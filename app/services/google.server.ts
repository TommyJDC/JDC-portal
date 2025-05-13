import { google } from 'googleapis';
import type { UserSessionData } from './session.server'; // MODIFIÉ ICI
import type { Credentials } from 'google-auth-library';
// Importer googleConfig uniquement pour baseUrl ou d'autres configs non secrètes si nécessaire
import { googleConfig as appGoogleConfig } from '../firebase.config'; // Renommer pour éviter la confusion

// Lire les secrets OAuth directement depuis les variables d'environnement côté serveur
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
// Utiliser le baseUrl de firebase.config.ts ou le définir via une variable d'env aussi
const APP_BASE_URL = appGoogleConfig.baseUrl; // Ou process.env.APP_BASE_URL;
const REDIRECT_URI = `${APP_BASE_URL}/auth/google/callback`;


export async function getGoogleAuthClient(session: UserSessionData | null | { googleRefreshToken: string }) {
  console.log('[google.server] Début de getGoogleAuthClient');
  
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.error('[google.server] Configuration Google manquante');
    throw new Error("Google Client ID ou Client Secret ne sont pas configurés dans les variables d'environnement du serveur.");
  }

  if (!session?.googleRefreshToken) {
    console.error('[google.server] Token de rafraîchissement manquant dans la session');
    throw new Error("User session or Google refresh token is missing.");
  }

  console.log('[google.server] Création du client OAuth2');
  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
  );

  let accessToken: string | undefined = undefined;
  let expiryDate: number | undefined = undefined;

  if ('googleAccessToken' in session && typeof session.googleAccessToken === 'string') {
    accessToken = session.googleAccessToken;
    console.log('[google.server] Token d\'accès trouvé dans la session');
  }
  if ('tokenExpiry' in session && typeof session.tokenExpiry === 'number') {
    expiryDate = session.tokenExpiry;
    console.log('[google.server] Date d\'expiration trouvée dans la session:', new Date(expiryDate).toISOString());
  }

  const tokens: Credentials = {
    access_token: accessToken,
    refresh_token: session.googleRefreshToken,
    token_type: 'Bearer',
    expiry_date: expiryDate,
  };

  oauth2Client.setCredentials(tokens);

  const needsRefresh = !tokens.access_token || (tokens.expiry_date && tokens.expiry_date < Date.now() + 60000);
  console.log('[google.server] État du token:', {
    hasAccessToken: !!tokens.access_token,
    hasExpiryDate: !!tokens.expiry_date,
    currentTime: new Date().toISOString(),
    expiryTime: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : 'N/A',
    needsRefresh
  });
  
  if (needsRefresh) {
    try {
      console.log('[google.server] Rafraîchissement du token Google nécessaire');
      oauth2Client.setCredentials({ refresh_token: session.googleRefreshToken });
      const { credentials } = await oauth2Client.refreshAccessToken();
      console.log('[google.server] Nouveau token obtenu avec succès');
      
      oauth2Client.setCredentials(credentials);
      
      try {
        console.log('[google.server] Validation du nouveau token');
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        await gmail.users.getProfile({ userId: 'me' });
        console.log('[google.server] Nouveau token Google validé avec succès');
        
        // Mettre à jour la session avec le nouveau token
        if ('updateSession' in session && typeof session.updateSession === 'function') {
          await session.updateSession({
            googleAccessToken: credentials.access_token,
            tokenExpiry: credentials.expiry_date
          });
          console.log('[google.server] Session mise à jour avec le nouveau token');
        }
      } catch (error) {
        console.error('[google.server] Échec de la validation du nouveau token:', error);
        throw new Error('Le nouveau token Google n\'est pas valide');
      }
    } catch (error: any) {
      if (error.response?.data?.error === 'invalid_grant') {
        console.error('[google.server] Token invalide pour l\'utilisateur:', {
          userId: 'userId' in session ? session.userId : 'unknown',
          email: 'email' in session ? session.email : 'unknown'
        });
        throw new Error("L'authentification Google n'est plus valide. Veuillez vous ré-authentifier.");
      }
      console.error('[google.server] Échec du rafraîchissement du token:', error);
      throw new Error(`Impossible de rafraîchir le token Google: ${error.message}`);
    }
  } else {
    console.log('[google.server] Token actuel valide, pas besoin de rafraîchissement');
  }

  return oauth2Client;
}

export async function readSheetData(
  authClient: any,
  spreadsheetId: string,
  range: string
): Promise<any[][] | null> {
  const sheets = google.sheets({ version: 'v4', auth: authClient });
  try {
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    return response.data.values ?? [];
  } catch (error: any) {
    if (error.response?.status === 403) {
      throw new Error(`Permission denied for spreadsheet ${spreadsheetId}.`);
    }
    if (error.response?.status === 404) {
      throw new Error(`Spreadsheet not found (ID: ${spreadsheetId}, Range: ${range}).`);
    }
    throw new Error(`Failed to read Google Sheet data: ${error.message}`);
  }
}

export async function writeSheetData(
  authClient: any,
  spreadsheetId: string,
  range: string,
  values: any[][]
): Promise<any> {
  const sheets = google.sheets({ version: 'v4', auth: authClient });
  try {
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values }
    });
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 403) {
      throw new Error(`Permission denied for spreadsheet ${spreadsheetId}.`);
    }
    if (error.response?.status === 404) {
      throw new Error(`Spreadsheet not found (ID: ${spreadsheetId}, Range: ${range}).`);
    }
    throw new Error(`Failed to write Google Sheet data: ${error.message}`);
  }
}

export async function getCalendarEvents(
  authClient: any,
  timeMin: string,
  timeMax: string
): Promise<any[]> {
  const calendar = google.calendar({ version: 'v3', auth: authClient });
  try {
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 50,
    });
    return response.data.items ?? [];
  } catch (error: any) {
    if (error.response?.status === 403) {
      throw new Error(`Permission denied for Google Calendar.`);
    }
    if (error.response?.status === 404) {
      throw new Error(`Primary calendar not found.`);
    }
    throw new Error(`Failed to fetch Google Calendar events: ${error.message}`);
  }
}
