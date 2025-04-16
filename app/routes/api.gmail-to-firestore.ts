import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticator } from "~/services/auth.server";
import { getGoogleAuthClient } from "~/services/google.server";
import { processGmailToFirestore } from "~/services/gmail.service.server";
import { getUserProfileSdk } from "~/services/firestore.service.server";

/**
 * Action qui traite les emails Gmail et les envoie à Firestore
 * Cette route peut être appelée manuellement ou via un planificateur de tâches
 */
export async function action({ request }: ActionFunctionArgs) {
  try {
    // Vérifier l'authentification
    const session = await authenticator.isAuthenticated(request);
    if (!session) {
      return json({ success: false, error: "Non authentifié" }, { status: 401 });
    }

    // Récupérer le profil utilisateur pour vérifier le rôle
    const userProfile = await getUserProfileSdk(session.userId);
    if (!userProfile || userProfile.role !== "Admin") {
      return json({ success: false, error: "Accès non autorisé. Rôle Admin requis." }, { status: 403 });
    }

    // Obtenir le client Google authentifié
    const authClient = await getGoogleAuthClient(session);
    if (!authClient) {
      return json({ success: false, error: "Impossible d'obtenir le client Google authentifié" }, { status: 500 });
    }

    // Traiter les emails et les envoyer à Firestore
    await processGmailToFirestore(authClient);

    return json({ success: true, message: "Traitement Gmail vers Firestore terminé avec succès" });
  } catch (error) {
    console.error("[API Gmail-to-Firestore] Erreur:", error);
    return json(
      { 
        success: false, 
        error: `Erreur lors du traitement: ${error instanceof Error ? error.message : String(error)}` 
      }, 
      { status: 500 }
    );
  }
}
