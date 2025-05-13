import { Authenticator } from "remix-auth";
import { GoogleStrategy, type GoogleProfile } from "remix-auth-google";
import { sessionStorage, type UserSessionData } from "./session.server";
import { auth as adminAuth, initializeFirebaseAdmin } from "~/firebase.admin.config.server";
import { getUserProfileSdk, createUserProfileSdk } from "./firestore.service.server";
import type { UserProfile } from "~/types/firestore.types";
import { redirect } from "@remix-run/node";

// Initialiser Firebase Admin
initializeFirebaseAdmin().catch(error => {
  console.error("Failed to initialize Firebase Admin in auth.server.ts:", error);
});

// Créer une instance de l'authenticator
export const authenticator = new Authenticator<UserSessionData>(sessionStorage, {
  sessionKey: 'user',
  sessionErrorKey: 'authError',
  throwOnError: true,
});

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
        'openid',
        'email',
        'profile',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/calendar.readonly'
      ],
      accessType: "offline",
      prompt: "consent"
    },
    async ({ profile, accessToken, refreshToken, extraParams }) => {
      console.log("[AUTH.SERVER] Google Strategy - Profile received from Google:", JSON.stringify(profile, null, 2));
      console.log("[AUTH.SERVER] Google Strategy - Access Token:", accessToken ? "Present" : "Absent");
      console.log("[AUTH.SERVER] Google Strategy - Refresh Token:", refreshToken ? "Present" : "Absent");

      const googleUserId = profile.id;
      const email = profile.emails?.[0]?.value;
      const displayName = profile.displayName || email?.split('@')[0];
      const photoURL = profile.photos?.[0]?.value;

      if (!googleUserId || !email) {
        console.error("[AUTH.SERVER] Google Strategy - Google User ID or email is missing from profile.");
        throw new Error("Google User ID or email is missing from profile.");
      }

      try {
        let firebaseUid: string;
        let firebaseUserRecord;

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
            await adminAuth().updateUser(firebaseUid, updates);
          }
        } catch (error: any) {
          if (error.code === 'auth/user-not-found') {
            const newUser = {
              email: email,
              emailVerified: profile._json?.email_verified || false,
              displayName: displayName,
              photoURL: photoURL,
            };
            firebaseUserRecord = await adminAuth().createUser(newUser);
            firebaseUid = firebaseUserRecord.uid;
          } else {
            throw error;
          }
        }

        let userProfileDoc = await getUserProfileSdk(firebaseUid);
        const calculatedNom = profile.name?.familyName && profile.name?.givenName 
          ? `${profile.name.givenName} ${profile.name.familyName}` 
          : displayName;

        if (!userProfileDoc) {
          const newUserProfileData: UserProfile = {
            uid: firebaseUid,
            email: email,
            displayName: displayName,
            role: 'User',
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
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          userProfileDoc = await createUserProfileSdk(newUserProfileData);
          if (!userProfileDoc) {
            throw new Error("Failed to create user profile");
          }
        } else {
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
          
          if (needsFirestoreUpdate) {
            const updatedProfile = await createUserProfileSdk(userProfileDoc);
            if (updatedProfile) {
              userProfileDoc = updatedProfile;
            }
          }
        }

        return {
          userId: firebaseUid,
          email: email,
          displayName: displayName,
          role: userProfileDoc.role,
          secteurs: userProfileDoc.secteurs,
          googleRefreshToken: refreshToken
        };
      } catch (error) {
        console.error("[AUTH.SERVER] Error in Google Strategy:", error);
        throw error;
      }
    }
  )
);

export async function authenticateUser(request: Request) {
  const session = await sessionStorage.getSession(request.headers.get("Cookie"));
  const user = session.get("user") as UserSessionData | null;
  
  if (!user) {
    throw redirect("/login");
  }
  
  return user;
}

export async function createUserSession(userData: UserSessionData, redirectTo: string) {
  const session = await sessionStorage.getSession();
  session.set("user", userData);
  
  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session, {
        maxAge: 60 * 60 * 24 * 30 // 30 jours
      })
    }
  });
}

export async function destroyUserSession(request: Request) {
  const session = await sessionStorage.getSession(request.headers.get("Cookie"));
  
  return redirect("/login", {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session)
    }
  });
}

export async function handleGoogleAuth(profile: any, accessToken: string, refreshToken: string) {
  console.log("[AUTH.SERVER] Google Auth - Profile received:", JSON.stringify(profile, null, 2));
  console.log("[AUTH.SERVER] Google Auth - Access Token:", accessToken ? "Present" : "Absent");
  console.log("[AUTH.SERVER] Google Auth - Refresh Token:", refreshToken ? "Present" : "Absent");

  const googleUserId = profile.id;
  const email = profile.emails?.[0]?.value;
  const displayName = profile.displayName || email?.split('@')[0];
  const photoURL = profile.photos?.[0]?.value;

  if (!googleUserId || !email) {
    console.error("[AUTH.SERVER] Google Auth - Google User ID or email is missing from profile.");
    throw new Error("Google User ID or email is missing from profile.");
  }

  try {
    let firebaseUid: string;
    let firebaseUserRecord;

    try {
      firebaseUserRecord = await adminAuth().getUserByEmail(email);
      firebaseUid = firebaseUserRecord.uid;
      console.log(`[AUTH.SERVER] Google Auth - Found existing Firebase user. UID: ${firebaseUid}`);
      
      const updates: { displayName?: string; photoURL?: string } = {};
      if (displayName && firebaseUserRecord.displayName !== displayName) {
        updates.displayName = displayName;
      }
      if (photoURL && firebaseUserRecord.photoURL !== photoURL) {
        updates.photoURL = photoURL;
      }
      if (Object.keys(updates).length > 0) {
        await adminAuth().updateUser(firebaseUid, updates);
      }
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        const newUser = {
          email: email,
          emailVerified: profile._json?.email_verified || false,
          displayName: displayName,
          photoURL: photoURL,
        };
        firebaseUserRecord = await adminAuth().createUser(newUser);
        firebaseUid = firebaseUserRecord.uid;
      } else {
        throw error;
      }
    }

    let userProfileDoc = await getUserProfileSdk(firebaseUid);
    const calculatedNom = profile.name?.familyName && profile.name?.givenName 
      ? `${profile.name.givenName} ${profile.name.familyName}` 
      : displayName;

    if (!userProfileDoc) {
      const newUserProfileData: UserProfile = {
        uid: firebaseUid,
        email: email,
        displayName: displayName,
        role: 'User',
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
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      userProfileDoc = await createUserProfileSdk(newUserProfileData);
      if (!userProfileDoc) {
        throw new Error("Failed to create user profile");
      }
    } else {
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
      
      if (needsFirestoreUpdate) {
        const updatedProfile = await createUserProfileSdk(userProfileDoc);
        if (updatedProfile) {
          userProfileDoc = updatedProfile;
        }
      }
    }

    return {
      userId: firebaseUid,
      email: email,
      displayName: displayName,
      role: userProfileDoc.role,
      secteurs: userProfileDoc.secteurs,
      googleRefreshToken: refreshToken,
      googleAccessToken: accessToken,
      tokenExpiry: Date.now() + 3600000 // 1 heure
    };
  } catch (error) {
    console.error("[AUTH.SERVER] Error in Google Auth:", error);
    throw error;
  }
}

