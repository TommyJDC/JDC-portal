import { json } from '@remix-run/node';
import type { ActionFunctionArgs } from '@remix-run/node';
// import { authenticator } from '~/services/auth.server'; // Plus utilisé directement
import { sessionStorage, type UserSessionData } from "~/services/session.server"; // Importer pour session manuelle

/**
 * Cette API permet de recréer des notifications avec des IDs simples et non composés
 * pour qu'elles soient facilement supprimables
 */
export async function action({ request }: ActionFunctionArgs) {
  try {
    // Mode développement - vérifier s'il y a un paramètre de bypass
    const url = new URL(request.url);
    const devBypass = url.searchParams.get("dev_bypass") === "true";
    
    // Vérifier l'authentification
    const session = await sessionStorage.getSession(request.headers.get("Cookie"));
    const userSession: UserSessionData | null = session.get("user") ?? null;

    if (!userSession && !devBypass) {
      return json({ error: "Non authentifié (session manuelle)" }, { status: 401 });
    }
    // La logique de cette route est désactivée, donc la session n'est pas utilisée au-delà de la vérification.
    // Cette route n'est plus disponible car la blockchain n'est plus utilisée
    return json({ error: "La recréation des notifications via la blockchain n'est plus supportée. Utilisez Firestore." }, { status: 410 });
  } catch (error) {
    console.error("[api.recreate-notifications] Erreur critique:", error);
    return json({ error: "Erreur serveur" }, { status: 500 });
  }
}
