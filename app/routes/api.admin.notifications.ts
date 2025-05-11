import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node'; // Imports uniques
import { sessionStorage, type UserSessionData } from "~/services/session.server"; 
import { getUserProfileSdk, deleteNotificationById } from '~/services/firestore.service.server'; 
import { getNotifications, createNotification, markNotificationAsRead, deleteNotification } from '~/services/notifications.service.server';
import type { Notification as FirestoreNotification, UserProfile } from '~/types/firestore.types'; 

// L'interface Notification locale est supprimée car nous utilisons FirestoreNotification
/*
export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  userId: string;
  isRead: boolean;
  createdAt: string;
  operator?: string;
}
*/

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Mode développement - vérifions s'il y a un paramètre de bypass
    const url = new URL(request.url);
    const devBypass = url.searchParams.get("dev_bypass") === "true";

    // Vérifier l'authentification
    const session = await sessionStorage.getSession(request.headers.get("Cookie"));
    const userSession: UserSessionData | null = session.get("user") ?? null;
    
    let isAdmin = false;
    let targetUserIdForNotifications: string | null = null;

    if (userSession && userSession.userId) {
      const userProfile = await getUserProfileSdk(userSession.userId);
      if (userProfile && userProfile.role?.toLowerCase() === 'admin') {
        isAdmin = true;
        targetUserIdForNotifications = userSession.userId; // L'admin voit ses propres notifications ou toutes ? Pour l'instant, les siennes.
      } else if (userProfile) {
        // Non admin mais authentifié, ne devrait pas accéder à une route admin API
        return json({ error: "Permissions insuffisantes" }, { status: 403 });
      } else {
        // Profil non trouvé
        return json({ error: "Profil utilisateur non trouvé" }, { status: 404 });
      }
    }

    if (!isAdmin && !devBypass) {
      console.log("[api.admin.notifications] Authentification échouée ou non admin");
      return json({ error: "Non authentifié ou permissions insuffisantes" }, { status: 401 });
    }
    
    if (devBypass) {
      console.log("[api.admin.notifications] Mode bypass activé pour le loader");
      targetUserIdForNotifications = "all"; // Ou un ID admin de test si getNotifications le gère
    }
    
    if (!targetUserIdForNotifications) {
        // Ce cas ne devrait pas être atteint si la logique ci-dessus est correcte
        return json({ error: "Impossible de déterminer l'utilisateur pour les notifications" }, { status: 400 });
    }

    console.log(`[api.admin.notifications] Récupération des notifications pour ${targetUserIdForNotifications}...`);
    
    // Récupérer toutes les notifications Firestore
    const notifications = await getNotifications(targetUserIdForNotifications);
    // Trier par date (les plus récentes d'abord)
    notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    // Si aucune notification n'est trouvée dans les événements, indiquer qu'aucune notification n'existe
    if (notifications.length === 0) {
      console.log("[api.admin.notifications] Aucune notification Firestore trouvée");
      return json({
        notifications: [],
        message: "Aucune notification Firestore trouvée"
      });
    }
    
    return json({ notifications });
  } catch (error) {
    console.error("[api.admin.notifications] Erreur critique:", error);
    return json({ 
      error: "Erreur lors de la récupération des notifications",
      notifications: [] 
    }, { status: 500 });
  }
}

// Action pour créer une notification ou marquer comme lue
export async function action({ request }: ActionFunctionArgs) {
  try {
    // Mode développement - vérifier s'il y a un paramètre de bypass
    const url = new URL(request.url);
    const devBypass = url.searchParams.get("dev_bypass") === "true";
    
    // Vérifier l'authentification
    const sessionCookie = request.headers.get("Cookie");
    const sessionStore = await sessionStorage.getSession(sessionCookie);
    const userSession: UserSessionData | null = sessionStore.get("user") ?? null;
    
    let isAdmin = false;

    if (userSession && userSession.userId) {
      const userProfile = await getUserProfileSdk(userSession.userId);
      if (userProfile && userProfile.role?.toLowerCase() === 'admin') {
        isAdmin = true;
      } else if (userProfile) {
        return json({ error: "Permissions insuffisantes" }, { status: 403 });
      } else {
        return json({ error: "Profil utilisateur non trouvé" }, { status: 404 });
      }
    }

    if (!isAdmin && !devBypass) {
      return json({ error: "Non authentifié ou permissions insuffisantes" }, { status: 401 });
    }
    
    if (devBypass && !isAdmin) { // Si bypass mais pas de session admin valide, on log mais on continue
        console.log("[api.admin.notifications ACTION] Mode bypass activé");
    }
    
    // Récupérer les données de la requête
    const formData = await request.formData();
    const action = formData.get("action") as string;
    
    if (!action) {
      return json({ error: "Action non spécifiée" }, { status: 400 });
    }
    
    try {
      if (action === "create") {
        const title = formData.get("title") as string;
        const message = formData.get("message") as string;
        const type = formData.get("type") as string;
        const userId = formData.get("userId") as string;
        
        if (!title || !message) {
          return json({ 
            error: "Le titre et le message sont requis" 
          }, { status: 400 });
        }
        
        // Le type pour createNotification est Omit<FirestoreNotification, 'id' | 'createdAt'>
        // FirestoreNotification a isRead: boolean.
        const notificationData: Omit<FirestoreNotification, 'id' | 'createdAt'> = {
          userId: userId || "all", // Assurer que userId est une string
          title,
          message,
          type: type || "info", // Assurer que type est une string
          isRead: false, // isRead est bien une propriété de FirestoreNotification
          // link, targetRoles, sector, metadata peuvent être ajoutés ici si nécessaire
        };
        
        const notif = await createNotification(notificationData);
        
        if (notif) {
          return json({ 
            success: true, 
            message: "Notification créée avec succès",
            id: notif.id
          });
        } else {
          return json({ 
            error: "Erreur Firestore: création échouée" 
          }, { status: 500 });
        }
      } 
      else if (action === "markAsRead") {
        const id = formData.get("id") as string;
        
        if (!id) {
          return json({ 
            error: "L'ID de notification est requis" 
          }, { status: 400 });
        }
        
        await markNotificationAsRead(id);
        
        return json({ 
          success: true, 
          message: "Notification marquée comme lue" 
        });
      }
      else if (action === "delete") {
        const id = formData.get("id") as string;
        
        if (!id) {
          return json({ 
            error: "L'ID de notification est requis" 
          }, { status: 400 });
        }
        
        const result = await deleteNotificationById(id);
        
        if (result.success) {
          return json({ 
            success: true, 
            message: "Notification supprimée avec succès"
          });
        } else {
          return json({ 
            error: result.message 
          }, { status: 500 });
        }
      }
      
      return json({ 
        error: "Action non reconnue" 
      }, { status: 400 });
    }
    catch (error) {
      console.error("[api.admin.notifications] Erreur Firestore:", error);
      return json({ 
        error: "Erreur lors de l'interaction avec Firestore" 
      }, { status: 500 });
    }
  } catch (error) {
    console.error("[api.admin.notifications] Erreur critique:", error);
    return json({ error: "Erreur serveur" }, { status: 500 });
  }
}
