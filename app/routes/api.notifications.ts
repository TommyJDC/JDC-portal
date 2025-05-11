import { json } from '@remix-run/node';
import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
// import { authenticator } from '~/services/auth.server'; // Plus utilisé directement
import { sessionStorage, type UserSessionData } from "~/services/session.server"; // Importer pour session manuelle
// Fonctions de service Firestore pour les notifications
import { 
  getNotifications, 
  markNotificationAsRead, 
  deleteNotification, // Assumant que deleteNotificationById est renommé ou remplacé par deleteNotification
  markAllNotificationsAsRead,
  getUnreadNotificationsCount
} from '~/services/notifications.service.server'; 
import type { Notification as FirestoreNotification } from '~/types/firestore.types'; // Type Notification de Firestore

// Interface pour une notification (peut être simplifiée ou alignée avec FirestoreNotification)
export interface NotificationDisplay {
  id: string;
  title: string;
  message: string;
  type: string;
  userId: string;
  isRead: boolean;
  timestamp: string; // Format ISO
  createdAt?: Date | string; // Conserver pour la compatibilité si l'UI l'utilise
  link?: string; // Ajouté depuis FirestoreNotification
  // source?: 'blockchain'; // Supprimé, maintenant c'est Firestore
  sector?: string[]; // Si pertinent pour le filtrage
}

// Type pour l'utilisateur authentifié (remplacé par UserSessionData)
// interface UserSession {
//   userId: string;
//   role?: string; // Rôle de l'utilisateur pour le filtrage
//   secteurs?: string[]; // Secteurs de l'utilisateur pour le filtrage
// }

