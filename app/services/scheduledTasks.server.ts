// import { action as processGmailAction } from '~/routes/api.gmail-to-firestore'; // Supprimé
// import { action as syncInstallationsAction } from '~/routes/api.sync-installations'; // Supprimé
import { notifySapFromInstallations } from '~/services/notifications.service.server';
import { getScheduledTaskState, updateScheduledTaskState } from '~/services/firestore.service.server'; // Importez les fonctions de service Firestore

export async function triggerScheduledTasks() {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000); // Une heure en millisecondes

  // Ne conserve que la tâche de notification SAP pour le déclenchement via le dashboard
  const tasksToRun = [
    { name: 'sap-notification', type: 'service', handler: notifySapFromInstallations },
  ];

  for (const task of tasksToRun) {
    try {
      const taskState = await getScheduledTaskState(task.name); // Utiliser la fonction de service

      if (!taskState || (taskState.lastRun && taskState.lastRun.toDate() < oneHourAgo)) { // Vérifier l'existence de lastRun
        console.log(`[scheduledTasks] Déclenchement de la tâche : ${task.name}`);

        // Puisque la seule tâche restante est de type 'service', nous simplifions la logique.
        if (task.type === 'service') {
          try {
            // Appeler la fonction de service directement
            await task.handler();
            console.log(`[scheduledTasks] Tâche ${task.name} exécutée avec succès.`);
            // Mettre à jour l'état de la tâche avec le nom de la tâche
            await updateScheduledTaskState(task.name);
          } catch (serviceError) {
            console.error(`[scheduledTasks] Erreur lors de l'exécution du service ${task.name}:`, serviceError);
          }
        } else {
          // Ce cas ne devrait plus se produire avec la configuration actuelle de tasksToRun
          console.warn(`[scheduledTasks] Type de tâche inconnu ou non géré: ${task.type} pour ${task.name}`);
        }

        // La gestion du succès est maintenant à l'intérieur du bloc try/catch du service
        // if (success) {
        //   console.log(`[scheduledTasks] Tâche ${task.name} exécutée avec succès.`);
        //   // Mettre à jour l'état de la tâche avec le nom de la tâche
        //   await updateScheduledTaskState(task.name);
        // } else {
        //    console.error(`[scheduledTasks] La tâche ${task.name} a échoué.`);
        // }
      } else {
        console.log(`[scheduledTasks] Tâche ${task.name} déjà exécutée récemment.`);
      }
    } catch (error) {
      console.error(`[scheduledTasks] Erreur lors du traitement de la tâche ${task.name}:`, error);
    }
  }
}

// Vous devrez appeler triggerScheduledTasks() depuis un loader ou une action fréquemment exécutée.
