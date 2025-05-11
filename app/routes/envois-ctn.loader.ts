import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
// import { authenticator } from "~/services/auth.server"; // Plus utilisé directement
import { sessionStorage, type UserSessionData } from "~/services/session.server"; // Importer pour session manuelle
import { getAllShipments, getUserProfileSdk } from "~/services/firestore.service.server";
import type { Shipment, UserProfile } from "~/types/firestore.types";
// import type { UserSession } from "~/services/session.server"; // Remplacé par UserSessionData

export interface EnvoisCtnLoaderData {
    userProfile: UserProfile | null;
    allShipments: Shipment[];
    error: string | null;
}

export const loader = async ({ request }: LoaderFunctionArgs): Promise<ReturnType<typeof json<EnvoisCtnLoaderData>>> => {
    const sessionCookie = request.headers.get("Cookie");
    const sessionStore = await sessionStorage.getSession(sessionCookie);
    const userSession: UserSessionData | null = sessionStore.get("user") ?? null;

    if (!userSession?.userId) {
        return json({ userProfile: null, allShipments: [], error: "Utilisateur non authentifié." });
    }

    let userProfile: UserProfile | null = null;
    let allShipments: Shipment[] = [];
    let error: string | null = null;

    try {
        userProfile = await getUserProfileSdk(userSession.userId); // Utiliser userSession.userId
        if (!userProfile) {
            throw new Error("Profil utilisateur introuvable.");
        }

        const userSectors = userProfile.secteurs || [];
        const isAdmin = userProfile.role === 'Admin';

        if (!isAdmin && (!userSectors || userSectors.length === 0)) {
            throw new Error("Aucun secteur défini pour cet utilisateur.");
        }

        // Utiliser les noms exacts des secteurs
        const sectorsToQuery = isAdmin 
            ? ['CHR', 'HACCP', 'Kezia', 'Tabac']
            : userSectors;

        allShipments = await getAllShipments(sectorsToQuery);

    } catch (err: any) {
        error = `Erreur de chargement des données: ${err.message || String(err)}`;
        userProfile = null;
        allShipments = [];
    }

    return json({ userProfile, allShipments, error });
};
