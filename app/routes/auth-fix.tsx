import { redirect } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
// import { authenticator } from "~/services/auth.server"; // Plus utilisé directement
import { sessionStorage, type UserSessionData } from "~/services/session.server"; // Importer UserSessionData

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const cookieHeader = request.headers.get("Cookie");
    const sessionStore = await sessionStorage.getSession(cookieHeader);
    const userSession: UserSessionData | null = sessionStore.get("user") ?? null;
    
    if (userSession && userSession.userId) {
      // Si une session valide existe (selon notre nouvelle méthode), on considère que l'authentification "fonctionne"
      // ou du moins qu'il n'y a rien à "fixer" de cette manière.
      // L'objectif de cette route était peut-être de gérer des sessions créées par l'ancien authenticator.
      console.log("[auth-fix] Session utilisateur valide trouvée, redirection vers le profil");
      return redirect("/user-profile");
    }
    
    // Si nous arrivons ici, soit il n'y a pas de cookie, soit la session est invalide (pas d'objet user ou pas de userId).
    if (!cookieHeader) {
      console.log("[auth-fix] Aucun cookie trouvé, redirection vers la page de connexion");
      return redirect("/login"); // Rediriger vers /login qui mène à /auth-direct
    }
    
    // Il y a un cookie, mais la session n'est pas valide selon notre nouvelle méthode.
    // Cela pourrait être une session ancienne ou corrompue.
    console.log("[auth-fix] Cookie trouvé mais session invalide. Tentative de destruction de la session.");
    
    // Détruire la session (même si elle est potentiellement déjà invalide ou vide)
    const newCookie = await sessionStorage.destroySession(sessionStore);
    
    // Rediriger vers la page de connexion après avoir tenté de nettoyer la session.
    console.log("[auth-fix] Session détruite (ou tentative), redirection vers la page de connexion.");
    return redirect("/login", {
      headers: {
        "Set-Cookie": newCookie,
      },
    });
  } catch (error: any) {
    console.error("[auth-fix] Erreur lors de la tentative de correction:", error);
    
    // En cas d'erreur, rediriger vers la page de debug
    return redirect("/debug-session");
  }
}

export default function AuthFix() {
  // Cette fonction ne devrait jamais être appelée en raison de la redirection
  return null;
}
