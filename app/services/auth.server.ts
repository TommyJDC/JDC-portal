import { Authenticator } from "remix-auth";
import { GoogleStrategy } from "remix-auth-google";
import { sessionStorage, type UserSession } from "./session.server";
import { getUserProfileSdk, createUserProfileSdk } from "./firestore.service.server";

// Create an instance of the authenticator
export const authenticator = new Authenticator<UserSession>(sessionStorage, {
  throwOnError: true,
});

// Google Strategy configuration
const googleClientId = process.env.GOOGLE_CLIENT_ID || import.meta.env.VITE_GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
const appBaseUrl = process.env.APP_BASE_URL || import.meta.env.VITE_APP_BASE_URL;

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
      scope: ["openid", "email", "profile", "https://www.googleapis.com/auth/drive", "https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/calendar"].join(" "),
      accessType: "offline",
      prompt: "consent",
    },
    async ({ accessToken, refreshToken, extraParams, profile }) => {
      console.log("[AuthServer] Entered GoogleStrategy verify function."); // <-- Log ajouté
      console.log("[AuthServer] Profile ID:", profile.id); // <-- Log ajouté
      console.log("[AuthServer] Profile Email:", profile.emails?.[0]?.value); // <-- Log ajouté

      const email = profile.emails?.[0]?.value;
      if (!email || !email.endsWith("@jdc.fr")) {
        console.error(`[AuthServer] Email validation failed: ${email}`); // <-- Log ajouté
        throw new Error("Seuls les emails @jdc.fr sont autorisés.");
      }
      console.log(`[AuthServer] Email ${email} validated.`); // <-- Log ajouté

      try {
        // D'abord essayer de récupérer le profil existant
        const userProfile = await getUserProfileSdk(profile.id);

        // Vérifier si le profil existe avant d'accéder à ses propriétés
        if (!userProfile) {
            // Ceci ne devrait théoriquement pas arriver si getUserProfileSdk lance une erreur "not found"
            // Mais ajoutons une sécurité.
            console.error(`[AuthServer] getUserProfileSdk returned null unexpectedly for ID: ${profile.id}`);
            throw new Error("Impossible de vérifier le profil utilisateur existant.");
        }

        console.log(`[AuthServer] Existing profile found for ID: ${profile.id}`); // <-- Log ajouté
        return {
          userId: profile.id,
          email: email,
          displayName: userProfile.displayName || profile.displayName || "Utilisateur Google",
          googleAccessToken: accessToken,
          googleRefreshToken: refreshToken,
          tokenExpiry: Date.now() + extraParams.expires_in * 1000,
        };
      } catch (error) {
        console.error("[AuthServer] Error caught in verify function:", error); // <-- Log ajouté

        // Vérifier le type de l'erreur avant d'accéder à .message
        let errorMessage = "Unknown error during profile check/creation";
        if (error instanceof Error) {
          errorMessage = error.message;
        }

        // Si le profil n'existe pas (basé sur le message d'erreur), le créer automatiquement
        if (errorMessage.includes("not found") || errorMessage.includes("User profile not found")) {
          console.log(`[AuthServer] Error indicates profile not found for ID: ${profile.id}. Attempting creation.`); // <-- Log ajouté
          const newProfile = await createUserProfileSdk(
            profile.id,
            email,
            profile.displayName || "Utilisateur Google"
          );
          console.log(`[AuthServer] Profile created successfully for ID: ${profile.id}`); // <-- Log ajouté
          return {
            userId: profile.id,
            email: email,
            displayName: newProfile.displayName,
            googleAccessToken: accessToken,
            googleRefreshToken: refreshToken,
            tokenExpiry: Date.now() + extraParams.expires_in * 1000,
          };
        }
        // Si c'est une autre erreur, la propager
        throw error;
      }
    }
  )
);
