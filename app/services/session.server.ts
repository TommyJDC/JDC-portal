import { createCookieSessionStorage } from "@remix-run/node"; // or cloudflare/deno

// Define the structure of your session data, including Google tokens
export interface UserSession {
  userId: string; // Or your user ID from Firestore/Firebase Auth
  email: string | null;
  displayName: string | null;
  googleAccessToken?: string;
  googleRefreshToken?: string;
  tokenExpiry?: number; // Timestamp when the access token expires
  // Add other user profile data as needed
}

// Ensure SESSION_SECRET is set in your environment variables
// You can generate a secret using: openssl rand -hex 32
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error("SESSION_SECRET must be set as an environment variable");
}

// Export the session storage instance
export const sessionStorage = createCookieSessionStorage<UserSession>({
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
