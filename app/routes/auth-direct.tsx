import { json, redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { sessionStorage, commitLongSession, type UserSessionData } from "~/services/session.server";
import { getGoogleAuthClient } from "~/services/google.server";
import { getUserProfileSdk, createUserProfileSdk, updateUserProfileSdk } from "~/services/firestore.service.server"; // Ajout de updateUserProfileSdk
import type { UserProfile } from "~/types/firestore.types"; // Ajout de l'import UserProfile
import { google } from "googleapis";
import { googleConfig } from "~/firebase.config";

// Fonction pour créer un client OAuth2
function createOAuthClient() {
  return new google.auth.OAuth2(
    googleConfig.clientId,
    googleConfig.clientSecret,
    `${googleConfig.baseUrl}/auth-direct`
  );
}

export async function loader({ request }: LoaderFunctionArgs) {
  // Vérifier si l'utilisateur a déjà une session
  const cookieHeader = request.headers.get("Cookie");
  if (cookieHeader) {
    try {
      const session = await sessionStorage.getSession(cookieHeader);
      const userSession = session.get("user"); // Lire l'objet UserSessionData sous la clé "user"
      if (userSession && userSession.userId) { // Vérifier que userSession existe et contient userId
        // Rediriger vers le dashboard si déjà connecté
        return redirect("/dashboard");
      }
    } catch (e) {
      console.error("Erreur lors de la vérification de session:", e);
    }
  }

  // Récupérer le code d'autorisation Google s'il existe
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  
  // Si on a une erreur d'autorisation
  if (error) {
    return json({ 
      authUrl: generateAuthUrl(),
      error: `Erreur d'authentification: ${error}` 
    });
  }
  
  // Si on a un code d'autorisation
  if (code) {
    console.log("[AUTH-DIRECT.TSX] Start processing with code...");
    const startTime = Date.now();
    let stepTime = startTime;

    try {
      // Échanger le code contre des tokens
      console.log("[AUTH-DIRECT.TSX] Step 1: Creating OAuth client...");
      const oauthClient = createOAuthClient();
      stepTime = Date.now();
      console.log("[AUTH-DIRECT.TSX] Step 2: Exchanging code for tokens...");
      const { tokens } = await oauthClient.getToken(code);
      console.log(`[AUTH-DIRECT.TSX] Step 2 completed in ${Date.now() - stepTime}ms. Tokens obtained.`);
      
      // Récupérer les infos de l'utilisateur
      oauthClient.setCredentials(tokens);
      stepTime = Date.now();
      console.log("[AUTH-DIRECT.TSX] Step 3: Getting user info from Google...");
      const userInfo = await getUserInfo(oauthClient);
      console.log(`[AUTH-DIRECT.TSX] Step 3 completed in ${Date.now() - stepTime}ms. UserInfo: ${JSON.stringify(userInfo)}`);
      
      if (!userInfo || !userInfo.id) {
        throw new Error("Impossible de récupérer les informations utilisateur");
      }
      
      // Gérer l'utilisateur Firebase Auth
      let firebaseUid: string;
      let firebaseUserRecord;
      stepTime = Date.now();
      console.log("[AUTH-DIRECT.TSX] Step 4: Importing Firebase Admin Auth...");
      const adminAuth = (await import("~/firebase.admin.config.server")).auth;
      console.log(`[AUTH-DIRECT.TSX] Step 4 completed in ${Date.now() - stepTime}ms.`);

      try {
        stepTime = Date.now();
        console.log(`[AUTH-DIRECT.TSX] Step 5: Getting Firebase user by email: ${userInfo.email}...`);
        firebaseUserRecord = await adminAuth().getUserByEmail(userInfo.email || "");
        firebaseUid = firebaseUserRecord.uid;
        console.log(`[AUTH-DIRECT.TSX] Step 5 completed in ${Date.now() - stepTime}ms. Firebase user found. UID: ${firebaseUid}`);
        
        const updates: { displayName?: string; photoURL?: string } = {};
        if (userInfo.name && firebaseUserRecord.displayName !== userInfo.name) {
          updates.displayName = userInfo.name;
        }
        if (userInfo.picture && firebaseUserRecord.photoURL !== userInfo.picture) {
          updates.photoURL = userInfo.picture;
        }
        if (Object.keys(updates).length > 0) {
          stepTime = Date.now();
          console.log(`[AUTH-DIRECT.TSX] Step 5.1: Updating Firebase user ${firebaseUid}...`);
          await adminAuth().updateUser(firebaseUid, updates);
          console.log(`[AUTH-DIRECT.TSX] Step 5.1 completed in ${Date.now() - stepTime}ms.`);
        }
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          stepTime = Date.now();
          console.log(`[AUTH-DIRECT.TSX] Step 5 Failed (user not found). Step 5.2: Creating Firebase user for ${userInfo.email}...`);
          const newFirebaseUser = await adminAuth().createUser({
            email: userInfo.email || "",
            emailVerified: userInfo.verified_email || false,
            displayName: userInfo.name || "",
            photoURL: userInfo.picture || "",
          });
          firebaseUid = newFirebaseUser.uid;
          console.log(`[AUTH-DIRECT.TSX] Step 5.2 completed in ${Date.now() - stepTime}ms. New Firebase user created. UID: ${firebaseUid}`);
        } else {
          console.error("[AUTH-DIRECT.TSX] Error managing Firebase Auth user (Step 5.x):", error);
          throw error; 
        }
      }
      
      stepTime = Date.now();
      console.log(`[AUTH-DIRECT.TSX] Step 6: Getting Firestore profile for UID: ${firebaseUid}...`);
      let userProfile = await getUserProfileSdk(firebaseUid);
      console.log(`[AUTH-DIRECT.TSX] Step 6 completed in ${Date.now() - stepTime}ms. Firestore profile: ${JSON.stringify(userProfile)}`);
      
      if (!userProfile) {
        stepTime = Date.now();
        console.log(`[AUTH-DIRECT.TSX] Step 7: Firestore profile not found. Creating...`);
        const newUserProfileData: UserProfile = {
          uid: firebaseUid, email: userInfo.email || "",
          displayName: userInfo.name || userInfo.email?.split('@')[0] || "",
          role: userInfo.email === 'tommy.vilmen@jdc.fr' ? 'Admin' : 'Technician', 
          secteurs: userInfo.email === 'tommy.vilmen@jdc.fr' ? ['CHR', 'HACCP', 'Kezia', 'Tabac'] : [],
          nom: userInfo.name || "", phone: "", createdAt: new Date(), updatedAt: new Date(),
          gmailAuthStatus: "active", gmailAuthorizedScopes: [], 
          googleRefreshToken: tokens.refresh_token || "",
          isGmailProcessor: false, labelSapClosed: "", labelSapNoResponse: "", labelSapRma: "",
          jobTitle: "", department: ""
        };
        userProfile = await createUserProfileSdk(newUserProfileData);
        console.log(`[AUTH-DIRECT.TSX] Step 7 completed in ${Date.now() - stepTime}ms. Firestore profile created.`);
      } else {
        // userProfile est garanti non-null dans ce bloc.
        // Pour clarifier pour TypeScript, nous pouvons utiliser une nouvelle référence.
        const existingUserProfile: UserProfile = userProfile; 
        if (tokens.refresh_token && existingUserProfile.googleRefreshToken !== tokens.refresh_token) {
          stepTime = Date.now();
          console.log(`[AUTH-DIRECT.TSX] Step 7.1: Updating Firestore refresh token for UID: ${firebaseUid}...`);
          await updateUserProfileSdk(firebaseUid, { googleRefreshToken: tokens.refresh_token });
          // Mettre à jour la propriété de l'objet local.
          existingUserProfile.googleRefreshToken = tokens.refresh_token; 
          console.log(`[AUTH-DIRECT.TSX] Step 7.1 completed in ${Date.now() - stepTime}ms.`);
        }
      }
      
      if (!userProfile) { // userProfile est UserProfile | null ici. Cette vérification est cruciale.
        console.error("[AUTH-DIRECT.TSX] Critical: userProfile is null after Firestore operations. Cannot create session.");
        throw new Error("User profile could not be established in Firestore.");
      }

      stepTime = Date.now();
      console.log("[AUTH-DIRECT.TSX] Step 8: Getting Remix session...");
      const session = await sessionStorage.getSession();
      console.log(`[AUTH-DIRECT.TSX] Step 8 completed in ${Date.now() - stepTime}ms.`);

      const userSessionData: UserSessionData = {
        userId: firebaseUid, email: userProfile.email, displayName: userProfile.displayName,
        role: userProfile.role, secteurs: userProfile.secteurs || [],
        googleRefreshToken: tokens.refresh_token || userProfile.googleRefreshToken || undefined,
      };
      session.set("user", userSessionData);
      
      stepTime = Date.now();
      console.log("[AUTH-DIRECT.TSX] Step 9: Committing session and redirecting to dashboard...");
      const cookie = await commitLongSession(session);
      console.log(`[AUTH-DIRECT.TSX] Step 9 (commit session) completed in ${Date.now() - stepTime}ms.`);
      console.log(`[AUTH-DIRECT.TSX] Total processing time: ${Date.now() - startTime}ms.`);
      
      return redirect("/dashboard", { headers: { "Set-Cookie": cookie } });
    } catch (error) {
      console.error(`[AUTH-DIRECT.TSX] Error during direct authentication (Total time: ${Date.now() - startTime}ms):`, error);
      return json({ 
        authUrl: generateAuthUrl(),
        error: "Erreur lors de l'authentification Google" 
      });
    }
  }
  
  // Afficher la page d'authentification avec le lien Google
  return json({ 
    authUrl: generateAuthUrl(),
    error: null 
  });
}

