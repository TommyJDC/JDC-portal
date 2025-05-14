import { action as syncInstallationsAction } from "~/routes/api.sync-installations";
import { getEmails } from "~/services/email.service.server";

const SYNC_INTERVAL = 30 * 60 * 1000; // 30 minutes en millisecondes

let syncInterval: NodeJS.Timeout | null = null;

export async function startScheduledTasks() {
  console.log("[scheduler.server] Démarrage des tâches planifiées...");
  
  await executeSyncTasks();
  
  syncInterval = setInterval(executeSyncTasks, SYNC_INTERVAL);
}

export function stopScheduledTasks() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log("[scheduler.server] Tâches planifiées arrêtées");
  }
}

async function executeSyncTasks() {
  try {
    console.log("[scheduler.server] Exécution des tâches de synchronisation...");
    
    // 1. Synchroniser les installations en appelant l'action de la route
    console.log("[scheduler.server] Synchronisation des installations via l'action...");
    // Simuler un objet Request minimal car l'action s'attend à une requête POST
    const mockRequest = new Request("http://localhost/api/sync-installations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    
    // L'action s'attend à un objet de type ActionFunctionArgs
    // Le contexte et les paramètres peuvent souvent être vides pour les appels internes de ce type
    // si la logique de l'action ne les utilise pas de manière critique.
    const syncResult = await syncInstallationsAction({ 
      request: mockRequest, 
      context: {}, 
      params: {} 
    });
    // Analyser la réponse JSON de l'action
    const syncResultData = await syncResult.json(); 
    console.log("[scheduler.server] Résultat de la synchronisation:", syncResultData);

    // 2. Récupérer les emails
    console.log("[scheduler.server] Récupération des emails...");
    const emailsResult = await getEmails();
    console.log("[scheduler.server] Résultat de la récupération des emails:", emailsResult);

  } catch (error) {
    console.error("[scheduler.server] Erreur lors de l'exécution des tâches:", error);
  }
} 