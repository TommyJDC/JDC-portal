import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import type { SapTicket } from "~/types/firestore.types";
import { sendSAPResponseEmail } from "./gmail.service.server";
import type { OAuth2Client } from "google-auth-library";

// Initialize the Google Generative AI client
// Ensure the API key is loaded securely, e.g., from environment variables
const apiKey = process.env.GEMINI_API_KEY; // Assuming API key is in environment variables

if (!apiKey) {
  console.error("GEMINI_API_KEY is not set in environment variables.");
  // Depending on requirements, you might want to throw an error here
  // or handle it in the calling function.
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Configuration for the AI model
const generationConfig = {
  temperature: 0.9,
  topK: 1,
  topP: 1,
  maxOutputTokens: 2048,
};

// Safety settings for content generation
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

/**
 * Safely extracts the string value from a ticket property, handling both { stringValue: string } and simple string formats.
 * @param prop The ticket property.
 * @param defaultValue The default value to return if the property is null, undefined, or not in the expected format.
 * @returns The string value of the property or the default value.
 */
function getTicketStringValue(prop: { stringValue: string } | string | undefined | null, defaultValue: string = 'N/A'): string {
  if (prop === undefined || prop === null) {
    return defaultValue;
  }
  if (typeof prop === 'string') {
    return prop;
  }
  if (typeof prop === 'object' && prop !== null && 'stringValue' in prop && typeof prop.stringValue === 'string') {
    return prop.stringValue;
  }
  return defaultValue;
}


/**
 * Generates an AI summary based on ticket details, technician notes, case type, and a template.
 * @param ticket - The SAP ticket details.
 * @param technicianNotes - Notes provided by the technician.
 * @param caseType - The type of case ('CLOSURE', 'RMA', 'NO_RESPONSE').
 * @param template - The template to use for generating the prompt.
 * @returns A promise resolving to the generated summary string.
 * @throws Error if the API key is missing, the AI client is not initialized, or generation fails.
 */
export async function generateAISummary(
  authClient: OAuth2Client,
  ticket: SapTicket & { messageId?: { stringValue: string } },
  technicianNotes: string | undefined,
  caseType: 'CLOSURE' | 'RMA' | 'NO_RESPONSE',
  template?: string
): Promise<string> {
  if (!genAI) {
    console.error("[ai.service.server] AI client not initialized. GEMINI_API_KEY missing?");
    throw new Error("Service AI non disponible. Clé API manquante.");
  }

  console.log(`[ai.service.server] Generating AI summary for ticket ${ticket.id}, case: ${caseType}`);

  // Configuration des templates spécifiques
  const emailTemplates = {
    CLOSURE: {
      subject: `[CLÔTURE] Ticket ${getTicketStringValue(ticket.numeroSAP)}`,
      greeting: 'Bonjour,',
      content: `Notre équipe a résolu le problème suivant :`
    },
    RMA: {
      subject: `[RMA] Demande retour matériel - ${getTicketStringValue(ticket.numeroSAP)}`,
      greeting: 'Bonjour,',
      content: `Nous sollicitons un retour matériel pour :`
    },
    MATERIAL: {
      subject: `[ENVOI] Demande matériel - ${getTicketStringValue(ticket.numeroSAP)}`,
      greeting: 'Bonjour,',
      content: `Nous avons besoin d\'un envoi matériel pour :`
      
    },
    NO_RESPONSE: {
      subject: `[RELANCE] Ticket ${getTicketStringValue(ticket.numeroSAP)}`,
      greeting: 'Bonjour,',
      content: `Suite à notre dernier échange :`
    }
  };

  // Récupération du template adapté
  const selectedTemplate = emailTemplates[caseType] || {
    subject: `[SUIVI] Ticket ${getTicketStringValue(ticket.numeroSAP)}`,
    greeting: 'Bonjour,',
    content: '',
  };

  // Construction conditionnelle du prompt
  let prompt = template;

  if (!prompt) {
    let ticketDetails = '';
    const numeroSAP = getTicketStringValue(ticket.numeroSAP, '');
    const client = getTicketStringValue(ticket.client, getTicketStringValue(ticket.raisonSociale, ''));
    const descriptionProbleme = getTicketStringValue(ticket.descriptionProbleme, getTicketStringValue(ticket.description, ''));

    if (numeroSAP) ticketDetails += `Numéro SAP: ${numeroSAP}\n`;
    if (client) ticketDetails += `Client: ${client}\n`;
    if (descriptionProbleme) ticketDetails += `Description du problème: ${descriptionProbleme}\n`;
    if (technicianNotes) ticketDetails += `Notes du technicien: ${technicianNotes}\n`;

    if (ticketDetails) {
      prompt = `
${selectedTemplate.subject}

${selectedTemplate.greeting}

${selectedTemplate.content}

--- Détails du Ticket ---
${ticketDetails}

--- Instructions pour la réponse ---
- Rédigez une réponse claire et professionnelle en français.
- Ce mail est destiné à une équipe interne (par exemple, l'équipe commerciale ou administrative), PAS au client final.
- L'expéditeur du mail est un technicien de l'entreprise.
- Utilisez un format HTML pour la mise en page. Structurez le contenu avec des balises comme <h1>, <h2>, <p>, <strong>, <ul>, <li>, <br>. Assurez-vous que la mise en page est claire et facile à lire.
- Incluez des emojis pertinents pour rendre le message convivial.
- NE PAS inclure d'informations de contact du service d'assistance ou de numéro de téléphone.
- Adaptez le contenu en fonction du type de cas (${caseType}).
- Pour les cas RMA/MATERIAL, mentionnez "@Pascal THOMINET" au début du corps de l'email.
- Commencez le mail par la salutation "Bonjour,".
- Terminez le mail par "Cordialement,". NE PAS inclure de nom ou de signature après "Cordialement,".
`;
    } else {
      // Prompt alternatif si toutes les informations clés sont manquantes
      prompt = `
${selectedTemplate.subject}

${selectedTemplate.greeting}

${selectedTemplate.content}

--- Informations disponibles ---
${technicianNotes ? `Notes du technicien: ${technicianNotes}\n` : 'Aucune information détaillée disponible pour ce ticket.'}

--- Instructions pour la réponse ---
- Rédigez un résumé en français basé uniquement sur les informations disponibles ci-dessus (principalement les notes du technicien si présentes).
- Ce mail est destiné à une équipe interne (par exemple, l'équipe commerciale ou administrative), PAS au client final.
- L'expéditeur du mail est un technicien de l'entreprise.
- Utilisez un format HTML pour la mise en page. Structurez le contenu avec des balises comme <h1>, <h2>, <p>, <strong>, <ul>, <li>, <br>. Assurez-vous que la mise en page est claire et facile à lire.
- Incluez des emojis pertinents.
- NE PAS inclure d'informations de contact du service d'assistance ou de numéro de téléphone.
- Adaptez le contenu en fonction du type de cas (${caseType}).
- Pour les cas RMA/MATERIAL, mentionnez "@Pascal THOMINET" au début du corps de l'email.
- Évitez de mentionner explicitement que des informations sont manquantes. Concentrez-vous sur ce qui peut être déduit des notes du technicien.
- Commencez le mail par la salutation "Bonjour,".
- Terminez le mail par "Cordialement,". NE PAS inclure de nom ou de signature après "Cordialement,".
`;
    }
  }

  console.log("[ai.service.server] Prompt sent to AI:", prompt);

  // Add other relevant fields as needed based on caseType

  try {
    // Use the appropriate model
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig,
      safetySettings,
    });

    const response = result.response;

    if (response?.candidates?.[0]?.content?.parts?.[0]?.text) {
      const generatedText = response.candidates[0].content.parts[0]?.text || '';
      console.log("[ai.service.server] Generated text:", generatedText);

      // Retourner le texte généré pour que l'action de la route puisse l'utiliser pour l'envoi d'e-mail
      return generatedText;
    } else {
      const blockReason = response?.promptFeedback?.blockReason;
      const finishReason = response?.candidates?.[0]?.finishReason;
      console.warn(`[ai.service.server] Gemini response issue. Block Reason: ${blockReason}, Finish Reason: ${finishReason}`);
      throw new Error(blockReason ? `Génération bloquée: ${blockReason}` : (finishReason ? `Génération terminée avec raison: ${finishReason}` : "Aucune réponse textuelle reçue de l'IA."));
    }

  } catch (err: any) {
    console.error("[ai.service.server] Error generating summary with Gemini:", err);
    if (err.message?.includes('API key not valid')) {
      throw new Error("Clé API Gemini invalide ou expirée.");
    } else if (err.message?.includes('SAFETY')) {
      throw new Error("La génération a été bloquée pour des raisons de sécurité.");
    } else if (err.message?.includes('quota')) {
      throw new Error("Quota d'API Gemini dépassé.");
    } else {
      throw new Error(`Échec de la génération du résumé AI: ${err.message || "Une erreur inconnue est survenue."}`);
    }
  }
}