// Fonction pour générer l'URL d'authentification Google
function generateAuthUrl() {
  const oauthClient = createOAuthClient();
  const scopes = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.labels',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/spreadsheets.readonly'
  ];
  
  return oauthClient.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });
}

// Fonction pour récupérer les informations de l'utilisateur
async function getUserInfo(oauthClient: any) {
  try {
    const { data } = await google.oauth2('v2').userinfo.get({ 
      auth: oauthClient 
    });
    
    return data;
  } catch (error) {
    console.error("Erreur lors de la récupération des informations utilisateur:", error);
    throw error;
  }
}

export default function AuthDirect() {
  const { authUrl, error } = useLoaderData<typeof loader>();
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-jdc-gray-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Effet de fond avec des cercles */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 -right-20 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 left-1/3 w-72 h-72 bg-pink-500/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md">
        <div className="backdrop-blur-xl bg-white/10 rounded-2xl shadow-2xl border border-white/20 p-8 space-y-6">
          <div className="text-center">
            <img 
              src="https://www.jdc.fr/images/logo_jdc_blanc.svg" 
              alt="JDC Logo" 
              className="h-12 w-auto mx-auto mb-6"
            />
            <h1 className="text-2xl font-bold text-white mb-2">Connexion au Portail JDC</h1>
            <p className="text-white/70 text-sm">
              Connectez-vous avec votre compte Google pour accéder au tableau de bord.
            </p>
          </div>
          
          {error && (
            <div className="bg-red-500/20 backdrop-blur-sm border border-red-500/30 text-white p-4 rounded-xl">
              {error}
            </div>
          )}
          
          <div className="space-y-6">
            <a
              href={authUrl}
              className="flex items-center justify-center gap-3 w-full bg-white/10 hover:bg-white/20 text-white font-medium py-3 px-6 rounded-xl border border-white/20 transition-all duration-300 hover:shadow-lg hover:shadow-white/10 group"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                  <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
                  <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
                  <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
                  <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/>
                </g>
              </svg>
              <span className="group-hover:translate-x-1 transition-transform">Se connecter avec Google</span>
            </a>
            
            <div className="text-center">
              <a href="/reset-session" className="text-red-400/80 hover:text-red-300 transition-colors text-sm">
                Réinitialiser la session
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
