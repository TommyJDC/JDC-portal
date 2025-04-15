import type { ActionFunctionArgs } from "@remix-run/node";
    import { json } from "@remix-run/node";
    import { authenticator } from "~/services/auth.server";
    import { updateSAPTICKET } from "~/services/firestore.service.server";
    import type { UserSession } from "~/services/session.server";

    export async function action({ request }: ActionFunctionArgs) {
        const session: UserSession | null = await authenticator.isAuthenticated(request);

        if (!session?.userId) {
            return json({ success: false, error: "Non authentifié." }, { status: 401 });
        }

        const formData = await request.formData();
        const intent = formData.get("intent") as string;
        const sectorId = formData.get("sectorId") as string;
        const ticketId = formData.get("ticketId") as string;

        if (!sectorId || !ticketId) {
             return json({ success: false, error: "ID de secteur ou de ticket manquant." }, { status: 400 });
        }

        try {
            if (intent === "update_status") {
                const newStatus = formData.get("status") as string;
                if (!newStatus) {
                    return json({ success: false, error: "Nouveau statut manquant." }, { status: 400 });
                }
                await updateSAPTICKET(sectorId, ticketId, { statutSAP: newStatus });
                return json({ success: true, message: "Statut mis à jour." });

            } else if (intent === "add_comment") {
                const newComment = formData.get("comment") as string;
                const existingCommentsString = formData.get("existingComments") as string; // Pass existing comments as JSON string
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
                     // Decide how to handle: proceed with just the new comment or return error?
                     // Let's proceed with just the new comment for now.
                }
                const updatedComments = [newComment, ...existingComments];
                await updateSAPTICKET(sectorId, ticketId, { commentaires: updatedComments });
                return json({ success: true, message: "Commentaire ajouté." });

            } else if (intent === "save_summary") {
                 const summary = formData.get("summary") as string;
                 if (summary === null || summary === undefined) { // Allow empty string? Check requirements
                     return json({ success: false, error: "Résumé manquant." }, { status: 400 });
                 }
                 await updateSAPTICKET(sectorId, ticketId, { summary: summary });
                 return json({ success: true, message: "Résumé sauvegardé." });

            } else if (intent === "save_solution") {
                 const solution = formData.get("solution") as string;
                  if (solution === null || solution === undefined) { // Allow empty string? Check requirements
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
