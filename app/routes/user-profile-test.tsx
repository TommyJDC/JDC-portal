import { json, redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import type { LoaderFunctionArgs } from "@remix-run/node";
// import { authenticator } from "~/services/auth.server"; // Plus utilisé directement
import { sessionStorage, type UserSessionData } from "~/services/session.server"; // Importer pour session manuelle

export async function loader({ request }: LoaderFunctionArgs) {
  // Vérifier l'authentification de base
  const sessionCookie = request.headers.get("Cookie");
  const sessionStore = await sessionStorage.getSession(sessionCookie);
  const userSession: UserSessionData | null = sessionStore.get("user") ?? null;

  if (!userSession || !userSession.userId) {
    // Rediriger vers /login si non authentifié, car "/" redirige vers /dashboard qui nécessitera une auth
    return redirect("/login"); 
  }

  // Retourner uniquement les données de session, sans appeler la blockchain
  return json({
    userId: userSession.userId,
    email: userSession.email || '',
    displayName: userSession.displayName || '',
  });
}

export default function UserProfileTest() {
  const data = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg shadow-lg p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-white text-center mb-6">Profil Utilisateur (Test)</h1>
        
        <div className="space-y-4">
          {/* Informations simples */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">ID Utilisateur</label>
            <p className="text-sm text-white bg-gray-700 px-3 py-2 rounded">{data.userId}</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
            <p className="text-sm text-white bg-gray-700 px-3 py-2 rounded">{data.email}</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Nom d'affichage</label>
            <p className="text-sm text-white bg-gray-700 px-3 py-2 rounded">{data.displayName}</p>
          </div>
        </div>
        
        <div className="mt-8 text-center">
          <p className="text-gray-400 mb-4">Cette page est une version simplifiée sans accès à la blockchain</p>
          <div className="flex justify-between">
            <a href="/dashboard" className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors">
              Retour au tableau de bord
            </a>
            <a href="/user-profile" className="inline-block bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded transition-colors">
              Essayer la vraie page profil
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
