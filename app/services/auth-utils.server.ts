// authenticator n'est plus utilisé directement ici pour isAuthenticated
import { getUserProfileSdk } from './firestore.service.server'; 
import { sessionStorage, commitLongSession, type UserSessionData } from "./session.server"; // Standardisation sur UserSessionData
// Response est un objet global, pas besoin de l'importer de @remix-run/node

export async function requireAdminUser(request: Request): Promise<UserSessionData> {
  console.log('[requireAdminUser] Vérification des permissions administrateur');
  const session = await sessionStorage.getSession(request.headers.get("Cookie"));
  const userSession = session.get("user");
  
  if (!userSession || !userSession.userId) {
    console.log('[requireAdminUser] Aucun utilisateur authentifié via session');
    throw new Response("Unauthorized", { status: 401 });
  }
  
  console.log(`[requireAdminUser] Utilisateur authentifié: ${userSession.userId}, vérification du rôle admin`);
  
  try {
    const profile = await getUserProfileSdk(userSession.userId);
    
    console.log(`[requireAdminUser] Profil récupéré, rôle: ${profile?.role}`);
    
    // Comparaison des rôles en s'assurant que userSession.role est aussi vérifié si le profil n'existe pas (ne devrait pas arriver pour un admin)
    const effectiveRole = profile?.role || userSession.role;
    if (effectiveRole?.toLowerCase() !== 'admin') {
      console.log(`[requireAdminUser] L'utilisateur n'est pas admin, rôle: ${effectiveRole}`);
      throw new Response("Forbidden", { status: 403 });
    }
    
    console.log('[requireAdminUser] Accès admin validé');
    return userSession; // Retourner les données de la session
  } catch (error) {
    console.error('[requireAdminUser] Erreur lors de la vérification du profil:', error);
    throw new Response("Erreur lors de la vérification du profil", { status: 500 });
  }
}

/**
 * Interface pour les résultats du diagnostic d'authentification
 */
export interface AuthDiagnosticResult {
  hasCookies: boolean;
  hasSessionCookie: boolean;
  hasValidSessionData: boolean;
  hasUserId: boolean;
  hasEmail: boolean;
  userId?: string;
  email?: string;
  displayName?: string;
  error?: string;
  cookieSize?: number;
}

/**
 * Diagnostique la session d'authentification pour identifier les problèmes
 */
export async function diagnoseDamagedSession(request: Request): Promise<AuthDiagnosticResult> {
  try {
    const cookieHeader = request.headers.get("Cookie");
    const result: AuthDiagnosticResult = {
      hasCookies: !!cookieHeader,
      hasSessionCookie: false,
      hasValidSessionData: false,
      hasUserId: false,
      hasEmail: false
    };

    if (!cookieHeader) {
      return result;
    }

    result.cookieSize = cookieHeader.length;
    
    // Vérifier si le cookie de session existe
    const sessionCookieMatch = cookieHeader.match(/__session=([^;]+)/);
    if (sessionCookieMatch) {
      result.hasSessionCookie = true;
    } else {
      return result;
    }

    // Essayer de récupérer les données de session
    try {
      const session = await sessionStorage.getSession(cookieHeader);
      const userSession = session.get("user"); // Lire l'objet UserSessionData

      if (userSession && userSession.userId) {
        result.hasValidSessionData = true; // Indique que l'objet user a été trouvé
        result.hasUserId = !!userSession.userId;
        result.hasEmail = !!userSession.email; // email est optionnel dans UserSessionData
        
        result.userId = userSession.userId;
        result.email = userSession.email;
        result.displayName = userSession.displayName;
      } else {
        result.hasValidSessionData = false;
      }
    } catch (error: any) {
      result.error = error.message || "Erreur lors de la lecture des données de session";
      // Ne pas retourner ici, laisser la fonction continuer pour retourner l'objet result complet
    }

    return result;
  } catch (error: any) {
    return {
      hasCookies: false,
      hasSessionCookie: false,
      hasValidSessionData: false,
      hasUserId: false,
      hasEmail: false,
      error: error.message || "Erreur critique lors du diagnostic"
    };
  }
}

/**
 * Répare la session en créant une nouvelle session avec les mêmes données utilisateur
 */
