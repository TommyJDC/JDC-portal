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
    <div className="bg-gray-800 p-6 rounded-xl shadow-2xl border border-gray-700">
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
        <ul className="space-y-3 max-h-60 overflow-y-auto pr-2">
          {tickets.map((ticket) => (
            <li key={ticket.id} className="flex justify-between items-start text-sm p-3 bg-gray-700/30 rounded-md hover:bg-gray-700 transition-colors duration-150">
              <div className="flex-grow mr-3">
                <span className="font-medium text-yellow-400 block">{getClientDisplay(ticket)}</span>
                {ticket.telephone && (
                  <span className="text-gray-400 block text-xs mt-0.5">
                    Tel: {ticket.telephone}
                  </span>
                )}
                {ticket.date && (
                  <span className="text-gray-500 block text-xs italic mt-0.5">
                    {formatFirestoreDate(ticket.date, { 
                      defaultValue: 'Date non spécifiée'
                    }) as string}
                  </span>
                )}
              </div>
              <div className="flex-shrink-0 text-right">
                <span className={getStatusClasses(ticket.statut)}>
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
