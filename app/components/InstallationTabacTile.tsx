import React, { useState } from 'react';
import { FaSave } from 'react-icons/fa';
import { convertFirestoreDate, formatFirestoreDate } from "~/utils/dateUtils"; // Import ajouté
import { getStringValue } from '~/utils/firestoreUtils';

interface InstallationTabacTileProps {
  installation: {
    dateSignatureCde: string;
    dateCdeMateriel: string;
    ca: string;
    codeClient: string;
    nom: string;
    ville: string;
    telephone: string;
    commercial: string;
    materiel: string;
    balance: string;
    offreTpe: string;
    cdc: string;
    jdc: string;
    tech: string;
    dateInstall: string;
    nouvelleInstallRenouvellement: string;
    commentaire: string;
    etatMateriel: string;
  };
  hasCTN: boolean;
  onSave: (values: any) => void;
}

const InstallationTabacTile: React.FC<InstallationTabacTileProps> = ({ installation, hasCTN, onSave }) => {
  const [localInstallation, setLocalInstallation] = useState(installation);

  return (
    <div className="bg-jdc-card p-4 rounded-lg shadow-lg border border-gray-700/50 hover:border-jdc-blue/50 transition-colors">
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-bold text-xl text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-400">
            {getStringValue(installation.nom)}
          </h3>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span className="px-2 py-1 rounded bg-jdc-gray/50 font-mono">
              {getStringValue(installation.codeClient)}
            </span>
            <span className="text-gray-500">•</span>
            <span>{getStringValue(installation.ville)}</span>
          </div>
        </div>
        {/* CTN Status Badge */}
        <div className={`px-2 py-1 rounded text-xs ${hasCTN ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
          {hasCTN ? 'CTN envoyé' : 'CTN manquant'}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="space-y-2">
          <p className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">Tél:</span>
            <span className="font-medium text-sm">{getStringValue(installation.telephone)}</span>
          </p>
          <p className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">Commercial:</span>
            <span className="font-medium text-sm">{getStringValue(installation.commercial)}</span>
          </p>
          <p className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">Tech:</span>
            <span className="font-medium text-sm">{getStringValue(installation.tech, 'Non assigné')}</span>
          </p>
        </div>
        <div className="space-y-2">
          <p className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">Date Cde:</span>
            <span className="font-medium text-sm">
              {getStringValue(installation.dateCdeMateriel, 'N/A')}
            </span>
          </p>
          <p className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">Install.:</span>
            <span className="font-medium text-sm">
              {getStringValue(installation.dateInstall, 'Non planifiée')}
            </span>
          </p>
          <p className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">Type:</span>
            <span className="font-medium text-sm">{getStringValue(installation.nouvelleInstallRenouvellement, 'Non défini')}</span>
          </p>
        </div>
      </div>

      {/* Configuration Details */}
      <div className="mb-4 p-3 bg-jdc-gray/20 rounded border border-gray-700/30">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <p>
            <span className="text-gray-400">Matériel: </span>
            <span>{installation.materiel}</span>
          </p>
          <p>
            <span className="text-gray-400">Balance: </span>
            <span>{installation.balance}</span>
          </p>
          <p>
            <span className="text-gray-400">TPE: </span>
            <span>{installation.offreTpe}</span>
          </p>
          <p>
            <span className="text-gray-400">État: </span>
            <span>{installation.etatMateriel}</span>
          </p>
        </div>
      </div>

      {/* Commentaire */}
      {installation.commentaire && (
        <div className="text-sm text-gray-300 bg-black/20 p-3 rounded">
          <p className="text-gray-400 mb-1">Commentaire:</p>
          <p>{installation.commentaire}</p>
          {!hasCTN && (
            <p className="text-red-400 mt-2 text-xs">CTN non envoyé</p>
          )}
        </div>
      )}

      {/* Edit Fields */}
      <div className="mt-4 pt-4 border-t border-gray-700/30">
        <div className="grid grid-cols-2 gap-4 mb-2">
          <input
            type="text"
            className="bg-jdc-gray-700 text-white rounded px-2 py-1 text-sm focus:ring-jdc-blue focus:border-jdc-blue"
            value={localInstallation.dateInstall || ''}
            onChange={(e) => setLocalInstallation({ ...localInstallation, dateInstall: e.target.value })}
            placeholder="Date d'installation"
          />
          <input
            type="text"
            className="bg-jdc-gray-700 text-white rounded px-2 py-1 text-sm focus:ring-jdc-blue focus:border-jdc-blue"
            value={localInstallation.tech || ''}
            onChange={(e) => setLocalInstallation({ ...localInstallation, tech: e.target.value })}
            placeholder="Technicien"
          />
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <select
            className="bg-jdc-gray-700 text-white rounded px-2 py-1 text-sm focus:ring-jdc-blue focus:border-jdc-blue"
            value={localInstallation.nouvelleInstallRenouvellement || ''}
            onChange={(e) => setLocalInstallation({ ...localInstallation, nouvelleInstallRenouvellement: e.target.value })}
          >
            <option value="">Type d'installation</option>
            <option value="Nouvelle Installation">Nouvelle Installation</option>
            <option value="Renouvellement">Renouvellement</option>
          </select>
          <select
            className="bg-jdc-gray-700 text-white rounded px-2 py-1 text-sm focus:ring-jdc-blue focus:border-jdc-blue"
            value={localInstallation.etatMateriel || ''}
            onChange={(e) => setLocalInstallation({ ...localInstallation, etatMateriel: e.target.value })}
          >
            <option value="">État du matériel</option>
            <option value="Neuf">Neuf</option>
            <option value="Reconditionné">Reconditionné</option>
            <option value="Occasion">Occasion</option>
          </select>
        </div>
        <button
          onClick={() => onSave(localInstallation)}
          className="w-full bg-jdc-blue hover:bg-jdc-blue-dark text-white font-bold py-2 px-4 rounded flex items-center justify-center gap-2"
        >
          <FaSave />
          Sauvegarder
        </button>
      </div>
    </div>
  );
};

export default InstallationTabacTile;
