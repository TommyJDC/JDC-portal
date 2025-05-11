import { sessionStorage } from './session.server';
import type { UserSession } from './session.server';

/**
 * Récupère manuellement la session utilisateur à partir des cookies
 * Cette fonction utilise la même approche que le root loader
 */
export async function getSessionFromCookie(request: Request): Promise<UserSession | null> {
  const cookieHeader = request.headers.get("Cookie");
  
  if (!cookieHeader) {
    console.log("[getSessionFromCookie] Aucun cookie trouvé dans la requête");
    return null;
  }
  
  try {
    // Extraire la session directement à partir du cookie
    const session = await sessionStorage.getSession(cookieHeader);
    const userId = session.get("userId");
    
    if (!userId) {
      console.log("[getSessionFromCookie] Aucun userId trouvé dans la session");
      return null;
    }
    
    // Construire un objet UserSession à partir des données de la session
    const user: UserSession = {
      userId,
      email: session.get("email") || "",
      displayName: session.get("displayName") || "",
      googleRefreshToken: session.get("googleRefreshToken") || ""
    };
    
    console.log(`[getSessionFromCookie] Session utilisateur récupérée, userId: ${userId}`);
    return user;
  } catch (error) {
    console.error("[getSessionFromCookie] Erreur lors de la récupération de la session:", error);
    return null;
  }
} 