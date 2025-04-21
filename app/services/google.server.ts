import { google } from 'googleapis';
import type { UserSession } from './session.server'; // Assuming UserSession has google tokens
import type { Credentials } from 'google-auth-library';

// Ensure Google credentials from .env are loaded (needed for OAuth client)
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const APP_BASE_URL = process.env.APP_BASE_URL; // Needed for redirect URI

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !APP_BASE_URL) {
  console.error("Missing GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or APP_BASE_URL in environment variables.");
  // Depending on your app's needs, you might throw an error or handle this differently
  // For now, log the error. Functions using this might fail later.
}

const REDIRECT_URI = `${APP_BASE_URL}/auth/google/callback`;

/**
 * Creates an OAuth2 client authenticated with the user's tokens.
 * Handles token refresh if necessary.
 * @param session - The user session containing Google tokens.
 * @returns An authenticated OAuth2 client instance.
 * @throws Error if session is missing, refresh token is missing, server credentials are not configured, or refresh fails.
 */
// Allow session to be UserSession, null, or an object containing just the refresh token
export async function getGoogleAuthClient(session: UserSession | null | { googleRefreshToken: string }) {
  // We absolutely need a refresh token.
  if (!session?.googleRefreshToken) {
    throw new Error("User session or Google refresh token is missing.");
  }
  // Server credentials must be configured.
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error("Server Google credentials (ID or Secret) are not configured.");
  }

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
  );

  const tokens: Credentials = {
    // Try to set initial credentials if access token is available
    // The 'session' might only contain the refresh token if called from certain contexts
    access_token: ('googleAccessToken' in session && session.googleAccessToken) ? session.googleAccessToken : undefined,
    refresh_token: session.googleRefreshToken, // Always present due to check above
    token_type: 'Bearer',
    // Set expiry only if it exists in the session object
    expiry_date: ('tokenExpiry' in session && session.tokenExpiry) ? session.tokenExpiry : undefined,
  };

  oauth2Client.setCredentials(tokens); // Set whatever we have initially

  // Determine if we need to refresh:
  // 1. Access token is missing.
  // 2. Access token is present but expired or expiring soon.
  const needsRefresh = !tokens.access_token || (tokens.expiry_date && tokens.expiry_date < Date.now() + 60000); // 60 seconds buffer

  if (needsRefresh) {
    console.log(`[GoogleAuthClient] Refresh needed. Reason: ${!tokens.access_token ? 'Access token missing' : 'Token expired or expiring soon'}. Refreshing...`);
    try {
      // Ensure the refresh token is set for the refresh call,
      // as the initial setCredentials might have failed if access token was missing.
      oauth2Client.setCredentials({ refresh_token: session.googleRefreshToken });
      const { credentials } = await oauth2Client.refreshAccessToken();
      console.log("[GoogleAuthClient] Token refreshed successfully.");
      oauth2Client.setCredentials(credentials); // Set the new credentials (includes new access token)

      // IMPORTANT: The caller needs to handle updating the session/user profile
      // with the potentially new refresh token and expiry date if they are returned.
      // This function currently doesn't have access to commitSession or update user profiles.
      // TODO: Consider returning the new credentials from this function so the caller can update storage.
      // For now, we just update the client instance for immediate use.

    } catch (error: any) { // Added : any type for error
      console.error("[GoogleAuthClient] Error refreshing access token:", error);
      // Handle refresh error (e.g., user revoked access)
      // Check if the error indicates invalid grant (revoked access)
      if (error.response?.data?.error === 'invalid_grant') {
         console.error("[GoogleAuthClient] Refresh token is invalid or revoked. User needs to re-authenticate.");
         // Optionally update user profile status here if possible, or let the caller handle it.
         throw new Error("Google authentication is invalid or revoked. Please re-authorize the application.");
      }
      throw new Error(`Failed to refresh Google access token: ${error.message}`);
    }
  } else {
    console.log("[GoogleAuthClient] Existing access token is valid.");
  }

  return oauth2Client;
}

/**
 * Reads data from a Google Sheet range.
 * @param authClient - Authenticated OAuth2 client.
 * @param spreadsheetId - The ID of the spreadsheet.
 * @param range - The A1 notation of the range to retrieve (e.g., 'Sheet1!A1:B2').
 * @returns A promise resolving to the sheet data (array of arrays).
 */
