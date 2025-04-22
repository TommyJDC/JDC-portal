import React, { useState } from 'react';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSave } from "@fortawesome/free-solid-svg-icons";
import type { Installation } from "~/types/firestore.types";
import { formatFirestoreDate } from "~/utils/dateUtils";
import { Timestamp } from 'firebase/firestore';

interface InstallationHACCPTileProps {
  installation: {
    id: string;
    [key: string]: any;
  };
  onSave: (values: Record<string, any>) => void;
}

const InstallationHACCPTile: React.FC<InstallationHACCPTileProps> = ({ installation, onSave }) => {
  const [localInstallation, setLocalInstallation] = useState<Record<string, any>>(installation);

  const getDateValue = (date: any): string => {
    if (!date) return '';
    if (typeof date === 'string') return date;
    if (date instanceof Date) return date.toISOString().split('T')[0];
    if (date instanceof Timestamp) return date.toDate().toISOString().split('T')[0];
    if (date?.seconds) return new Date(date.seconds * 1000).toISOString().split('T')[0];
    return '';
  };

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
            <span className="text-gray-400 text-sm">Date Cde:</span>
            <span className="font-medium text-sm">
              {formatFirestoreDate(installation.dateCdeMateriel)}
            </span>
          </p>
          <p className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">Install.:</span>
            <span className="font-medium text-sm">
              {installation.dateInstall ? formatFirestoreDate(installation.dateInstall) : 'Non planifiée'}
            </span>
          </p>
          <p className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">Tech:</span>
            <span className="font-medium text-sm">{installation.tech || 'Non assigné'}</span>
          </p>
        </div>
      </div>

      {/* Configuration Details */}
      <div className="mb-4 p-3 bg-jdc-gray/20 rounded border border-gray-700/30">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <p>
            <span className="text-gray-400">Config: </span>
            <span>{installation.configCaisse || 'N/A'}</span>
          </p>
          <p>
            <span className="text-gray-400">TPE: </span>
            <span>{installation.offreTpe || 'N/A'}</span>
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
              type="date"
              className="w-full bg-black text-white rounded px-2 py-1 text-sm border border-gray-600 focus:ring-jdc-blue focus:border-jdc-blue"
              value={getDateValue(localInstallation.dateInstall)}
              onChange={(e) => setLocalInstallation({
                ...localInstallation,
                dateInstall: e.target.value
              })}
              placeholder="Date d'installation"
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
          {/* Statut Install */}
          <div>
            <label htmlFor={`installStatus-${installation.id}`} className="block text-xs font-medium text-gray-400 mb-1">Installé</label>
            <select
              id={`installStatus-${installation.id}`}
              className="w-full bg-black text-white rounded px-2 py-1 text-sm border border-gray-600 focus:ring-jdc-blue focus:border-jdc-blue"
              value={localInstallation.install || 'Non'} // Default to 'Non' if undefined
              onChange={(e) => setLocalInstallation({ ...localInstallation, install: e.target.value })}
            >
              <option value="Non">Non</option>
              <option value="Oui">Oui</option>
            </select>
          </div>
        </div>
        <button
          onClick={() => onSave({
            dateInstall: localInstallation.dateInstall,
            tech: localInstallation.tech,
            install: localInstallation.install, // Include install status
            updatedAt: new Date()
          })}
          className="w-full bg-jdc-blue hover:bg-jdc-blue-dark text-white font-bold py-2 px-4 rounded flex items-center justify-center gap-2"
        >
          <FontAwesomeIcon icon={faSave} />
          Sauvegarder
        </button>
      </div>
    </div>
  );
};

export default InstallationHACCPTile;
