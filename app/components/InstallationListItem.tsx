import React from 'react';
import type { Installation } from '~/types/firestore.types';
import { FaMapMarkerAlt, FaPhone, FaUserTie, FaCalendarAlt, FaBuilding, FaInfoCircle, FaPaperPlane, FaExclamationTriangle, FaLink } from 'react-icons/fa';
import { getStatusColor, getStatusIcon } from '~/utils/styleUtils';

interface InstallationListItemProps {
  installation: Installation & { hasCTN?: boolean };
  onClick: (installation: Installation & { hasCTN?: boolean }) => void;
  hasCTN?: boolean;
  onSendToBlockchain?: (installation: Installation) => void;
}

// Définition locale du type InstallationStatus (repris de styleUtils)
type InstallationStatus = 'rendez-vous à prendre' | 'rendez-vous pris' | 'installation terminée';

// Fonction utilitaire pour formatter une date avec gestion d'erreurs
const formatDate = (dateValue: Date | string | undefined): string => {
  if (!dateValue) return 'N/A';
  
  try {
    if (dateValue instanceof Date) {
      return dateValue.toLocaleDateString();
    }
    
    // Si c'est une chaîne qui ressemble à un timestamp UNIX (en secondes)
    if (typeof dateValue === 'string' && /^\d+$/.test(dateValue)) {
      return new Date(parseInt(dateValue) * 1000).toLocaleDateString();
    }
    
    // Si c'est une chaîne de date normale
    return new Date(dateValue).toLocaleDateString();
  } catch (e) {
    console.warn('Erreur lors du formatage de la date:', e);
    return String(dateValue);
  }
};

const InstallationListItem: React.FC<InstallationListItemProps> = ({ 
  installation, 
  onClick, 
  hasCTN,
  onSendToBlockchain 
}) => {
  const statusColor = getStatusColor(installation.status as InstallationStatus);
  const StatusIcon = getStatusIcon(installation.status as InstallationStatus);

  // Gérer le clic sur le bouton blockchain sans propager l'événement
  const handleBlockchainClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Empêcher que le click se propage au parent
    if (onSendToBlockchain) {
      onSendToBlockchain(installation);
    }
  };

  return (
    <div
      className="bg-ui-surface hover:bg-ui-surface-hover rounded-lg shadow-md p-4 cursor-pointer transition-all duration-200 flex flex-col space-y-2 border-l-4 focus:outline-none focus:ring-2 focus:ring-brand-blue"
      style={{ borderLeftColor: statusColor }}
      onClick={() => onClick(installation)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(installation); }}
    >
      {/* Header: Nom Client, Code Client, Statut CTN */}
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-bold text-xl text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-400">
            {installation.nom || 'Client sans nom'}
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
        <div className={`px-2 py-1 rounded text-xs ${hasCTN ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
          {hasCTN ? 'Matériel envoyé' : 'Matériel non envoyé'}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <FaPhone className="text-gray-400" />
            <span>{installation.telephone || 'Non renseigné'}</span>
          </div>
          <div className="flex items-center gap-2">
            <FaUserTie className="text-gray-400" />
            <span>{installation.commercial || 'Non assigné'}</span>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <FaCalendarAlt className="text-gray-400" />
            <span>{installation.dateInstall ? new Date(installation.dateInstall).toLocaleDateString('fr-FR') : 'Non planifié'}</span>
          </div>
          <div className="flex items-center gap-2">
            <StatusIcon className="text-gray-400" />
            <span className="capitalize">{installation.status}</span>
          </div>
        </div>
      </div>

      {/* Commentaire */}
      {installation.commentaire && (
        <div className="text-sm text-gray-300 bg-black/20 p-3 rounded">
          <p className="text-gray-400 mb-1">Commentaire:</p>
          <p>{installation.commentaire}</p>
        </div>
      )}
    </div>
  );
};

export default InstallationListItem;
