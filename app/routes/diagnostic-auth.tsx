import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import type { LoaderFunctionArgs } from "@remix-run/node";
// import { authenticator } from "~/services/auth.server"; // Plus utilisé directement
import { sessionStorage, type UserSessionData } from "~/services/session.server"; // Importer sessionStorage et UserSessionData
import { getUserProfileSdk } from "~/services/firestore.service.server";
import type { UserProfile } from "~/types/firestore.types"; // Importer UserProfile pour typer profileData

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const cookie = request.headers.get("Cookie");
    const sessionStore = await sessionStorage.getSession(cookie);
    const userSession: UserSessionData | null = sessionStore.get("user") ?? null; // Assurer que c'est null si undefined

    if (!userSession || !userSession.userId) {
      return json({
        authenticated: false,
        userId: null,
        email: null,
        displayName: null,
        error: "Non authentifié (session manuelle)",
        profileData: null,
        rawSession: sessionStore.data // Afficher les données brutes de la session
      });
    }

    // Session trouvée
    console.log("Session (UserSessionData) trouvée:", userSession);

    // Tenter de récupérer le profil
    let profileError: string | null = null;
    let profileData: UserProfile | null = null;
    try {
      profileData = await getUserProfileSdk(userSession.userId);
    } catch (error: any) {
      profileError = error.message || "Erreur inconnue lors de la récupération du profil";
      console.error("Erreur lors de la récupération du profil:", error);
    }

    return json({
      authenticated: true,
      userId: userSession.userId,
      email: userSession.email,
      displayName: userSession.displayName,
      error: profileError,
      profileData,
      rawSession: userSession // Afficher l'objet UserSessionData
    });
  } catch (error: any) {
    console.error("Erreur dans le loader diagnostic-auth:", error);
    return json({
      authenticated: false,
      userId: null,
      error: `Erreur critique: ${error.message || "Erreur inconnue"}`,
      profileData: null,
      rawSession: null
    });
  }
}

export default function DiagnosticAuth() {
  const data = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-jdc-gray-900 p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Diagnostic d'Authentification</h1>

      <div className="bg-jdc-card rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-xl text-white mb-4">Statut d'authentification</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-jdc-gray-300">État:</div>
          <div className={`font-bold ${data.authenticated ? "text-green-500" : "text-red-500"}`}>
            {data.authenticated ? "Authentifié ✅" : "Non authentifié ❌"}
          </div>

          {data.userId && (
            <>
              <div className="text-jdc-gray-300">ID Utilisateur:</div>
              <div className="text-white">{data.userId}</div>

              <div className="text-jdc-gray-300">Email:</div>
              <div className="text-white">{data.email}</div>

              <div className="text-jdc-gray-300">Nom:</div>
              <div className="text-white">{data.displayName}</div>
            </>
          )}

          {data.error && (
            <>
              <div className="text-jdc-gray-300">Erreur:</div>
              <div className="text-red-500">{data.error}</div>
            </>
          )}
        </div>
      </div>

      {data.profileData && (
        <div className="bg-jdc-card rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl text-white mb-4">Données du profil utilisateur</h2>
          <pre className="bg-jdc-gray-800 p-4 rounded text-green-400 overflow-auto max-h-80">
            {JSON.stringify(data.profileData, null, 2)}
          </pre>
        </div>
      )}

      <div className="bg-jdc-card rounded-lg shadow-lg p-6">
        <h2 className="text-xl text-white mb-4">Session complète</h2>
        <pre className="bg-jdc-gray-800 p-4 rounded text-blue-400 overflow-auto max-h-80">
          {JSON.stringify(data.rawSession, null, 2)}
        </pre>
      </div>

      <div className="mt-6 space-y-4">
        <p className="text-white">Tests et actions:</p>
        <div className="space-x-4">
          <a href="/user-profile" className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded">
            Aller à la page profil
          </a>
          <a href="/dashboard" className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded">
            Aller au dashboard
          </a>
          <a href="/logout" className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded">
            Se déconnecter
          </a>
        </div>
      </div>
    </div>
  );
}