export async function repairSession(request: Request): Promise<{ success: boolean; headers?: Headers; error?: string }> {
  try {
    console.log("[auth-utils] Début de la réparation de session");
    
    // Diagnostic pour récupérer les données de session
    const diagnostic = await diagnoseDamagedSession(request);
    console.log("[auth-utils] Diagnostic:", JSON.stringify(diagnostic, null, 2));
    
    if (!diagnostic.hasUserId || !diagnostic.userId) {
      console.log("[auth-utils] Impossible de réparer: aucun ID utilisateur trouvé dans la session");
      return { success: false, error: "Impossible de réparer: aucun ID utilisateur trouvé dans la session" };
    }
    
    // Créer une nouvelle session propre
    const newSession = await sessionStorage.getSession();
    console.log("[auth-utils] Nouvelle session créée");
    
    const userSessionDataToSet: UserSessionData = {
      userId: diagnostic.userId, // userId est garanti par la vérification précédente
      email: diagnostic.email || "", // S'assurer que email est une chaîne
      displayName: diagnostic.displayName || "", // S'assurer que displayName est une chaîne
      // Fournir des valeurs par défaut pour les champs obligatoires manquants dans le diagnostic
      role: "User", // Valeur par défaut, car non récupérée par diagnoseDamagedSession
      secteurs: [], // Valeur par défaut
      googleRefreshToken: undefined, // Non récupéré par diagnoseDamagedSession
    };
    newSession.set("user", userSessionDataToSet);
    
    console.log("[auth-utils] Données définies dans la nouvelle session:", userSessionDataToSet);
    
    // Vérifier si le profil existe dans Firestore
    try {
      const profile = await getUserProfileSdk(diagnostic.userId);
      if (!profile) {
        console.log("[auth-utils] Profil utilisateur non trouvé dans Firestore");
        return { success: false, error: "Profil utilisateur non trouvé dans Firestore" };
      }
      console.log("[auth-utils] Profil utilisateur trouvé dans Firestore");
    } catch (error: any) {
      console.warn(`[auth-utils] Vérification du profil échouée mais on continue:`, error);
      // On continue quand même, car le problème est peut-être uniquement avec la session
    }
    
    // Créer un cookie avec une longue durée pour la nouvelle session
    const newCookie = await commitLongSession(newSession);
    console.log("[auth-utils] Nouveau cookie de session créé");
    
    // Vérifier que le cookie a bien été créé
    if (!newCookie || newCookie.length < 10) {
      console.error("[auth-utils] Erreur: Le cookie généré est invalide ou trop court");
      return { success: false, error: "Le cookie généré est invalide" };
    }
    
    // Créer les en-têtes HTTP pour définir le nouveau cookie
    const headers = new Headers();
    headers.append("Set-Cookie", newCookie);
    console.log("[auth-utils] En-têtes HTTP créés avec le nouveau cookie");
    
    // Pour le débogage, tentons de lire la session à partir du cookie que nous venons de créer
    try {
      // Note: newCookie peut contenir des attributs comme HttpOnly, Secure, etc.
      // Pour tester getSession, il faut juste la partie nom=valeur.
      // Cependant, sessionStorage.getSession attend l'en-tête Cookie complet.
      // Il est plus simple de faire confiance à commitLongSession.
      // Si on voulait tester, il faudrait simuler une requête avec ce cookie.
      const tempRawSession = await sessionStorage.getSession(newCookie); // Ceci pourrait ne pas fonctionner comme attendu
      const tempUserSession = tempRawSession.get("user");
      console.log("[auth-utils] Vérification de la session créée - userSession:", tempUserSession);
    } catch (error) {
      console.warn("[auth-utils] Impossible de lire la session de test à partir du cookie brut:", error);
    }
    
    console.log("[auth-utils] Réparation de session réussie");
    return { success: true, headers };
  } catch (error: any) {
    console.error("[auth-utils] Erreur lors de la réparation de session:", error);
    return { success: false, error: error.message || "Erreur lors de la réparation de session" };
  }
}

/**
 * Force l'effacement de la session en créant un cookie de destruction
 */
export async function forceDestroySession(request: Request): Promise<Headers> {
  try {
    const session = await sessionStorage.getSession(request.headers.get("Cookie"));
    const cookie = await sessionStorage.destroySession(session);
    
    const headers = new Headers();
    headers.append("Set-Cookie", cookie);
    return headers;
  } catch (error) {
    // En cas d'erreur, créer quand même un cookie vide pour supprimer le cookie existant
    const headers = new Headers();
    headers.append("Set-Cookie", "__session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT");
    return headers;
  }
}
