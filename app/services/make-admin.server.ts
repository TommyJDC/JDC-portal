import { updateUserProfileSdk } from './firestore.service.server'; // Modifié pour Firestore

/**
 * Service pour modifier le rôle d'un utilisateur en Admin
 * @param userId ID de l'utilisateur à passer en Admin
 */
export async function makeUserAdmin(userId: string): Promise<boolean> {
  console.log(`Tentative de passage en Admin pour l'utilisateur: ${userId}`);
  
  try {
    // Mettre à jour le profil avec le rôle Admin
    await updateUserProfileSdk(userId, { // Modifié pour Firestore
      role: 'Admin'
      // updatedAt a été retiré de UserProfile et n'est plus géré automatiquement par updateUserProfileSdk
    });
    
    console.log(`✅ L'utilisateur ${userId} est maintenant Admin`);
    return true;
  } catch (error) {
    console.error(`❌ Erreur lors du passage en Admin:`, error);
    return false;
  }
}
