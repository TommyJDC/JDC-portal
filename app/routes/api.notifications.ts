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
import { initializeFirebaseAdmin, getDb } from '~/firebase.admin.config.server';
import type { DocumentSnapshot } from 'firebase-admin/firestore';

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

    return json({
      notifications: firestoreNotifications,
      unreadCount: firestoreNotifications.filter(n => !n.isRead).length,
      isPlaceholder: false
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

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    console.log('[api.notifications] Début du traitement de la requête');
    const formData = await request.formData();
    const action = formData.get('action') as string;
    const notificationId = formData.get('notificationId') as string;

    // Récupérer l'ID de l'utilisateur depuis la session
    const session = await sessionStorage.getSession(request.headers.get("Cookie"));
    const userSession = session.get("user");
    const userId = userSession?.userId;

    if (!userId) {
      console.error('[api.notifications] Utilisateur non authentifié');
      return json({ 
        success: false, 
        message: 'Vous devez être connecté pour effectuer cette action' 
      }, { status: 401 });
    }

    console.log('[api.notifications] Données reçues:', { action, notificationId });

    if (!action) {
      console.error('[api.notifications] Action non spécifiée');
      return json({ success: false, message: 'Action non spécifiée' }, { status: 400 });
    }

    switch (action) {
      case 'delete': {
        if (!notificationId) {
          console.error('[api.notifications] ID de notification manquant pour la suppression');
          return json({ success: false, message: 'ID de notification requis' }, { status: 400 });
        }

        console.log(`[api.notifications] Tentative de suppression de la notification ${notificationId}`);
        const result = await deleteNotification(notificationId);
        
        if (!result.success) {
          console.error(`[api.notifications] Échec de la suppression de ${notificationId}:`, result.message);
          return json(result, { status: 400 });
        }

        console.log(`[api.notifications] Notification ${notificationId} supprimée avec succès`);
        return json(result);
      }

      case 'clearAll': {
        console.log('[api.notifications] Début de la suppression de toutes les notifications pour l\'utilisateur:', userId);
        
        const db = await getDb();
        const batch = db.batch();
        
        // Récupérer toutes les notifications de l'utilisateur
        const notificationsSnapshot = await db
          .collection('notifications')
          .where('userId', '==', userId)
          .get();

        console.log(`[api.notifications] ${notificationsSnapshot.size} notifications trouvées pour l'utilisateur ${userId}`);

        if (notificationsSnapshot.empty) {
          console.log('[api.notifications] Aucune notification à supprimer');
          return json({ 
            success: true, 
            message: 'Aucune notification à supprimer' 
          });
        }

        let updatedCount = 0;
        let skippedCount = 0;

        // Ajouter chaque notification au batch pour mise à jour
        notificationsSnapshot.docs.forEach((doc: DocumentSnapshot) => {
          const data = doc.data();
          if (data?.locked) {
            console.log(`[api.notifications] Notification ${doc.id} ignorée car verrouillée`);
            skippedCount++;
            return;
          }

          // Mettre à jour le document pour ajouter l'utilisateur à la liste deletedForUsers
          const deletedForUsers = data?.deletedForUsers || [];
          if (!deletedForUsers.includes(userId)) {
            batch.update(doc.ref, {
              deletedForUsers: [...deletedForUsers, userId]
            });
            updatedCount++;
          }
        });

        if (updatedCount === 0) {
          console.log('[api.notifications] Aucune notification à mettre à jour');
          return json({ 
            success: true, 
            message: 'Aucune notification à mettre à jour' 
          });
        }

        try {
          await batch.commit();
          console.log(`[api.notifications] Mise à jour réussie: ${updatedCount} notifications mises à jour, ${skippedCount} ignorées`);
          return json({ 
            success: true, 
            message: `${updatedCount} notification${updatedCount > 1 ? 's' : ''} masquée${updatedCount > 1 ? 's' : ''}${skippedCount > 0 ? `, ${skippedCount} ignorée${skippedCount > 1 ? 's' : ''} (verrouillée${skippedCount > 1 ? 's' : ''})` : ''}` 
          });
        } catch (error) {
          console.error('[api.notifications] Erreur lors de la mise à jour:', error);
          return json({ 
            success: false, 
            message: 'Erreur lors de la mise à jour des notifications' 
          }, { status: 500 });
        }
      }

      default:
        console.error(`[api.notifications] Action non reconnue: ${action}`);
        return json({ 
          success: false, 
          message: `Action non reconnue: ${action}` 
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[api.notifications] Erreur non gérée:', {
      error,
      stack: error instanceof Error ? error.stack : undefined,
      message: error instanceof Error ? error.message : 'Erreur inconnue'
    });
    
    return json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Erreur inconnue' 
    }, { status: 500 });
  }
};
