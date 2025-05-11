import { json } from '@remix-run/node';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { createNotification } from '~/services/notifications.service.server'; // Modifié pour utiliser le service Firestore
import type { Notification } from '~/types/firestore.types'; // Importer le type Notification

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const devBypass = url.searchParams.get("dev_bypass") === "true";
  
  // En production, cette route ne devrait pas être accessible
  if (!import.meta.env.DEV && !devBypass) {
    return json({ error: 'Cette route est uniquement disponible en développement' }, { status: 403 });
  }

  try {
    console.log('[api.reinit-notifications] Création d\'une notification de test Firestore...');
    
    // Définir les données pour la notification de test
    // Le type du paramètre de createNotification est Omit<Notification, 'id' | 'createdAt' | 'read'>
    // Cela signifie que 'isRead' (du type Notification) est attendu.
    const testNotificationData: Omit<Notification, 'id' | 'createdAt' | 'read'> = { 
      title: "Notification de Test (Firestore)",
      message: "Ceci est une notification de test générée pour Firestore.",
      type: "info",
      userId: "testUser", // Ou "all", ou un ID utilisateur spécifique pour le test
      isRead: false, // Ajouté car attendu par le type du paramètre de createNotification
      link: "/dashboard" 
      // Les champs 'id', 'createdAt' sont gérés par createNotification.
      // Le champ 'read' (utilisé en interne par le service) est aussi géré par createNotification.
    };
    
    // Créer une notification de test via le service Firestore
    const result = await createNotification(testNotificationData);
    
    if (result && result.id) {
      console.log(`[api.reinit-notifications] Notification de test Firestore créée avec succès (ID: ${result.id})`);
      return json({ success: true, message: 'Notification de test Firestore créée avec succès', notificationId: result.id });
    } else {
      console.log('[api.reinit-notifications] Erreur lors de la création de la notification de test Firestore');
      return json({ 
        success: false, 
        error: 'La création de notification Firestore a échoué' 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('[api.reinit-notifications] Erreur Firestore:', error);
    return json({ 
      error: `Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}` 
    }, { status: 500 });
  }
}
