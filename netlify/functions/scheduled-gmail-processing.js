// JDC-portal/netlify/functions/scheduled-gmail-processing.js
// Assurez-vous que 'node-fetch' est installé pour vos fonctions Netlify:
// cd JDC-portal/netlify/functions (ou le dossier contenant le package.json des fonctions)
// npm install node-fetch
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  // Récupérez l'URL de base de votre site depuis les variables d'environnement Netlify
  // Assurez-vous que la variable DEPLOY_PRIME_URL ou URL est définie dans votre environnement Netlify
  const siteUrl = process.env.DEPLOY_PRIME_URL || process.env.URL || 'http://localhost:3000'; // Fallback pour le développement local si nécessaire
  const apiUrl = `${siteUrl}/api/gmail-to-firestore`;

  console.log(`[Netlify Function] scheduled-gmail-processing: Appel de ${apiUrl}`);

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        // Ajoutez des en-têtes si nécessaire, par exemple un secret pour sécuriser l'API
        // 'Authorization': `Bearer ${process.env.YOUR_API_SECRET}`
        'Content-Type': 'application/json' // Même si le corps est vide, c'est une bonne pratique
      },
      // body: JSON.stringify({}) // Ajoutez un corps si votre API l'attend
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error(`[Netlify Function] scheduled-gmail-processing: Erreur lors de l'appel API (${response.status})`, responseData);
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: `Erreur API: ${response.statusText}`, details: responseData }),
      };
    }

    console.log('[Netlify Function] scheduled-gmail-processing: Appel API réussi.', responseData);
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Traitement Gmail déclenché.', details: responseData }),
    };

  } catch (error) {
    console.error('[Netlify Function] scheduled-gmail-processing: Erreur inattendue.', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Erreur interne de la fonction Netlify.', details: error.message }),
    };
  }
};
