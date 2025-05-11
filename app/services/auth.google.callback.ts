import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect, createCookieSessionStorage } from "@remix-run/node"; // Response retiré de l'import
import { authenticator } from "~/services/auth.server";
// Retiré : import { commitSession, getSession } from "~/services/session.server";

// Session temporaire pour stocker les informations de redirection
const authRedirectSessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__auth_redirect",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [process.env.SESSION_SECRET || import.meta.env.VITE_SESSION_SECRET],
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 5, // 5 minutes
  },
});

export async function loader({ request }: LoaderFunctionArgs) {
  // Récupérer la session temporaire pour obtenir l'URL de redirection
  const redirectSession = await authRedirectSessionStorage.getSession(
    request.headers.get("Cookie")
  );
  
  // Déterminer l'URL de redirection AVANT l'authentification
  let returnTo = redirectSession.get("returnTo") || "/user-profile"; // Ou une autre page par défaut post-connexion
  const mode = redirectSession.get("mode");

  if (mode === "gmail") {
    returnTo = "/admin/gmail-config";
  }

  try {
    // Essayer d'authentifier l'utilisateur sans redirection automatique
    // pour pouvoir intercepter et modifier la réponse
    return await authenticator.authenticate("google", request, {
      // Pas de successRedirect/failureRedirect pour pouvoir personnaliser la réponse
      throwOnError: true,
      context: { redirectTo: returnTo }
    }).then((user) => {
      // Si l'authentification réussit, rediriger manuellement
      // et effacer la session temporaire
      const headers = new Headers();
      headers.append("Set-Cookie", authRedirectSessionStorage.destroySession(redirectSession));
      return redirect(returnTo, { headers });
    });
  } catch (error) {
    console.error("Google callback error:", error);
    
    // Toujours s'assurer de nettoyer la session temporaire
    const headers = new Headers();
    headers.append("Set-Cookie", authRedirectSessionStorage.destroySession(redirectSession));
    
    // Rediriger vers la page d'accueil avec un message d'erreur
    return redirect("/?error=google-auth-failed", { headers });
  }
} 