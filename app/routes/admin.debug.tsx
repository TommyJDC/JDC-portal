import React from 'react';
import { useLoaderData, useSearchParams } from '@remix-run/react';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node';
import { getSessionFromCookie } from '~/services/session-utils.server';
import { getUserProfileSdk } from '~/services/firestore.service.server'; // Import Firestore SDK service
import type { UserProfile } from '~/types/firestore.types'; // Import UserProfile type

// Définir le type de données retournées par le loader
interface LoaderData {
  timestamp: string;
  session: {
    userId: string | null;
    email: string | null;
    profile: UserProfile | null;
  };
  error?: string;
  stack?: string;
}

export async function loader({ request }: LoaderFunctionArgs): Promise<ReturnType<typeof json<LoaderData>>> {
  // Toujours activer le mode bypass pour cette page
  const url = new URL(request.url);
  if (url.searchParams.get("dev_bypass") !== "true") {
    url.searchParams.set("dev_bypass", "true");
    return redirect(url.toString());
  }
  const session = await getSessionFromCookie(request);
  let userProfile: UserProfile | null = null;
  if (session?.userId) {
    try {
      userProfile = await getUserProfileSdk(session.userId);
    } catch (error) {
      console.error('[admin.debug] Erreur lors de la récupération du profil Firestore:', error);
    }
  }
  const debugInfo: LoaderData = {
    timestamp: new Date().toISOString(),
    session: {
      userId: session?.userId || 'bypass-dev',
      email: session?.email || 'bypass@dev.local',
      profile: userProfile || null
    }
  };
  return json(debugInfo);
}

export default function FirestoreDebug() {
  const data = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  return (
    <div className="bg-jdc-gray-900 p-6 rounded-lg shadow">
      <h1 className="text-2xl font-bold text-white mb-6">Diagnostic Firestore</h1>
      <div className="mb-4 bg-amber-900/30 p-3 rounded border border-amber-700">
        <p className="text-amber-300 text-sm">Mode bypass activé: {searchParams.get("dev_bypass") === "true" ? "Oui" : "Non"}</p>
      </div>
      {data.error ? (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded">
          <h2 className="text-xl font-semibold text-red-400 mb-2">Erreur</h2>
          <pre className="text-red-300 text-sm whitespace-pre-wrap">{data.error}</pre>
          {data.stack && (
            <details className="mt-3">
              <summary className="text-red-400 cursor-pointer">Stack trace</summary>
              <pre className="mt-2 text-red-300 text-xs overflow-x-auto">{data.stack}</pre>
            </details>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-jdc-gray-800 p-4 rounded">
            <h2 className="text-xl font-semibold text-jdc-blue mb-4">Informations de session</h2>
            <div className="space-y-2">
              <p><span className="text-jdc-gray-400">ID utilisateur:</span> <span className="text-white">{data.session?.userId || 'Non disponible'}</span></p>
              <p><span className="text-jdc-gray-400">Email:</span> <span className="text-white">{data.session?.email || 'Non disponible'}</span></p>
              {data.session?.profile && (
                <>
                  <p><span className="text-jdc-gray-400">Nom d'affichage:</span> <span className="text-white">{data.session.profile.displayName}</span></p>
                  <p><span className="text-jdc-gray-400">Rôle:</span> <span className="text-white">{data.session.profile.role}</span></p>
                  <p><span className="text-jdc-gray-400">Secteurs:</span> <span className="text-white">{data.session.profile.secteurs?.join(', ') || 'Aucun'}</span></p>
                </>
              )}
              <p><span className="text-jdc-gray-400">Timestamp:</span> <span className="text-white">{data.timestamp}</span></p>
            </div>
          </div>
        </div>
      )}
      <div className="mt-6 flex gap-3">
        <a href="/admin" className="px-4 py-2 bg-jdc-gray-700 rounded text-white hover:bg-jdc-gray-600">
          Retour à l'admin
        </a>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-jdc-blue rounded text-white hover:bg-blue-700"
        >
          Rafraîchir
        </button>
      </div>
    </div>
  );
}
