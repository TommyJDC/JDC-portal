import type { LoaderFunctionArgs } from "@remix-run/node";
    import { json } from "@remix-run/node";
    import { authenticator } from "~/services/auth.server";
    import { getAllShipments, getUserProfileSdk } from "~/services/firestore.service.server";
    import type { Shipment, UserProfile } from "~/types/firestore.types";
    import type { UserSession } from "~/services/session.server";

    export interface EnvoisCtnLoaderData {
        userProfile: UserProfile | null;
        allShipments: Shipment[];
        error: string | null;
    }

    export const loader = async ({ request }: LoaderFunctionArgs): Promise<ReturnType<typeof json<EnvoisCtnLoaderData>>> => {
        const session: UserSession | null = await authenticator.isAuthenticated(request);

        if (!session?.userId) {
            // Or redirect to login: throw redirect("/login");
            return json({ userProfile: null, allShipments: [], error: "Utilisateur non authentifié." });
        }

        let userProfile: UserProfile | null = null;
        let allShipments: Shipment[] = [];
        let error: string | null = null;

        try {
            userProfile = await getUserProfileSdk(session.userId);
            if (!userProfile) {
                throw new Error("Profil utilisateur introuvable.");
            }
            allShipments = await getAllShipments(userProfile);

        } catch (err: any) {
            console.error("Error fetching data for Envois CTN loader:", err);
            error = `Erreur de chargement des données: ${err.message || String(err)}`;
            // Reset data on error
            userProfile = null;
            allShipments = [];
        }

        return json({ userProfile, allShipments, error });
    };
