
// Ce script charge le mappage d'ID utilisateur au démarrage de l'application
import fs from 'fs';
import path from 'path';

export function loadUserIdMapping() {
  try {
    const mappingFilePath = path.join('app', 'data', 'userIdMapping.json');
    
    if (fs.existsSync(mappingFilePath)) {
      const mappingData = JSON.parse(fs.readFileSync(mappingFilePath, 'utf8'));
      console.log('[loadUserIdMapping] Mappage d\'ID utilisateur chargé:', mappingData);
      return mappingData;
    } else {
      console.log('[loadUserIdMapping] Aucun fichier de mappage trouvé');
      return {};
    }
  } catch (error) {
    console.error('[loadUserIdMapping] Erreur lors du chargement du mappage:', error);
    return {};
  }
}
