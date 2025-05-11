import { json } from '@remix-run/node';
import type { LoaderFunctionArgs } from '@remix-run/node';
// import { authenticator } from '~/services/auth.server'; // Plus utilisé directement
import { sessionStorage, type UserSessionData } from "~/services/session.server"; // Importer pour session manuelle
// import { getRealNotificationIds } from '~/services/blockchain.service.server'; // Supprimé car spécifique à la blockchain

/**
 * API pour diagnostiquer les problèmes avec les IDs de notifications (Adapté pour Firestore)
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Mode développement - vérifier s'il y a un paramètre de bypass
    const url = new URL(request.url);
    const devBypass = url.searchParams.get("dev_bypass") === "true";
    
    // Vérifier l'authentification
    const session = await sessionStorage.getSession(request.headers.get("Cookie"));
    const userSession: UserSessionData | null = session.get("user") ?? null;

    if (!userSession && !devBypass) {
      return json({ error: "Non authentifié (session manuelle)" }, { status: 401 });
    }
    
    if (devBypass && !userSession) {
        console.log("[api.notifications.diagnostics] Mode bypass activé sans session utilisateur.");
    } else if (userSession) {
        console.log(`[api.notifications.diagnostics] Utilisateur authentifié: ${userSession.userId}`);
    }

    console.log("[api.notifications.diagnostics] Accès à la route de diagnostic des notifications.");
    
    // Puisque la gestion des notifications est maintenant sur Firestore,
    // les diagnostics spécifiques aux ID de la blockchain ne sont plus pertinents.
    // Cette route pourrait être adaptée pour diagnostiquer les notifications Firestore si nécessaire.
    // Pour l'instant, elle retourne un message indiquant ce changement.
    
    return json({
      success: true,
      message: "Les diagnostics spécifiques aux ID de notifications blockchain ne sont plus applicables. Les notifications sont gérées via Firestore.",
      data: {
        timestamp: new Date().toISOString(),
        status: "Firestore_Mode"
      }
    });
    
  } catch (error) {
    // Erreur générale si l'authentification ou autre chose échoue avant le retour principal
    console.error("[api.notifications.diagnostics] Erreur critique:", error);
    return json({ 
      error: "Erreur serveur",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
