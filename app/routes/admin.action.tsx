import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from '@remix-run/node';
import { getUserProfileSdk, updateUserProfileSdk, createUserProfileSdk } from '~/services/firestore.service.server';
import type { UserProfile } from '~/types/firestore.types';
import { getSessionFromCookie } from '~/services/session-utils.server';
import * as fs from 'fs';
import * as path from 'path';
// import { generateUserKeys } from '../services/blockchain-wallet.server'; // Commenté temporairement
// import { getUserAddressById } from '~/services/blockchain.service.server'; // Supprimé, on utilise le profil Firestore

// Helper pour logger dans un fichier pour déboguer les problèmes
const logToFile = (message: string) => {
  try {
    const logPath = path.join('app', 'logs', 'admin-action.log');
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logPath, `${timestamp} - ${message}\n`);
  } catch (error) {
    console.error('Erreur lors de l\'écriture dans le fichier de log:', error);
  }
};

// La fonction d'action qui traite les mises à jour d'utilisateurs
export async function action({ request }: ActionFunctionArgs) {
  console.log('[admin.action] Traitement d\'une requête action');
  logToFile('[admin.action] Traitement d\'une requête action');
  
  try {
    const formData = await request.formData();
    const formDataEntries = Object.fromEntries(formData);
    console.log('[admin.action] Données du formulaire reçues:', formDataEntries);
    logToFile(`[admin.action] Données du formulaire reçues: ${JSON.stringify(formDataEntries)}`);
    
    // Vérifier s'il s'agit du mode dev_bypass
    const devBypass = formData.get('dev_bypass') === 'true';
    if (devBypass) {
      console.log('[admin.action] Mode dev_bypass activé, contournement des vérifications d\'autorisation');
      logToFile('[admin.action] Mode dev_bypass activé');
    } else {
      // Si pas en mode dev_bypass, vérifier l'authentification et les droits admin
      const cookieHeader = request.headers.get("Cookie");
      if (!cookieHeader) {
        console.log('[admin.action] Pas de cookie trouvé, accès refusé');
        logToFile('[admin.action] Pas de cookie trouvé, accès refusé');
        return json({ success: false, error: 'Authentification requise' }, { status: 401 });
      }
      
      try {
        // Vérifier la session et les droits d'admin
        const session = await getSessionFromCookie(request);
        if (!session || !session.userId) {
          console.log('[admin.action] Session invalide, accès refusé');
          logToFile('[admin.action] Session invalide, accès refusé');
          return json({ success: false, error: 'Session invalide' }, { status: 401 });
        }
        
        console.log(`[admin.action] Session valide pour l'utilisateur: ${session.userId}`);
        logToFile(`[admin.action] Session valide pour l'utilisateur: ${session.userId}`);
        // La vérification du rôle admin pourrait être ajoutée ici si nécessaire
      } catch (error) {
        console.error('[admin.action] Erreur lors de la vérification de la session:', error);
        logToFile(`[admin.action] Erreur lors de la vérification de la session: ${error}`);
        return json({ success: false, error: 'Erreur d\'authentification' }, { status: 401 });
      }
    }
    
    // Vérifier s'il s'agit d'une demande de génération de wallet
    // if (formData.get('generateWallet') === '1') {
    //   const userId = formData.get('userId');
    //   if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    //     return json({
    //       success: false,
    //       error: 'ID utilisateur manquant ou invalide'
    //     }, { status: 400 });
    //   }

    //   try {
    //     const trimmedUserId = userId.trim();
    //     console.log(`[admin.action] Génération d'un wallet pour l'utilisateur ${trimmedUserId}`);
    //     logToFile(`[admin.action] Génération d'un wallet pour l'utilisateur ${trimmedUserId}`);
        
    //     let userProfile: UserProfile | null | undefined;
    //     try {
    //       userProfile = await getUserProfileSdk(trimmedUserId);
    //     } catch (error) {
    //       console.error(`[admin.action] Erreur lors de la récupération du profil Firestore pour ${trimmedUserId}:`, error);
    //       logToFile(`[admin.action] Erreur lors de la récupération du profil Firestore pour ${trimmedUserId}: ${error}`);
    //       // Ne pas bloquer ici, on essaiera de créer le profil si non trouvé
    //     }

    //     if (userProfile) {
    //       console.log(`[admin.action] Profil utilisateur ${trimmedUserId} trouvé dans Firestore.`);
    //       logToFile(`[admin.action] Profil utilisateur ${trimmedUserId} trouvé dans Firestore.`);
    //       if (userProfile.encryptedWallet) {
    //         console.log(`[admin.action] L'utilisateur ${trimmedUserId} a déjà un wallet chiffré (Firestore).`);
    //         logToFile(`[admin.action] L'utilisateur ${trimmedUserId} a déjà un wallet chiffré (Firestore).`);
    //         return json({
    //           success: false,
    //           message: `L'utilisateur ${trimmedUserId} a déjà un wallet (basé sur Firestore).`
    //         });
    //       }
    //       // Si pas de encryptedWallet, on continue pour générer les clés.
    //     } else {
    //       console.log(`[admin.action] Profil utilisateur ${trimmedUserId} non trouvé dans Firestore. Création...`);
    //       logToFile(`[admin.action] Profil utilisateur ${trimmedUserId} non trouvé dans Firestore. Création...`);
    //       try {
    //         const newUser: UserProfile = {
    //           uid: trimmedUserId,
    //           email: `${trimmedUserId}@jdc.fr`,
    //           displayName: `Utilisateur ${trimmedUserId}`,
    //           nom: `Auto-généré ${new Date().toISOString()}`,
    //           role: "Viewer",
    //           secteurs: ["CHR"],
    //           phone: "",
    //           createdAt: new Date(),
    //           updatedAt: new Date(),
    //           address: '',
    //           jobTitle: '',
    //           department: undefined,
    //           gmailAuthStatus: 'inactive',
    //           isGmailProcessor: false,
    //           gmailAuthorizedScopes: [],
    //           googleRefreshToken: '',
    //           labelSapClosed: '',
    //           labelSapNoResponse: '',
    //           labelSapRma: '',
    //         };
    //         await createUserProfileSdk(newUser);
    //         userProfile = newUser; // Assigner le profil nouvellement créé
    //         console.log(`[admin.action] Profil utilisateur ${trimmedUserId} créé avec succès dans Firestore.`);
    //         logToFile(`[admin.action] Profil utilisateur ${trimmedUserId} créé avec succès dans Firestore.`);
    //       } catch (createError) {
    //         console.error(`[admin.action] Erreur lors de la création du profil Firestore pour ${trimmedUserId}:`, createError);
    //         logToFile(`[admin.action] Erreur lors de la création du profil Firestore pour ${trimmedUserId}: ${createError}`);
    //         return json({
    //           success: false,
    //           error: `Erreur lors de la création du profil Firestore: ${createError instanceof Error ? createError.message : 'Erreur inconnue'}`
    //         }, { status: 500 });
    //       }
    //     }

    //     // À ce stade, userProfile devrait exister (soit trouvé, soit créé)
    //     // et ne pas avoir de encryptedWallet.
    //     // On génère les clés et l'adresse. L'adresse sera stockée dans blockchainAddress.
    //     console.log(`[admin.action] Génération des clés pour l'utilisateur Firestore ${trimmedUserId}.`);
    //     logToFile(`[admin.action] Génération des clés pour l'utilisateur Firestore ${trimmedUserId}.`);
    //     // const newBlockchainAddress = await generateUserKeys(trimmedUserId); // Met à jour encryptedWallet dans Firestore

    //     // Mettre à jour le profil Firestore avec la nouvelle adresse blockchain générée
    //     // await updateUserProfileSdk(trimmedUserId, { blockchainAddress: newBlockchainAddress, updatedAt: new Date() });
        
    //     // console.log(`[admin.action] Wallet généré et profil Firestore mis à jour pour ${trimmedUserId}. Adresse: ${newBlockchainAddress}`);
    //     // logToFile(`[admin.action] Wallet généré et profil Firestore mis à jour pour ${trimmedUserId}. Adresse: ${newBlockchainAddress}`);
        
    //     return json({
    //       success: true,
    //       message: `La génération de wallet est temporairement désactivée. L'adresse et la clé chiffrée auraient été stockées dans Firestore.`,
    //       // address: newBlockchainAddress,
    //     });

    //   } catch (error: any) {
    //     console.error(`[admin.action] Erreur lors de la génération du wallet:`, error);
    //     logToFile(`[admin.action] Erreur lors de la génération du wallet: ${error}`);
    //     return json({
    //       success: false,
    //       error: error instanceof Error ? error.message : 'Erreur lors de la génération du wallet'
    //     }, { status: 500 });
    //   }
    // }
    
    // Récupérer l'ID utilisateur et les données de mise à jour
    const userId = formData.get('userId');
    const updatesStr = formData.get('updates');
    
    logToFile(`[admin.action] userId récupéré: "${userId}" (type: ${typeof userId})`);
    logToFile(`[admin.action] updatesStr récupéré: "${updatesStr}" (type: ${typeof updatesStr})`);
    
    // Vérification renforcée de l'ID utilisateur
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      console.log('[admin.action] Erreur: userId inexistant ou invalide', { userId });
      logToFile(`[admin.action] Erreur: userId inexistant ou invalide: ${JSON.stringify(userId)}`);
      return json({
        success: false,
        error: 'ID utilisateur manquant ou invalide'
      }, { status: 400 });
    }
    
    // Normaliser l'ID (supprimer les espaces en début/fin)
    const trimmedUserId = userId.trim();
    logToFile(`[admin.action] userId normalisé: "${trimmedUserId}"`);
    
    if (!updatesStr || typeof updatesStr !== 'string') {
      console.log('[admin.action] Erreur: updatesStr inexistant ou invalide', updatesStr);
      logToFile(`[admin.action] Erreur: updatesStr inexistant ou invalide: ${JSON.stringify(updatesStr)}`);
      return json({
        success: false,
        error: 'Données de mise à jour manquantes ou invalides'
      }, { status: 400 });
    }
    
    // Parser les mises à jour JSON
    let updates: Partial<UserProfile>;
    try {
      updates = JSON.parse(updatesStr);
      console.log('[admin.action] Mises à jour parsées:', updates);
      logToFile(`[admin.action] Mises à jour parsées: ${JSON.stringify(updates)}`);
    } catch (error) {
      console.error('[admin.action] Erreur lors du parsing des mises à jour:', error);
      logToFile(`[admin.action] Erreur lors du parsing des mises à jour: ${error}`);
      return json({
        success: false,
        error: 'Format des données de mise à jour invalide'
      }, { status: 400 });
    }
    
    // Valider le rôle si présent
    if (updates.role) {
      const validRoles = ['Admin', 'Technician', 'Logistics', 'Client', 'Viewer'];
      if (!validRoles.includes(updates.role)) {
        logToFile(`[admin.action] Rôle invalide: ${updates.role}`);
        return json({
          success: false,
          error: `Rôle invalide: ${updates.role}`
        }, { status: 400 });
      }
    }
    
    // Valider les secteurs si présents
    if (updates.secteurs) {
      const validSectors = ['CHR', 'HACCP', 'Kezia', 'Tabac'];
      if (!Array.isArray(updates.secteurs) || updates.secteurs.some(s => !validSectors.includes(s))) {
        logToFile(`[admin.action] Secteurs invalides: ${JSON.stringify(updates.secteurs)}`);
        return json({
          success: false,
          error: 'Un ou plusieurs secteurs invalides'
        }, { status: 400 });
      }
    }
    
    // Effectuer la mise à jour avec le service Firestore SDK
    try {
      console.log(`[admin.action] Tentative de mise à jour Firestore pour l'utilisateur ${trimmedUserId} avec:`, updates);
      logToFile(`[admin.action] Tentative de mise à jour Firestore pour l'utilisateur ${trimmedUserId} avec: ${JSON.stringify(updates)}`);
      await updateUserProfileSdk(trimmedUserId, updates); // Utilise Firestore SDK
      console.log(`[admin.action] Mise à jour Firestore réussie pour l'utilisateur ${trimmedUserId}`);
      logToFile(`[admin.action] Mise à jour Firestore réussie pour l'utilisateur ${trimmedUserId}`);
      
      return json({ 
        success: true,
        message: `Utilisateur ${trimmedUserId} mis à jour avec succès`
      });
    } catch (error: any) {
      console.error('[admin.action] Erreur lors de la mise à jour Firestore:', error);
      logToFile(`[admin.action] Erreur lors de la mise à jour Firestore: ${error}`);
      // Retourner un message plus informatif à l'utilisateur
      return json({
        success: false,
        error: error instanceof Error 
          ? `Erreur de mise à jour Firestore: ${error.message}` 
          : 'Erreur lors de la mise à jour Firestore'
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('[admin.action] Erreur générale:', error);
    logToFile(`[admin.action] Erreur générale: ${error}`);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    }, { status: 500 });
  }
}
