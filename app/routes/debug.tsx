import { json, LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { useEffect, useState } from "react";
import { DebugAuth } from "~/components/DebugAuth";
import { authenticator } from "~/services/auth.server";
import { getUserProfileSdk } from "~/services/firestore.service.server";
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { app as clientApp } from '~/firebase.config';
import type { UserProfile } from "~/types/firestore.types";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await authenticator.isAuthenticated(request);
  
  let serverProfile = null;
  if (user?.userId) {
    try {
      serverProfile = await getUserProfileSdk(user.userId);
      console.log("[DEBUG] Server profile loaded:", serverProfile);
    } catch (error) {
      console.error("[DEBUG] Error loading server profile:", error);
    }
  }
  
  return json({ user, serverProfile });
}

export default function DebugPage() {
  const { user, serverProfile } = useLoaderData<typeof loader>();
  const [clientUser, setClientUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const auth = getAuth(clientApp);
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      console.log("[DEBUG] Firebase auth state changed:", firebaseUser);
      setClientUser(firebaseUser ? {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
        emailVerified: firebaseUser.emailVerified,
        providerId: firebaseUser.providerId,
      } : null);
      setIsLoading(false);
    });
    
    return () => unsubscribe();
  }, []);
  
  return (
    <div className="max-w-4xl mx-auto space-y-8 py-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">Diagnostic de l'authentification</h1>
        <div className="space-x-4">
          <Link to="/debug-profile" className="text-blue-400 hover:underline">
            Tester un profil spécifique
          </Link>
          <Link to="/" className="text-blue-400 hover:underline">
            Retour à l'accueil
          </Link>
        </div>
      </div>
      
      <div className="bg-blue-900/30 p-6 rounded-lg border border-blue-800">
        <h2 className="text-xl font-semibold text-white mb-4">Session utilisateur (côté serveur)</h2>
        {user ? (
          <div className="bg-gray-800 p-4 rounded overflow-auto max-h-60">
            <pre className="text-gray-300 whitespace-pre-wrap">
              {JSON.stringify(user, null, 2)}
            </pre>
          </div>
        ) : (
          <p className="text-red-400">Aucune session utilisateur trouvée côté serveur.</p>
        )}
      </div>
      
      <div className="bg-blue-900/30 p-6 rounded-lg border border-blue-800">
        <h2 className="text-xl font-semibold text-white mb-4">Profil utilisateur (côté serveur)</h2>
        {serverProfile ? (
          <div className="space-y-4">
            <div className="bg-gray-800 p-4 rounded overflow-auto max-h-60">
              <pre className="text-gray-300 whitespace-pre-wrap">
                {JSON.stringify(serverProfile, null, 2)}
              </pre>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p><span className="text-gray-400">ID:</span> <span className="text-white">{serverProfile.uid}</span></p>
                <p><span className="text-gray-400">Email:</span> <span className="text-white">{serverProfile.email}</span></p>
                <p><span className="text-gray-400">Nom:</span> <span className="text-white">{serverProfile.displayName}</span></p>
              </div>
              <div>
                <p><span className="text-gray-400">Rôle:</span> <span className="text-white">{serverProfile.role}</span></p>
                <p><span className="text-gray-400">Type du rôle:</span> <span className="text-white">{typeof serverProfile.role}</span></p>
                <p><span className="text-gray-400">Est Admin:</span> <span className="text-white">{serverProfile.role?.toLowerCase() === 'admin' ? 'Oui' : 'Non'}</span></p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-red-400">Aucun profil utilisateur trouvé côté serveur.</p>
        )}
      </div>
      
      <div className="bg-blue-900/30 p-6 rounded-lg border border-blue-800">
        <h2 className="text-xl font-semibold text-white mb-4">Utilisateur Firebase (côté client)</h2>
        {isLoading ? (
          <p className="text-yellow-400">Chargement de l'état d'authentification Firebase...</p>
        ) : clientUser ? (
          <div className="bg-gray-800 p-4 rounded overflow-auto max-h-60">
            <pre className="text-gray-300 whitespace-pre-wrap">
              {JSON.stringify(clientUser, null, 2)}
            </pre>
          </div>
        ) : (
          <p className="text-red-400">Aucun utilisateur Firebase trouvé côté client.</p>
        )}
      </div>
      
      <div className="bg-blue-900/30 p-6 rounded-lg border border-blue-800">
        <h2 className="text-xl font-semibold text-white mb-4">Composant DebugAuth</h2>
        <div className="bg-gray-800 p-4 rounded">
          <DebugAuth user={user} profile={serverProfile as UserProfile} loadingAuth={isLoading} />
        </div>
      </div>
      
      <div className="bg-yellow-900/30 p-6 rounded-lg border border-yellow-800">
        <h2 className="text-xl font-semibold text-white mb-4">Diagnostic</h2>
        
        {user && clientUser && (
          <div className="mb-4">
            <p className="text-white mb-2">
              <strong>Correspondance des IDs:</strong>{" "}
              {user.userId === clientUser.uid ? (
                <span className="text-green-400">OK - Les IDs correspondent</span>
              ) : (
                <span className="text-red-400">ERREUR - Les IDs ne correspondent pas</span>
              )}
            </p>
            <p className="text-gray-300">
              <span className="text-gray-400">ID Serveur:</span> {user.userId}<br />
              <span className="text-gray-400">ID Client:</span> {clientUser.uid}
            </p>
          </div>
        )}
        
        {serverProfile && (
          <div className="mb-4">
            <p className="text-white mb-2">
              <strong>Rôle Admin:</strong>{" "}
              {serverProfile.role?.toLowerCase() === 'admin' ? (
                <span className="text-green-400">OUI - L'utilisateur a le rôle Admin</span>
              ) : (
                <span className="text-red-400">NON - L'utilisateur n'a pas le rôle Admin</span>
              )}
            </p>
            <p className="text-gray-300">
              <span className="text-gray-400">Rôle:</span> {serverProfile.role} (type: {typeof serverProfile.role})
            </p>
          </div>
        )}
        
        <div className="mt-4">
          <h3 className="text-lg font-semibold text-white mb-2">Actions recommandées:</h3>
          <ul className="list-disc list-inside text-gray-300 space-y-1">
            <li>Vérifiez que l'ID utilisateur côté serveur correspond à l'ID Firebase</li>
            <li>Vérifiez que le profil utilisateur contient bien un rôle "Admin" (sensible à la casse)</li>
            <li>Vérifiez que la variable <code className="bg-gray-800 px-1 rounded">loadingAuth</code> n'est pas bloquée à <code className="bg-gray-800 px-1 rounded">true</code></li>
            <li>Utilisez la page <Link to="/debug-profile" className="text-blue-400 underline">Tester un profil</Link> pour vérifier directement un profil utilisateur</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
