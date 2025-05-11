import { Authenticator } from "remix-auth"; // Reste pour le type, même si l'instance est factice
import { GoogleStrategy, type GoogleProfile } from "remix-auth-google";
import { sessionStorage, type UserSessionData } from "./session.server";
import { auth as adminAuth, initializeFirebaseAdmin } from "~/firebase.admin.config.server";
import { getUserProfileSdk, createUserProfileSdk } from "./firestore.service.server";
import type { UserProfile } from "~/types/firestore.types";
import { redirect } from "@remix-run/node"; // Ajout de l'import pour redirect

// Initialiser Firebase Admin au démarrage du module si ce n'est pas déjà fait ailleurs (ex: entry.server.tsx)
// Il est préférable de l'appeler une seule fois. Si entry.server.tsx ou un autre point d'entrée l'appelle, cette ligne peut être redondante.
// Pour l'instant, nous allons nous assurer qu'il est appelé.
initializeFirebaseAdmin().catch(error => {
  console.error("Failed to initialize Firebase Admin in auth.server.ts:", error);
  // Gérer l'erreur d'initialisation si nécessaire, peut-être en arrêtant l'application ou en loggant sévèrement.
});

// --- DEBUT Neutralisation de Remix Auth ---
// Create an instance of the authenticator
// Le type générique est UserSessionData, qui sera stocké sous la clé "user".
/*
export const authenticator = new Authenticator<UserSessionData>(sessionStorage, {
  sessionKey: 'user', // Spécifie que les données utilisateur sont stockées sous la clé 'user'
  sessionErrorKey: 'authError', // Clé pour les messages d'erreur flash d'authentification
  throwOnError: true,
});
*/

// Pour éviter les erreurs d'importation ailleurs, on peut exporter un objet factice ou commenter les usages.
// Pour l'instant, on commente. Les erreurs d'importation devront être gérées.
export const authenticator = {
  isAuthenticated: async (request: Request, options?: { successRedirect?: string; failureRedirect?: string; throwOnError?: boolean; }) => {
    console.warn("[AUTH.SERVER] authenticator.isAuthenticated a été appelé mais Remix Auth est neutralisé. Retourne null.");
    // Simuler un utilisateur non authentifié pour l'instant
    if (options?.failureRedirect) {
      throw redirect(options.failureRedirect);
    }
    if (options?.throwOnError) {
      throw new Error("User not authenticated (Remix Auth neutralisé)");
    }
    return null;
  },
  authenticate: async (strategy: string, request: Request, options?: { successRedirect?: string; failureRedirect?: string; throwOnError?: boolean; context?: any; }) => {
    console.warn(`[AUTH.SERVER] authenticator.authenticate pour la stratégie ${strategy} a été appelé mais Remix Auth est neutralisé.`);
    if (options?.failureRedirect) {
      throw redirect(options.failureRedirect);
    }
    throw new Error("Authentication attempt failed (Remix Auth neutralisé)");
  },
  logout: async (request: Request, options: { redirectTo: string; }) => {
    console.warn("[AUTH.SERVER] authenticator.logout a été appelé mais Remix Auth est neutralisé.");
    const session = await sessionStorage.getSession(request.headers.get("Cookie"));
    throw redirect(options.redirectTo, {
      headers: {
        "Set-Cookie": await sessionStorage.destroySession(session),
      },
    });
  }
  // Ajouter d'autres méthodes factices si nécessaire
};

