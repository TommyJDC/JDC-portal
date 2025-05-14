// import { action as processGmailAction } from '~/routes/api.gmail-to-firestore'; // Supprimé
// import { action as syncInstallationsAction } from '~/routes/api.sync-installations'; // Supprimé
import { getDb } from '~/firebase.admin.config.server';
import { notifySapFromInstallations } from '~/services/notifications.service.server';
import { getScheduledTaskState, updateScheduledTaskState, createDailySapSnapshot } from '~/services/firestore.service.server'; // Importez les fonctions de service Firestore

export async function triggerScheduledTasks() {
  console.log("[scheduledTasks] Déclenchement des tâches planifiées");
  
  try {
    // Vérifier si un snapshot a déjà été créé aujourd'hui
    const db = getDb();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    console.log("[scheduledTasks] Recherche d'un snapshot existant pour aujourd'hui:", today.toISOString());

    const snapshotQuery = await db.collection('sap_snapshots')
      .where('timestamp', '>=', today)
      .limit(1)
      .get();

    if (snapshotQuery.empty) {
      console.log("[scheduledTasks] Aucun snapshot trouvé pour aujourd'hui, création d'un nouveau snapshot");
      const snapshot = await createDailySapSnapshot();
      console.log("[scheduledTasks] Nouveau snapshot créé avec succès:", snapshot);
    } else {
      const existingSnapshot = snapshotQuery.docs[0].data();
      console.log("[scheduledTasks] Un snapshot existe déjà pour aujourd'hui:", existingSnapshot);
    }

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Ne conserve que la tâche de notification SAP pour le déclenchement via le dashboard
    const tasksToRun = [
      { name: 'sap-notification', type: 'service', handler: notifySapFromInstallations },
    ];

    for (const task of tasksToRun) {
      try {
        const taskState = await getScheduledTaskState(task.name);

        if (!taskState || (taskState.lastRun && taskState.lastRun.toDate() < oneHourAgo)) {
          console.log(`[scheduledTasks] Déclenchement de la tâche : ${task.name}`);

          if (task.type === 'service') {
            try {
              await task.handler();
              console.log(`[scheduledTasks] Tâche ${task.name} exécutée avec succès.`);
              await updateScheduledTaskState(task.name);
            } catch (serviceError) {
              console.error(`[scheduledTasks] Erreur lors de l'exécution du service ${task.name}:`, serviceError);
            }
          } else {
            console.warn(`[scheduledTasks] Type de tâche inconnu ou non géré: ${task.type} pour ${task.name}`);
          }
        } else {
          console.log(`[scheduledTasks] Tâche ${task.name} déjà exécutée récemment.`);
        }
      } catch (error) {
        console.error(`[scheduledTasks] Erreur lors de l'exécution de la tâche ${task.name}:`, error);
      }
    }
  } catch (error) {
    console.error("[scheduledTasks] Erreur lors de l'exécution des tâches planifiées:", error);
  }
}

// Vous devrez appeler triggerScheduledTasks() depuis un loader ou une action fréquemment exécutée.
