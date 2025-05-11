import React from 'react';
import type { BlockchainSapTicket } from '~/types/blockchain.types';
import { 
  FaTicketAlt as TicketIcon,
  FaSpinner as SpinnerIcon,
  FaExclamationTriangle as ErrorIcon
} from 'react-icons/fa';
import { formatDate } from '~/utils/dateUtils';
import { FaInfoCircle, FaCalendarAlt, FaUserTie, FaMapMarkerAlt } from 'react-icons/fa';

interface RecentTicketsProps {
  tickets: BlockchainSapTicket[];
  isLoading?: boolean;
  error?: string | null;
}

export const RecentTickets: React.FC<RecentTicketsProps> = ({ tickets, isLoading = false, error = null }) => {

  const getClientDisplay = (ticket: BlockchainSapTicket): string => {
    return ticket.raisonSociale || ticket.codeClient || 'Client inconnu';
  };

  const getStatusClasses = (status?: string): string => {
    let baseClasses = 'px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap border ';
    switch (status) {
      case 'Nouveau':
        baseClasses += 'bg-jdc-yellow/20 text-jdc-yellow border-jdc-yellow/30';
        break;
      case 'En cours':
        baseClasses += 'bg-blue-600/20 text-blue-400 border-blue-600/30';
        break;
      case 'Fermé':
        baseClasses += 'bg-gray-600/20 text-gray-400 border-gray-600/30';
        break;
      default:
        baseClasses += 'bg-gray-500/20 text-gray-300 border-gray-500/30';
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
        <div className="space-y-3 max-h-[calc(100%-4rem)] overflow-y-auto pr-2">
          {tickets.map((ticket) => {
            const displayDate = ticket.date ? formatDate(new Date(ticket.date)) : 'N/A';
            const status = ticket.statut || 'Nouveau';

            return (
              <div
                key={ticket.id}
                className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg shadow-lg p-4 hover:shadow-xl hover:from-gray-700 hover:to-gray-800 transition-all duration-200 flex flex-col space-y-3 border-l-4"
                style={{ borderLeftColor: '#3b82f6' }}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center min-w-0">
                    <span className="text-white font-semibold text-base mr-2 truncate">
                      {getClientDisplay(ticket)}
                    </span>
                    <span className={getStatusClasses(status)}>
                      {status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-gray-400">
                  <div className="flex items-center">
                    <FaInfoCircle className="mr-2 text-gray-500 w-4 flex-shrink-0" />
                    <span>{ticket.numeroSAP}</span>
                  </div>
                  <div className="flex items-center">
                    <FaCalendarAlt className="mr-2 text-gray-500 w-4 flex-shrink-0" />
                    <span>{displayDate}</span>
                  </div>
                  <div className="flex items-center truncate">
                    <FaUserTie className="mr-2 text-gray-500 w-4 flex-shrink-0" />
                    <span className="truncate">{ticket.deducedSalesperson || 'N/A'} / {ticket.secteur}</span>
                  </div>
                </div>

                {ticket.adresse && (
                  <div className="border-t border-gray-700 pt-2 mt-2 space-y-1 text-xs text-gray-400">
                    <div className="flex items-center">
                      <FaMapMarkerAlt className="mr-2 text-gray-500 w-4 flex-shrink-0" />
                      <span className="truncate">{ticket.adresse}</span>
                    </div>
                  </div>
                )}

                {ticket.description && (
                  <div className="text-xs text-gray-300 pt-2 border-t border-gray-700 mt-2">
                    <p className="line-clamp-2 italic">"{ticket.description}"</p>
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
