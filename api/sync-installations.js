import fetch from 'node-fetch';

export const handler = async (event, context) => {
  console.log('[sync-installations] Début de la synchronisation');

  // Vérifier la clé API pour l'authentification interne
  const apiKey = event.headers['x-api-key'];
  const expectedApiKey = process.env.SCHEDULED_TASKS_API_KEY;

  if (!apiKey || apiKey !== expectedApiKey) {
    console.error('[sync-installations] Tentative d\'accès non autorisée (clé API manquante ou incorrecte)');
    return {
      statusCode: 401,
      body: JSON.stringify({ success: false, error: 'Unauthorized' })
    };
  }

  try {
    const apiUrl = `${process.env.VERCEL_URL}/api/sync-installations`;
    console.log('[sync-installations] Appel de l\'API:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('[sync-installations] Erreur API:', response.status, response.statusText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Synchronisation exécutée avec succès' })
    };
    console.log('[sync-installations] Synchronisation terminée avec succès');
    return result;
  } catch (error) {
    console.error('[sync-installations] Erreur de synchronisation:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
