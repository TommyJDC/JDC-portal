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
      className="bg-gradient-to-br from-[#10182a] via-[#1a2250] to-[#0a1120] rounded-2xl shadow-xl p-5 cursor-pointer hover:shadow-neon hover:scale-[1.02] transition-all duration-200 flex flex-col space-y-3 border-l-4 font-bold font-jetbrains outline-none focus:ring-2 focus:ring-jdc-yellow/60"
      style={{ borderLeftColor: statusColor }}
      onClick={() => onClick(installation)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(installation); }}
    >
      {/* Header: Nom Client, Code Client, Statut CTN */}
      <div className="flex justify-between items-center">
        <div className="flex items-center min-w-0">
          <FaBuilding className="mr-2 text-jdc-blue flex-shrink-0" />
          <span className="text-jdc-yellow font-bold text-lg mr-2 truncate" title={installation.nom || 'Sans nom'}>
            {installation.nom || 'Client sans nom'}
          </span>
          <span className="text-jdc-yellow-200 text-xs">
            ({installation.codeClient || 'Code inconnu'})
          </span>
        </div>
        <div className="flex gap-2">
          {onSendToBlockchain && (
            <button
              className="flex-shrink-0 inline-flex items-center px-3 py-1 rounded-full text-xs font-bold shadow-chip border-2 bg-jdc-blue/90 text-white border-jdc-blue hover:bg-jdc-blue"
              title="Envoyer vers la blockchain"
              onClick={handleBlockchainClick}
            >
              <FaLink className="mr-1" />
              Blockchain
            </button>
          )}
          <span
            className={`flex-shrink-0 inline-flex items-center px-3 py-1 rounded-full text-xs font-bold shadow-chip border-2 ${hasCTN ? 'bg-jdc-green/90 text-[#10182a] border-jdc-green' : 'bg-red-700/90 text-jdc-yellow border-red-400'}`}
            title={hasCTN ? "Envoyé à CTN" : "Non envoyé à CTN"}
          >
            {hasCTN ? <FaPaperPlane className="mr-1" /> : <FaExclamationTriangle className="mr-1" />}
            {hasCTN ? "Envoyé" : "Non envoyé"}
          </span>
        </div>
      </div>

      {/* Body: Statut, Date, Commercial/Tech */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-jdc-yellow-200 font-bold">
        <div className="flex items-center" title={`Statut: ${installation.status || 'Non défini'}`}> 
          <StatusIcon className="mr-2 w-4 h-4 flex-shrink-0" style={{ color: statusColor }} />
          <span className="font-bold" style={{ color: statusColor }}>
            {installation.status || 'Non défini'}
          </span>
        </div>
        <div className="flex items-center" title={`Date Installation: ${installation.dateInstall ? formatDate(installation.dateInstall) : 'N/A'}`}> 
          <FaCalendarAlt className="mr-2 text-jdc-yellow w-4 flex-shrink-0" />
          <span>{installation.dateInstall ? formatDate(installation.dateInstall) : 'N/A'}</span>
        </div>
        <div className="flex items-center truncate" title={`Commercial: ${installation.commercial || 'N/A'} / Technicien: ${installation.tech || 'N/A'}`}> 
          <FaUserTie className="mr-2 text-jdc-yellow w-4 flex-shrink-0" />
          <span className="truncate">
            {installation.commercial || 'N/A'} / {installation.tech || 'N/A'}
          </span>
        </div>
      </div>

      {/* Footer: Adresse, Téléphone */}
      <div className="border-t border-jdc-yellow/20 pt-2 mt-2 space-y-1 text-xs text-jdc-yellow-200">
        {(installation.adresse || installation.ville || installation.codePostal) ? (
          <div className="flex items-center">
            <FaMapMarkerAlt className="mr-2 text-jdc-yellow w-4 flex-shrink-0" />
            <span className="truncate" title={
              `${installation.adresse || ''}${installation.codePostal ? ', ' + installation.codePostal : ''}${installation.ville ? ' ' + installation.ville : ''}`
            }>
              {installation.adresse || ''}
              {installation.codePostal ? ', ' + installation.codePostal : ''}
              {installation.ville ? ' ' + installation.ville : ''}
            </span>
          </div>
        ) : null}
        {installation.telephone && (
          <div className="flex items-center">
            <FaPhone className="mr-2 text-jdc-yellow w-4 flex-shrink-0" />
            <span>{installation.telephone}</span>
          </div>
        )}
      </div>

      {/* Commentaire (si existe) */}
      {installation.commentaire && (
        <div className="text-xs text-jdc-yellow pt-2 border-t border-jdc-yellow/20 mt-2 font-mono italic">
          <p className="line-clamp-2" title={installation.commentaire}>&quot;{installation.commentaire}&quot;</p>
        </div>
      )}
    </div>
  );
};

export default InstallationListItem;
