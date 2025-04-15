import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { authenticator } from "~/services/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  // This is the route Google redirects back to after authentication.
  // The authenticator handles the callback verification, token exchange,
  // calls the verify function, sets the session, and handles redirection.
  return await authenticator.authenticate("google", request, {
    // Let the authenticator handle the redirection on success.
    // This ensures the session cookie is set correctly before redirecting.
    successRedirect: "/dashboard",
    failureRedirect: "/?error=google-auth-failed",
  });
  // No need for manual redirect here, authenticator handles it.
}
