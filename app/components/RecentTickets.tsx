import React from 'react';
import type { SapTicket } from '~/types/firestore.types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTicket, faSpinner, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
// Use the new date utility functions
import { parseFrenchDate, formatDateForDisplay } from '~/utils/dateUtils';
interface RecentTicketsProps {
  tickets: SapTicket[];
  isLoading?: boolean;
  error?: string | null;
}

export const RecentTickets: React.FC<RecentTicketsProps> = ({ tickets, isLoading = false, error = null }) => {

  const getClientDisplay = (ticket: SapTicket): string => {
    return ticket.raisonSociale || ticket.codeClient || 'Client inconnu';
  };

  const getSummaryDisplay = (summary?: string): string => {
    if (!summary) return 'Pas de résumé';
    return summary.length > 40 ? summary.substring(0, 40) + '...' : summary;
  };

  // Function to determine status classes with updated colors
  const getStatusClasses = (status?: string): string => {
    switch (status) {
      case 'Nouveau':
        return 'bg-green-600 text-white'; // Vert pour Nouveau
      case 'Demande de RMA': // Assuming this is the exact string
        return 'bg-blue-600 text-white'; // Bleu pour Demande de RMA
      case 'Ouvert':
        return 'bg-red-600 text-white'; // Rouge pour Ouvert
      case 'En cours':
        return 'bg-yellow-500 text-black'; // Jaune pour En cours
      case 'Fermé':
        return 'bg-gray-600 text-white'; // Gris pour Fermé
      default:
        return 'bg-gray-500 text-white'; // Gris par défaut
    }
  };

  return (
    <div className="bg-jdc-card p-4 rounded-lg shadow-lg">
      <h2 className="text-xl font-semibold text-white mb-3 flex items-center">
        {/* Use color prop for FontAwesomeIcon */}
        <FontAwesomeIcon icon={faTicket} className="mr-2 text-jdc-yellow" />
        Tickets SAP Récents
      </h2>
      {isLoading && (
        <div className="flex items-center justify-center text-jdc-gray-300 py-4">
          <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
          Chargement...
        </div>
      )}
      {error && !isLoading && (
         <div className="flex items-center text-red-400 py-4">
           <FontAwesomeIcon icon={faExclamationTriangle} className="mr-2" />
           Erreur: {error}
         </div>
      )}
      {!isLoading && !error && tickets.length === 0 && (
        <p className="text-jdc-gray-400 text-center py-4">Aucun ticket récent à afficher.</p>
      )}
      {!isLoading && !error && tickets.length > 0 && (
        <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">
          {tickets.map((ticket) => (
            <li key={ticket.id} className="flex justify-between items-start text-sm p-2 bg-jdc-gray-800 rounded hover:bg-jdc-gray-700">
              <div className="flex-grow mr-2">
                <span className="font-medium text-white block">{getClientDisplay(ticket)}</span>
                <span className="text-jdc-gray-400 block text-xs">
                  {getSummaryDisplay(ticket.summary)} - {ticket.secteur || 'Secteur N/A'}
                 </span>
                 <span className="text-jdc-gray-500 block text-xs italic">
                  {/* Parse and format the date using the new functions */}
                  {formatDateForDisplay(parseFrenchDate(ticket.date))}
                </span>
              </div>
              <div className="flex-shrink-0 text-right">
                {/* Apply status classes using the updated helper function */}
                <span className={`px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${getStatusClasses(ticket.statut)}`}>
                  {ticket.statut || 'N/A'}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
