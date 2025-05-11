import { json } from '@remix-run/node';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
// import { authenticator } from '~/services/auth.server'; // Plus utilisé directement
import { sessionStorage, type UserSessionData } from "~/services/session.server"; // Importer sessionStorage et UserSessionData
import { 
  getUserProfileSdk,
  getSapTicketCountBySectorSdk,
  getDistinctClientCountFromEnvoiSdk,
  getAllUserProfilesSdk,
  getInstallationsSnapshot // Pour les stats d'installations
  // getAllRecentTransactions n'est plus utilisé
} from '~/services/firestore.service.server';
import type { UserProfile } from '~/types/firestore.types'; // Importer UserProfile
// import type { BlockchainTransaction } from '~/types/blockchain.types'; // Supprimé

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Mode développement - vérifions s'il y a un paramètre de bypass
    const url = new URL(request.url);
    const devBypass = url.searchParams.get("dev_bypass") === "true";

    // Vérifier l'authentification
    const session = await sessionStorage.getSession(request.headers.get("Cookie"));
    const userSession: UserSessionData | null = session.get("user") ?? null;
    
    if (!userSession && !devBypass) {
      console.log("[api.admin.stats] Authentification échouée (session manuelle)");
      return json({ error: "Non authentifié" }, { status: 401 });
    }

    // En mode bypass ou avec un utilisateur authentifié
    let userProfileData: UserProfile | null = null; // Type UserProfile pour userProfileData
    
    if (userSession) {
      // Vérifier les permissions admin pour un utilisateur authentifié
      userProfileData = await getUserProfileSdk(userSession.userId);
      if (!userProfileData || userProfileData.role?.toLowerCase() !== 'admin') {
        console.log("[api.admin.stats] Permissions insuffisantes pour", userSession.userId);
        return json({ error: "Permissions insuffisantes" }, { status: 403 });
      }
    } else if (devBypass) { // Si devBypass est true et userSession est null
      console.log("[api.admin.stats] Mode bypass développement activé");
      // En mode bypass, userProfileData restera null, ce qui est géré dans Promise.all
    } else {
       // Ce cas ne devrait pas être atteint
      console.log("[api.admin.stats] Accès non autorisé (ni session, ni bypass)");
      return json({ error: "Accès non autorisé" }, { status: 401 });
    }

    console.log("[api.admin.stats] Collecte des statistiques Firestore...");
    
    const allSectors = ['CHR', 'HACCP', 'Kezia', 'Tabac'];
    
    // Les statistiques de transactions blockchain ne sont plus pertinentes.
    // const transactionsByDay: Record<string, number> = {};
    // const eventTypes: Record<string, number> = {};

    const [
      ticketCounts,
      clientCount, // Remplacé clientStats par clientCount directement
      userCount,
      installationsSnapshot // Pour les stats d'installations
    ] = await Promise.all([
      getSapTicketCountBySectorSdk(allSectors).catch(e => { // Modifié pour Firestore
        console.error("[api.admin.stats] Erreur ticketCounts Firestore:", e);
        return {};
      }),
      // Pour clientCount, on peut utiliser getDistinctClientCountFromEnvoiSdk ou une autre logique sur 'installations'
      // Supposons que userProfileData est disponible si l'admin est connecté
      userProfileData ? getDistinctClientCountFromEnvoiSdk(userProfileData).catch(e => {
        console.error("[api.admin.stats] Erreur clientCount Firestore:", e);
        return 0;
      }) : Promise.resolve(0),
      getAllUserProfilesSdk().then(users => users.length).catch(e => { // Modifié pour Firestore
        console.error("[api.admin.stats] Erreur userCount Firestore:", e);
        return 0;
      }),
      userProfileData ? getInstallationsSnapshot(userProfileData).catch(e => { // Modifié pour Firestore
        console.error("[api.admin.stats] Erreur installationsSnapshot Firestore:", e);
        return { total: 0, byStatus: {}, bySector: {} };
      }) : Promise.resolve({ total: 0, byStatus: {}, bySector: {} })
    ]);

    console.log("[api.admin.stats] Statistiques Firestore calculées avec succès");
    
    return json({
      ticketCounts,
      clientCount,
      clientEvolution: 0, // L'évolution du nombre de clients n'est pas directement calculée ici, à adapter si besoin
      userCount,
      installations: installationsSnapshot, // Utiliser le snapshot des installations
      // transactionsByDay, // Supprimé
      // eventTypes, // Supprimé
      // gasUsageAvg et confirmationTimeAvg sont spécifiques à la blockchain et supprimés
    });
  } catch (error) {
    console.error("Erreur API admin stats (Firestore):", error);
    return json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// Pour les requêtes POST futures (si nécessaire)
export async function action({ request }: ActionFunctionArgs) {
  // Mode développement - vérifions s'il y a un paramètre de bypass
  const url = new URL(request.url);
  const devBypass = url.searchParams.get("dev_bypass") === "true";

  const session = await sessionStorage.getSession(request.headers.get("Cookie"));
  const userSession: UserSessionData | null = session.get("user") ?? null;

  if (!userSession && !devBypass) {
    return json({ error: "Non authentifié" }, { status: 401 });
  }

  // En mode dev bypass ou avec un utilisateur authentifié
  if (userSession) {
    // Vérifier les permissions admin
    const userProfile = await getUserProfileSdk(userSession.userId);
    if (!userProfile || userProfile.role?.toLowerCase() !== 'admin') {
      return json({ error: "Permissions insuffisantes" }, { status: 403 });
    }
  } else if (!devBypass) { // Si pas de session et pas de bypass
     return json({ error: "Non authentifié" }, { status: 401 });
  }
  // Si devBypass est true, on continue même sans userSession

  // Implémentation future pour les actions POST
  return json({ message: "Action non implémentée" });
}
