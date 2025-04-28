import React from 'react';
import type { Installation } from '~/types/firestore.types';
import { FaMapMarkerAlt, FaPhone, FaUserTie, FaCalendarAlt, FaBuilding } from 'react-icons/fa';

interface InstallationListItemProps {
  installation: Installation;
  onClick: (installation: Installation) => void;
  hasCTN?: boolean; // Rendre la prop hasCTN optionnelle
}

const InstallationListItem: React.FC<InstallationListItemProps> = ({ installation, onClick, hasCTN }) => {
  return (
    <div
      className="bg-gray-800 rounded-lg shadow-md p-4 text-sm cursor-pointer hover:bg-gray-700 transition-colors duration-150 flex flex-col space-y-3"
      onClick={() => onClick(installation)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(installation); }}
    >
      {/* Header Section */}
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <div className="flex items-center mb-1">
            <FaBuilding className="mr-2 text-jdc-blue w-4 flex-shrink-0" />
            <span className="text-white font-semibold mr-2 truncate" title={installation.nom}>{installation.nom}</span>
            <span className="text-gray-400 text-xs">({installation.codeClient})</span>
          </div>
        </div>
        {/* Badge de status d'envoi animé */}
        <span
          className={`ml-2 flex-shrink-0 inline-block px-2 py-0.5 rounded-full text-xs font-semibold animate-pulse ${hasCTN ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}
        >
          {hasCTN ? "Envoyé" : "Non envoyé"}
        </span>
      </div>

      {/* Details Section */}
      <div className="space-y-1 text-xs text-gray-400">
        <div className="flex items-center">
          <FaCalendarAlt className="mr-2 text-gray-500 w-4 flex-shrink-0" />
          <span>Date Install: {installation.dateInstall || 'N/A'}</span>
          <span className="mx-2">|</span>
          <span className="text-gray-500">Statut: {installation.status}</span>
        </div>
        <div className="flex items-center">
           <FaUserTie className="mr-2 text-gray-500 w-4 flex-shrink-0" />
           <span>{installation.commercial} / {installation.tech}</span>
        </div>
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

      {/* Comment Section */}
      {installation.commentaire && (
        <div className="text-xs text-gray-300 pt-1 border-t border-gray-700 mt-2">
          <p className="line-clamp-2" title={installation.commentaire}>Commentaire: {installation.commentaire}</p> {/* Allow 2 lines for comment */}
        </div>
      )}
    </div>
  );
};

export default InstallationListItem;
