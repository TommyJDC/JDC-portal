import type { LoaderFunctionArgs } from "@remix-run/node";
    import { json } from "@remix-run/node";
    import { authenticator } from "~/services/auth.server";
    import { getUserProfileSdk, getAllTicketsForSectorsSdk } from "~/services/firestore.service.server";
    import type { SapTicket, UserProfile } from "~/types/firestore.types";
    import type { UserSession } from "~/services/session.server";

    export interface TicketsSapLoaderData {
        userProfile: UserProfile | null;
        allTickets: SapTicket[];
        error: string | null;
    }

    export const loader = async ({ request }: LoaderFunctionArgs): Promise<ReturnType<typeof json<TicketsSapLoaderData>>> => {
        const session: UserSession | null = await authenticator.isAuthenticated(request);

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

            // Déterminer les secteurs à interroger en fonction du rôle de l'utilisateur
            const sectorsToQuery = userProfile.role === 'Admin' 
                ? ['CHR', 'HACCP', 'Kezia', 'Tabac'] // Admins voient tous les secteurs
                : userProfile.secteurs ?? []; // Autres utilisateurs voient leurs secteurs définis

            if (sectorsToQuery.length === 0) {
                console.warn(`Tickets SAP Loader: User ${session.userId} (Role: ${userProfile.role}) has no sectors assigned or is not an Admin.`);
                // allTickets reste []
            } else {
                console.log(`Tickets SAP Loader: Fetching tickets for sectors: ${sectorsToQuery.join(', ')}`);
                const fetchedTickets = await getAllTicketsForSectorsSdk(sectorsToQuery);
                // Filter out tickets without raisonSociale on the server
                allTickets = fetchedTickets.filter(t => t.raisonSociale);
                console.log(`Tickets SAP Loader: Fetched ${fetchedTickets.length} tickets.`);
                // Filter out tickets without raisonSociale and ensure dates in contactAttempts are Date objects
                allTickets = fetchedTickets
                    .filter(t => t.raisonSociale)
                    .map(ticket => {
                        const processedTicket: SapTicket = {
                            ...ticket,
                            // Ensure date is a Date object
                            date: ticket.date instanceof Date || ticket.date === null ? ticket.date : new Date((ticket.date as any).seconds * 1000),
                            // Ensure dates in contactAttempts are Date objects
                            contactAttempts: ticket.contactAttempts?.map(attempt => ({
                                ...attempt,
                                date: attempt.date instanceof Date ? attempt.date : new Date((attempt.date as any).seconds * 1000)
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
