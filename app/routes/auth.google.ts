/*
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { redirect, createCookieSessionStorage } from "@remix-run/node";
import { authenticator } from "~/services/auth.server";

// Session temporaire pour stocker les informations de redirection
const authSessionStorage = createCookieSessionStorage({
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
  const url = new URL(request.url);
  const returnTo = url.searchParams.get("returnTo");
  const mode = url.searchParams.get("mode");

  // Si c'est une authentification pour Gmail, on ne vérifie pas si l'utilisateur est déjà authentifié
  if (mode !== "gmail") {
    await authenticator.isAuthenticated(request, {
      successRedirect: "/dashboard",
    });
  }

  // Stocker returnTo et mode dans une session temporaire
  const session = await authSessionStorage.getSession();
  session.set("returnTo", returnTo || "/dashboard");
  session.set("mode", mode || "default");

  // Stocker le cookie de session temporaire dans les headers
  const headers = new Headers();
  headers.set("Set-Cookie", await authSessionStorage.commitSession(session));

  // Laisser l'authenticator gérer la redirection vers Google OAuth
  return authenticator.authenticate("google", request, {
    context: { headers },
    failureRedirect: "/?error=google-auth-failed"
  });
}

export async function action({ request, params, context }: ActionFunctionArgs) {
  return loader({ request, params, context });
}
*/

// Cette route n'est plus utilisée car auth-direct.tsx gère le flux d'authentification.
// Laisser un export par défaut pour éviter les erreurs si la route est encore appelée.
export default function AuthGoogleRoute() {
  return null; // Pas besoin d'afficher de contenu, les loaders/actions redirigent.
}

// Exporter des fonctions loader et action vides ou qui redirigent pour éviter les erreurs.
import { redirect } from "@remix-run/node";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  return redirect("/login");
}

export async function action({ request }: ActionFunctionArgs) {
  return redirect("/login");
}
