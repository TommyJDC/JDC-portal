import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticator } from "~/services/auth.server";
import type { UserSession } from "~/services/session.server";

// Ce loader renvoie le token d'accès Google de l'utilisateur authentifié.
export async function loader({ request }: LoaderFunctionArgs) {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login", // Rediriger si non authentifié
  });

  if (!user || !user.googleAccessToken) {
    return json({ error: "Token d'accès Google manquant." }, { status: 401 });
  }

  return json({ accessToken: user.googleAccessToken });
}
