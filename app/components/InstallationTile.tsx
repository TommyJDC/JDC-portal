import React, { useState, useEffect } from 'react'; // Ajout de useEffect
import { FaSave } from 'react-icons/fa';
import { getStringValue } from '~/utils/firestoreUtils';
import type { Installation as FirestoreInstallation, InstallationStatus } from '~/types/firestore.types'; // Import des types Firestore

interface InstallationTileProps {
  installation: FirestoreInstallation; // Utilisation du type Firestore
  hasCTN: boolean;
  onSave: (values: Partial<FirestoreInstallation>) => void; // Adapter le type de onSave
}

const InstallationTile: React.FC<InstallationTileProps> = ({ installation, hasCTN, onSave }) => {
  // Initialiser localInstallation avec les valeurs de la prop, en s'assurant que dateInstall est une chaîne
  const [localInstallation, setLocalInstallation] = useState<FirestoreInstallation>({
    ...installation,
    dateInstall: installation.dateInstall instanceof Date 
      ? installation.dateInstall.toISOString().split('T')[0] // Formater Date en YYYY-MM-DD
      : getStringValue(installation.dateInstall, ''), // Garder la chaîne si c'en est une
  });

  // Mettre à jour localInstallation si la prop installation change
  useEffect(() => {
    setLocalInstallation({
      ...installation,
      dateInstall: installation.dateInstall instanceof Date
        ? installation.dateInstall.toISOString().split('T')[0]
        : getStringValue(installation.dateInstall, ''),
    });
  }, [installation]);

  console.log(`[InstallationTile][DEBUG] Received installation prop:`, installation);
  console.log(`[InstallationTile][DEBUG] Initial localInstallation:`, localInstallation);

  return (
    <div className="bg-gray-800 p-6 rounded-xl shadow-2xl border border-gray-700 hover:border-jdc-blue transition-all duration-300 ease-in-out">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-extrabold text-2xl text-yellow-400"> {/* Changer la couleur en jaune */}
            {getStringValue(installation.nom)}
          </h3>
          <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
            <span className="px-2 py-0.5 rounded bg-gray-700 font-mono text-gray-300">
              {getStringValue(installation.codeClient)}
            </span>
            <span className="text-gray-500">•</span>
            <span>{getStringValue(installation.ville)}</span>
          </div>
        </div>
        {/* CTN Status Badge */}
        <div 
          className={`px-3 py-1 rounded-full text-xs font-semibold ${
            hasCTN 
              ? 'bg-green-600/30 text-green-300 border border-green-600/50' 
              : 'bg-red-600/30 text-red-300 border border-red-600/50'
          }`}
          title={hasCTN ? "Matériel envoyé (CTN trouvé)" : "Matériel non envoyé (aucun CTN trouvé)"}
        >
          {hasCTN ? 'Matériel envoyé' : 'Envoi en attente'}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6 mb-4 text-gray-300">
        <div className="space-y-2">
          <p className="flex items-center gap-2">
            <span className="text-gray-400 text-sm font-medium">Contact:</span>
            <span className="text-sm">{getStringValue(installation.contact, 'N/A')}</span>
          </p>
          <p className="flex items-center gap-2">
            <span className="text-gray-400 text-sm font-medium">Tél:</span>
            <span className="text-sm">{getStringValue(installation.telephone, 'N/A')}</span>
          </p>
          <p className="flex items-center gap-2">
            <span className="text-gray-400 text-sm font-medium">Commercial:</span>
            <span className="text-sm">{getStringValue(installation.commercial, 'N/A')}</span>
          </p>
        </div>
        <div className="space-y-2">
          <p className="flex items-center gap-2">
            <span className="text-gray-400 text-sm font-medium">Install.:</span>
            <span className="text-sm">
              { localInstallation.dateInstall instanceof Date
                ? localInstallation.dateInstall.toLocaleDateString('fr-FR') // Afficher la date localisée si c'est un objet Date
                : getStringValue(localInstallation.dateInstall, 'Non planifiée') // Sinon, utiliser getStringValue
              }
            </span>
          </p>
          <p className="flex items-center gap-2">
            <span className="text-gray-400 text-sm font-medium">Tech:</span>
            <span className="text-sm">{getStringValue(installation.tech, 'Non assigné')}</span>
          </p>
          <p className="flex items-center gap-2">
            <span className="text-gray-400 text-sm font-medium">Status:</span>
            <span className="text-sm">{getStringValue(installation.status, 'En attente')}</span>
          </p>
        </div>
      </div>

      {/* Commentaire */}
      {installation.commentaire && (
        <div className="text-sm text-gray-300 bg-gray-700/30 p-3 rounded-md mt-4">
          <p className="text-gray-400 mb-1 font-medium">Commentaire:</p>
          <p>{installation.commentaire}</p>
        </div>
      )}

      {/* Edit Fields */}
      <div className="mt-6 pt-6 border-t border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Date Installation */}
          <div>
            <label htmlFor={`dateInstall-${installation.id}`} className="block text-xs font-medium text-gray-400 mb-1">Date Install.</label>
            <input
              id={`dateInstall-${installation.id}`}
              type="date" // Changer le type en 'date' pour une meilleure UX
              className="w-full bg-gray-900 text-white rounded-md px-3 py-2 text-sm border border-gray-700 focus:ring-jdc-blue focus:border-jdc-blue"
              value={getStringValue(localInstallation.dateInstall, '')} // Assurer que la valeur est une chaîne YYYY-MM-DD
              onChange={(e) => setLocalInstallation({ ...localInstallation, dateInstall: e.target.value })}
            />
          </div>
          {/* Technicien */}
          <div>
            <label htmlFor={`tech-${installation.id}`} className="block text-xs font-medium text-gray-400 mb-1">Technicien</label>
            <input
              id={`tech-${installation.id}`}
              type="text"
              className="w-full bg-gray-900 text-white rounded-md px-3 py-2 text-sm border border-gray-700 focus:ring-jdc-blue focus:border-jdc-blue"
              value={localInstallation.tech || ''}
              onChange={(e) => setLocalInstallation({ ...localInstallation, tech: e.target.value })}
              placeholder="Nom du tech"
            />
          </div>
          {/* Status */}
          <div>
            <label htmlFor={`status-${installation.id}`} className="block text-xs font-medium text-gray-400 mb-1">Status</label>
            <select
              id={`status-${installation.id}`}
              className="w-full bg-gray-900 text-white rounded-md px-3 py-2 text-sm border border-gray-700 focus:ring-jdc-blue focus:border-jdc-blue"
              value={localInstallation.status as InstallationStatus || 'rendez-vous à prendre'}
              onChange={(e) => setLocalInstallation({ ...localInstallation, status: e.target.value as InstallationStatus })}
            >
              <option value="rendez-vous à prendre">Rendez-vous à prendre</option>
              <option value="rendez-vous pris">Rendez-vous pris</option>
              <option value="installation terminée">Installation terminée</option>
              {/* <option value="installation en attente">Installation en attente</option> */} {/* Cette option n'est pas dans InstallationStatus */}
            </select>
          </div>
        </div>
        {/* Commentaire Edit Field */}
        <div className="mb-4">
           <label htmlFor={`commentaire-${installation.id}`} className="block text-xs font-medium text-gray-400 mb-1">Commentaire</label>
           <textarea
             id={`commentaire-${installation.id}`}
             className="w-full bg-gray-900 text-white rounded-md px-3 py-2 text-sm border border-gray-700 focus:ring-jdc-blue focus:border-jdc-blue"
             value={localInstallation.commentaire || ''}
             onChange={(e) => setLocalInstallation({ ...localInstallation, commentaire: e.target.value })}
             placeholder="Ajouter un commentaire..."
             rows={3}
           />
        </div>
        <button
          onClick={() => {
            // Préparer les données à sauvegarder, en s'assurant que dateInstall est au bon format si modifié
            const saveData: Partial<FirestoreInstallation> = { ...localInstallation };
            if (typeof localInstallation.dateInstall === 'string' && localInstallation.dateInstall.match(/^\d{4}-\d{2}-\d{2}$/)) {
              // Si c'est une chaîne YYYY-MM-DD, on peut la convertir en Date ou la laisser en chaîne selon ce que onSave attend
              // Pour l'instant, on la laisse en chaîne, onSave devra gérer la conversion si besoin pour Firestore.
              saveData.dateInstall = localInstallation.dateInstall;
            }
            onSave(saveData);
          }}
          className="w-full bg-jdc-blue hover:bg-jdc-blue-dark text-white font-bold py-2 px-4 rounded-md flex items-center justify-center gap-2 transition-colors duration-200"
        >
          <FaSave />
          Sauvegarder
        </button>
      </div>
    </div>
  );
};

export default InstallationTile;
