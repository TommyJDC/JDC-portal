import { action as processGmailAction } from '~/routes/api.gmail-to-firestore';
import { action as syncInstallationsAction } from '~/routes/api.sync-installations';
import { notifySapFromInstallations } from '~/services/notifications.service.server';
import { getScheduledTaskState, updateScheduledTaskState } from '~/services/firestore.service.server'; // Importez les fonctions de service Firestore

export async function triggerScheduledTasks() {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000); // Une heure en millisecondes

  const tasksToRun = [
    { name: 'scheduled-gmail-processing', type: 'action', handler: processGmailAction },
    { name: 'sync-installations', type: 'action', handler: syncInstallationsAction },
    { name: 'sap-notification', type: 'service', handler: notifySapFromInstallations },
  ];

  for (const task of tasksToRun) {
    try {
      const taskState = await getScheduledTaskState(task.name); // Utiliser la fonction de service

      if (!taskState || (taskState.lastRun && taskState.lastRun.toDate() < oneHourAgo)) { // Vérifier l'existence de lastRun
        console.log(`[scheduledTasks] Déclenchement de la tâche : ${task.name}`);

        let success = false;
        if (task.type === 'action') {
          // Créer un objet Request simulé pour l'action Remix
          // Utiliser un chemin de base au lieu de localhost pour la compatibilité Vercel
          const request = new Request('/', { method: 'POST' }); // Utilisez POST si l'action est POST

          // Appeler l'action directement
          const response = await task.handler({ request, params: {}, context: {} }) as Response; // Caster en Response

          if (response.status === 200) {
            success = true;
          } else {
            const errorBody = await response.json();
            console.error(`[scheduledTasks] Erreur lors du déclenchement de la tâche ${task.name}:`, response.status, response.statusText, errorBody);
          }
        } else if (task.type === 'service') {
          // Appeler la fonction de service directement
          await task.handler();
          success = true; // Supposer le succès si aucune erreur n'est levée
        }

        if (success) {
          console.log(`[scheduledTasks] Tâche ${task.name} exécutée avec succès.`);
          // Mettre à jour l'état de la tâche avec le nom de la tâche
          await updateScheduledTaskState(task.name);
        } else {
           console.error(`[scheduledTasks] La tâche ${task.name} a échoué.`);
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
