import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { authenticator } from "~/services/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  // This is the route Google redirects back to after authentication.
  // The authenticator handles the callback verification, token exchange,
  // calls the verify function, sets the session, and handles redirection.
  return await authenticator.authenticate("google", request, {
    // Rediriger vers la page de création de profil après l'authentification réussie
    // La page create-profile vérifiera si l'utilisateur a déjà configuré ses secteurs
    // et le redirigera vers le dashboard si c'est le cas
    successRedirect: "/create-profile",
    failureRedirect: "/?error=google-auth-failed",
  });
  // No need for manual redirect here, authenticator handles it.
}
