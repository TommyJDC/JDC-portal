import { json } from '@remix-run/node';
import type { LoaderFunction, ActionFunction } from '@remix-run/node';
// import { generateUserKeys } from '~/services/blockchain-wallet.server'; // Commenté temporairement

export const action: ActionFunction = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const uid = url.searchParams.get('uid');
    if (!uid) {
      return json({ success: false, error: 'uid manquant' }, { status: 400 });
    }
    // await generateUserKeys(uid); // Logique de génération commentée
    console.warn(`[api/generate-wallet] La génération de wallet pour l'UID ${uid} est temporairement désactivée.`);
    return json({ 
      success: false, 
      error: 'La fonctionnalité de génération de wallet est temporairement désactivée en raison de problèmes d\'importation du service blockchain-wallet.' 
    }, { status: 503 }); // 503 Service Unavailable
  } catch (error: any) {
    return json({ success: false, error: error?.message || 'Erreur inconnue' }, { status: 500 });
  }
};

export const loader: LoaderFunction = async () => {
  return json({ success: false, error: 'Méthode non autorisée' }, { status: 405 });
};
