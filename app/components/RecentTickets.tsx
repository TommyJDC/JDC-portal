import React from 'react';
import type { SapTicket } from '~/types/firestore.types';
import { 
  FaTicketAlt as TicketIcon,
  FaSpinner as SpinnerIcon,
  FaExclamationTriangle as ErrorIcon
} from 'react-icons/fa';
import { convertFirestoreDate, formatFirestoreDate } from '~/utils/dateUtils';
import { getStringValue } from '~/utils/firestoreUtils';
import { getTicketStatusStyle } from '~/utils/styleUtils'; // Importer la fonction de style
import { FaInfoCircle, FaCalendarAlt, FaUserTie, FaMapMarkerAlt } from 'react-icons/fa'; // Importer des icônes supplémentaires

interface RecentTicketsProps {
  tickets: SapTicket[];
  isLoading?: boolean;
  error?: string | null;
}

export const RecentTickets: React.FC<RecentTicketsProps> = ({ tickets, isLoading = false, error = null }) => {

  const getClientDisplay = (ticket: SapTicket): string => {
    return getStringValue(ticket.raisonSociale) || getStringValue(ticket.codeClient) || 'Client inconnu';
  };

  const getStatusClasses = (status?: string): string => {
    let baseClasses = 'px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap border '; // Rendre le badge rond et ajouter une bordure
    switch (status) {
      case 'Nouveau':
        baseClasses += 'bg-jdc-yellow/20 text-jdc-yellow border-jdc-yellow/30'; // Ajuster les couleurs
        break;
      case 'Demande de RMA':
        baseClasses += 'bg-blue-600/20 text-blue-400 border-blue-600/30'; // Ajuster les couleurs
        break;
      case 'Ouvert':
        baseClasses += 'bg-red-600/20 text-red-400 border-red-600/30'; // Ajuster les couleurs
        break;
      case 'En cours':
        baseClasses += 'bg-jdc-yellow/20 text-jdc-yellow border-jdc-yellow/30'; // Ajuster les couleurs
        break;
      case 'Fermé':
        baseClasses += 'bg-gray-600/20 text-gray-400 border-gray-600/30'; // Ajuster les couleurs
        break;
      default:
        baseClasses += 'bg-gray-500/20 text-gray-300 border-gray-500/30'; // Ajuster les couleurs
    }
    return baseClasses;
  };

  return (
    <div className="bg-gray-800 p-6 rounded-xl shadow-2xl border border-gray-700 hover:border-jdc-blue transition-all duration-300 ease-in-out h-full">
      <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
        <TicketIcon className="mr-2 text-jdc-yellow" />
        Tickets SAP Récents
      </h2>
      {isLoading && (
        <div className="flex items-center justify-center text-gray-400 py-4">
          <SpinnerIcon className="mr-2 animate-spin" />
          Chargement...
        </div>
      )}
      {error && !isLoading && (
         <div className="flex items-center text-red-400 py-4">
           <ErrorIcon className="mr-2" />
           Erreur: {error}
         </div>
      )}
      {!isLoading && !error && tickets.length === 0 && (
        <p className="text-gray-400 text-center py-4">Aucun ticket récent à afficher.</p>
      )}
      {!isLoading && !error && tickets.length > 0 && (
        <div className="space-y-3 max-h-[calc(100%-4rem)] overflow-y-auto pr-2"> {/* Remplacer ul par div */}
          {tickets && tickets.map((ticket) => {
            const status = getStringValue(ticket.statut);
            const statusStyle = getTicketStatusStyle(status);
            const displayDate = formatFirestoreDate(ticket.date instanceof Date ? ticket.date : null);

            // Déterminer la couleur de la bordure (similaire à tickets-sap.tsx)
            let borderColor = '#6b7280'; // Default: gray-500 from styleUtils default
            // Extraire la couleur hex depuis les classes Tailwind (simplifié, suppose des couleurs standard)
            if (statusStyle.bgColor.includes('green')) borderColor = '#10b981'; // emerald-500 (approximatif)
            else if (statusStyle.bgColor.includes('red')) borderColor = '#ef4444'; // red-500 (approximatif)
            else if (statusStyle.bgColor.includes('blue')) borderColor = '#3b82f6'; // blue-500
            else if (statusStyle.bgColor.includes('orange')) borderColor = '#f97316'; // orange-500
            else if (statusStyle.bgColor.includes('yellow')) borderColor = '#eab308'; // yellow-500
            else if (statusStyle.bgColor.includes('teal')) borderColor = '#14b8a6'; // teal-500
            else if (statusStyle.bgColor.includes('gray-600')) borderColor = '#4b5563'; // gray-600
            else if (statusStyle.bgColor.includes('jdc-gray-700')) borderColor = '#333333'; // jdc-gray-800 (approximation)


            return (
              // Appliquer le style de carte ici
              <div
                key={ticket.id}
                className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg shadow-lg p-4 hover:shadow-xl hover:from-gray-700 hover:to-gray-800 transition-all duration-200 flex flex-col space-y-3 border-l-4"
                style={{ borderLeftColor: borderColor }} // Utiliser la couleur du statut pour la bordure
                // Ajouter onClick si on veut ouvrir les détails depuis le drawer
                // onClick={() => handleTicketClick(ticket)}
                role="button" // Optionnel si cliquable
                tabIndex={0} // Optionnel si cliquable
              >
                {/* Header: Raison Sociale/Code Client, Statut */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center min-w-0">
                    {/* <FaBuilding className="mr-2 text-jdc-blue flex-shrink-0" /> */}
                    <span className="text-white font-semibold text-base mr-2 truncate" title={getStringValue(ticket.raisonSociale)}>
                      {getClientDisplay(ticket)}
                    </span>
                    <span className={`ml-2 inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${statusStyle.bgColor} ${statusStyle.textColor}`}>
                      {status || 'N/A'}
                    </span>
                  </div>
                  {/* Potentiellement un bouton d'action ici */}
                </div>

                {/* Body: Numéro SAP, Date, Commercial/Secteur */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-gray-400">
                  <div className="flex items-center" title={`SAP: ${getStringValue(ticket.numeroSAP)}`}>
                    <FaInfoCircle className="mr-2 text-gray-500 w-4 flex-shrink-0" />
                    <span>{getStringValue(ticket.numeroSAP)}</span>
                  </div>
                  <div className="flex items-center" title={`Date: ${displayDate}`}>
                    <FaCalendarAlt className="mr-2 text-gray-500 w-4 flex-shrink-0" />
                    <span>{displayDate}</span>
                  </div>
                   <div className="flex items-center truncate" title={`Commercial: ${ticket.deducedSalesperson || 'N/A'} / Secteur: ${getStringValue(ticket.secteur)}`}>
                     <FaUserTie className="mr-2 text-gray-500 w-4 flex-shrink-0" />
                     <span className="truncate">{ticket.deducedSalesperson || 'N/A'} / {getStringValue(ticket.secteur)}</span>
                   </div>
                </div>

                {/* Footer: Adresse (si disponible) */}
                {ticket.adresse && (
                  <div className="border-t border-gray-700 pt-2 mt-2 space-y-1 text-xs text-gray-400">
                    <div className="flex items-center">
                      <FaMapMarkerAlt className="mr-2 text-gray-500 w-4 flex-shrink-0" />
                      <span className="truncate" title={getStringValue(ticket.adresse)}>{getStringValue(ticket.adresse)}</span>
                    </div>
                  </div>
                )}

                {/* Description (si existe) */}
                {ticket.description && (
                  <div className="text-xs text-gray-300 pt-2 border-t border-gray-700 mt-2">
                    <p className="line-clamp-2 italic" title={getStringValue(ticket.description)}>"{getStringValue(ticket.description)}"</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
