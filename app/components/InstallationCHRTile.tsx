import React, { useState } from 'react';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSave } from "@fortawesome/free-solid-svg-icons";
import { getStringValue } from '~/utils/firestoreUtils';

interface InstallationCHRTileProps {
  installation: {
    dateCdeMateriel: string;
    ca: string;
    codeClient: string;
    nom: string;
    ville: string;
    telephone: string;
    commercial: string;
    materiel: string;
    cdc: string;
    integrationJalia: string;
    dossier: string;
    tech: string;
    dateInstall: string;
    heure: string;
    relanceProg: string;
    commentaireTech: string;
    materielLivre: string;
    commentaireEnvoi: string;
    bt: string;
    techSecu: string;
    techAffecte: string;
  };
  hasCTN: boolean;
  onSave: (values: any) => void;
}

const InstallationCHRTile: React.FC<InstallationCHRTileProps> = ({ installation, hasCTN, onSave }) => {
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
            <span className="text-gray-400 text-sm">Heure:</span>
            <span className="font-medium text-sm">{getStringValue(installation.heure, 'Non définie')}</span>
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
            <span className="text-gray-400">CDC: </span>
            <span>{installation.cdc}</span>
          </p>
        </div>
      </div>

      {/* Commentaires */}
      {(installation.commentaireTech || installation.commentaireEnvoi) && (
        <div className="text-sm text-gray-300 bg-black/20 p-3 rounded">
          {installation.commentaireTech && (
            <>
              <p className="text-gray-400 mb-1">Commentaire Tech:</p>
              <p className="mb-2">{installation.commentaireTech}</p>
            </>
          )}
          {installation.commentaireEnvoi && (
            <>
              <p className="text-gray-400 mb-1">Commentaire Envoi:</p>
              <p>{installation.commentaireEnvoi}</p>
              {!hasCTN && (
                <p className="text-red-400 mt-2 text-xs">CTN non envoyé</p>
              )}
            </>
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
            value={localInstallation.heure || ''}
            onChange={(e) => setLocalInstallation({ ...localInstallation, heure: e.target.value })}
            placeholder="Heure"
          />
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <input
            type="text"
            className="bg-jdc-gray-700 text-white rounded px-2 py-1 text-sm focus:ring-jdc-blue focus:border-jdc-blue"
            value={localInstallation.tech || ''}
            onChange={(e) => setLocalInstallation({ ...localInstallation, tech: e.target.value })}
            placeholder="Technicien"
          />
          <input
            type="text"
            className="bg-jdc-gray-700 text-white rounded px-2 py-1 text-sm focus:ring-jdc-blue focus:border-jdc-blue"
            value={localInstallation.techSecu || ''}
            onChange={(e) => setLocalInstallation({ ...localInstallation, techSecu: e.target.value })}
            placeholder="Tech Sécu"
          />
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

export default InstallationCHRTile;
