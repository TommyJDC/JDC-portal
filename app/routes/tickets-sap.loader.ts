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

            const sectorsToQuery = userProfile.secteurs ?? [];
            if (sectorsToQuery.length === 0) {
                console.warn(`Tickets SAP Loader: User ${session.userId} (Role: ${userProfile.role}) has no sectors assigned.`);
                // Return empty tickets but profile is still valid
            } else {
                console.log(`Tickets SAP Loader: Fetching tickets for sectors: ${sectorsToQuery.join(', ')}`);
                const fetchedTickets = await getAllTicketsForSectorsSdk(sectorsToQuery);
                // Filter out tickets without raisonSociale on the server
                allTickets = fetchedTickets.filter(t => t.raisonSociale);
                console.log(`Tickets SAP Loader: Fetched ${allTickets.length} tickets with raisonSociale.`);
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
