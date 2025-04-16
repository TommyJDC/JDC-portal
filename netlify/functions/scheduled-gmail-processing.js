import fetch from 'node-fetch';

export const handler = async (event, context) => {
  const secret = process.env.SCHEDULED_TASK_SECRET;
  
  // Vérification de sécurité
  if (event.headers['x-scheduled-secret'] !== secret) {
    return {
      statusCode: 403,
      body: 'Unauthorized'
    };
  }

  try {
    const response = await fetch(`${process.env.URL}/api/gmail-to-firestore`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-scheduled-secret': secret
      }
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Traitement exécuté avec succès' })
    };
  } catch (error) {
    console.error('Erreur du traitement planifié:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
