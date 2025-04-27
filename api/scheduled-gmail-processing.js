import fetch from 'node-fetch';

export const handler = async (event, context) => {
  console.log('[scheduled-gmail] Début du traitement planifié');

  try {
    const apiUrl = `${process.env.VERCEL_URL}/api/gmail-to-firestore`;
    console.log('[scheduled-gmail] Appel de l\'API:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('[scheduled-gmail] Erreur API:', response.status, response.statusText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Traitement exécuté avec succès' })
    };
    console.log('[scheduled-gmail] Traitement terminé avec succès');
    return result;
  } catch (error) {
    console.error('[scheduled-gmail] Erreur du traitement planifié:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
