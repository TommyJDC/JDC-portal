import { initializeFirebaseAdmin } from '~/firebase.admin.config.server';
import { FieldValue } from 'firebase-admin/firestore';
import { gmail_v1 } from 'googleapis';
import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import type { GmailProcessingConfig } from '~/types/firestore.types';
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';

let db: FirebaseFirestore.Firestore;

// --- Types ---
interface EmailData {
  date: string;
  raisonSociale: string;
  numeroSAP: string;
  codeClient: string;
  adresse: string;
  telephone: string;
  demandeSAP: string;
  messageId: string;
}

/**
 * Extrait le contenu des emails avec les labels spécifiés
 */
export async function extractEmailContent(
  authClient: OAuth2Client,
  config: GmailProcessingConfig,
  collection: string,
  labels: string[]
): Promise<EmailData[]> {
  const gmail = google.gmail({ version: 'v1', auth: authClient });
  const emailData: EmailData[] = [];

  try {
    // Récupérer les IDs des labels
    console.log(`[GmailService] Recherche des labels pour ${collection}:`, labels);
    const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
    const allLabels = labelsResponse.data.labels || [];
    const labelIds = labels
      .map(labelName => {
        const label = allLabels.find(l => l.name === labelName);
        if (!label || !label.id) {
          console.warn(`[GmailService] Label "${labelName}" non trouvé`);
          return null;
        }
        return label.id;
      })
      .filter((id): id is string => id !== null);

    if (labelIds.length === 0) {
      console.error(`[GmailService] Aucun label cible trouvé pour ${collection}`);
      return [];
    }

    // Rechercher les messages avec ces labels
    console.log(`[GmailService] Recherche des messages avec les labels:`, labelIds);
    const messagesResponse = await gmail.users.messages.list({
      userId: 'me',
      labelIds: labelIds,
      maxResults: config.maxEmailsPerRun
    });

    const messages = messagesResponse.data.messages || [];
    console.log(`[GmailService] ${messages.length} messages trouvés pour ${collection}`);

    // Traiter chaque message
    for (const message of messages) {
      try {
        const messageResponse = await gmail.users.messages.get({
          userId: 'me',
          id: message.id || '',
          format: 'full'
        });

        const messageData = messageResponse.data;
        const body = getMessageBody(messageData);
        
        // Extraire les données avec des expressions régulières
        // Extraction plus robuste des données
        const dateMatch = /Pour le (.*?)(?:\n|$)/i.exec(body);
        const date = dateMatch ? dateMatch[1].trim() : "Non trouvé";
        
        const raisonSocialeMatch = /Enseigne\s*[\*:]?\s*(.*?)(?:\n|\*|$)/i.exec(body);
        const raisonSociale = raisonSocialeMatch ? raisonSocialeMatch[1].trim() : "Non trouvé";
        
        const numeroSAPMatch = /Num(?:éro)?\s*SAP\s*[\*:]?\s*(.*?)(?:\n|\*|$)/i.exec(body);
        const numeroSAP = numeroSAPMatch ? numeroSAPMatch[1].trim() : "Non trouvé";
        
        const codeClientMatch = /Client\s*[\*:]?\s*(\d+)/i.exec(body);
        const codeClient = codeClientMatch ? codeClientMatch[1] : "Non trouvé";
        
        // Extraction de l'adresse avec plusieurs formats possibles
        const adresseMatch = /Adresse\s*[\*:]?\s*((?:(?!\nTéléphone).)*)/is.exec(body);
        const adresse = adresseMatch ? adresseMatch[1].trim().replace(/\n/g, ' ') : "Non trouvé";
        
        // Extraction des téléphones avec formats variés
        const telephones = [];
        const phoneRegex = /Téléphone\s*(?:1)?\s*[\*:]?\s*(\d{10})/gi;
        let phoneMatch;
        while ((phoneMatch = phoneRegex.exec(body)) !== null) {
          telephones.push(phoneMatch[1]);
        }
        const telephone = telephones.length > 0 ? telephones.join(', ') : "Non trouvé";
        
        // Extraction de la demande SAP
        const demandeSAPMatch = /Commentaires?\s*[\*:]?\s*(.*)/is.exec(body);
        const demandeSAP = demandeSAPMatch ? demandeSAPMatch[1].trim() : "Non trouvé";
        const messageId = messageData.id || '';

        emailData.push({
          date,
          raisonSociale,
          numeroSAP,
          codeClient,
          adresse,
          telephone,
          demandeSAP,
          messageId
        });
      } catch (error) {
        console.error(`[GmailService] Erreur lors du traitement du message ${message.id}:`, error);
      }
    }

    return emailData;
  } catch (error) {
    console.error(`[GmailService] Erreur lors de l'extraction des emails pour ${collection}:`, error);
    throw new Error(`Impossible d'extraire les données des emails: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extrait le corps du message à partir des données Gmail
 */
function getMessageBody(message: any): string {
  if (!message.payload) return '';

  // Fonction récursive pour trouver la partie texte
  function findTextPart(part: any): string {
    if (part.mimeType === 'text/plain' && part.body && part.body.data) {
      return Buffer.from(part.body.data, 'base64').toString('utf-8');
    }

    if (part.parts) {
      for (const subPart of part.parts) {
        const text = findTextPart(subPart);
        if (text) return text;
      }
    }

    return '';
  }

  // Chercher dans les parties du message
  if (message.payload.parts) {
    for (const part of message.payload.parts) {
      const text = findTextPart(part);
      if (text) return text;
    }
  }

  // Si pas de parties ou pas de texte trouvé, essayer le corps principal
  if (message.payload.body && message.payload.body.data) {
    return Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
  }

  return '';
}

/**
 * Normalise un numéro SAP en supprimant tous les caractères non numériques
 */
function normalizeSapNumber(sapNumber: string | null | undefined, collection: string): string {
  if (!sapNumber || sapNumber === "Non trouvé") {
    console.log(`[GmailService] Numéro SAP manquant ou "Non trouvé" dans ${collection}`);
    return "";
  }
  
  // Nettoyer le numéro SAP
  const cleaned = sapNumber.replace(/[^0-9]/g, "").trim();
  
  // Validation différente selon la collection
  if (collection === 'HACCP' && cleaned.length !== 10) {
    console.warn(`[GmailService] Numéro SAP HACCP invalide (doit avoir 10 chiffres): ${sapNumber} -> ${cleaned}`);
    return "";
  }
  
  if ((collection === 'Kezia' || collection === 'CHR' || collection === 'Tabac') && cleaned.length === 0) {
    console.warn(`[GmailService] Numéro SAP ${collection} invalide (vide après nettoyage): ${sapNumber}`);
    return "";
  }
  
  return cleaned;
}

/**
 * Vérifie si un numéro SAP existe déjà dans Firestore
 */
export async function sapNumberExists(sapNumber: string, collection: string): Promise<boolean> {
  if (!sapNumber) return false;

  try {
    if (!db) {
      db = await initializeFirebaseAdmin();
    }
    const query = db.collection(collection).where('numeroSAP', '==', sapNumber).limit(1);
    const snapshot = await query.get();
    return !snapshot.empty;
  } catch (error) {
    console.error(`[GmailService] Erreur lors de la vérification du numéro SAP ${sapNumber} dans ${collection}:`, error);
    return false;
  }
}

/**
 * Envoie les données extraites à Firestore
 */
export async function sendDataToFirebase(row: EmailData, sapNumber: string, collection: string): Promise<void> {
  try {
    await db.collection(collection).add({
      date: { stringValue: row.date },
      raisonSociale: { stringValue: row.raisonSociale },
      numeroSAP: { stringValue: sapNumber },
      codeClient: { stringValue: row.codeClient },
      adresse: { stringValue: row.adresse },
      telephone: { stringValue: row.telephone },
      demandeSAP: { stringValue: row.demandeSAP },
      messageId: { stringValue: row.messageId },
      createdAt: FieldValue.serverTimestamp()
    });
    console.log(`[GmailService] Données envoyées à Firestore (${collection}) pour le numéro SAP: ${sapNumber}`);
  } catch (error) {
    console.error(`[GmailService] Erreur lors de l'envoi des données à Firestore (${collection}):`, error);
    throw new Error(`Impossible d'envoyer les données à Firestore: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Supprime les documents avec "Non trouvé" comme numéro SAP
 */
export async function deleteRowsWithNonTrouve(collection: string): Promise<void> {
  if (!db) {
    db = await initializeFirebaseAdmin();
  }
  
  try {
    const snapshot = await db.collection(collection)
      .where('numeroSAP.stringValue', '==', 'Non trouvé')
      .get();
    
    console.log(`[GmailService] ${snapshot.size} documents avec "Non trouvé" trouvés dans ${collection}`);
    
    const batch = db.batch();
    snapshot.docs.forEach((doc: QueryDocumentSnapshot) => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log(`[GmailService] ${snapshot.size} documents avec "Non trouvé" supprimés de ${collection}`);
  } catch (error) {
    console.error(`[GmailService] Erreur lors de la suppression des documents "Non trouvé" de ${collection}:`, error);
  }
}

/**
 * Supprime les documents avec des numéros SAP en double
 */
export async function deleteRowsWithDuplicateSAP(collection: string): Promise<void> {
  if (!db) {
    db = await initializeFirebaseAdmin();
  }

  try {
    const snapshot = await db.collection(collection).get();
    const docs = snapshot.docs;
    
    const seenSAP: Record<string, string> = {}; // sapNumber -> docId
    const toDelete: string[] = [];
    
    docs.forEach((doc: QueryDocumentSnapshot) => {
      const data = doc.data();
      const sapNumber = data.numeroSAP?.stringValue;
      
      if (!sapNumber) return;
      
      if (seenSAP[sapNumber]) {
        // Déjà vu, on supprime
        toDelete.push(doc.id);
      } else {
        seenSAP[sapNumber] = doc.id;
      }
    });
    
    console.log(`[GmailService] ${toDelete.length} documents en double trouvés dans ${collection}`);
    
    if (toDelete.length > 0) {
      const batch = db.batch();
      toDelete.forEach(id => {
        batch.delete(db.collection(collection).doc(id));
      });
      
      await batch.commit();
      console.log(`[GmailService] ${toDelete.length} documents en double supprimés de ${collection}`);
    }
  } catch (error) {
    console.error(`[GmailService] Erreur lors de la suppression des doublons de ${collection}:`, error);
  }
}

/**
 * Ajoute le label "Traité" à un email
 */
async function addProcessedLabel(
  gmail: any,
  messageId: string,
  processedLabelName: string
): Promise<void> {
  try {
    // Vérifier si le label existe, sinon le créer
    const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
    const labels = (labelsResponse.data.labels || []) as gmail_v1.Schema$Label[];
    let processedLabel = labels.find((l: gmail_v1.Schema$Label) => l.name === processedLabelName);

    if (!processedLabel) {
      console.log(`[GmailService] Création du label "${processedLabelName}"`);
      const createResponse = await gmail.users.labels.create({
        userId: 'me',
        requestBody: {
          name: processedLabelName,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show'
        }
      });
      processedLabel = createResponse.data;
    }

    if (!processedLabel || !processedLabel.id) {
      throw new Error(`Label "${processedLabelName}" non trouvé ou invalide`);
    }

    // Ajouter le label au message
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        addLabelIds: [processedLabel.id]
      }
    });

    console.log(`[GmailService] Label "${processedLabelName}" ajouté au message ${messageId}`);
  } catch (error) {
    console.error(`[GmailService] Erreur lors de l'ajout du label au message ${messageId}:`, error);
  }
}

/**
 * Fonction principale qui exécute tout le processus
 */
export async function processGmailToFirestore(
  authClient: OAuth2Client,
  config: GmailProcessingConfig
): Promise<void> {
  // Déclarer les variables en dehors du try pour qu'elles soient accessibles dans le catch
  let collections: { name: string; config: any }[] = [];
  let name: string | null = null; 

  try {
    console.log('[GmailService] Démarrage du traitement Gmail vers Firestore');
    
    // Initialiser les collections ici
    collections = [
      { name: 'Kezia', config: config.sectorCollections.kezia },
      { name: 'HACCP', config: config.sectorCollections.haccp },
      { name: 'CHR', config: config.sectorCollections.chr },
      { name: 'Tabac', config: config.sectorCollections.tabac }
    ];

    for (const collectionItem of collections) {
      name = collectionItem.name; // Mettre à jour le nom de la collection en cours
      const collectionConfig = collectionItem.config;

      if (!collectionConfig.enabled || collectionConfig.labels.length === 0) {
        console.log(`[GmailService] Collection ${name} ignorée - 
          Statut: ${collectionConfig.enabled ? 'activée' : 'désactivée'}
          Labels configurés: ${collectionConfig.labels.length}
          Responsables: ${collectionConfig.responsables?.length || 0}`);
        continue;
      }

      console.log(`[GmailService] Traitement de la collection ${name}`);
      
      // Extraire les données des emails pour cette collection
      const data = await extractEmailContent(authClient, config, name, collectionConfig.labels);
      console.log(`[GmailService] ${data.length} emails extraits pour ${name}`);
      
      // Traiter chaque email
      for (const row of data) {
        const sapNumber = normalizeSapNumber(row.numeroSAP, name);
        
        if (!sapNumber) {
          const originalNum = row.numeroSAP;
          const cleanedNum = originalNum.replace(/[^0-9]/g, "").trim();
          console.log(`[GmailService] Numéro SAP rejeté dans ${name}:
            Original: "${originalNum}"
            Nettoyé: "${cleanedNum}"
            Message ID: ${row.messageId}
            Raison sociale: ${row.raisonSociale}
            Code client: ${row.codeClient}`);
          continue;
        }
        
        // Vérifier si le numéro SAP existe déjà dans cette collection
        const exists = await sapNumberExists(sapNumber, name);
        if (!exists) {
          await sendDataToFirebase(row, sapNumber, name);
          // Ajouter le label "Traité" après le traitement réussi
          const gmail = google.gmail({ version: 'v1', auth: authClient });
          await addProcessedLabel(gmail, row.messageId, config.processedLabelName);
        } else {
          console.log(`[GmailService] Numéro SAP déjà existant dans ${name}: ${sapNumber}`);
        }
      }
      
      // Nettoyer les documents "Non trouvé" pour cette collection
      await deleteRowsWithNonTrouve(name);
      
      // Nettoyer les doublons SAP pour cette collection
      await deleteRowsWithDuplicateSAP(name);
    }
    
    console.log('[GmailService] Traitement Gmail vers Firestore terminé avec succès');
  } catch (error) {
    console.error(`[GmailService] Erreur critique lors du traitement Gmail vers Firestore:
      Message: ${error instanceof Error ? error.message : String(error)}
      Stack: ${error instanceof Error ? error.stack : 'Non disponible'}
      Collections configurées: ${collections.map((c: { name: string }) => c.name).join(', ')}
      Dernière collection traitée: ${name ?? 'Aucune'}`); // Utiliser ?? pour gérer null/undefined
    throw new Error(`Échec du traitement Gmail vers Firestore: ${error instanceof Error ? error.message : String(error)}`);
  }
}
