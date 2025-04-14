import type { ActionFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node"; // Import redirect
import { authenticator } from "~/services/auth.server";

// Action function: Handles POST requests to log the user out
export async function action({ request }: ActionFunctionArgs) {
  // Use the authenticator to destroy the user's session
  await authenticator.logout(request, { redirectTo: "/" }); // Redirect to homepage after logout
}

// Loader function: Redirect GET requests to the homepage or login page
// Prevents users from accessing the logout route directly via GET
export async function loader() {
  // You could also redirect to '/login' or another appropriate page
  return redirect("/");
}
