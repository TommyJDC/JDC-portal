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

  // Authentifier l'utilisateur. Remix-auth gère la session et la redirection.
  // La fonction authenticate retournera une réponse de redirection avec le cookie de session défini.
  // Elle lancera une Réponse (Response) en cas de succès ou d'échec de redirection.
  try {
    // Cette ligne va lancer une Response (redirection) ou une erreur.
    await authenticator.authenticate("google", request, {
      successRedirect: returnTo,
      failureRedirect: "/?error=google-auth-failed",
    });
    
    // Si authenticate ne lance rien (ce qui ne devrait pas arriver avec successRedirect/failureRedirect),
    // on gère un cas improbable.
    console.error("Authenticator did not throw a Response.");
    const headers = new Headers();
    headers.append("Set-Cookie", await authRedirectSessionStorage.destroySession(redirectSession));
    return redirect("/?error=auth-unexpected", { headers });

  } catch (error) {
     // L'erreur est très probablement une Response (redirection) lancée par authenticate.
     if (error instanceof Response) {
       // Que ce soit succès ou échec, authenticate a lancé une Response.
       // Nous ajoutons simplement le Set-Cookie pour détruire la session temporaire.
       const headers = new Headers(error.headers);
       headers.append("Set-Cookie", await authRedirectSessionStorage.destroySession(redirectSession));
       // Retourne la réponse originale (redirection) avec le header supplémentaire.
       return new Response(error.body, { status: error.status, headers: headers });
     }
     
     // Gérer d'autres types d'erreurs inattendues (pas une Response)
     console.error("Google callback non-Response error:", error);
     const headers = new Headers();
     headers.append("Set-Cookie", await authRedirectSessionStorage.destroySession(redirectSession));
     return redirect("/?error=internal-server-error", { headers });
  }
}
