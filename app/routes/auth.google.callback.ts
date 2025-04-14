import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticator } from "~/services/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  // This is the route Google redirects back to after authentication.
  // The authenticator handles the callback verification, token exchange,
  // and calls the verify function we defined in the GoogleStrategy.
  return authenticator.authenticate("google", request, {
    // Redirect to the dashboard upon successful authentication
    successRedirect: "/dashboard",
     // Redirect to a login or error page upon failure
     // You might want a more specific error page later
     failureRedirect: "/?error=google-auth-failed", // Redirect to homepage on failure
   });
 }
