import { google } from 'googleapis';
import type { UserSession } from './session.server';
import type { Credentials } from 'google-auth-library';
import { googleConfig } from '../firebase.config';

const REDIRECT_URI = `${googleConfig.baseUrl}/auth/google/callback`;

export async function getGoogleAuthClient(session: UserSession | null | { googleRefreshToken: string }) {
  if (!session?.googleRefreshToken) {
    throw new Error("User session or Google refresh token is missing.");
  }

  const oauth2Client = new google.auth.OAuth2(
    googleConfig.clientId,
    googleConfig.clientSecret,
    REDIRECT_URI
  );

  const tokens: Credentials = {
    access_token: ('googleAccessToken' in session && session.googleAccessToken) ? session.googleAccessToken : undefined,
    refresh_token: session.googleRefreshToken,
    token_type: 'Bearer',
    expiry_date: ('tokenExpiry' in session && session.tokenExpiry) ? session.tokenExpiry : undefined,
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
        throw new Error("Google authentication is invalid or revoked. Please re-authorize the application.");
      }
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
