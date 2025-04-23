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
    <div className="bg-jdc-card p-4 rounded-lg shadow-lg border border-gray-700/50 hover:border-jdc-blue/50 transition-colors">
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-bold text-xl text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-400">
            {installation.nom}
          </h3>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span className="px-2 py-1 rounded bg-jdc-gray/50 font-mono">
              {installation.codeClient}
            </span>
            <span className="text-gray-500">•</span>
            <span>{installation.ville}</span>
          </div>
        </div>
        {/* CTN Status Badge */}
        <div 
          className={`px-2 py-1 rounded text-xs ${
            hasCTN 
              ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}
          title={hasCTN ? "Matériel envoyé (CTN trouvé)" : "Matériel non envoyé (aucun CTN trouvé)"}
        >
          {hasCTN ? 'Matériel envoyé' : 'Envoi en attente'}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="space-y-2">
          <p className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">Contact:</span>
            <span className="font-medium text-sm">{installation.contact || 'N/A'}</span>
          </p>
          <p className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">Tél:</span>
            <span className="font-medium text-sm">{installation.telephone || 'N/A'}</span>
          </p>
          <p className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">Commercial:</span>
            <span className="font-medium text-sm">{installation.commercial || 'N/A'}</span>
          </p>
        </div>
        <div className="space-y-2">
          <p className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">Install.:</span>
            <span className="font-medium text-sm">
              {installation.dateInstall || 'Non planifiée'}
            </span>
          </p>
          <p className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">Tech:</span>
            <span className="font-medium text-sm">{installation.tech || 'Non assigné'}</span>
          </p>
          <p className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">Status:</span>
            <span className="font-medium text-sm">{installation.status || 'En attente'}</span>
          </p>
        </div>
      </div>

      {/* Commentaire */}
      {installation.commentaire && (
        <div className="text-sm text-gray-300 bg-black/20 p-3 rounded">
          <p className="text-gray-400 mb-1">Commentaire:</p>
          <p>{installation.commentaire}</p>
        </div>
      )}

      {/* Edit Fields */}
      <div className="mt-4 pt-4 border-t border-gray-700/30">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Date Installation */}
          <div>
            <label htmlFor={`dateInstall-${installation.id}`} className="block text-xs font-medium text-gray-400 mb-1">Date Install.</label>
            <input
              id={`dateInstall-${installation.id}`}
              type="text"
              className="w-full bg-black text-white rounded px-2 py-1 text-sm border border-gray-600 focus:ring-jdc-blue focus:border-jdc-blue"
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
              className="w-full bg-black text-white rounded px-2 py-1 text-sm border border-gray-600 focus:ring-jdc-blue focus:border-jdc-blue"
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
              className="w-full bg-black text-white rounded px-2 py-1 text-sm border border-gray-600 focus:ring-jdc-blue focus:border-jdc-blue"
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
        <button
          onClick={() => onSave(localInstallation)}
          className="w-full bg-jdc-blue hover:bg-jdc-blue-dark text-white font-bold py-2 px-4 rounded flex items-center justify-center gap-2"
        >
          <FontAwesomeIcon icon={faSave} />
          Sauvegarder
        </button>
      </div>
    </div>
  );
};

export default InstallationTile;
