import type { LoaderFunctionArgs } from "@remix-run/node";
    import { json } from "@remix-run/node";
    import { authenticator } from "~/services/auth.server";
    import { getUserProfileSdk, getAllTicketsForSectorsSdk } from "~/services/firestore.service.server";
import type { SapTicket, UserProfile } from "~/types/firestore.types";
    import type { UserSession } from "~/services/session.server";
    import { convertFirestoreDate } from "~/utils/dateUtils";

    export interface TicketsSapLoaderData {
        userProfile: UserProfile | null;
        allTickets: SapTicket[];
        error: string | null;
    }

    export const loader = async ({ request }: LoaderFunctionArgs): Promise<ReturnType<typeof json<TicketsSapLoaderData>>> => {
        const session: UserSession | null = await authenticator.isAuthenticated(request);
        const url = new URL(request.url);
        const selectedSectorParam = url.searchParams.get("sector");

        if (!session?.userId) {
            return json({ userProfile: null, allTickets: [], error: "Utilisateur non authentifié." });
        }

        let userProfile: UserProfile | null = null;
        let allTickets: SapTicket[] = [];
        let error: string | null = null;

        try {
            userProfile = await getUserProfileSdk(session.userId);
            if (!userProfile) {
                throw new Error("Profil utilisateur introuvable.");
            }

            // Déterminer les secteurs à interroger
            let sectorsToQuery: string[] = [];
            if (userProfile.role === 'Admin') {
                // Si Admin et un secteur est sélectionné dans l'URL, interroger uniquement ce secteur
                if (selectedSectorParam && selectedSectorParam !== '') {
                    sectorsToQuery = [selectedSectorParam];
                    console.log(`Tickets SAP Loader: Admin user requesting specific sector: ${selectedSectorParam}`);
                } else {
                    // Si Admin et aucun secteur n'est sélectionné, interroger tous les secteurs
                    sectorsToQuery = ['CHR', 'HACCP', 'Kezia', 'Tabac'];
                    console.log(`Tickets SAP Loader: Admin user requesting all sectors.`);
                }
            } else {
                // Pour les non-admins, interroger uniquement leurs secteurs assignés
                sectorsToQuery = userProfile.secteurs ?? [];
                 // Si un secteur est sélectionné dans l'URL et qu'il fait partie des secteurs assignés,
                 // on peut potentiellement affiner la requête, mais pour l'instant, on se base sur les secteurs assignés.
                 // Le filtrage par selectedSectorParam sera fait côté client si nécessaire,
                 // mais idéalement, getAllTicketsForSectorsSdk devrait gérer une liste de secteurs.
                 // On s'assure que le secteur demandé est bien dans les secteurs de l'utilisateur si non-admin
                 if (selectedSectorParam && selectedSectorParam !== '' && sectorsToQuery.includes(selectedSectorParam)) {
                     sectorsToQuery = [selectedSectorParam];
                     console.log(`Tickets SAP Loader: Non-admin user requesting specific assigned sector: ${selectedSectorParam}`);
                 } else if (selectedSectorParam && selectedSectorParam !== '' && !sectorsToQuery.includes(selectedSectorParam)) {
                      console.warn(`Tickets SAP Loader: Non-admin user ${session.userId} requested sector ${selectedSectorParam} which is not assigned. Loading all assigned sectors.`);
                      // sectorsToQuery reste userProfile.secteurs
                 } else {
                      console.log(`Tickets SAP Loader: Non-admin user ${session.userId} requesting all assigned sectors: ${sectorsToQuery.join(', ')}`);
                 }
            }


            if (sectorsToQuery.length === 0) {
                console.warn(`Tickets SAP Loader: User ${session.userId} (Role: ${userProfile.role}) has no sectors assigned or no valid sector requested.`);
                // allTickets reste []
            } else {
                console.log(`Tickets SAP Loader: Final sectors to query: ${sectorsToQuery.join(', ')}`);
                const fetchedTickets = await getAllTicketsForSectorsSdk(sectorsToQuery);
                console.log(`Tickets SAP Loader: Fetched ${fetchedTickets.length} tickets.`);
                // Filter out tickets without raisonSociale and ensure dates in contactAttempts are Date objects
                allTickets = fetchedTickets
                    .filter(t => t.raisonSociale)
                    .map(ticket => {
                        const processedTicket: SapTicket = {
                            ...ticket,
                            // Ensure date is a Date object
                            date: convertFirestoreDate(ticket.date),
                            // Ensure dates in contactAttempts are Date objects
                            contactAttempts: ticket.contactAttempts?.map(attempt => ({
                                ...attempt,
                                date: convertFirestoreDate(attempt.date)
                            }))
                        };
                        return processedTicket;
                    });
                console.log(`Tickets SAP Loader: Processed ${allTickets.length} tickets with raisonSociale.`);
                console.log('Sample ticket dates (value and type):');
                allTickets.slice(0, 5).forEach((ticket, index) => {
                    console.log(`  Ticket ${index}: value =`, ticket.date, `, type =`, typeof ticket.date, `, instanceof Date =`, ticket.date instanceof Date);
                });
            }

        } catch (err: any) {
            console.error("Error fetching data for Tickets SAP loader:", err);
            error = `Erreur de chargement des données: ${err.message || String(err)}`;
            userProfile = null; // Reset profile if fetch failed
            allTickets = [];
        }

        // IMPORTANT: Dates are automatically serialized by json()
        return json({ userProfile, allTickets, error });
    };
