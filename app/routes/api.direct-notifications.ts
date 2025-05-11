import { json } from '@remix-run/node';
import type { ActionFunctionArgs } from '@remix-run/node';
// import { authenticator } from '~/services/auth.server'; // Plus utilisé directement
import { sessionStorage, type UserSessionData } from "~/services/session.server"; // Importer pour session manuelle
import { createNotification } from '~/services/notifications.service.server';
import { deleteNotificationById } from '~/services/firestore.service.server';

/**
 * Cette API permet de créer et supprimer des notifications directement avec des IDs explicites
 * pour contourner le problème d'IDs différents entre l'interface et la blockchain
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

    // Récupérer les données de la requête
    const formData = await request.formData();
    const action = formData.get("action") as string;
    
    if (!action) {
      return json({ error: "Action non spécifiée" }, { status: 400 });
    }
    
    if (action === "create") {
      // Création d'une notification Firestore
      const notificationId = formData.get("notificationId") as string || `notif_direct_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const title = formData.get("title") as string || "Notification sans titre";
      const message = formData.get("message") as string || "Message de notification";
      const type = formData.get("type") as string || "info";
      const userId = formData.get("userId") as string || "all";
      try {
        const notif = await createNotification({
          userId,
          title,
          message,
          type,
          isRead: false
        });
        if (notif) {
          return json({ success: true, message: `Notification créée avec succès avec ID: ${notif.id}`, id: notif.id });
        } else {
          return json({ error: `Erreur Firestore: création échouée` }, { status: 500 });
        }
      } catch (error) {
        return json({ error: `Erreur Firestore: ${error instanceof Error ? error.message : String(error)}` }, { status: 500 });
      }
    } else if (action === "delete") {
      const id = formData.get("id") as string;
      if (!id) {
        return json({ error: "L'ID de notification est requis" }, { status: 400 });
      }
      const result = await deleteNotificationById(id);
      if (result.success) {
        return json({ success: true, message: "Notification supprimée avec succès" });
      } else {
        return json({ error: result.message }, { status: 500 });
      }
    }
    return json({ error: "Action non reconnue" }, { status: 400 });
  } catch (error) {
    console.error("[api.direct-notifications] Erreur critique:", error);
    return json({ error: "Erreur serveur" }, { status: 500 });
  }
}
