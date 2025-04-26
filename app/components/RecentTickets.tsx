import React from 'react';
import type { SapTicket } from '~/types/firestore.types';
import { 
  FaTicketAlt as TicketIcon,
  FaSpinner as SpinnerIcon,
  FaExclamationTriangle as ErrorIcon
} from 'react-icons/fa';
import { convertFirestoreDate, formatFirestoreDate } from '~/utils/dateUtils';
import { getStringValue } from '~/utils/firestoreUtils';

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
        <ul className="space-y-3 max-h-[calc(100%-4rem)] overflow-y-auto pr-2">
          {tickets && tickets.map((ticket, index) => (
            <li key={ticket.id} className="text-sm p-3 bg-gray-700/30 rounded-md hover:bg-gray-700 transition-colors duration-150">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-yellow-400 truncate">{getStringValue(ticket.raisonSociale)}</p>
                  <div className="flex items-center gap-2 text-gray-400">
                    <span>SAP #{getStringValue(ticket.numeroSAP)}</span>
                    <span>•</span>
                    <span>{getStringValue(ticket.secteur)}</span>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
