import { json, type LoaderFunctionArgs, redirect } from "@remix-run/node"; // Ajout de redirect
// import { authenticator } from "~/services/auth.server"; // Plus utilisé directement
import { sessionStorage, type UserSessionData } from "~/services/session.server"; // Importer sessionStorage et UserSessionData

// Ce loader renvoie le token d'accès Google de l'utilisateur authentifié.
export async function loader({ request }: LoaderFunctionArgs) {
  const session = await sessionStorage.getSession(request.headers.get("Cookie"));
  const userSession: UserSessionData | null = session.get("user") ?? null;

  if (!userSession || !userSession.userId) {
    // Rediriger si non authentifié. Note: authenticator le faisait automatiquement.
    // Ici, nous devons le faire explicitement si failureRedirect est souhaité.
    // Pour une API, retourner une erreur 401 est souvent préférable.
    return json({ error: "Non authentifié." }, { status: 401 });
    // Ou: throw redirect("/login"); 
  }

  // IMPORTANT: UserSessionData ne contient pas googleAccessToken par défaut.
  // Il contient googleRefreshToken. Si googleAccessToken est nécessaire,
  // il faudrait l'ajouter à UserSessionData et le stocker lors de la connexion.
  // Pour l'instant, on suppose qu'il pourrait être ajouté à UserSessionData.
  // Si on veut utiliser le refreshToken pour obtenir un accessToken, la logique serait ici.
  const accessToken = (userSession as any).googleAccessToken; // Cast temporaire pour correspondre à l'ancienne logique

  if (!accessToken) {
    return json({ error: "Token d'accès Google manquant dans la session." }, { status: 401 });
  }

  return json({ accessToken: accessToken });
}
