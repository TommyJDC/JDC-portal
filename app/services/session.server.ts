import { createCookieSessionStorage } from "@remix-run/node"; // or cloudflare/deno

// Define the structure of your user session data
export interface UserSession {
  userId: string; // Or your user ID from Firestore/Firebase Auth
  email: string | null;
  displayName: string | null;
  googleAccessToken?: string;
  googleRefreshToken?: string;
  tokenExpiry?: number; // Timestamp when the access token expires
  // Add other user profile data as needed
}

// Define the structure of the session data when used with remix-auth
export interface AuthSession {
  user: UserSession;
}


// Ensure SESSION_SECRET is set in your environment variables
// You can generate a secret using: openssl rand -hex 32
const sessionSecret = process.env.SESSION_SECRET || import.meta.env.VITE_SESSION_SECRET || "7gZfSqVQSHS9M9c/x9YVBSRPq+E1T/M6jN8dybzRhUY=";
if (!sessionSecret) {
    throw new Error("SESSION_SECRET must be set");
}

// Export the session storage instance, typed for remix-auth
export const sessionStorage = createCookieSessionStorage<AuthSession>({
  cookie: {
    name: "__session", // use any name you want
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [sessionSecret],
    secure: process.env.NODE_ENV === "production", // enable this in prod
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
});

// You can also export the methods individually for convenience
export const { getSession, commitSession, destroySession } = sessionStorage;
