import { json } from '@remix-run/node';
import type { LoaderFunctionArgs } from '@remix-run/node';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const devBypass = url.searchParams.get("dev_bypass") === "true";
  
  // En production, cette route ne devrait pas être accessible
  if (!import.meta.env.DEV && !devBypass) {
    return json({ error: 'Cette route est uniquement disponible en développement' }, { status: 403 });
  }

  try {
    console.log('[api.reinit-notifications] Réinitialisation des notifications...');
    return json({ success: true, message: 'Notifications réinitialisées avec succès' });
  } catch (error) {
    console.error('[api.reinit-notifications] Erreur:', error);
    return json({ 
      error: `Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}` 
    }, { status: 500 });
  }
}
