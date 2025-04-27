import { getFirestore } from 'firebase-admin/firestore';
import { initializeFirebaseAdmin } from './firebase.admin.config.server'; // Assurez-vous que ce chemin est correct
import fetch from 'node-fetch';

const TASK_COLLECTION = 'scheduledTasksState';

interface TaskState {
  lastRun: Date;
}

async function getDb() {
  // Assurez-vous que Firebase Admin est initialisé
  // La fonction initializeFirebaseAdmin doit gérer l'initialisation unique
  await initializeFirebaseAdmin(); 
  return getFirestore();
}

export async function triggerScheduledTasks() {
  const db = await getDb();
  const tasksRef = db.collection(TASK_COLLECTION);
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000); // Une heure en millisecondes

  const tasksToRun = [
    { name: 'scheduled-gmail-processing', path: '/api/scheduled-gmail-processing' },
    { name: 'sync-installations', path: '/api/sync-installations' },
    { name: 'sap-notification', path: '/api/sap-notification' }, 
  ];

  for (const task of tasksToRun) {
    try {
      const taskDoc = await tasksRef.doc(task.name).get();
      const taskState = taskDoc.data() as TaskState | undefined;

      if (!taskState || taskState.lastRun < oneHourAgo) {
        console.log(`[scheduledTasks] Déclenchement de la tâche : ${task.name}`);
        const apiUrl = `${process.env.VERCEL_URL}${task.path}`;
        
        // Utiliser la méthode GET pour les Cron Jobs simulés
        const response = await fetch(apiUrl, { method: 'GET' }); 

        if (response.ok) {
          console.log(`[scheduledTasks] Tâche ${task.name} exécutée avec succès.`);
          await tasksRef.doc(task.name).set({ lastRun: now });
        } else {
          console.error(`[scheduledTasks] Erreur lors du déclenchement de la tâche ${task.name}:`, response.status, response.statusText);
        }
      } else {
        console.log(`[scheduledTasks] Tâche ${task.name} déjà exécutée récemment.`);
      }
    } catch (error) {
      console.error(`[scheduledTasks] Erreur lors du traitement de la tâche ${task.name}:`, error);
    }
  }
}

// Vous devrez appeler triggerScheduledTasks() depuis un loader ou une action fréquemment exécutée.
