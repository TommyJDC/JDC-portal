import React, { useState } from 'react';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSave } from "@fortawesome/free-solid-svg-icons";

interface InstallationTileProps {
  installation: {
    id: string;
    codeClient: string;
    nom: string;
    ville?: string;
    contact?: string;
    telephone?: string;
    commercial?: string;
    dateInstall?: string;
    tech?: string;
    status?: string;
    commentaire?: string;
  };
  hasCTN: boolean;
  onSave: (values: Record<string, any>) => void;
}

const InstallationTile: React.FC<InstallationTileProps> = ({ installation, hasCTN, onSave }) => {
  const [localInstallation, setLocalInstallation] = useState(installation);

  console.log(`[InstallationTile][DEBUG] Received installation prop:`, installation);

  return (
    <div className="bg-gray-800 p-6 rounded-xl shadow-2xl border border-gray-700 hover:border-jdc-blue transition-all duration-300 ease-in-out">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-extrabold text-2xl text-yellow-400"> {/* Changer la couleur en jaune */}
            {installation.nom}
          </h3>
          <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
            <span className="px-2 py-0.5 rounded bg-gray-700 font-mono text-gray-300">
              {installation.codeClient}
            </span>
            <span className="text-gray-500">•</span>
            <span>{installation.ville}</span>
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
            <span className="text-sm">{installation.contact || 'N/A'}</span>
          </p>
          <p className="flex items-center gap-2">
            <span className="text-gray-400 text-sm font-medium">Tél:</span>
            <span className="text-sm">{installation.telephone || 'N/A'}</span>
          </p>
          <p className="flex items-center gap-2">
            <span className="text-gray-400 text-sm font-medium">Commercial:</span>
            <span className="text-sm">{installation.commercial || 'N/A'}</span>
          </p>
        </div>
        <div className="space-y-2">
          <p className="flex items-center gap-2">
            <span className="text-gray-400 text-sm font-medium">Install.:</span>
            <span className="text-sm">
              {installation.dateInstall || 'Non planifiée'}
            </span>
          </p>
          <p className="flex items-center gap-2">
            <span className="text-gray-400 text-sm font-medium">Tech:</span>
            <span className="text-sm">{installation.tech || 'Non assigné'}</span>
          </p>
          <p className="flex items-center gap-2">
            <span className="text-gray-400 text-sm font-medium">Status:</span>
            <span className="text-sm">{installation.status || 'En attente'}</span>
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
              type="text"
              className="w-full bg-gray-900 text-white rounded-md px-3 py-2 text-sm border border-gray-700 focus:ring-jdc-blue focus:border-jdc-blue"
              value={localInstallation.dateInstall || ''}
              onChange={(e) => setLocalInstallation({ ...localInstallation, dateInstall: e.target.value })}
              placeholder="JJ/MM/AAAA"
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
              value={localInstallation.status || 'rendez-vous à prendre'}
              onChange={(e) => setLocalInstallation({ ...localInstallation, status: e.target.value })}
            >
              <option value="rendez-vous à prendre">Rendez-vous à prendre</option>
              <option value="rendez-vous pris">Rendez-vous pris</option>
              <option value="installation terminée">Installation terminée</option>
              <option value="installation en attente">Installation en attente</option>
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
          onClick={() => onSave(localInstallation)}
          className="w-full bg-jdc-blue hover:bg-jdc-blue-dark text-white font-bold py-2 px-4 rounded-md flex items-center justify-center gap-2 transition-colors duration-200"
        >
          <FontAwesomeIcon icon={faSave} />
          Sauvegarder
        </button>
      </div>
    </div>
  );
};

export default InstallationTile;
