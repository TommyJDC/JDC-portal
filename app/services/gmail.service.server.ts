import { initializeFirebaseAdmin } from '~/firebase.admin.config.server';
import { FieldValue } from 'firebase-admin/firestore';
import { gmail_v1 } from 'googleapis';
import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import type { GmailProcessingConfig, SapTicket } from '~/types/firestore.types';
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { marked } from 'marked'; // Import marked

let db: FirebaseFirestore.Firestore;

// Types Gmail
interface GmailHeader {
  name: string;
  value: string;
}

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
  // Ajouter les informations d'email extraites
  mailFrom?: string;
  mailTo?: string[];
  mailCc?: string[];
  mailSubject?: string;
  mailThreadId?: string;
  mailMessageId?: string;
  mailReferences?: string;
  mailDate?: Date;
}

/**
 * Extrait le contenu des emails avec les labels spécifiés
 */
async function getMessageDetails(messageData: any): Promise<{
  from?: string;
  to?: string[];
  cc?: string[];
  subject?: string;
  threadId?: string;
  messageId?: string;
  references?: string;
  date?: Date;
}> {
  const headers = messageData.payload?.headers;
  if (!headers) return {};

  const from = headers.find((h: GmailHeader) => h?.name?.toLowerCase() === 'from')?.value;
  // Assurez-vous que 'to' est toujours un tableau
  const to = headers.find((h: GmailHeader) => h?.name?.toLowerCase() === 'to')?.value?.split(',').map((email: string) => email.trim()).filter(Boolean) || [];
  // Assurez-vous que 'cc' est toujours un tableau
  const cc = headers.find((h: GmailHeader) => h?.name?.toLowerCase() === 'cc')?.value?.split(',').map((email: string) => email.trim()).filter(Boolean) || [];
  const subject = headers.find((h: GmailHeader) => h?.name?.toLowerCase() === 'subject')?.value;
  const messageId = headers.find((h: GmailHeader) => h?.name?.toLowerCase() === 'message-id')?.value;
  // Assurez-vous que 'references' est une chaîne, même si l'en-tête est manquant
  const references = headers.find((h: GmailHeader) => h?.name?.toLowerCase() === 'references')?.value || '';
  const dateStr = headers.find((h: GmailHeader) => h?.name?.toLowerCase() === 'date')?.value;
  const date = dateStr ? new Date(dateStr) : undefined;

  return {
    from,
    to, // Sera maintenant un tableau vide si l'en-tête est absent
    cc, // Sera maintenant un tableau vide si l'en-tête est absent
    subject,
    threadId: messageData.threadId,
    messageId,
    references, // Sera maintenant une chaîne vide si l'en-tête est absent
    date
  };
}

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
        const messageDetails = await getMessageDetails(messageData);

        // Extraire les données avec des expressions régulières
        // Prioriser Raison Sociale, sinon Enseigne, avec arrêt plus robuste (plus de termes, flag 's')
        let raisonSociale = "Non trouvé";
        // Lookahead: Stop before Enseigne, Grand Compte, Adresse, Client, Téléphone, Email, Horaires
        let matchRS = /Raison Sociale\s*[\*:]?\s*(.*?)(?=\s*(?:Enseigne\s*[\*:]?|Grand Compte|Adresse\s*[\*:]?|Client\s*[\*:]?|T(?:=C3=A9|é)l(?:=C3=A9|é)phone|Email|Horaires|$))/is.exec(body);
        if (matchRS && matchRS[1]) {
            raisonSociale = matchRS[1].replace(/\*$/, '').trim();
        } else {
            // Lookahead: Stop before Grand Compte, Adresse, Client, Téléphone, Email, Horaires
            matchRS = /Enseigne\s*[\*:]?\s*(.*?)(?=\s*(?:Grand Compte|Adresse\s*[\*:]?|Client\s*[\*:]?|T(?:=C3=A9|é)l(?:=C3=A9|é)phone|Email|Horaires|$))/is.exec(body);
            if (matchRS && matchRS[1]) {
                raisonSociale = matchRS[1].replace(/\*$/, '').trim();
            }
        }
        raisonSociale = raisonSociale.replace(/\s+/g, ' ').trim(); // Clean up extra spaces

        // Chercher Numéro SAP (7+ chiffres) après "Numéro" OU entre astérisques
        const numeroSAPMatch = /(?:Num(?:=C3=A9|é)ro\s*\*?\s*(\d{7,})\s*\*?|\*(\d{7,})\*)/i.exec(body);
        // Utiliser le groupe de capture qui a fonctionné (le 1er ou le 2ème)
        const numeroSAP = numeroSAPMatch ? (numeroSAPMatch[1] || numeroSAPMatch[2] || '').trim() : "Non trouvé";

        const codeClientMatch = /(?:Code\s*)?Client\s*[\*:]?\s*(\d+)/i.exec(body); // Rend "Code " optionnel
        const codeClient = codeClientMatch ? codeClientMatch[1] : "Non trouvé";

        // Extraction de l'adresse (capturer uniquement la partie adresse)
        const adresseMatch = /Adresse\s*:?\s*((?:\d+\s+[\w\s-]+\s+\d{5}\s+[\w\s-]+))/i.exec(body);
        const adresse = adresseMatch ? adresseMatch[1].trim() : "Non trouvé";

        // Extraction de la date (format complet avec jour de la semaine)
        const dateMatch = /((?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+\d{1,2}\s+(?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+\d{4})/i.exec(body);
        const date = dateMatch ? dateMatch[0].trim() : "Non trouvé";

        // Extraction des téléphones 1 et 2 (inchangé)
        const tel1Match = /T(?:=C3=A9|é)l(?:=C3=A9|é)phone\s*1\s*(\d+)/i.exec(body);
        const tel2Match = /T(?:=C3=A9|é)l(?:=C3=A9|é)phone\s*2\s*(\d+)/i.exec(body);
        const tel1 = tel1Match ? tel1Match[1] : null;
        const tel2 = tel2Match ? tel2Match[1] : null;
        let telephone = "Non trouvé";
        if (tel1 && tel2) {
            telephone = `${tel1}, ${tel2}`;
        } else if (tel1) {
            telephone = tel1;
        } else if (tel2) {
            telephone = tel2;
        }

        // Extraction de la demande SAP (Commentaires)
        const demandeSAPMatch = /Commentaires?\s*[\*:]?\s*(.*)/is.exec(body);
        const demandeSAP = demandeSAPMatch ? demandeSAPMatch[1].trim() : "Non trouvé";
        const messageId = messageData.id || '';

        emailData.push({
          date: messageDetails.date ? messageDetails.date.toISOString() : date, // Utiliser la date de l'en-tête si disponible
          raisonSociale,
          numeroSAP,
          codeClient,
          adresse,
          telephone,
          demandeSAP,
          messageId: messageData.id || '',
          // Ajouter les nouvelles informations d'email
          mailFrom: messageDetails.from,
          mailTo: messageDetails.to,
          mailCc: messageDetails.cc,
          mailSubject: messageDetails.subject,
          mailThreadId: messageDetails.threadId,
          mailMessageId: messageDetails.messageId,
          mailReferences: messageDetails.references,
          mailDate: messageDetails.date
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

  let htmlContent = '';
  let plainTextContent = '';

  // Fonction récursive pour trouver les parties HTML et texte brut
  function findContentParts(part: any) {
    if (part.mimeType === 'text/html' && part.body && part.body.data) {
      htmlContent = Buffer.from(part.body.data, 'base64').toString('utf-8');
    } else if (part.mimeType === 'text/plain' && part.body && part.body.data) {
      plainTextContent = Buffer.from(part.body.data, 'base64').toString('utf-8');
    }

    if (part.parts) {
      for (const subPart of part.parts) {
        // Ne chercher qu'une seule fois pour éviter d'écraser avec des sous-parties
        if (!htmlContent || !plainTextContent) {
           findContentParts(subPart);
        }
      }
    }
  }

  // Chercher dans les parties du message principal
  findContentParts(message.payload);

  // Si pas trouvé dans les parties, essayer le corps principal (moins courant pour multipart)
  if (!htmlContent && !plainTextContent && message.payload.body && message.payload.body.data) {
     if (message.payload.mimeType === 'text/html') {
        htmlContent = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
     } else if (message.payload.mimeType === 'text/plain') {
        plainTextContent = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
     }
  }

  // Prioriser le HTML nettoyé
  if (htmlContent) {
    // Simple nettoyage HTML : supprimer les balises et décoder les entités HTML basiques
    let cleanedHtml = htmlContent
      .replace(/<style([\s\S]*?)<\/style>/gi, '') // Remove style blocks
      .replace(/<script([\s\S]*?)<\/script>/gi, '') // Remove script blocks
      .replace(/<[^>]*>/g, ' ') // Remove HTML tags, replace with space
      .replace(/&nbsp;/g, ' ')
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .trim();

    // Tentative de décodage Quoted-Printable si nécessaire (simple)
    try {
        cleanedHtml = cleanedHtml.replace(/=([A-F0-9]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16)));
        cleanedHtml = cleanedHtml.replace(/=\r?\n/g, ''); // Remove soft line breaks
    } catch (e) {
        console.warn("[GmailService] Échec du décodage Quoted-Printable partiel:", e);
    }

    console.log("[GmailService] Utilisation du contenu HTML nettoyé.");
    return cleanedHtml;
  }

  // Sinon, utiliser le texte brut
  if (plainTextContent) {
    console.log("[GmailService] Utilisation du contenu texte brut.");
    // Tentative de décodage Quoted-Printable si nécessaire (simple)
     try {
        plainTextContent = plainTextContent.replace(/=([A-F0-9]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16)));
        plainTextContent = plainTextContent.replace(/=\r?\n/g, ''); // Remove soft line breaks
    } catch (e) {
        console.warn("[GmailService] Échec du décodage Quoted-Printable partiel:", e);
    }
    return plainTextContent;
  }

  console.warn("[GmailService] Aucun contenu text/html ou text/plain trouvé.");
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

  // Validation seulement si la chaîne est vide
  if ((collection === 'HACCP' || collection === 'Kezia' || collection === 'CHR' || collection === 'Tabac') && cleaned.length === 0) {
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
      date: row.date, // Utiliser la chaîne de date directement
      raisonSociale: row.raisonSociale,
      numeroSAP: sapNumber,
      codeClient: row.codeClient,
      adresse: row.adresse,
      telephone: row.telephone,
      demandeSAP: row.demandeSAP,
      status: 'open', // Ajouter le statut par défaut
      // Informations de base du mail
      mailId: row.messageId,
      // Nouvelles informations d'email (s'assurer qu'elles ne sont pas undefined)
      mailFrom: row.mailFrom || '', // Assurer une chaîne vide si undefined
      mailTo: row.mailTo || [], // Assurer un tableau vide si undefined
      mailCc: row.mailCc || [], // Assurer un tableau vide si undefined
      mailSubject: row.mailSubject || '', // Assurer une chaîne vide si undefined
      mailThreadId: row.mailThreadId || '', // Assurer une chaîne vide si undefined
      mailMessageId: row.mailMessageId || '', // Assurer une chaîne vide si undefined
      mailReferences: row.mailReferences || '', // Assurer une chaîne vide si undefined
      mailDate: row.mailDate || null, // Firestore accepte null pour les dates
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
 * Sends an email response, threading it to a previous message.
 * @param authClient - The authenticated OAuth2 client.
 * @param threadId - The ID of the thread to reply to.
 * @param originalMessageId - The ID of the original message to reply to.
 * @param subject - The subject of the email.
 * @param htmlBody - The HTML body of the email.
 * @returns The ID of the sent message.
 */
export async function sendSAPResponseEmail(
  authClient: OAuth2Client,
  ticket: SapTicket,
  subject: string,
  htmlBody: string,
  caseType?: string
): Promise<string | null | undefined> {
  if (!ticket.mailId) {
    console.warn('No mail ID provided in ticket for email response');
    return null;
  }

  const gmail = google.gmail({ version: 'v1', auth: authClient });

  try {
    // Build email content
    let htmlContent = htmlBody;
    if (caseType === 'RMA' || caseType === 'MATERIAL') {
      htmlContent = `@Pascal THOMINET\n${htmlContent}`;
    }

    // Create RFC 2822 email message with all stored information
    const emailLines = [
      `From: ${ticket.mailFrom || ''}`,
      `To: ${Array.isArray(ticket.mailTo) ? ticket.mailTo.join(', ') : ticket.mailTo || ''}`,
      ticket.mailCc && ticket.mailCc.length > 0 ? `Cc: ${ticket.mailCc.join(', ')}` : '',
      `Subject: ${subject}`,
      ticket.mailMessageId ? `In-Reply-To: ${ticket.mailMessageId}` : '',
      // Construire la chaîne References en ajoutant le nouveau Message-ID à la fin
      ticket.mailReferences ? 
        `References: ${ticket.mailReferences} ${ticket.mailMessageId}` : 
        ticket.mailMessageId ? 
          `References: ${ticket.mailMessageId}` : '',
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      '',
      htmlContent
    ].filter(Boolean);

    // Encode as base64url
    const raw = Buffer.from(emailLines.join('\r\n'))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Send email, attaching it to the original thread
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw,
        threadId: ticket.mailThreadId
      }
    });

    console.log(`Email sent successfully with ID: ${response.data.id}, using stored email information:
      Thread ID: ${ticket.mailThreadId}
      Original Message ID: ${ticket.mailMessageId}
      References: ${ticket.mailReferences}
      To: ${ticket.mailTo?.join(', ')}
      Cc: ${ticket.mailCc?.join(', ')}`);
    
    return response.data.id;
  } catch (error) {
    console.error('Error sending email reply:', error);
    throw new Error(`Failed to send email reply: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Applies a Gmail label to a thread.
 * @param authClient - The authenticated OAuth2 client.
 * @param threadId - The ID of the thread to label.
 * @param labelName - The name of the label to apply.
 */
export async function applyGmailLabel(
  authClient: OAuth2Client,
  threadId: string,
  labelName: string
): Promise<void> {
  const gmail = google.gmail({ version: 'v1', auth: authClient });

  try {
    // Find the label ID by name
    const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
    const allLabels = (labelsResponse.data.labels || []) as gmail_v1.Schema$Label[];
    const label = allLabels.find((l: gmail_v1.Schema$Label) => l.name === labelName);

    if (!label || !label.id) {
      console.warn(`[GmailService] Label "${labelName}" non trouvé. Impossible d'appliquer le label au thread ${threadId}.`);
      // Optionally create the label here if it doesn't exist
      return;
    }

    // Apply the label to the thread
    await gmail.users.threads.modify({
      userId: 'me',
      id: threadId,
      requestBody: {
        addLabelIds: [label.id],
      },
    });

    console.log(`[GmailService] Label "${labelName}" appliqué au thread ${threadId}.`);
  } catch (error) {
    console.error(`[GmailService] Erreur lors de l'application du label "${labelName}" au thread ${threadId}:`, error);
    // Decide how to handle: log, notify user, retry?
  }
}

