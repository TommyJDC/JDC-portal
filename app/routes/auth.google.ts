import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { authenticator } from "~/services/auth.server"; // Import the authenticator

// Loader function: Redirects GET requests to the authenticator
export async function loader({ request }: LoaderFunctionArgs) {
  // If the user is already authenticated, redirect them to the dashboard or another appropriate page
  // This prevents users from hitting the login initiation route if they are already logged in.
  await authenticator.isAuthenticated(request, {
    successRedirect: "/dashboard", // Or wherever you want authenticated users to go
  });

  // If not authenticated, proceed with initiating the Google authentication flow
  return authenticator.authenticate("google", request);
}

// Action function: Handles POST requests (e.g., from a login button)
export async function action({ request }: ActionFunctionArgs) {
   // If the user is already authenticated, redirect them away
   await authenticator.isAuthenticated(request, {
    successRedirect: "/dashboard",
  });
  // Initiate the Google authentication flow
  return authenticator.authenticate("google", request);
}
