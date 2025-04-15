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
 * @throws Error if session or tokens are missing, or refresh fails.
 */
export async function getGoogleAuthClient(session: UserSession | null) {
  if (!session?.googleAccessToken || !session.googleRefreshToken) {
    throw new Error("User session or Google tokens are missing.");
  }
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new Error("Server Google credentials (ID or Secret) are not configured.");
  }

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
  );

  const tokens: Credentials = {
    access_token: session.googleAccessToken,
    refresh_token: session.googleRefreshToken,
    // scope: session.scopes, // Include scopes if stored in session
    token_type: 'Bearer',
    expiry_date: session.tokenExpiry,
  };

  oauth2Client.setCredentials(tokens);

  // Optional: Check if the token is expired and refresh if needed.
  // googleapis library might handle this automatically in some cases,
  // but explicit check can be more robust.
  if (session.tokenExpiry && session.tokenExpiry < Date.now() + 60000) { // Refresh if expires in next 60s
    console.log("[GoogleAuthClient] Access token expired or expiring soon. Refreshing...");
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      console.log("[GoogleAuthClient] Token refreshed successfully.");
      oauth2Client.setCredentials(credentials);

      // IMPORTANT: Update the session with the new tokens!
      // This requires committing the session back. This function currently
      // doesn't have access to commitSession. The calling loader/action
      // will need to handle session updates after calling this function
      // if a refresh occurred. We can return the new tokens for this purpose.
      // For now, we just update the client instance.
      // TODO: Implement session update logic in the caller based on returned new tokens.

    } catch (error) {
      console.error("[GoogleAuthClient] Error refreshing access token:", error);
      // Handle refresh error (e.g., user revoked access)
      // Maybe throw a specific error to trigger re-authentication?
      throw new Error("Failed to refresh Google access token. Please re-authenticate.");
    }
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

// TODO: Add function writeSheetData(authClient, spreadsheetId, range, values)
// This will be needed later for editing, but requires unique row identifier logic.


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
