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
        <div className="flex items-center min-w-0">
          <FaBuilding className="mr-2 text-brand-blue flex-shrink-0 h-4 w-4" />
          <span className="text-text-primary font-semibold text-base mr-2 truncate" title={installation.nom || 'Sans nom'}>
            {installation.nom || 'Client sans nom'}
          </span>
          <span className="text-text-secondary text-xs">
            ({installation.codeClient || 'Code inconnu'})
          </span>
        </div>
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 flex-shrink-0">
          {onSendToBlockchain && (
            <button
              className="flex-shrink-0 inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-brand-blue/10 text-brand-blue border border-brand-blue/30 hover:bg-brand-blue/20"
              title="Envoyer vers la blockchain"
              onClick={handleBlockchainClick}
            >
              <FaLink className="mr-1.5 h-3 w-3" />
              Blockchain
            </button>
          )}
          <span
            className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${hasCTN ? 'bg-green-500/10 text-green-700 border-green-500/30' : 'bg-red-500/10 text-red-700 border-red-500/30'}`}
            title={hasCTN ? "Envoyé à CTN" : "Non envoyé à CTN"}
          >
            {hasCTN ? <FaPaperPlane className="mr-1 h-3 w-3" /> : <FaExclamationTriangle className="mr-1 h-3 w-3" />}
            {hasCTN ? "Envoyé" : "Non envoyé"}
          </span>
        </div>
      </div>

      {/* Body: Statut, Date, Commercial/Tech */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-3 gap-y-1 text-xs text-text-secondary">
        <div className="flex items-center" title={`Statut: ${installation.status || 'Non défini'}`}> 
          <StatusIcon className="mr-1.5 w-3.5 h-3.5 flex-shrink-0" style={{ color: statusColor }} />
          <span className="font-medium" style={{ color: statusColor }}>
            {installation.status || 'Non défini'}
          </span>
        </div>
        <div className="flex items-center" title={`Date Installation: ${installation.dateInstall ? formatDate(installation.dateInstall) : 'N/A'}`}> 
          <FaCalendarAlt className="mr-1.5 text-text-tertiary w-3.5 h-3.5 flex-shrink-0" />
          <span className="text-text-primary">{installation.dateInstall ? formatDate(installation.dateInstall) : 'N/A'}</span>
        </div>
        <div className="flex items-center truncate" title={`Commercial: ${installation.commercial || 'N/A'} / Technicien: ${installation.tech || 'N/A'}`}> 
          <FaUserTie className="mr-1.5 text-text-tertiary w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate text-text-primary">
            {installation.commercial || 'N/A'} / {installation.tech || 'N/A'}
          </span>
        </div>
      </div>

      {/* Footer: Adresse, Téléphone */}
      {(installation.adresse || installation.ville || installation.codePostal || installation.telephone) && (
        <div className="border-t border-ui-border pt-2 mt-2 space-y-1 text-xs text-text-secondary">
          {(installation.adresse || installation.ville || installation.codePostal) && (
            <div className="flex items-center">
              <FaMapMarkerAlt className="mr-1.5 text-text-tertiary w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate" title={
                `${installation.adresse || ''}${installation.codePostal ? ', ' + installation.codePostal : ''}${installation.ville ? ' ' + installation.ville : ''}`
              }>
                {installation.adresse || ''}
                {installation.codePostal ? ', ' + installation.codePostal : ''}
                {installation.ville ? ' ' + installation.ville : ''}
              </span>
            </div>
          )}
          {installation.telephone && (
            <div className="flex items-center">
              <FaPhone className="mr-1.5 text-text-tertiary w-3.5 h-3.5 flex-shrink-0" />
              <span>{installation.telephone}</span>
            </div>
          )}
        </div>
      )}

      {/* Commentaire (si existe) */}
      {installation.commentaire && (
        <div className="text-xs text-text-tertiary pt-2 border-t border-ui-border mt-2 italic">
          <p className="line-clamp-2" title={installation.commentaire}>"{installation.commentaire}"</p>
        </div>
      )}
    </div>
  );
};

export default InstallationListItem;