export async function readSheetData(
    authClient: any, // Type should be OAuth2Client, but use 'any' for simplicity if type issues arise
    spreadsheetId: string,
    range: string
): Promise<any[][] | null> {
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    console.log(`[GoogleSheets] Reading data from spreadsheetId: ${spreadsheetId}, range: ${range}`);
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
        });
        console.log(`[GoogleSheets] Successfully read data for range: ${range}`);
        return response.data.values ?? []; // Return empty array if no values
    } catch (error: any) {
        console.error(`[GoogleSheets] Error reading sheet data (ID: ${spreadsheetId}, Range: ${range}):`, error.response?.data || error.message);
        // Handle specific errors like 403 (permission denied), 404 (not found)
        if (error.response?.status === 403) {
             throw new Error(`Permission denied for spreadsheet ${spreadsheetId}. Ensure the user granted 'drive' or 'spreadsheets' scope and has access to the sheet.`);
        }
         if (error.response?.status === 404) {
             throw new Error(`Spreadsheet or sheet/range not found (ID: ${spreadsheetId}, Range: ${range}).`);
        }
        throw new Error(`Failed to read Google Sheet data: ${error.message}`);
    }
}

/**
 * Updates values in a specific range of a Google Sheet.
 * @param authClient - Authenticated OAuth2 client
 * @param spreadsheetId - The ID of the spreadsheet
 * @param range - The A1 notation of the range to update (e.g., 'Sheet1!N2:P2')
 * @param values - The values to write to the range
 * @returns A promise resolving to the update response
 */
export async function writeSheetData(
    authClient: any,
    spreadsheetId: string,
    range: string,
    values: any[][]
): Promise<any> {
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    console.log(`[GoogleSheets] Writing data to spreadsheetId: ${spreadsheetId}, range: ${range}`);
    try {
        const response = await sheets.spreadsheets.values.update({
            spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: values
            }
        });
        console.log(`[GoogleSheets] Successfully updated data for range: ${range}`);
        return response.data;
    } catch (error: any) {
        console.error(`[GoogleSheets] Error writing sheet data (ID: ${spreadsheetId}, Range: ${range}):`, error.response?.data || error.message);
        if (error.response?.status === 403) {
            throw new Error(`Permission denied for spreadsheet ${spreadsheetId}. Ensure the user has write access to the sheet.`);
        }
        if (error.response?.status === 404) {
            throw new Error(`Spreadsheet or sheet/range not found (ID: ${spreadsheetId}, Range: ${range}).`);
        }
        throw new Error(`Failed to write Google Sheet data: ${error.message}`);
    }
}


// --- Google Calendar Functions ---

/**
 * Fetches calendar events for the primary calendar within a given time range.
 * @param authClient Authenticated OAuth2 client.
 * @param timeMin Start time (ISO string).
 * @param timeMax End time (ISO string).
 * @returns A promise resolving to an array of calendar events.
 */
export async function getCalendarEvents(
    authClient: any, // Type should be OAuth2Client
    timeMin: string,
    timeMax: string
): Promise<any[]> { // Consider defining a stricter type for CalendarEvent
    const calendar = google.calendar({ version: 'v3', auth: authClient });
    console.log(`[GoogleCalendar] Fetching events from primary calendar between ${timeMin} and ${timeMax}`);
    try {
        const response = await calendar.events.list({
            calendarId: 'primary', // Use the primary calendar of the authenticated user
            timeMin: timeMin,
            timeMax: timeMax,
            singleEvents: true, // Expand recurring events into single instances
            orderBy: 'startTime', // Order events by start time
            maxResults: 50, // Limit the number of events fetched (adjust as needed)
        });
        const events = response.data.items ?? [];
        console.log(`[GoogleCalendar] Successfully fetched ${events.length} events.`);
        return events;
    } catch (error: any) {
        console.error(`[GoogleCalendar] Error fetching calendar events:`, error.response?.data || error.message);
        if (error.response?.status === 403) {
             throw new Error(`Permission denied for Google Calendar. Ensure the user granted 'calendar' or 'calendar.readonly' scope.`);
        }
         if (error.response?.status === 404) {
             throw new Error(`Primary calendar not found.`);
        }
        throw new Error(`Failed to fetch Google Calendar events: ${error.message}`);
    }
}
