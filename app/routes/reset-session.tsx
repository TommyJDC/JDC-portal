import { redirect } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { sessionStorage, type UserSessionData } from "~/services/session.server"; // Importer UserSessionData

export async function loader({ request }: LoaderFunctionArgs) {
  // Récupérer la session actuelle
  const sessionStore = await sessionStorage.getSession(request.headers.get("Cookie"));
  const userSession: UserSessionData | null = sessionStore.get("user") ?? null;
  
  // Afficher les informations dans les logs
  console.log("Reset Session - Données actuelles (UserSessionData):");
  if (userSession) {
    console.log(`UserId: ${userSession.userId}`);
    console.log(`Email: ${userSession.email}`);
    console.log(`Display Name: ${userSession.displayName}`);
    console.log(`Role: ${userSession.role}`);
  } else {
    console.log("Aucune UserSessionData trouvée.");
  }
  
  // Détruire la session
  const newCookie = await sessionStorage.destroySession(sessionStore); // Utiliser sessionStore ici
  
  // Rediriger vers la page d'accueil avec le cookie de destruction
  return redirect("/", {
    headers: {
      "Set-Cookie": newCookie,
    },
  });
}

export default function ResetSession() {
  // Cette fonction ne sera jamais appelée en raison de la redirection dans le loader
  return null;
}
