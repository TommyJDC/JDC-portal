import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { sessionStorage } from "~/services/session.server";
import { authenticator } from "~/services/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  // Analyser les cookies de la requête
  const cookieHeader = request.headers.get("Cookie");
  const hasCookies = !!cookieHeader;
  
  // Récupérer et analyser la session
  let sessionData = null;
  let sessionCookieFound = false;
  let cookieLength = 0;
  
  if (hasCookies) {
    cookieLength = cookieHeader?.length || 0;
    
    // Rechercher spécifiquement le cookie de session
    const cookies = cookieHeader?.split(';') || [];
    for (const cookie of cookies) {
      if (cookie.trim().startsWith('__session=')) {
        sessionCookieFound = true;
        break;
      }
    }
  }
  
  // Essayer de récupérer la session depuis sessionStorage
  let rawSession = null;
  let sessionError = null;
  
  try {
    const session = await sessionStorage.getSession(cookieHeader);
    const userId = session.get("userId");
    const email = session.get("email");
    const displayName = session.get("displayName");
    
    if (userId) {
      sessionData = { userId, email, displayName };
    }
    
    // Récupérer l'objet brut pour debugging
    rawSession = Object.fromEntries(
      Object.entries(session.data).filter(([key]) => 
        !['flash', 'expires'].includes(key)
      )
    );
  } catch (error: any) {
    sessionError = error.message || "Erreur lors de la lecture de la session";
    console.error("Erreur lors de la lecture de la session:", error);
  }
  
  // Vérifier avec authenticator (remix-auth)
  let authData = null;
  let authError = null;
  
  try {
    const authResult = await authenticator.isAuthenticated(request);
    authData = authResult;
  } catch (error: any) {
    authError = error.message || "Erreur lors de l'authentification";
    console.error("Erreur lors de l'authentification:", error);
  }
  
  // Essayer une approche alternative pour lire le cookie
  let altCookieData = null;
  
  if (cookieHeader) {
    try {
      const cookie = (await sessionStorage.commitSession(
        await sessionStorage.getSession(cookieHeader)
      )).split(';')[0].split('=')[1];
      
      if (cookie) {
        // Ne pas afficher le cookie complet, juste une indication
        altCookieData = {
          length: cookie.length,
          preview: `${cookie.substring(0, 10)}...`,
        };
      }
    } catch (error) {
      console.error("Erreur lors de la lecture alternative du cookie:", error);
    }
  }

  return json({
    cookieInfo: {
      hasCookies,
      cookieLength,
      sessionCookieFound,
    },
    sessionData,
    sessionError,
    authData,
    authError,
    rawSession,
    altCookieData,
  });
}

export default function DebugSession() {
  const data = useLoaderData<typeof loader>();
  
  return (
    <div className="min-h-screen bg-jdc-gray-900 p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Débogage de Session</h1>
      
      <div className="space-y-8">
        {/* Informations sur les cookies */}
        <div className="bg-jdc-card rounded-lg shadow-lg p-6">
          <h2 className="text-xl text-white mb-4">Cookies</h2>
          <div className="grid grid-cols-2 gap-2">
            <div className="text-jdc-gray-300">Cookies présents:</div>
            <div className={data.cookieInfo.hasCookies ? "text-green-500" : "text-red-500"}>
              {data.cookieInfo.hasCookies ? "Oui ✅" : "Non ❌"}
            </div>
            
            {data.cookieInfo.hasCookies && (
              <>
                <div className="text-jdc-gray-300">Longueur du header Cookie:</div>
                <div className="text-white">{data.cookieInfo.cookieLength} caractères</div>
                
                <div className="text-jdc-gray-300">Cookie de session trouvé:</div>
                <div className={data.cookieInfo.sessionCookieFound ? "text-green-500" : "text-red-500"}>
                  {data.cookieInfo.sessionCookieFound ? "Oui ✅" : "Non ❌"}
                </div>
                
                {data.altCookieData && (
                  <>
                    <div className="text-jdc-gray-300">Alternative:</div>
                    <div className="text-white">
                      Longueur: {data.altCookieData.length}, 
                      Début: {data.altCookieData.preview}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
        
        {/* Données de session */}
        <div className="bg-jdc-card rounded-lg shadow-lg p-6">
          <h2 className="text-xl text-white mb-4">Session (via sessionStorage)</h2>
          {data.sessionData ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="text-jdc-gray-300">ID Utilisateur:</div>
              <div className="text-white">{data.sessionData.userId}</div>
              
              <div className="text-jdc-gray-300">Email:</div>
              <div className="text-white">{data.sessionData.email}</div>
              
              <div className="text-jdc-gray-300">Nom:</div>
              <div className="text-white">{data.sessionData.displayName}</div>
            </div>
          ) : (
            <div className="text-red-500">
              {data.sessionError || "Aucune donnée de session trouvée"}
            </div>
          )}
          
          {data.rawSession && (
            <div className="mt-4">
              <div className="text-jdc-gray-300 mb-2">Session complète:</div>
              <pre className="bg-jdc-gray-800 p-4 rounded text-green-400 overflow-auto max-h-40 text-xs">
                {JSON.stringify(data.rawSession, null, 2)}
              </pre>
            </div>
          )}
        </div>
        
        {/* Authenticator */}
        <div className="bg-jdc-card rounded-lg shadow-lg p-6">
          <h2 className="text-xl text-white mb-4">Authentification (via authenticator)</h2>
          {data.authData ? (
            <pre className="bg-jdc-gray-800 p-4 rounded text-green-400 overflow-auto max-h-40">
              {JSON.stringify(data.authData, null, 2)}
            </pre>
          ) : (
            <div className="text-red-500">
              {data.authError || "Authenticator n'a pas reconnu l'utilisateur"}
            </div>
          )}
        </div>
        
        {/* Actions */}
        <div className="space-y-4">
          <h2 className="text-xl text-white mb-4">Actions</h2>
          <div className="flex flex-wrap gap-4">
            <a 
              href="/reset-session" 
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
            >
              Réinitialiser la session
            </a>
            <a 
              href="/logout" 
              className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded"
            >
              Se déconnecter
            </a>
            <a 
              href="/" 
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
            >
              Retour à l'accueil
            </a>
            <a 
              href="/diagnostic-auth" 
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
            >
              Diagnostic Auth
            </a>
            <a 
              href="/fix-auth-problem" 
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded font-bold"
            >
              Réparer Authentification
            </a>
            <a 
              href="/user-profile-test" 
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded"
            >
              Profil Test
            </a>
          </div>
        </div>
      </div>
    </div>
  );
} 