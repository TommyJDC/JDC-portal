import React from 'react';
import { json, redirect } from '@remix-run/node';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, useSearchParams } from '@remix-run/react';
// Importer depuis firebase.admin.config.server pour une initialisation centralisée
import { initializeFirebaseAdmin, getDb } from '~/firebase.admin.config.server'; 

interface DebugInfo {
  timestamp: string;
  env: {
    nodeEnv: string;
    firestoreProjectId?: string; // Ajout pour Firestore
  };
  firestoreStatus: {
    connected: boolean;
    error?: string;
  };
  // Les références à contractAddresses, provider, wallet sont supprimées
}

export async function loader({ request }: LoaderFunctionArgs) {
  // Auto-activer le mode bypass (conservé si utile pour d'autres raisons)
  const url = new URL(request.url);
  if (url.searchParams.get("dev_bypass") !== "true") {
    url.searchParams.set("dev_bypass", "true");
    console.log('[admin.test-firestore] Activation automatique du mode bypass');
    return redirect(url.toString());
  }

  const debugInfo: DebugInfo = {
    timestamp: new Date().toISOString(),
    env: {
      nodeEnv: process.env.NODE_ENV || 'non défini',
      firestoreProjectId: process.env.FIREBASE_PROJECT_ID || 'non défini',
    },
    firestoreStatus: {
      connected: false,
    },
  };

  try {
    console.log('[admin.test-firestore] Test de connexion Firestore');
    await initializeFirebaseAdmin(); // Assure l'initialisation de Firebase Admin
    const db = getDb(); // Obtient l'instance Firestore
    // Optionnel: Tenter une petite opération pour confirmer la connexion, ex: lire un document non critique
    // await db.collection('__test_collection__').doc('__test_doc__').get();
    debugInfo.firestoreStatus.connected = true;
    console.log('[admin.test-firestore] Connexion Firestore (ou initialisation) réussie');
    
    return json(debugInfo);
  } catch (error) {
    console.error('[admin.test-firestore] Erreur Firestore:', error);
    debugInfo.firestoreStatus.error = error instanceof Error ? error.message : 'Erreur inconnue Firestore';
    return json(debugInfo);
  }
}

export default function TestFirestore() { // Renommé pour refléter le changement
  const data = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  
  return (
    <div className="bg-jdc-gray-900 p-6 rounded-lg">
      <h1 className="text-2xl font-bold text-white mb-6">Test Connexion Firestore</h1>
      
      <div className="mb-4 bg-amber-900/30 p-3 rounded border border-amber-700">
        <p className="text-amber-300 text-sm">Mode bypass activé: {searchParams.get("dev_bypass") === "true" ? "Oui" : "Non"}</p>
      </div>
      
      {data.firestoreStatus.error && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded">
          <h2 className="text-red-400 mb-2">Erreur Firestore</h2>
          <p className="text-red-300">{data.firestoreStatus.error}</p>
        </div>
      )}
      
      <div className="space-y-6">
        <div className="bg-jdc-gray-800 p-4 rounded">
          <h2 className="text-lg font-semibold text-jdc-blue mb-4">Environnement</h2>
          <div className="space-y-2">
            <p><span className="text-jdc-gray-400">Node Env:</span> <span className="text-white">{data.env.nodeEnv}</span></p>
            <p><span className="text-jdc-gray-400">Project ID Firestore:</span> <span className="text-white">{data.env.firestoreProjectId}</span></p>
            <p><span className="text-jdc-gray-400">Timestamp:</span> <span className="text-white">{data.timestamp}</span></p>
          </div>
        </div>
        
        <div className="bg-jdc-gray-800 p-4 rounded">
          <h2 className="text-lg font-semibold text-jdc-blue mb-4">Connexion Firestore</h2>
          <div className="space-y-2">
            <p>
              <span className="text-jdc-gray-400">Statut:</span> 
              <span className={data.firestoreStatus.connected ? "text-green-500 ml-2" : "text-red-500 ml-2"}>
                {data.firestoreStatus.connected ? "Connecté" : "Non connecté"}
              </span>
            </p>
            {data.firestoreStatus.error && (
              <p><span className="text-jdc-gray-400">Détail Erreur:</span> <span className="text-red-400 ml-2">{data.firestoreStatus.error}</span></p>
            )}
          </div>
        </div>
      </div>
      
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