// L'appel authenticator.use(...) n'est plus valide car 'authenticator' est un objet factice.
/*
// Configuration Google
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
      scope: [
        'openid', // Pour l'ID token
        'email',  // Pour l'adresse e-mail
        'profile', // Pour les informations de base du profil (nom, photo)
        'https://www.googleapis.com/auth/gmail.readonly',    // Gmail
        'https://www.googleapis.com/auth/drive.readonly',    // Drive
        'https://www.googleapis.com/auth/calendar.readonly' // Calendar
      ],
      accessType: "offline", // Pour obtenir un refreshToken
      prompt: "consent" // Pour s'assurer que l'utilisateur voit l'écran de consentement et que le refreshToken est émis pour les nouveaux scopes
    },
    async ({ profile, accessToken, refreshToken, extraParams }) => {
      // Toute cette logique est maintenant commentée car la stratégie n'est plus utilisée.
      // La logique équivalente sera dans auth-direct.tsx
      console.log("[AUTH.SERVER] Google Strategy (COMMENTÉE) - Profile received from Google:", JSON.stringify(profile, null, 2));
      console.log("[AUTH.SERVER] Google Strategy (COMMENTÉE) - Access Token:", accessToken ? "Present" : "Absent");
      console.log("[AUTH.SERVER] Google Strategy - Refresh Token:", refreshToken ? "Present" : "Absent");
      console.log("[AUTH.SERVER] Google Strategy - Extra Params (id_token expected here):", JSON.stringify(extraParams, null, 2));

      // L'ID token de Google est déjà validé par remix-auth-google en termes de signature.
      // Nous utilisons les informations du profil Google directement.
      // L'UID Google est dans profile.id
      // L'email est dans profile.emails[0].value

      const googleUserId = profile.id;
      const email = profile.emails?.[0]?.value;
      const displayName = profile.displayName || email?.split('@')[0];
      const photoURL = profile.photos?.[0]?.value; // URL de la photo de profil Google

      if (!googleUserId || !email) {
        console.error("[AUTH.SERVER] Google Strategy - Google User ID or email is missing from profile.");
        throw new Error("Google User ID or email is missing from profile.");
      }

      try {
        let firebaseUid: string;
        let firebaseUserRecord;

        // 1. Essayer de trouver l'utilisateur Firebase par son email
        console.log(`[AUTH.SERVER] Google Strategy - Attempting to find Firebase user by email: ${email}`);
        try {
          firebaseUserRecord = await adminAuth().getUserByEmail(email);
          firebaseUid = firebaseUserRecord.uid;
          console.log(`[AUTH.SERVER] Google Strategy - Found existing Firebase user by email. UID: ${firebaseUid}`);
          
          const updates: { displayName?: string; photoURL?: string } = {};
          if (displayName && firebaseUserRecord.displayName !== displayName) {
            updates.displayName = displayName;
          }
          if (photoURL && firebaseUserRecord.photoURL !== photoURL) {
            updates.photoURL = photoURL;
          }
          if (Object.keys(updates).length > 0) {
            console.log(`[AUTH.SERVER] Google Strategy - Updating Firebase user ${firebaseUid} with:`, updates);
            await adminAuth().updateUser(firebaseUid, updates);
          }

        } catch (error: any) {
          if (error.code === 'auth/user-not-found') {
            console.log(`[AUTH.SERVER] Google Strategy - Firebase user not found for email: ${email}. Creating new Firebase user.`);
            const newUser = {
              email: email,
              emailVerified: profile._json?.email_verified || false,
              displayName: displayName,
              photoURL: photoURL,
            };
            firebaseUserRecord = await adminAuth().createUser(newUser);
            firebaseUid = firebaseUserRecord.uid;
            console.log(`[AUTH.SERVER] Google Strategy - Created new Firebase user. UID: ${firebaseUid}`);
          } else {
            console.error("[AUTH.SERVER] Google Strategy - Error fetching Firebase user by email:", error);
            throw error;
          }
        }

        console.log(`[AUTH.SERVER] Google Strategy - Checking for user profile in Firestore with Firebase UID: ${firebaseUid}`);
        let userProfileDoc = await getUserProfileSdk(firebaseUid);
        console.log("[AUTH.SERVER] Google Strategy - Existing user profile from Firestore:", JSON.stringify(userProfileDoc, null, 2));

        const calculatedNom = profile.name?.familyName && profile.name?.givenName 
          ? `${profile.name.givenName} ${profile.name.familyName}` 
          : displayName;

        if (!userProfileDoc) {
          console.log(`[AUTH.SERVER] Google Strategy - User profile not found in Firestore for UID: ${firebaseUid}. Creating new profile.`);
          const newUserProfileData: UserProfile = {
            uid: firebaseUid,
            email: email,
            displayName: displayName,
            role: 'User', // Rôle par défaut
            secteurs: [],
            nom: calculatedNom,
            phone: '', 
            address: '',
            googleRefreshToken: refreshToken || '', 
            isGmailProcessor: false,
            gmailAuthorizedScopes: [],
            gmailAuthStatus: 'unauthorized',
            labelSapClosed: '',
            labelSapNoResponse: '',
            labelSapRma: '',
            createdAt: new Date(), // Restauré: initialiser avec la date actuelle
            updatedAt: new Date(), // Restauré: initialiser avec la date actuelle
          };
          console.log("[AUTH.SERVER] Google Strategy - New user profile to create in Firestore (before SDK):", JSON.stringify(newUserProfileData, null, 2));
          const createdProfile = await createUserProfileSdk(newUserProfileData);
          userProfileDoc = createdProfile;
          console.log("[AUTH.SERVER] Google Strategy - New user profile created/returned by SDK:", JSON.stringify(userProfileDoc, null, 2));
        } else {
          console.log("[AUTH.SERVER] Google Strategy - User profile found in Firestore. Current doc:", JSON.stringify(userProfileDoc, null, 2));
          let needsFirestoreUpdate = false;
          
          if (refreshToken && userProfileDoc.googleRefreshToken !== refreshToken) {
            userProfileDoc.googleRefreshToken = refreshToken;
            needsFirestoreUpdate = true;
          }
          if (displayName && userProfileDoc.displayName !== displayName) {
            userProfileDoc.displayName = displayName;
            needsFirestoreUpdate = true;
          }
           if (calculatedNom && userProfileDoc.nom !== calculatedNom) {
            userProfileDoc.nom = calculatedNom;
            needsFirestoreUpdate = true;
          }
          // updatedAt sera géré par createUserProfileSdk (utilisé pour la mise à jour)

          if (needsFirestoreUpdate) {
            console.log("[AUTH.SERVER] Google Strategy - Updating existing user profile in Firestore (before SDK):", JSON.stringify(userProfileDoc, null, 2));
            // createUserProfileSdk mettra à jour updatedAt et conservera createdAt s'il existe et est une Date,
            // ou l'initialisera si null/undefined.
            const updatedProfile = await createUserProfileSdk(userProfileDoc);
            userProfileDoc = updatedProfile;
            console.log("[AUTH.SERVER] Google Strategy - Existing user profile updated/returned by SDK:", JSON.stringify(userProfileDoc, null, 2));
          }
        }

        if (!userProfileDoc) {
          console.error("[AUTH.SERVER] Critical: userProfileDoc is null or undefined before creating session data.");
          throw new Error("User profile could not be definitively established.");
        }

        const sessionUserData: UserSessionData = {
          userId: firebaseUid,
          email: email,
          displayName: userProfileDoc.displayName,
          role: userProfileDoc.role,
          secteurs: userProfileDoc.secteurs || [],
          googleRefreshToken: refreshToken,
        };
        console.log("[AUTH.SERVER] Google Strategy - Returning session user data:", JSON.stringify(sessionUserData, null, 2));
        return sessionUserData;

      } catch (error) {
        console.error("[AUTH.SERVER] Error during Firebase user management or Firestore operation:", error);
        if (error instanceof Error) {
          console.error("Error message:", error.message);
          console.error("Error stack:", error.stack);
        }
        // Il est important de relancer l'erreur pour que remix-auth la gère (ex: failureRedirect)
        // Vous pouvez personnaliser le message d'erreur si nécessaire
        throw new Error(`Authentication failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  )
);
*/
// --- FIN Neutralisation de Remix Auth ---
