// Définir l'intervalle de synchronisation (30 minutes)
const SYNC_INTERVAL = 30 * 60 * 1000; // 30 minutes en millisecondes

// Fonction pour démarrer les tâches planifiées
export const startScheduledTasks = async () => {
  console.log('[scheduler] Démarrage des tâches planifiées');
  
  try {
    // Exécuter immédiatement
    await executeSyncTasks();
    
    // Puis exécuter toutes les 30 minutes
    const intervalId = setInterval(executeSyncTasks, SYNC_INTERVAL);
    return intervalId;
  } catch (error) {
    console.error('[scheduler] Erreur lors du démarrage des tâches:', error);
    throw error;
  }
};

// Fonction pour arrêter les tâches planifiées
export const stopScheduledTasks = (intervalId: NodeJS.Timeout) => {
  console.log('[scheduler] Arrêt des tâches planifiées');
  clearInterval(intervalId);
};

// Fonction pour exécuter les tâches de synchronisation
async function executeSyncTasks() {
  console.log('[scheduler] Exécution des tâches de synchronisation');
  
  try {
    // Synchroniser les installations avec un chemin relatif
    const syncResponse = await fetch('/api/sync-installations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'include',
      mode: 'cors',
      cache: 'no-cache',
      keepalive: true,
    });
    
    if (!syncResponse.ok) {
      console.error('[scheduler] Erreur de synchronisation:', syncResponse.status, syncResponse.statusText, await syncResponse.text());
      return;
    }
    
    const syncResult = await syncResponse.json();
    console.log('[scheduler] Résultat de la synchronisation:', syncResult);
    
    // Récupérer les emails avec un chemin relatif
    const emailsResponse = await fetch('/api/emails', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'include',
      mode: 'cors',
      cache: 'no-cache',
      keepalive: true,
    });
    
    if (!emailsResponse.ok) {
      console.error('[scheduler] Erreur de récupération des emails:', emailsResponse.status, emailsResponse.statusText, await emailsResponse.text());
      return;
    }
    
    const emailsResult = await emailsResponse.json();
    console.log('[scheduler] Résultat de la récupération des emails:', emailsResult);
    
  } catch (error) {
    console.error('[scheduler] Erreur lors de l\'exécution des tâches (catch global):', error);
    return;
  }
} 