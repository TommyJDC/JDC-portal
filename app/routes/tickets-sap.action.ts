import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticator } from "~/services/auth.server";
import { updateSAPTICKET, archiveSapTicket, getUserProfileSdk, deleteSapTicket } from "~/services/firestore.service.server"; // Import archiveSapTicket, getUserProfileSdk, and deleteSapTicket
import type { UserProfile, SapTicket, GmailProcessingConfig } from "~/types/firestore.types"; // Import UserProfile, SapTicket, GmailProcessingConfig
import type { UserSession } from "~/services/session.server"; // Import UserSession
import { getGoogleAuthClient } from "~/services/google.server"; // Import getGoogleAuthClient
import { sendSAPResponseEmail, applyGmailLabel } from "~/services/gmail.service.server"; // Import Gmail service functions
import { initializeFirebaseAdmin } from "~/firebase.admin.config.server"; // Import initializeFirebaseAdmin
import { generateAISummary as generateAISummaryService } from "~/services/ai.service.server"; // Import the AI service function

// Simple cache to prevent duplicate email sending on rapid consecutive requests
const recentEmailSent: { [ticketId: string]: number } = {};
const EMAIL_COOLDOWN_MS = 5000; // 5 seconds cooldown

export async function action({ request }: ActionFunctionArgs) {
    const session: UserSession | null = await authenticator.isAuthenticated(request);

    if (!session?.userId) {
        return json({ success: false, error: "Non authentifié." }, { status: 401 });
    }

    // Get Google Auth Client for the authenticated user
    const authClient = await getGoogleAuthClient(session);

    if (!authClient) {
        return json({ success: false, error: "Client Google non disponible pour l'utilisateur authentifié." }, { status: 401 });
    }

    // Get the authenticated user's profile
    const userProfile = await getUserProfileSdk(session.userId);

    if (!userProfile) {
        return json({ success: false, error: "Profil utilisateur introuvable." }, { status: 404 });
    }

    const formData = await request.formData();
    const intent = formData.get("intent") as string;
    const sectorId = formData.get("sectorId") as string;
    const ticketId = formData.get("ticketId") as string;

    if (!sectorId || !ticketId) {
        return json({ success: false, error: "ID de secteur ou de ticket manquant." }, { status: 400 });
    }

    try {
        // Fetch ticket details
        const dbAdmin = await initializeFirebaseAdmin();
        const ticketRef = dbAdmin.collection(sectorId).doc(ticketId);
        const ticketDoc = await ticketRef.get();
        if (!ticketDoc.exists) {
            return json({ success: false, error: "Ticket introuvable." }, { status: 404 });
        }

        // Get ticket data and ensure required fields
        const ticket = {
            id: ticketDoc.id,
            secteur: sectorId as 'CHR' | 'HACCP' | 'Kezia' | 'Tabac', // Assurer le type correct
            ...ticketDoc.data()
        } as SapTicket;

        // Retrieve global Gmail config
        const configDoc = await dbAdmin.collection('settings').doc('gmailProcessingConfig').get();
        const gmailConfig = configDoc.exists ? configDoc.data() as GmailProcessingConfig : null;

        if (!gmailConfig) {
            console.warn("Gmail processing global config not found.");
        }

        if (intent === "update_status") {
            const newStatus = formData.get("status") as SapTicket['status'];
            const technicianNotes = formData.get("technicianNotes") as string | undefined;
            const materialType = formData.get("materialType") as SapTicket['materialType'] | undefined;
            const materialDetails = formData.get("materialDetails") as string | undefined;

            if (!newStatus) {
                return json({ success: false, error: "Nouveau statut manquant." }, { status: 400 });
            }

            const updateData: Partial<SapTicket> = {
                status: newStatus,
                statutSAP: newStatus,
                technicianNotes: technicianNotes,
                materialType: materialType,
                materialDetails: materialDetails,
            };

            let emailContent = '';
            let gmailLabel = '';
            switch (newStatus) {
                case 'closed':
                    if (!technicianNotes) {
                        return json({ success: false, error: "Notes du technicien manquantes pour clôture." }, { status: 400 });
                    }
                    try {
                        const closurePrompt = `Generate a summary for ticket ${ticket.numeroSAP?.stringValue} (Closure).
Veuillez structurer la réponse en utilisant le format HTML. Utilisez des balises HTML pour structurer le contenu (par exemple, <p>, <br>, <strong>, <ul>, <li>). Incluez des emojis pertinents pour rendre le message plus convivial. Soignez la mise en page pour une meilleure lisibilité.`;
                        updateData.aiSummary = await generateAISummaryService(authClient, ticket, technicianNotes, 'CLOSURE', closurePrompt);
                        emailContent = updateData.aiSummary;
                        gmailLabel = userProfile?.labelSapClosed || '';
                    } catch (aiError: any) {
                        console.error(`Error generating AI summary for closure ticket ${ticketId}:`, aiError);
                        updateData.aiSummary = `[Échec de la génération du résumé AI pour clôture] ${technicianNotes}`;
                        emailContent = updateData.aiSummary;
                        gmailLabel = userProfile?.labelSapClosed || '';
                        // archiveTicket = true; // Variable non utilisée, supprimée
                    }
                    break;

                case 'pending':
                    const newAttempt = {
                        date: new Date(),
                        method: 'phone' as 'phone',
                        success: false
                    };
                    updateData.contactAttempts = Array.isArray(ticket.contactAttempts) ? [...ticket.contactAttempts, newAttempt] : [newAttempt];

                    try {
                        const noResponsePrompt = `Generate a summary for ticket ${ticket.numeroSAP?.stringValue} (No Response).
Veuillez structurer la réponse en utilisant le format HTML. Utilisez des balises HTML pour structurer le contenu (par exemple, <p>, <br>, <strong>, <ul>, <li>). Incluez des emojis pertinents pour rendre le message plus convivial. Soignez la mise en page pour une meilleure lisibilité.`;
                        updateData.aiSummary = await generateAISummaryService(authClient, ticket, technicianNotes, 'NO_RESPONSE', noResponsePrompt);
                        emailContent = updateData.aiSummary;
                        gmailLabel = userProfile?.labelSapNoResponse || '';
                    } catch (aiError: any) {
                        console.error(`Error generating AI summary for no response ticket ${ticketId}:`, aiError);
                        updateData.aiSummary = `[Échec de la génération du résumé AI pour non réponse] ${technicianNotes || ''}`;
                        emailContent = updateData.aiSummary;
                        gmailLabel = userProfile?.labelSapNoResponse || '';
                    }
                    break;

                case 'rma_request':
                    if (!materialType || !materialDetails || !technicianNotes) {
                        return json({ success: false, error: "Type de matériel, détails du matériel ou notes du technicien manquants pour une demande de RMA." }, { status: 400 });
                    }
                    try {
                        const prompt = `Generate a summary for ticket ${ticket.numeroSAP?.stringValue} (RMA Request).`;
                        const fullPrompt = `${prompt}\nTechnician notes: ${technicianNotes}\nMaterial details: ${materialDetails}
Veuillez structurer la réponse en utilisant le format HTML. Utilisez des balises HTML pour structurer le contenu (par exemple, <p>, <br>, <strong>, <ul>, <li>). Incluez des emojis pertinents pour rendre le message plus convivial. Soignez la mise en page pour une meilleure lisibilité.`;
                        updateData.aiSummary = await generateAISummaryService(authClient, ticket, technicianNotes, 'RMA', fullPrompt);
                        emailContent = updateData.aiSummary;
                        gmailLabel = userProfile?.labelSapRma || '';
                    } catch (aiError: any) {
                        console.error(`Error generating AI summary for RMA request ticket ${ticketId}:`, aiError);
                        updateData.aiSummary = `[Échec de la génération du résumé AI pour RMA] Notes: ${technicianNotes}, Matériel: ${materialDetails}`;
                        emailContent = updateData.aiSummary;
                        gmailLabel = userProfile?.labelSapRma || '';
                    }
                    break;

                case 'material_sent':
                    if (!materialType || !materialDetails || !technicianNotes) {
                        return json({ success: false, error: "Type de matériel, détails du matériel ou notes du technicien manquants pour un envoi de matériel." }, { status: 400 });
                    }
                    try {
                        const prompt = `Generate a summary for ticket ${ticket.numeroSAP?.stringValue} (Material Sent).`;
                        const fullPrompt = `${prompt}\nTechnician notes: ${technicianNotes}\nMaterial details: ${materialDetails}
Veuillez structurer la réponse en utilisant le format HTML. Utilisez des balises HTML pour structurer le contenu (par exemple, <p>, <br>, <strong>, <ul>, <li>). Incluez des emojis pertinents pour rendre le message plus convivial. Soignez la mise en page pour une meilleure lisibilité.`;
                        updateData.aiSummary = await generateAISummaryService(authClient, ticket, technicianNotes, 'RMA', fullPrompt);
                        emailContent = updateData.aiSummary;
                        gmailLabel = userProfile?.labelSapRma || '';
                    } catch (aiError: any) {
                        console.error(`Error generating AI summary for Material Sent ticket ${ticketId}:`, aiError);
                        updateData.aiSummary = `[Échec de la génération du résumé AI pour Envoi Matériel] Notes: ${technicianNotes}, Matériel: ${materialDetails}`;
                        emailContent = updateData.aiSummary;
                        gmailLabel = userProfile?.labelSapRma || '';
                    }
                    break;

                case 'archived':
                    return json({ success: false, error: "Archivage via statut non supporté." }, { status: 400 });

                default:
                    break;
            }

            // Update ticket in Firestore
            await updateSAPTICKET(sectorId, ticketId, updateData);

            // Send email if content is generated and mailId exists
            if (emailContent && ticket.mailId && authClient) {
                try {
                    const sentMessageId = await sendSAPResponseEmail(
                        authClient,
                        ticket, // Passer l'objet ticket complet
                        `Réponse concernant votre ticket SAP ${ticket.numeroSAP?.stringValue}`,
                        emailContent,
                        newStatus === 'rma_request' || newStatus === 'material_sent' ? 'RMA' : undefined
                    );

                    if (gmailLabel && sentMessageId && ticket.mailThreadId) { // Vérifier si mailThreadId existe
                        await applyGmailLabel(authClient, ticket.mailThreadId, gmailLabel);
                    } else if (gmailLabel && sentMessageId) {
                         console.warn(`[tickets-sap.action] mailThreadId is undefined for ticket ${ticketId}. Cannot apply label.`);
                    }
                    console.log(`Email response sent for ticket ${ticketId}`);
                } catch (emailError: any) {
                    console.error(`Error sending email for ticket ${ticketId}:`, emailError);
                }
            }

            // Handle archiving for closed tickets
            if (newStatus === 'closed') {
                try {
                    // Pass technicianNotes and userProfile.displayName to archiveSapTicket
                    await archiveSapTicket(ticket, technicianNotes, userProfile.displayName);
                    console.log(`Ticket ${ticketId} archived successfully.`);
                } catch (archiveError: any) {
                    console.error(`Error archiving ticket ${ticketId}:`, archiveError);
                    return json({
                        success: false,
                        error: `Échec de l'archivage : ${archiveError.message}`
                    }, { status: 500 });
                }
            }


            return json({ success: true, message: `Statut mis à jour vers "${newStatus}".` });

        } else if (intent === "delete_ticket") {
            // No additional data needed for deletion, sectorId and ticketId are already available
            try {
                await deleteSapTicket(sectorId, ticketId);
                console.log(`Ticket ${ticketId} deleted successfully.`);
                return json({ success: true, message: "Ticket supprimé." });
            } catch (deleteError: any) {
                console.error(`Error deleting ticket ${ticketId}:`, deleteError);
                return json({ success: false, error: deleteError.message || "Échec de la suppression du ticket." }, { status: 500 });
            }

        } else if (intent === "add_comment") {
            const newComment = formData.get("comment") as string;
            const existingCommentsString = formData.get("existingComments") as string;
            
            if (!newComment) {
                return json({ success: false, error: "Commentaire vide." }, { status: 400 });
            }

            let existingComments: string[] = [];
            try {
                if (existingCommentsString) {
                    existingComments = JSON.parse(existingCommentsString);
                }
            } catch (e) {
                console.error("Failed to parse existing comments:", e);
            }

            const updatedComments = [newComment, ...existingComments];
            await updateSAPTICKET(sectorId, ticketId, { commentaires: updatedComments });
            return json({ success: true, message: "Commentaire ajouté." });

        } else if (intent === "save_summary") {
            const summary = formData.get("summary") as string;
            if (summary === null || summary === undefined) {
                return json({ success: false, error: "Résumé manquant." }, { status: 400 });
            }
            await updateSAPTICKET(sectorId, ticketId, { summary: summary });
            return json({ success: true, message: "Résumé sauvegardé." });

        } else if (intent === "save_solution") {
            const solution = formData.get("solution") as string;
            if (solution === null || solution === undefined) {
                return json({ success: false, error: "Solution manquante." }, { status: 400 });
            }
            await updateSAPTICKET(sectorId, ticketId, { solution: solution });
            return json({ success: true, message: "Solution sauvegardée." });

        } else {
            return json({ success: false, error: "Action non reconnue." }, { status: 400 });
        }
    } catch (error: any) {
        console.error(`Error processing intent ${intent} for ticket ${ticketId}:`, error);
        return json({ success: false, error: error.message || "Échec de la mise à jour du ticket." }, { status: 500 });
    }
}
