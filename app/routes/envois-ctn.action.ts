import type { ActionFunctionArgs } from "@remix-run/node";
    import { json } from "@remix-run/node";
    import { authenticator } from "~/services/auth.server";
    import { deleteShipmentSdk, getUserProfileSdk } from "~/services/firestore.service.server"; // Need profile to check admin
    import type { UserSession } from "~/services/session.server";

    export async function action({ request }: ActionFunctionArgs) {
        const session: UserSession | null = await authenticator.isAuthenticated(request);

        if (!session?.userId) {
            return json({ success: false, error: "Non authentifié." }, { status: 401 });
        }

        let isAdmin = false;
        try {
            // Fetch profile within the action to ensure up-to-date permissions
            const profile = await getUserProfileSdk(session.userId);
            isAdmin = profile?.role === 'Admin';
        } catch (e) {
             console.error("Error fetching profile in envois-ctn action:", e);
             return json({ success: false, error: "Impossible de vérifier les permissions." }, { status: 500 });
        }

        const formData = await request.formData();
        const intent = formData.get("intent");

        if (intent === "delete_group") {
            if (!isAdmin) {
                return json({ success: false, error: "Permissions insuffisantes pour supprimer un groupe." }, { status: 403 });
            }

            const shipmentIdsString = formData.get("shipmentIds");
            if (!shipmentIdsString || typeof shipmentIdsString !== 'string') {
                 return json({ success: false, error: "IDs d'envoi manquants ou invalides." }, { status: 400 });
            }

            const shipmentIds = shipmentIdsString.split(',').filter(id => id.trim() !== ''); // Filter empty strings
            if (shipmentIds.length === 0) {
                 return json({ success: false, error: "Aucun ID d'envoi valide fourni." }, { status: 400 });
            }

            console.log(`Action: Attempting to delete ${shipmentIds.length} shipments...`);
            const deletePromises = shipmentIds.map(id => deleteShipmentSdk(id));
            const results = await Promise.allSettled(deletePromises);

            const successfulDeletes = results.filter(r => r.status === 'fulfilled').length;
            const failedDeletes = results.filter(r => r.status === 'rejected').length;
            let errorMessage = null;

            if (failedDeletes > 0) {
                console.error(`Failed to delete ${failedDeletes} shipments.`);
                errorMessage = `Erreur lors de la suppression de ${failedDeletes} envoi${failedDeletes > 1 ? 's' : ''}.`;
                // Optionally log more details from rejected reasons
                 results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
                        .forEach(r => console.error("Deletion error detail:", r.reason));
            }

            if (successfulDeletes > 0) {
                 const successMessage = `${successfulDeletes} envoi${successfulDeletes > 1 ? 's' : ''} supprimé${successfulDeletes > 1 ? 's' : ''}.`;
                 return json({ success: true, message: errorMessage ? `${successMessage} ${errorMessage}` : successMessage });
            } else {
                 // Only failures occurred
                 return json({ success: false, error: errorMessage ?? "Échec de la suppression des envois." }, { status: 500 });
            }

        } else {
            return json({ success: false, error: "Action non reconnue." }, { status: 400 });
        }
    }