/**
 * Sends an email with the hours declaration.
 * @param authClient - The authenticated OAuth2 client.
 * @param to - The recipient email address.
 * @param subject - The subject of the email.
 * @param body - The plain text or HTML body of the email.
 * @returns The ID of the sent message.
 */
export async function sendHeuresEmail(
  accessToken: string, // Utiliser le token d'accès directement
  to: string,
  subject: string,
  body: string // Peut être HTML ou texte brut
): Promise<string | null | undefined> {
  // Initialiser le client Google API avec le token d'accès
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: 'v1', auth });

  try {
    // Créer le contenu de l'email au format RFC 2822
    const emailLines = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8', // Utiliser text/html si le corps est HTML
      '',
      body // Le corps de l'email
    ];

    // Encoder en base64url
    const raw = Buffer.from(emailLines.join('\r\n'))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Envoyer l'email
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: raw,
      },
    });

    console.log(`Email de déclaration d'heures envoyé avec succès à ${to}. Message ID: ${response.data.id}`);

    return response.data.id;
  } catch (error) {
    console.error(`Erreur lors de l'envoi de l'email de déclaration d'heures à ${to}:`, error);
    throw new Error(`Échec de l'envoi de l'email de déclaration d'heures: ${error instanceof Error ? error.message : String(error)}`);
  }
}


/**
 * Adds the "Processed" label to an email
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
