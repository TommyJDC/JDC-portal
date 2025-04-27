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
          // Créer un objet simulé avec la propriété 'method' attendue par les actions,
          // et le caster en 'any' pour satisfaire TypeScript et éviter l'erreur Invalid URL sur Vercel.
          const simulatedRequest = { method: 'POST' };
          const response = await task.handler({ request: simulatedRequest as any, params: {}, context: {} }) as Response; // Caster en Response

          if (response.status === 200) {
            success = true;
          } else {
            // Tenter de lire le corps de l'erreur si la réponse n'est pas OK
            try {
                const errorBody = await response.json();
                console.error(`[scheduledTasks] Erreur lors du déclenchement de la tâche ${task.name}:`, response.status, response.statusText, errorBody);
            } catch (jsonError) {
                // Si le corps n'est pas JSON, afficher le statut et le texte
                console.error(`[scheduledTasks] Erreur lors du déclenchement de la tâche ${task.name}:`, response.status, response.statusText, "Impossible de parser le corps de l'erreur en JSON.");
            }
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
