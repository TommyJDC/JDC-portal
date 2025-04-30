import React from 'react';
import type { Installation } from '~/types/firestore.types';
import { FaMapMarkerAlt, FaPhone, FaUserTie, FaCalendarAlt, FaBuilding, FaInfoCircle, FaPaperPlane, FaExclamationTriangle } from 'react-icons/fa';
import { getStatusColor, getStatusIcon } from '~/utils/styleUtils'; // Assurez-vous que ce chemin est correct

interface InstallationListItemProps {
  installation: Installation;
  onClick: (installation: Installation) => void;
  hasCTN?: boolean;
}

const InstallationListItem: React.FC<InstallationListItemProps> = ({ installation, onClick, hasCTN }) => {
  const statusColor = getStatusColor(installation.status);
  const StatusIcon = getStatusIcon(installation.status);

  return (
    <div
      className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg shadow-lg p-4 cursor-pointer hover:shadow-xl hover:from-gray-700 hover:to-gray-800 transition-all duration-200 flex flex-col space-y-3 border-l-4"
      style={{ borderLeftColor: statusColor }} // Bordure colorée selon le statut
      onClick={() => onClick(installation)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(installation); }}
    >
      {/* Header: Nom Client, Code Client, Statut CTN */}
      <div className="flex justify-between items-center">
        <div className="flex items-center min-w-0">
          <FaBuilding className="mr-2 text-jdc-blue flex-shrink-0" />
          <span className="text-white font-semibold text-base mr-2 truncate" title={installation.nom}>{installation.nom}</span>
          <span className="text-gray-500 text-xs">({installation.codeClient})</span>
        </div>
        <span
          className={`ml-2 flex-shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            hasCTN ? 'bg-green-600 text-green-100' : 'bg-red-600 text-red-100'
          }`}
          title={hasCTN ? "Envoyé à CTN" : "Non envoyé à CTN"}
        >
          {hasCTN ? <FaPaperPlane className="mr-1" /> : <FaExclamationTriangle className="mr-1" />}
          {hasCTN ? "Envoyé" : "Non envoyé"}
        </span>
      </div>

      {/* Body: Statut, Date, Commercial/Tech */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-gray-400">
        <div className="flex items-center" title={`Statut: ${installation.status}`}>
          <StatusIcon className="mr-2 w-4 h-4 flex-shrink-0" style={{ color: statusColor }} />
          <span className="font-medium" style={{ color: statusColor }}>{installation.status}</span>
        </div>
        <div className="flex items-center" title={`Date Installation: ${installation.dateInstall || 'N/A'}`}>
          <FaCalendarAlt className="mr-2 text-gray-500 w-4 flex-shrink-0" />
          <span>{installation.dateInstall || 'N/A'}</span>
        </div>
        <div className="flex items-center truncate" title={`Commercial: ${installation.commercial} / Technicien: ${installation.tech}`}>
          <FaUserTie className="mr-2 text-gray-500 w-4 flex-shrink-0" />
          <span className="truncate">{installation.commercial} / {installation.tech}</span>
        </div>
      </div>

      {/* Footer: Adresse, Téléphone */}
      <div className="border-t border-gray-700 pt-2 mt-2 space-y-1 text-xs text-gray-400">
        {installation.adresse && (
          <div className="flex items-center">
            <FaMapMarkerAlt className="mr-2 text-gray-500 w-4 flex-shrink-0" />
            <span className="truncate" title={`${installation.adresse}, ${installation.codePostal} ${installation.ville}`}>{installation.adresse}, {installation.codePostal} {installation.ville}</span>
          </div>
        )}
        {installation.telephone && (
          <div className="flex items-center">
            <FaPhone className="mr-2 text-gray-500 w-4 flex-shrink-0" />
            <span>{installation.telephone}</span>
          </div>
        )}
      </div>

      {/* Commentaire (si existe) */}
      {installation.commentaire && (
        <div className="text-xs text-gray-300 pt-2 border-t border-gray-700 mt-2">
          <p className="line-clamp-2 italic" title={installation.commentaire}>"{installation.commentaire}"</p>
        </div>
      )}
    </div>
  );
};

export default InstallationListItem;
