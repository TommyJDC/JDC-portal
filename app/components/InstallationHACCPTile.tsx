import React, { useState } from 'react';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSave } from "@fortawesome/free-solid-svg-icons";
import type { Installation } from "~/types/firestore.types";
import { formatFirestoreDate } from "~/utils/dateUtils";
import { Timestamp } from 'firebase/firestore';

interface InstallationHACCPTileProps {
  installation: {
    id: string;
    codeClient: string;
    nom: string;
    ville?: string;
    contact?: string;
    telephone?: string;
    commercial?: string;
    dateInstall?: string | Date; // Accepter string ou Date
    tech?: string;
    status?: string;
    commentaire?: string;
    dateCdeMateriel?: string | Date; // Accepter string ou Date
    configCaisse?: string;
    offreTpe?: string;
    install?: string;
    [key: string]: any; // Permettre d'autres champs
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
            <span className="text-gray-400 text-sm font-medium">Date Cde:</span>
            <span className="text-sm">
              {String(formatFirestoreDate(installation.dateCdeMateriel))} {/* Convertir explicitement en chaîne */}
            </span>
          </p>
          <p className="flex items-center gap-2">
            <span className="text-gray-400 text-sm font-medium">Install.:</span>
            <span className="text-sm">
              {installation.dateInstall ? String(formatFirestoreDate(installation.dateInstall)) : 'Non planifiée'} {/* Convertir explicitement en chaîne */}
            </span>
          </p>
          <p className="flex items-center gap-2">
            <span className="text-gray-400 text-sm font-medium">Tech:</span>
            <span className="text-sm">{installation.tech || 'Non assigné'}</span>
          </p>
        </div>
      </div>

      {/* Configuration Details */}
      <div className="mb-4 p-3 bg-gray-700/30 rounded-md border border-gray-700">
        <div className="grid grid-cols-2 gap-2 text-sm text-gray-300">
          <p>
            <span className="text-gray-400 font-medium">Config: </span>
            <span>{installation.configCaisse || 'N/A'}</span>
          </p>
          <p>
            <span className="text-gray-400 font-medium">TPE: </span>
            <span>{installation.offreTpe || 'N/A'}</span>
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
              type="date"
              className="w-full bg-gray-900 text-white rounded-md px-3 py-2 text-sm border border-gray-700 focus:ring-jdc-blue focus:border-jdc-blue"
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
              className="w-full bg-gray-900 text-white rounded-md px-3 py-2 text-sm border border-gray-700 focus:ring-jdc-blue focus:border-jdc-blue"
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
              className="w-full bg-gray-900 text-white rounded-md px-3 py-2 text-sm border border-gray-700 focus:ring-jdc-blue focus:border-jdc-blue"
              value={localInstallation.install || 'Non'} // Default to 'Non' if undefined
              onChange={(e) => setLocalInstallation({ ...localInstallation, install: e.target.value })}
            >
              <option value="Non">Non</option>
              <option value="Oui">Oui</option>
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
          onClick={() => onSave({
            dateInstall: localInstallation.dateInstall,
            tech: localInstallation.tech,
            install: localInstallation.install, // Include install status
            commentaire: localInstallation.commentaire, // Include commentaire
            updatedAt: new Date()
          })}
          className="w-full bg-jdc-blue hover:bg-jdc-blue-dark text-white font-bold py-2 px-4 rounded-md flex items-center justify-center gap-2 transition-colors duration-200"
        >
          <FontAwesomeIcon icon={faSave} />
          Sauvegarder
        </button>
      </div>
    </div>
  );
};

export default InstallationHACCPTile;
