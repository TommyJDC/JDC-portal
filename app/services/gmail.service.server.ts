import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { dbAdmin } from '~/firebase.admin.config.server';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import type { GmailProcessingConfig } from '~/types/firestore.types';

interface GmailLabel {
  id: string;
  name: string;
  labelListVisibility?: string;
  messageListVisibility?: string;
}

/**
 * Interface pour les données extraites des emails
 */
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
 * Extrait le contenu des emails avec le label spécifié
 * @param authClient Client OAuth2 authentifié
 * @param labelName Nom du label Gmail à rechercher
 * @param maxResults Nombre maximum d'emails à traiter
 * @returns Tableau de données extraites des emails
 */
export async function extractEmailContent(
  authClient: OAuth2Client,
  config: GmailProcessingConfig
): Promise<EmailData[]> {
  const gmail = google.gmail({ version: 'v1', auth: authClient });
  const emailData: EmailData[] = [];

  try {
    // Récupérer les IDs des labels
    console.log(`[GmailService] Recherche des labels:`, config.targetLabels);
    const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
    const labels = labelsResponse.data.labels || [];
    const labelIds = config.targetLabels
      .map(labelName => {
        const label = labels.find(l => l.name === labelName);
        if (!label || !label.id) {
          console.warn(`[GmailService] Label "${labelName}" non trouvé`);
          return null;
        }
        return label.id;
      })
      .filter((id): id is string => id !== null);

    if (labelIds.length === 0) {
      console.error(`[GmailService] Aucun label cible trouvé`);
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
    console.log(`[GmailService] ${messages.length} messages trouvés`);

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
        const date = /Pour le (.*)/i.exec(body);
        const raisonSociale = /Enseigne \*(.*?)\*/.exec(body);
        const numeroSAP = /Numéro \*(.*?)\*/.exec(body);
        const codeClient = /Client (\d+)/.exec(body);
        const regexAdresse = /Adresse((?! de livraison)[\s\S]*?)(?=\nTéléphone 1)/;
        const matchAdresse = regexAdresse.exec(body);
        const adresse = matchAdresse ? matchAdresse[1].trim() : "Non trouvé";
        const telephone = /Téléphone 1 (\d+)[^\d\n]*(?:\nTéléphone 2 (\d+))?/i.exec(body);
        const demandeSAP = /Commentaires([\s\S]*)/i.exec(body);
        const messageId = messageData.id || '';

        emailData.push({
          date: date ? date[1] : "Non trouvé",
          raisonSociale: raisonSociale ? raisonSociale[1] : "Non trouvé",
          numeroSAP: numeroSAP ? numeroSAP[1] : "Non trouvé",
          codeClient: codeClient ? codeClient[1] : "Non trouvé",
          adresse: adresse,
          telephone: telephone ? (telephone[1] + (telephone[2] ? ', ' + telephone[2] : '')) : "Non trouvé",
          demandeSAP: demandeSAP ? demandeSAP[1] : "Non trouvé",
          messageId: messageId
        });
      } catch (error) {
        console.error(`[GmailService] Erreur lors du traitement du message ${message.id}:`, error);
      }
    }

    return emailData;
  } catch (error) {
    console.error('[GmailService] Erreur lors de l\'extraction des emails:', error);
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
function normalizeSapNumber(sapNumber: string | null | undefined): string {
  if (!sapNumber) return "";
  return sapNumber.replace(/[^0-9]/g, "").trim();
}

/**
 * Vérifie si un numéro SAP existe déjà dans Firestore
 */
export async function sapNumberExists(sapNumber: string): Promise<boolean> {
  if (!sapNumber) return false;

  try {
    const query = dbAdmin.collection('Kezia').where('numeroSAP', '==', sapNumber).limit(1);
    const snapshot = await query.get();
    return !snapshot.empty;
  } catch (error) {
    console.error(`[GmailService] Erreur lors de la vérification du numéro SAP ${sapNumber}:`, error);
    return false;
  }
}

/**
 * Envoie les données extraites à Firestore
 */
export async function sendDataToFirebase(row: EmailData, sapNumber: string): Promise<void> {
  const FIRESTORE_SECRET = "E92N49W43Y29";
  
  try {
    await dbAdmin.collection('Kezia').add({
      date: { stringValue: row.date },
      raisonSociale: { stringValue: row.raisonSociale },
      numeroSAP: { stringValue: sapNumber },
      codeClient: { stringValue: row.codeClient },
      adresse: { stringValue: row.adresse },
      telephone: { stringValue: row.telephone },
      demandeSAP: { stringValue: row.demandeSAP },
      messageId: { stringValue: row.messageId },
      secret: { stringValue: FIRESTORE_SECRET },
      createdAt: FieldValue.serverTimestamp()
    });
    console.log(`[GmailService] Données envoyées à Firestore pour le numéro SAP: ${sapNumber}`);
  } catch (error) {
    console.error(`[GmailService] Erreur lors de l'envoi des données à Firestore:`, error);
    throw new Error(`Impossible d'envoyer les données à Firestore: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Supprime les documents avec "Non trouvé" comme numéro SAP
 */
export async function deleteRowsWithNonTrouve(): Promise<void> {
  const secret = "E92N49W43Y29";
  
  try {
    const snapshot = await dbAdmin.collection('Kezia')
      .where('numeroSAP.stringValue', '==', 'Non trouvé')
      .get();
    
    console.log(`[GmailService] ${snapshot.size} documents avec "Non trouvé" trouvés`);
    
    const batch = dbAdmin.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log(`[GmailService] ${snapshot.size} documents avec "Non trouvé" supprimés`);
  } catch (error) {
    console.error('[GmailService] Erreur lors de la suppression des documents "Non trouvé":', error);
  }
}

/**
 * Supprime les documents avec des numéros SAP en double
 */
export async function deleteRowsWithDuplicateSAP(): Promise<void> {
  try {
    const snapshot = await dbAdmin.collection('Kezia').get();
    const docs = snapshot.docs;
    
    const seenSAP: Record<string, string> = {}; // sapNumber -> docId
    const toDelete: string[] = [];
    
    docs.forEach(doc => {
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
    
    console.log(`[GmailService] ${toDelete.length} documents en double trouvés`);
    
    if (toDelete.length > 0) {
      const batch = dbAdmin.batch();
      toDelete.forEach(id => {
        batch.delete(dbAdmin.collection('Kezia').doc(id));
      });
      
      await batch.commit();
      console.log(`[GmailService] ${toDelete.length} documents en double supprimés`);
    }
  } catch (error) {
    console.error('[GmailService] Erreur lors de la suppression des doublons:', error);
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
    const labels = (labelsResponse.data.labels || []) as GmailLabel[];
    let processedLabel = labels.find((l: GmailLabel) => l.name === processedLabelName);

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
  try {
    console.log('[GmailService] Démarrage du traitement Gmail vers Firestore');
    
    // Extraire les données des emails
    const data = await extractEmailContent(authClient, config);
    console.log(`[GmailService] ${data.length} emails extraits`);
    
    // Traiter chaque ligne de données
    for (const row of data) {
      const sapNumber = normalizeSapNumber(row.numeroSAP);
      
      if (!sapNumber || sapNumber === "") {
        console.log("[GmailService] Numéro SAP invalide, saut de l'entrée.");
        continue;
      }
      
      // Vérifier si le numéro SAP existe déjà
      const exists = await sapNumberExists(sapNumber);
      if (!exists) {
        await sendDataToFirebase(row, sapNumber);
        // Ajouter le label "Traité" après le traitement réussi
        const gmail = google.gmail({ version: 'v1', auth: authClient });
        await addProcessedLabel(gmail, row.messageId, config.processedLabelName);
      } else {
        console.log(`[GmailService] Numéro SAP déjà existant: ${sapNumber}`);
      }
    }
    
    // Nettoyer les documents "Non trouvé"
    await deleteRowsWithNonTrouve();
    
    // Nettoyer les doublons SAP (deux fois pour être sûr)
    await deleteRowsWithDuplicateSAP();
    await deleteRowsWithDuplicateSAP();
    
    console.log('[GmailService] Traitement Gmail vers Firestore terminé avec succès');
  } catch (error) {
    console.error('[GmailService] Erreur lors du traitement Gmail vers Firestore:', error);
    throw new Error(`Échec du traitement Gmail vers Firestore: ${error instanceof Error ? error.message : String(error)}`);
  }
}
