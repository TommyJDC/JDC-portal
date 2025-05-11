import { json } from '@remix-run/node';
import type { ActionFunctionArgs } from '@remix-run/node';
// import { authenticator } from '~/services/auth.server'; // Plus utilisé directement
import { sessionStorage, type UserSessionData } from "~/services/session.server"; // Importer sessionStorage et UserSessionData
import { getUserProfileSdk } from '~/services/firestore.service.server';

// Cette route est destinée à réinitialiser ou recalculer les statistiques via une action POST
export async function action({ request }: ActionFunctionArgs) {
  try {
    if (request.method !== 'POST') {
      return json({ error: "Méthode non autorisée" }, { status: 405 });
    }

    // Mode développement - vérifions s'il y a un paramètre de bypass
    const url = new URL(request.url);
    const devBypass = url.searchParams.get("dev_bypass") === "true";

    // Vérifier l'authentification
    const session = await sessionStorage.getSession(request.headers.get("Cookie"));
    const userSession: UserSessionData | null = session.get("user") ?? null;

    if (!userSession && !devBypass) {
      console.log("[api.admin.stats.reset] Authentification échouée (session manuelle)");
      return json({ error: "Non authentifié" }, { status: 401 });
    }

    // En mode bypass ou avec un utilisateur authentifié
    if (userSession) {
      // Vérifier les permissions admin
      const userProfile = await getUserProfileSdk(userSession.userId);
      if (!userProfile || userProfile.role?.toLowerCase() !== 'admin') {
        console.log("[api.admin.stats.reset] Permissions insuffisantes pour", userSession.userId);
        return json({ error: "Permissions insuffisantes" }, { status: 403 });
      }
    } else if (devBypass) { // Si devBypass est true et userSession est null
      console.log("[api.admin.stats.reset] Mode bypass développement activé");
    } else {
      // Ce cas ne devrait pas être atteint
      console.log("[api.admin.stats.reset] Accès non autorisé (ni session, ni bypass)");
      return json({ error: "Accès non autorisé" }, { status: 401 });
    }

    // Dans une vraie implémentation, cette section pourrait:
    // 1. Réinitialiser une cache de statistiques 
    // 2. Recalculer des agrégations
    // 3. Lancer un job asynchrone pour mettre à jour les statistiques
    // 4. etc.
    
    console.log("[api.admin.stats.reset] Réinitialisation des statistiques demandée", userSession?.userId || "mode bypass");
    
    // Simuler un délai pour une tâche de fond
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return json({ 
      success: true, 
      message: "Réinitialisation des statistiques initiée avec succès" 
    });
  } catch (error) {
    console.error("Erreur de réinitialisation des statistiques:", error);
    return json({ 
      error: "Erreur lors de la réinitialisation des statistiques" 
    }, { status: 500 });
  }
}