export async function loader({ request }: LoaderFunctionArgs) {
  // Mode développement - vérifions s'il y a un paramètre de bypass
  const url = new URL(request.url);
  const devBypass = url.searchParams.get("dev_bypass") === "true";
  const userId = url.searchParams.get("userId");
  // Nouveau paramètre pour forcer l'affichage des exemples, même en prod
  const forceExamples = url.searchParams.get("force_examples") === "true";
  const includeAllNotifications = url.searchParams.get("includeAll") === "true"; 

  console.log(`[api.notifications] Requête de notifications:`, {
    userId,
    includeAll: includeAllNotifications,
    devBypass,
    forceExamples
  });

  // Vérifier l'authentification de l'utilisateur (sauf en mode bypass)
  const session = await sessionStorage.getSession(request.headers.get("Cookie"));
  const userSession: UserSessionData | null = session.get("user") ?? null;

  if (!userSession && !devBypass) {
    console.log('[api.notifications] Non authentifié (session manuelle)');
    return json({ error: 'Non authentifié' }, { status: 401 });
  }

  // Utiliser l'ID de l'utilisateur connecté si aucun n'est spécifié
  // Si devBypass est true, userSession peut être null, targetUserId sera alors userId (param URL) ou null.
  const targetUserId = userId || (userSession ? userSession.userId : null);

  if (!targetUserId) {
    console.log(`[api.notifications] userId manquant`);
    return json({ error: 'userId est requis' }, { status: 400 });
  }

  try {
    console.log(`[api.notifications] Récupération des notifications Firestore pour:`, targetUserId);
    
    // Récupérer les notifications depuis Firestore
    const firestoreNotifications: FirestoreNotification[] = await getNotifications(targetUserId);
    console.log(`[api.notifications] ${firestoreNotifications.length} notifications Firestore trouvées pour l'utilisateur`);

    // La logique de placeholder peut être conservée si nécessaire, ou adaptée
    if (firestoreNotifications.length === 0 && (forceExamples || (import.meta.env.DEV && !devBypass))) {
      console.log("[api.notifications] Utilisation d'exemples de notifications (mode Firestore)");
      const placeholderNotifications: NotificationDisplay[] = [
        {
          id: "fs_example_1",
          title: "Bienvenue (Firestore)",
          message: "Ceci est une notification d'exemple provenant de Firestore.",
          type: "info",
          userId: targetUserId, // Ou "all"
          isRead: false,
          timestamp: new Date(Date.now() - 1 * 24 * 3600000).toISOString(),
          link: "/dashboard"
        },
      ];
      const unreadCount = placeholderNotifications.filter(n => !n.isRead).length;
      return json({
        notifications: placeholderNotifications,
        unreadCount,
        isPlaceholder: true
      });
    }
    
    // Convertir les notifications Firestore au format d'affichage
    const formattedNotifications: NotificationDisplay[] = firestoreNotifications.map(notif => ({
      id: notif.id,
      title: notif.title || "Sans titre",
      message: notif.message || "",
      type: notif.type || "info",
      userId: notif.userId || "all", // Assurer que userId est toujours présent
      isRead: notif.isRead || false,
      timestamp: notif.createdAt instanceof Date 
        ? notif.createdAt.toISOString() 
        : (typeof notif.createdAt === 'string' ? notif.createdAt : new Date().toISOString()),
      link: notif.link,
      // sector: notif.sector // Décommenter si le type FirestoreNotification inclut 'sector' et que c'est nécessaire
    }));

    // Le filtrage par rôle/secteur est géré par `getNotifications` dans `notifications.service.server.ts`
    // Si un filtrage supplémentaire est nécessaire ici, il peut être ajouté.
    // Pour l'instant, on assume que getNotifications retourne déjà les bonnes notifications pour l'utilisateur.
    // Si `includeAllNotifications` est vrai, il faudrait une autre fonction dans le service ou ajuster `getNotifications`.
    // Pour simplifier, on va ignorer `includeAllNotifications` pour le moment ou supposer que `getNotifications` le gère.

    // Trier par date (déjà fait par le service, mais on peut le refaire si besoin)
    // formattedNotifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const unreadCount = await getUnreadNotificationsCount(targetUserId);

    console.log(`[api.notifications] Retour de ${formattedNotifications.length} notifications Firestore (${unreadCount} non lues)`);
    
    return json({
      notifications: formattedNotifications,
      unreadCount
    });
  } catch (error) {
    console.error('Erreur globale lors de la récupération des notifications:', error);
    return json({ 
      error: 'Échec de la récupération des notifications',
      notifications: [],
      unreadCount: 0
    }, { status: 500 });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const url = new URL(request.url);
  const segments = url.pathname.split('/');
  const notificationId = segments[segments.length - 2];
  const actionType = segments[segments.length - 1];
  const devBypass = url.searchParams.get("dev_bypass") === "true";

  // Authentification de l'utilisateur
  const session = await sessionStorage.getSession(request.headers.get("Cookie"));
  const userSession: UserSessionData | null = session.get("user") ?? null;

  if (!userSession && !devBypass) {
    return json({ error: 'Non authentifié (session manuelle)' }, { status: 401 });
  }
  
  // Si devBypass est true, userSession peut être null.
  // currentUserId sera null si userSession est null.
  const currentUserId = userSession?.userId; 

  if (request.method === 'POST') {
    try {
      if (actionType === 'read' && notificationId) {
        const success = await markNotificationAsRead(notificationId);
        return json({ success });
      } 
      else if (actionType === 'delete' && notificationId) {
        console.log(`[api.notifications] Tentative de suppression Firestore de la notification: ${notificationId}`);
        const result = await deleteNotification(notificationId); // Utilise la fonction du service Firestore
        if (result) { // Le service retourne true en cas de succès
          return json({ 
            success: true,
            message: `Notification ${notificationId} supprimée de Firestore`
          });
        } else {
          return json({ 
            error: `Échec de la suppression de la notification ${notificationId} de Firestore`,
            success: false
          }, { status: 500 });
        }
      }
      else if (actionType === 'mark-all-read') {
        if (!currentUserId) { // Vérifier si currentUserId est défini
          return json({ error: 'Utilisateur non authentifié pour marquer tout comme lu' }, { status: 401 });
        }
        const success = await markAllNotificationsAsRead(currentUserId);
        return json({ 
          success,
          message: success ? "Toutes les notifications marquées comme lues" : "Échec du marquage de toutes les notifications"
        });
      }
      
      return json({ error: 'Action non reconnue' }, { status: 400 });
    } catch (error) {
      console.error('Erreur lors du traitement de l\'action sur les notifications Firestore:', error);
      return json({ error: 'Erreur interne du serveur' }, { status: 500 });
    }
  }

  return json({ error: 'Méthode non autorisée' }, { status: 405 });
}
