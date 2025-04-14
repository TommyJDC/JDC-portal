import { Authenticator } from "remix-auth";
import { GoogleStrategy } from "remix-auth-google";
import { sessionStorage, type UserSession } from "./session.server";
import { getUserProfileSdk, createUserProfileSdk } from "./firestore.service.server";

// Create an instance of the authenticator
export const authenticator = new Authenticator<UserSession>(sessionStorage, {
  throwOnError: true,
});

// Google Strategy configuration
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const appBaseUrl = process.env.APP_BASE_URL;

if (!googleClientId || !googleClientSecret || !appBaseUrl) {
  throw new Error(
    "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and APP_BASE_URL must be set"
  );
}

authenticator.use(
  new GoogleStrategy(
    {
      clientID: googleClientId,
      clientSecret: googleClientSecret,
      callbackURL: `${appBaseUrl}/auth/google/callback`,
      scope: ["openid", "email", "profile"].join(" "),
      accessType: "offline",
      prompt: "consent",
    },
    async ({ accessToken, refreshToken, extraParams, profile }) => {
      const email = profile.emails?.[0]?.value;
      if (!email || !email.endsWith("@jdc.fr")) {
        throw new Error("Seuls les emails @jdc.fr sont autorisés.");
      }

      return {
        userId: profile.id,
        email: email,
        displayName: profile.displayName || "Utilisateur Google",
        googleAccessToken: accessToken,
        googleRefreshToken: refreshToken,
        tokenExpiry: Date.now() + extraParams.expires_in * 1000,
      };
    }
  )
);
