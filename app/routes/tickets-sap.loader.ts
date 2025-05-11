import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
// import { authenticator } from "~/services/auth.server"; // Plus utilisé
import { getUserProfileSdk, getAllTicketsForSectorsSdk } from "~/services/firestore.service.server";
import type { SapTicket, UserProfile } from "~/types/firestore.types";
import { sessionStorage, type UserSessionData } from "~/services/session.server"; // Importer UserSessionData
import { convertFirestoreDate } from "~/utils/dateUtils";

export interface TicketsSapLoaderData {
    userProfile: UserProfile | null;
    allTickets: SapTicket[];
    error: string | null;
}

export const loader = async ({ request }: LoaderFunctionArgs): Promise<ReturnType<typeof json<TicketsSapLoaderData>>> => {
    const cookieHeader = request.headers.get("Cookie");
    let userSession: UserSessionData | null = null;
    
    if (cookieHeader) {
        try {
            const sessionStore = await sessionStorage.getSession(cookieHeader);
            userSession = sessionStore.get("user") ?? null; // Lire l'objet UserSessionData sous la clé "user"
            if (userSession && userSession.userId) {
                console.log("Tickets SAP Loader: Session valide trouvée pour userId:", userSession.userId);
            } else {
                userSession = null; // S'assurer qu'il est null si userId est manquant
            }
        } catch (e) {
            console.error("Tickets SAP Loader: Erreur lors de la lecture de la session:", e);
            userSession = null;
        }
    }
    
    const url = new URL(request.url);
    const selectedSectorParam = url.searchParams.get("sector");

    if (!userSession?.userId) { // Vérifier userSession et userSession.userId
        return json({ userProfile: null, allTickets: [], error: "Utilisateur non authentifié." });
    }

    let userProfile: UserProfile | null = null;
    let allTickets: SapTicket[] = [];
    let error: string | null = null;

    try {
        userProfile = await getUserProfileSdk(userSession.userId); // Utiliser userSession.userId
        if (!userProfile) {
            throw new Error("Profil utilisateur introuvable.");
        }

        // Déterminer les secteurs à interroger
        let sectorsToQuery: string[] = [];
        if (userProfile.role === 'Admin') {
            if (selectedSectorParam && selectedSectorParam !== '') {
                sectorsToQuery = [selectedSectorParam];
                console.log(`Tickets SAP Loader: Admin user requesting specific sector: ${selectedSectorParam}`);
            } else {
                sectorsToQuery = ['CHR', 'HACCP', 'Kezia', 'Tabac'];
                console.log(`Tickets SAP Loader: Admin user requesting all sectors.`);
            }
        } else {
            sectorsToQuery = userProfile.secteurs ?? [];
             if (selectedSectorParam && selectedSectorParam !== '' && sectorsToQuery.includes(selectedSectorParam)) {
                 sectorsToQuery = [selectedSectorParam];
                 console.log(`Tickets SAP Loader: Non-admin user requesting specific assigned sector: ${selectedSectorParam}`);
             } else if (selectedSectorParam && selectedSectorParam !== '' && !sectorsToQuery.includes(selectedSectorParam)) {
                  console.warn(`Tickets SAP Loader: Non-admin user ${userSession.userId} requested sector ${selectedSectorParam} which is not assigned. Loading all assigned sectors.`);
             } else {
                  console.log(`Tickets SAP Loader: Non-admin user ${userSession.userId} requesting all assigned sectors: ${sectorsToQuery.join(', ')}`);
             }
        }

        if (sectorsToQuery.length === 0 && userProfile.role !== 'Admin') { // Les admins peuvent voir tous les secteurs même si aucun n'est explicitement sélectionné
            console.log(`Tickets SAP Loader: User ${userSession.userId} has no assigned sectors or no valid sector selected.`);
            // Retourner le profil mais pas de tickets si aucun secteur n'est applicable
            return json({ userProfile, allTickets: [], error: "Aucun secteur applicable pour afficher les tickets." });
        }
        
        // Si sectorsToQuery est vide pour un admin (aucun secteur sélectionné), cela signifie "tous les secteurs"
        // getAllTicketsForSectorsSdk devrait gérer une liste vide comme "tous les secteurs pertinents pour un admin" ou être appelé avec la liste complète.
        // La logique actuelle assigne ['CHR', 'HACCP', 'Kezia', 'Tabac'] si admin et pas de selectedSectorParam.

        console.log(`Tickets SAP Loader: Fetching tickets for sectors: ${sectorsToQuery.join(', ')}`);
        const tickets = await getAllTicketsForSectorsSdk(sectorsToQuery);

        allTickets = tickets.map(ticket => ({
            ...ticket,
            date: convertFirestoreDate(ticket.date)
        }));
        
        console.log(`Tickets SAP Loader: Found ${allTickets.length} tickets.`);
    } catch (err: any) {
        console.error("Error fetching data for Tickets SAP loader:", err);
        error = `Erreur de chargement des données: ${err.message || String(err)}`;
        // Ne pas réinitialiser userProfile ici, car il pourrait être valide même si la récupération des tickets échoue
        allTickets = [];
    }

    return json({ userProfile, allTickets, error });
};
