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


export async function getGoogleAuthClient(session: UserSessionData | null | { googleRefreshToken: string }) { // MODIFIÉ ICI
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error("Google Client ID ou Client Secret ne sont pas configurés dans les variables d'environnement du serveur.");
  }
  if (!session?.googleRefreshToken) {
    throw new Error("User session or Google refresh token is missing.");
  }

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
  );

  // Préparer les tokens pour les credentials de manière plus type-safe
  let accessToken: string | undefined = undefined;
  let expiryDate: number | undefined = undefined;

  // session est garanti non-null ici à cause du check `!session?.googleRefreshToken`
  // et googleRefreshToken est garanti d'exister sur session.
  // Maintenant, vérifions les propriétés optionnelles.
  if ('googleAccessToken' in session && typeof session.googleAccessToken === 'string') {
    accessToken = session.googleAccessToken;
  }
  if ('tokenExpiry' in session && typeof session.tokenExpiry === 'number') {
    expiryDate = session.tokenExpiry;
  }

  const tokens: Credentials = {
    access_token: accessToken,
    refresh_token: session.googleRefreshToken, // Garanti d'exister et d'être une string
    token_type: 'Bearer',
    expiry_date: expiryDate,
  };

  oauth2Client.setCredentials(tokens);

  const needsRefresh = !tokens.access_token || (tokens.expiry_date && tokens.expiry_date < Date.now() + 60000);
  
  if (needsRefresh) {
    try {
      oauth2Client.setCredentials({ refresh_token: session.googleRefreshToken });
      const { credentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(credentials);
    } catch (error: any) {
      if (error.response?.data?.error === 'invalid_grant') {
        // Il serait bon de logger l'email de l'utilisateur ici si possible, pour identifier qui doit se ré-authentifier
        console.error(`Invalid grant for user (refresh token likely revoked). User needs to re-authorize. Session: ${JSON.stringify(session)}`);
        throw new Error("Google authentication is invalid or revoked. Please re-authorize the application.");
      }
      // Logger plus de détails sur l'erreur
      console.error(`Failed to refresh Google access token. Error: ${error.message}, Response: ${JSON.stringify(error.response?.data)}, Session: ${JSON.stringify(session)}`);
      throw new Error(`Failed to refresh Google access token: ${error.message}`);
    }
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
