import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticator } from "~/services/auth.server";
import { getGoogleAuthClient } from "~/services/google.server";
import { processGmailToFirestore } from "~/services/gmail.service.server";
import { getUserProfileSdk, getAllUserProfilesSdk } from "~/services/firestore.service.server";
import { dbAdmin } from "~/firebase.admin.config.server";
import type { GmailProcessingConfig, UserProfile } from "~/types/firestore.types";
import type { UserSession } from "~/services/session.server";

/**
 * Action qui traite les emails Gmail pour tous les utilisateurs processeurs actifs
 * Cette route peut être appelée manuellement ou via un planificateur de tâches
 */
export async function action({ request }: ActionFunctionArgs) {
  try {
    // Vérifier le secret pour les appels planifiés
    const scheduledSecret = request.headers.get('x-scheduled-secret');
    const isScheduledCall = scheduledSecret === process.env.SCHEDULED_TASK_SECRET;

    // Si ce n'est pas un appel planifié, vérifier l'authentification admin
    if (!isScheduledCall) {
      const session = await authenticator.isAuthenticated(request);
      if (!session) {
        return json({ success: false, error: "Non authentifié" }, { status: 401 });
      }

      const userProfile = await getUserProfileSdk(session.userId);
      if (!userProfile || userProfile.role !== "Admin") {
        return json({ success: false, error: "Accès non autorisé. Rôle Admin requis." }, { status: 403 });
      }
    }

    // Récupérer la configuration Gmail
    const configDoc = await dbAdmin.collection('settings').doc('gmailProcessingConfig').get();
    const config = configDoc.exists ? configDoc.data() as GmailProcessingConfig : {
      maxEmailsPerRun: 50,
      targetLabels: [],
      processedLabelName: "Traité",
      refreshInterval: 5 // Par défaut, vérification toutes les 5 minutes
    };

    // Récupérer tous les utilisateurs processeurs actifs
    const users = await getAllUserProfilesSdk();
    const activeProcessors = users.filter(user => 
      user.isGmailProcessor && 
      user.googleRefreshToken && 
      user.gmailAuthStatus === 'active'
    );

    if (activeProcessors.length === 0) {
      return json({ 
        success: false, 
        error: "Aucun processeur Gmail actif trouvé" 
      }, { status: 400 });
    }

    // Traiter les emails pour chaque processeur actif
    const results = await Promise.all(activeProcessors.map(async (user) => {
      try {
        const session: UserSession = {
          userId: user.uid,
          email: user.email,
          displayName: user.displayName,
          googleRefreshToken: user.googleRefreshToken
        };

        const authClient = await getGoogleAuthClient(session);
        if (!authClient) {
          throw new Error(`Impossible d'obtenir le client Google pour ${user.email}`);
        }

        await processGmailToFirestore(authClient, config);
        return { email: user.email, success: true };
      } catch (error) {
        console.error(`Erreur pour ${user.email}:`, error);
        return { 
          email: user.email, 
          success: false, 
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }));

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    return json({ 
      success: true, 
      message: `Traitement terminé. Succès: ${successCount}, Échecs: ${failureCount}`,
      details: results
    });
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
