import { google } from "googleapis";
import { getGoogleRefreshTokenFromFirestore } from "~/services/sync-installations.server";
import { getGoogleAuthClient } from "~/services/google.server";
import { getDb } from "~/firebase.admin.config.server";

export async function getEmails() {
  try {
    console.log("Démarrage de la récupération des emails...");
    
    const refreshToken = await getGoogleRefreshTokenFromFirestore();
    if (!refreshToken) {
      throw new Error("Impossible d'obtenir le refresh token Google");
    }

    const authClient = await getGoogleAuthClient({ googleRefreshToken: refreshToken });
    if (!authClient) {
      throw new Error("Impossible de créer le client d'authentification Google OAuth2");
    }

    const gmail = google.gmail({ version: 'v1', auth: authClient });
    const db = getDb();
    
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread',
      maxResults: 50
    });

    const messages = response.data.messages || [];
    console.log(`${messages.length} emails non lus trouvés`);

    for (const message of messages) {
      const email = await gmail.users.messages.get({
        userId: 'me',
        id: message.id!
      });

      if (message.id) {
        await db.collection('emails').doc(message.id).set({
          id: message.id,
          threadId: message.threadId,
          snippet: email.data.snippet,
          headers: email.data.payload?.headers,
          receivedAt: new Date(),
          processed: false
        });

        await gmail.users.messages.modify({
          userId: 'me',
          id: message.id,
          requestBody: {
            removeLabelIds: ['UNREAD']
          }
        });
      }
    }

    return {
      success: true,
      message: `${messages.length} emails traités avec succès`
    };

  } catch (error) {
    console.error("Erreur lors de la récupération des emails:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur inconnue"
    };
  }
} 