import React from 'react';
import type { SapTicket } from '~/types/firestore.types';
import { 
  FaTicketAlt as TicketIcon,
  FaSpinner as SpinnerIcon,
  FaExclamationTriangle as ErrorIcon
} from 'react-icons/fa';
import { formatFirestoreDate } from '~/utils/dateUtils';

interface RecentTicketsProps {
  tickets: SapTicket[];
  isLoading?: boolean;
  error?: string | null;
}

export const RecentTickets: React.FC<RecentTicketsProps> = ({ tickets, isLoading = false, error = null }) => {

  const getClientDisplay = (ticket: SapTicket): string => {
    return ticket.raisonSociale || ticket.codeClient || 'Client inconnu';
  };

  // Supprimer la fonction getSummaryDisplay car le résumé ne sera plus affiché ici

  const getStatusClasses = (status?: string): string => {
    let baseClasses = 'px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ';
    switch (status) {
      case 'Nouveau':
        baseClasses += 'bg-jdc-yellow text-black';
        break;
      case 'Demande de RMA':
        baseClasses += 'bg-blue-600 text-white';
        break;
      case 'Ouvert':
        baseClasses += 'bg-red-600 text-white';
        break;
      case 'En cours':
        baseClasses += 'bg-jdc-yellow text-black';
        break;
      case 'Fermé':
        baseClasses += 'bg-gray-600 text-white';
        break;
      default:
        baseClasses += 'bg-gray-500 text-white';
    }
    // Ajouter une classe pour l'animation (exemple simple: pulsation)
    baseClasses += ' animate-pulse-once'; // Ajouter une classe d'animation
    return baseClasses;
  };

  return (
    <div className="bg-jdc-card p-4 rounded-lg shadow-lg">
      <h2 className="text-xl font-semibold text-white mb-3 flex items-center">
        <TicketIcon className="mr-2 text-jdc-yellow" />
        Tickets SAP Récents
      </h2>
      {isLoading && (
        <div className="flex items-center justify-center text-jdc-gray-300 py-4">
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
        <p className="text-jdc-gray-400 text-center py-4">Aucun ticket récent à afficher.</p>
      )}
      {!isLoading && !error && tickets.length > 0 && (
        <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">
          {tickets.map((ticket) => (
            <li key={ticket.id} className="flex justify-between items-start text-sm p-2 bg-jdc-gray-800 rounded hover:bg-jdc-gray-700">
              <div className="flex-grow mr-2">
                <span className="font-medium text-white block">{getClientDisplay(ticket)}</span>
                {ticket.telephone && ( // Afficher le numéro de téléphone s'il existe
                  <span className="text-jdc-gray-400 block text-xs">
                    Tel: {ticket.telephone}
                  </span>
                )}
                {ticket.date && (
                  <span className="text-jdc-gray-500 block text-xs italic">
                    {formatFirestoreDate(ticket.date, { 
                      defaultValue: 'Date non spécifiée'
                    }) as string}
                  </span>
                )}
              </div>
              <div className="flex-shrink-0 text-right">
                <span className={getStatusClasses(ticket.statut)}> {/* Appliquer les classes d'animation ici */}
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
