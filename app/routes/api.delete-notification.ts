import { json } from '@remix-run/node';
import type { ActionFunctionArgs } from '@remix-run/node';
// import { authenticator } from '~/services/auth.server'; // Plus utilisé directement
import { sessionStorage, type UserSessionData } from "~/services/session.server"; // Importer pour session manuelle
// Importation du service Firestore pour la suppression de notification
import { deleteNotificationById } from '~/services/firestore.service.server'; 

/**
 * Cette API permet de supprimer une notification par son ID en utilisant le service Firestore.
 */
export async function action({ request }: ActionFunctionArgs) {
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
    
    // Si userSession est null mais devBypass est true, on continue.
    // Si userSession existe, l'utilisateur est authentifié.
    // Aucune vérification de rôle spécifique n'est faite ici, juste l'authentification.
    if (!devBypass && !userSession) { // Double vérification pour s'assurer que si pas de bypass, userSession doit exister
        return json({ error: "Non authentifié" }, { status: 401 });
    }

    // Récupérer l'ID de la notification à supprimer
    const formData = await request.formData();
    const id = formData.get("id") as string;
    
    if (!id) {
      return json({ error: "ID de notification requis" }, { status: 400 });
    }
    
    try {
      // Appeler le service Firestore pour supprimer la notification
      const result = await deleteNotificationById(id);
      
      if (result.success) {
        console.log(`[api.delete-notification] Notification ${id} supprimée avec succès via Firestore`);
        return json({ 
          success: true, 
          message: result.message 
        });
      } else {
        console.error(`[api.delete-notification] Échec de la suppression via Firestore pour ${id}:`, result.message);
        return json({ 
          success: false, 
          error: result.message 
        }, { status: 500 });
      }
    }
    catch (error: any) {
      console.error("[api.delete-notification] Erreur lors de l'appel au service Firestore:", error);
      return json({ 
        success: false,
        error: error.message || "Erreur lors de la suppression de la notification"
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error("[api.delete-notification] Erreur critique:", error);
    return json({ 
      success: false,
      error: error.message || "Erreur serveur"
    }, { status: 500 });
  }
}
