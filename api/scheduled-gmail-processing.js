import fetch from 'node-fetch';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeFirebaseAdmin } from '../app/firebase.admin.config.server'; // Ajustez le chemin si nécessaire

const TASK_NAME = 'scheduled-gmail-processing';
const TASK_COLLECTION = 'scheduledTasksState';

async function getDb() {
  await initializeFirebaseAdmin();
  return getFirestore();
}

export const handler = async (event, context) => {
  console.log(`[${TASK_NAME}] Début du traitement planifié`);

  // Vérifier la clé API pour l'authentification interne
  const apiKey = event.headers['x-api-key'];
  const expectedApiKey = process.env.SCHEDULED_TASKS_API_KEY;

  if (!apiKey || apiKey !== expectedApiKey) {
    console.error(`[${TASK_NAME}] Tentative d\'accès non autorisée (clé API manquante ou incorrecte)`);
    return {
      statusCode: 401,
      body: JSON.stringify({ success: false, error: 'Unauthorized' })
    };
  }

  try {
    const db = await getDb();
    const tasksRef = db.collection(TASK_COLLECTION);
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000); // Une heure en millisecondes

    const taskDoc = await tasksRef.doc(TASK_NAME).get();
    const taskState = taskDoc.data(); // Supprimer l'assertion de type

    if (!taskState || (taskState.lastRun && taskState.lastRun.toDate() < oneHourAgo)) { // Vérifier l'existence de lastRun
      console.log(`[${TASK_NAME}] La tâche n'a pas été exécutée récemment. Déclenchement...`);

      const apiUrl = `${process.env.VERCEL_URL}/api/gmail-to-firestore`;
      console.log(`[${TASK_NAME}] Appel de l\'API:`, apiUrl);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error(`[${TASK_NAME}] Erreur API:`, response.status, response.statusText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Mettre à jour l'heure de dernière exécution
      await tasksRef.doc(TASK_NAME).set({ lastRun: now });
      console.log(`[${TASK_NAME}] Heure de dernière exécution mise à jour.`);

      const result = {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: 'Traitement exécuté avec succès' })
      };
      console.log(`[${TASK_NAME}] Traitement terminé avec succès`);
      return result;

    } else {
      console.log(`[${TASK_NAME}] Tâche déjà exécutée récemment. Ignoré.`);
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: 'Tâche déjà exécutée récemment' })
      };
    }

  } catch (error) {
    console.error(`[${TASK_NAME}] Erreur du traitement planifié:`, error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
