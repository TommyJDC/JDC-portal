import { json } from '@remix-run/node';
import type { LoaderFunctionArgs } from '@remix-run/node';
// import { authenticator } from '~/services/auth.server'; // Plus utilisé directement
import { sessionStorage, type UserSessionData } from "~/services/session.server"; // Importer sessionStorage et UserSessionData
import { getUserProfileSdk } from '~/services/firestore.service.server'; // Pour vérifier les droits admin

// Interface de base pour les logs si on veut en afficher depuis une autre source
interface LogEntry {
  timestamp: string;
  level: "info" | "warning" | "error" | "success";
  message: string;
  source: string;
  details?: string;
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const devBypass = url.searchParams.get("dev_bypass") === "true";

    const session = await sessionStorage.getSession(request.headers.get("Cookie"));
    const userSession: UserSessionData | null = session.get("user") ?? null;

    if (!userSession && !devBypass) {
      console.log("[api.admin.logs] Authentification échouée (session manuelle)");
      return json({ error: "Non authentifié" }, { status: 401 });
    }

    if (userSession) { // Si l'utilisateur est authentifié via la session
      try {
        const userProfile = await getUserProfileSdk(userSession.userId);
        if (!userProfile || userProfile.role?.toLowerCase() !== 'admin') {
          console.log("[api.admin.logs] Permissions insuffisantes pour", userSession.userId);
          return json({ error: "Permissions insuffisantes" }, { status: 403 });
        }
      } catch (profileError) {
        console.error("[api.admin.logs] Erreur vérification profil admin:", profileError);
        return json({ error: "Erreur vérification des permissions" }, { status: 500 });
      }
    } else if (devBypass) { // Si devBypass est true et userSession est null
      console.log("[api.admin.logs] Mode bypass développement activé");
    } else {
      // Ce cas ne devrait pas être atteint si la logique !userSession && !devBypass est correcte
      // Mais par sécurité, si on arrive ici, c'est que l'utilisateur n'est pas authentifié et le bypass n'est pas actif
      console.log("[api.admin.logs] Accès non autorisé (ni session, ni bypass)");
      return json({ error: "Accès non autorisé" }, { status: 401 });
    }

    console.log("[api.admin.logs] Accès à la route des logs.");
    
    // La logique de récupération des logs blockchain est supprimée.
    // Retourner un message indiquant que cette fonctionnalité a changé.
    const logs: LogEntry[] = [
      {
        timestamp: new Date().toISOString(),
        level: "info",
        message: "La fonctionnalité de logs blockchain a été désactivée.",
        source: "api.admin.logs",
        details: "Les logs d'application doivent être consultés via la plateforme d'hébergement (ex: Vercel, Netlify) ou un système de logging centralisé si configuré."
      }
    ];

    return json({ 
      logs,
      message: "Les logs spécifiques à la blockchain ne sont plus disponibles."
    });

  } catch (error) {
    console.error("[api.admin.logs] Erreur critique:", error);
    return json({ 
      error: "Erreur lors de la tentative de récupération des logs",
      logs: [] 
    }, { status: 500 });
  }
}
