import type { MetaFunction } from "@remix-run/node";
import { useState, useMemo, useRef, useCallback } from "react"; // Removed useEffect
import { useOutletContext, useLoaderData, useRevalidator } from "@remix-run/react"; // Added useLoaderData, useRevalidator
// Import loader and action with their types
import { loader } from "./tickets-sap.loader";
import { action } from "./tickets-sap.action";
import type { TicketsSapLoaderData } from "./tickets-sap.loader";
// Removed direct server imports
import type { SapTicket, UserProfile } from "~/types/firestore.types";
import type { UserSession } from "~/services/session.server";
import { Timestamp } from 'firebase/firestore'; // Keep for type checking/conversion
import { Input } from "~/components/ui/Input";
import { Button } from "~/components/ui/Button";
import TicketSAPDetails from "~/components/TicketSAPDetails";
import {
  FaTicketAlt, FaFilter, FaSearch, FaUserTag, FaChevronDown, FaChevronRight, FaSpinner,
  FaExclamationTriangle, FaPhone, FaMapMarkerAlt, FaUserTie, FaInfoCircle,
  FaCalendarAlt, FaChevronUp
} from 'react-icons/fa'; // Import React Icons
import { getTicketStatusStyle } from "~/utils/styleUtils";
import { formatFirestoreDate, convertFirestoreDate } from "~/utils/dateUtils"; // Corrected import

export const meta: MetaFunction = () => {
  return [{ title: "Tickets SAP | JDC Dashboard" }];
};

// Helper function to parse dates in the ticket data structure
const parseSapTicketDates = (ticket: any): SapTicket => {
    const parsedTicket: SapTicket = {
        ...ticket,
        // Parse the main ticket date
        date: convertFirestoreDate(ticket.date), // Use convertFirestoreDate directly
        // Parse dates within contactAttempts
        contactAttempts: ticket.contactAttempts?.map((attempt: any) => ({
            ...attempt,
            date: convertFirestoreDate(attempt.date) // Use convertFirestoreDate here too
        }))
    };
    return parsedTicket;
};

// Export loader and action
export { loader, action };

// Update Outlet context type to use UserSession if root provides it
type OutletContextType = {
  user: UserSession | null;
  // profile: UserProfile | null; // Profile now comes from this route's loader
};

// Helper to parse serialized dates (similar to dashboard)
const parseSerializedDateNullable = (serializedDate: string | { seconds: number; nanoseconds: number; } | null | undefined): Date | null => {
    console.log('parseSerializedDateNullable: Input:', serializedDate, 'Type:', typeof serializedDate);
    if (!serializedDate) {
        console.log('parseSerializedDateNullable: Input is null/undefined, returning null');
        return null;
    }
    if (typeof serializedDate === 'string') {
        console.log('parseSerializedDateNullable: Input is string, trying to parse...');
        try {
            // Try parsing the French date string format first
            const frenchDateParts = serializedDate.trim().split(' ');
            if (frenchDateParts.length === 4) {
                const day = parseInt(frenchDateParts[1]);
                const month = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'].findIndex(m => m === frenchDateParts[2].toLowerCase());
                const year = parseInt(frenchDateParts[3]);
                if (!isNaN(day) && month !== -1 && !isNaN(year)) {
                     const date = new Date(year, month, day);
                     console.log('parseSerializedDateNullable: Parsed as French date string:', date);
                     return date;
                }
            }

            // Fallback to standard Date parsing if French format fails
            const date = new Date(serializedDate);
            if (isNaN(date.getTime())) {
                console.log('parseSerializedDateNullable: Standard Date parsing failed, returning null');
                return null;
            }
            console.log('parseSerializedDateNullable: Parsed as standard Date string:', date);
            return date;
        } catch (e) {
            console.error('parseSerializedDateNullable: Error during string parsing:', e);
            return null;
        }
    }
    if (typeof serializedDate === 'object' && 'seconds' in serializedDate && typeof serializedDate.seconds === 'number' && 'nanoseconds' in serializedDate && typeof serializedDate.nanoseconds === 'number') {
         console.log('parseSerializedDateNullable: Input is { seconds, nanoseconds }, trying to convert to Date...');
         try {
             const date = new Timestamp(serializedDate.seconds, serializedDate.nanoseconds).toDate();
             console.log('parseSerializedDateNullable: Converted Timestamp to Date:', date);
             return date;
         }
         catch (e) {
             console.error('parseSerializedDateNullable: Error converting Timestamp:', e);
             return null;
         }
    }
    console.log('parseSerializedDateNullable: Unrecognized input format, returning null');
    return null;
};


const groupTicketsByRaisonSociale = (tickets: SapTicket[]): Map<string, SapTicket[]> => {
  const grouped = new Map<string, SapTicket[]>();
   if (!Array.isArray(tickets)) {
     return grouped;
   }
  tickets.forEach(ticket => {
    const raisonSociale = typeof ticket.raisonSociale === 'string' ? ticket.raisonSociale : ticket.raisonSociale?.stringValue;
    if (raisonSociale) {
        const existing = grouped.get(raisonSociale);
        if (existing) {
          existing.push(ticket);
        } else {
          grouped.set(raisonSociale, [ticket]);
        }
    }
  });
  return grouped;
};

export default function TicketsSap() {
  const { user } = useOutletContext<OutletContextType>(); // User session from context
  // Get data from loader
  const { userProfile, allTickets: serializedTickets, error: loaderError } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator(); // Hook to trigger revalidation

  console.log("TicketsSap component loaded. Raw loader data:", { userProfile, serializedTickets, loaderError });

  // State for client-side filtering and UI
  const [selectedSector, setSelectedSector] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showNumberOptions, setShowNumberOptions] = useState<Record<string, boolean>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SapTicket | null>(null);

  // Parse tickets dates from loader data immediately
  const allTickets: SapTicket[] = useMemo(() => {
      if (!serializedTickets) {
          return [];
      }
      // Map over serialized tickets and parse dates using the helper function
      return serializedTickets.map(parseSapTicketDates);
  }, [serializedTickets]);


  const availableSectors = useMemo(() => {
     // Use profile from loader data
     return userProfile?.secteurs?.slice().sort() ?? [];
  }, [userProfile]);

  const filteredAndGroupedTickets = useMemo(() => {
    let filtered = allTickets;

    if (selectedSector && selectedSector !== '') {
      filtered = filtered.filter(t => t.secteur === selectedSector);
    }

    if (searchTerm.trim() !== '') {
      const lowerSearchTerm = searchTerm.trim().toLowerCase();
      filtered = filtered.filter(t =>
        (typeof t.raisonSociale === 'string' ? t.raisonSociale : t.raisonSociale?.stringValue)?.toLowerCase().includes(lowerSearchTerm) ||
        (typeof t.client === 'string' ? t.client : t.client?.stringValue)?.toLowerCase().includes(lowerSearchTerm) ||
        t.id?.toLowerCase().includes(lowerSearchTerm) ||
        (typeof t.description === 'string' ? t.description : t.description?.stringValue)?.toLowerCase().includes(lowerSearchTerm) ||
        (typeof t.statut === 'string' ? t.statut : t.statut?.stringValue)?.toLowerCase().includes(lowerSearchTerm) ||
        (typeof t.numeroSAP === 'string' ? t.numeroSAP : t.numeroSAP?.stringValue)?.toLowerCase().includes(lowerSearchTerm) ||
        t.deducedSalesperson?.toLowerCase().includes(lowerSearchTerm) ||
        (typeof t.adresse === 'string' ? t.adresse : t.adresse?.stringValue)?.toLowerCase().includes(lowerSearchTerm) ||
        (typeof t.telephone === 'string' ? t.telephone : t.telephone?.stringValue)?.toLowerCase().includes(lowerSearchTerm)
      );
    }
    return groupTicketsByRaisonSociale(filtered);
  }, [allTickets, selectedSector, searchTerm]);

  const clientGroups = useMemo(() => {
    const findMostRecentDate = (tickets: SapTicket[]): Date | null => {
      let mostRecent: Date | null = null;
      for (const ticket of tickets) {
        // Use the already parsed date
        const parsedDate = ticket.date;
        if (parsedDate instanceof Date) { // Check if it's a valid Date object
          if (!mostRecent || parsedDate.getTime() > mostRecent.getTime()) {
            mostRecent = parsedDate;
          }
        }
      }
      return mostRecent;
    };

    const groupsWithDates = Array.from(filteredAndGroupedTickets.entries()).map(
      ([raisonSociale, tickets]) => ({
        raisonSociale,
        tickets,
        mostRecentDate: findMostRecentDate(tickets),
      })
    );

    groupsWithDates.sort((a, b) => {
      if (!b.mostRecentDate) return -1;
      if (!a.mostRecentDate) return 1;
      return b.mostRecentDate.getTime() - a.mostRecentDate.getTime(); // Corrected sorting logic
    });

    return groupsWithDates.map(group => [group.raisonSociale, group.tickets] as [string, SapTicket[]]);

  }, [filteredAndGroupedTickets]);

  // --- Callbacks (Keep as they are, no server calls here) ---
  const handleWebexCall = useCallback((ticketId: string, phoneNumbers: string[]) => {
    if (phoneNumbers.length === 1) {
      window.location.href = `webexphone://call?uri=tel:${phoneNumbers[0]}`;
      setShowNumberOptions(prevState => ({ ...prevState, [ticketId]: false }));
    } else if (phoneNumbers.length > 1) {
      setShowNumberOptions(prevState => ({ ...prevState, [ticketId]: !prevState[ticketId] }));
    }
  }, []);

  const handleNumberSelection = useCallback((number: string) => {
     window.location.href = `webexphone://call?uri=tel:${number}`;
   }, []);

   const handleTicketClick = (ticket: SapTicket) => {
     console.log("Ticket clicked:", ticket);
     // Ensure the ticket passed to modal has parsed date
     setSelectedTicket(ticket);
     setIsModalOpen(true);
   };

   const handleCloseModal = () => {
     setIsModalOpen(false);
     setSelectedTicket(null);
   };

   // Use revalidator hook to trigger revalidation
   const handleTicketUpdated = useCallback(() => {
     console.log("Ticket update detected from modal, revalidating data...");
     revalidator.revalidate();
     // Optionally close modal after update:
     // handleCloseModal();
   }, [revalidator]);


  // Show message if user is not logged in (based on context)
  if (!user) {
     return (
        <div className="text-center text-gray-400 py-10">
            Veuillez vous connecter pour voir les tickets SAP.
        </div>
     )
  }

   // Show loader error if present
   if (loaderError) {
       return <div className="text-center text-red-400 bg-red-900 bg-opacity-50 p-4 rounded-lg flex items-center justify-center">
          <FaExclamationTriangle className="mr-2" />
          {loaderError}
       </div>;
   }

   // Determine loading state based on revalidator
   const isLoading = revalidator.state === 'loading';

  return (
    <div className="space-y-6 p-6 bg-gray-900 min-h-screen"> {/* Ajuster le conteneur principal */}
      <h1 className="text-3xl font-semibold text-white mb-6 flex items-center"> {/* Ajuster le titre */}
        <FaTicketAlt className="mr-3 text-jdc-blue" />
        Gestion des Tickets SAP
        {isLoading && <FaSpinner className="ml-3 text-jdc-yellow animate-spin" title="Rafraîchissement..." />}
      </h1>

      {/* Filter and Search Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-gray-800 rounded-lg shadow-xl border border-gray-700"> {/* Ajuster le conteneur des contrôles */}
        {/* Sector Filter */}
        <div className="col-span-1">
          <label htmlFor="sector-filter" className="block text-sm font-medium text-gray-400 mb-1"> {/* Ajuster le style du label */}
            <FaFilter className="mr-1" /> Filtrer par Secteur
          </label>
          <select
            id="sector-filter"
            name="sector-filter"
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            className="block w-full rounded-md bg-gray-900 border-gray-700 focus:border-jdc-blue focus:ring focus:ring-jdc-blue focus:ring-opacity-50 text-white py-2 pl-3 pr-10 text-sm"
            disabled={isLoading || availableSectors.length === 0} // Disable during revalidation
          >
            <option value="">Tous les secteurs ({userProfile?.secteurs?.length ?? 0})</option>
            {availableSectors.map(sector => (
              <option key={sector} value={sector}>{sector}</option>
            ))}
          </select>
           {availableSectors.length === 0 && !isLoading && !loaderError && (
             <p className="text-xs text-gray-500 mt-1">Aucun secteur assigné à votre profil.</p>
           )}
        </div>

        {/* Search Input */}
        <div className="col-span-1 md:col-span-2">
           <Input
             label="Rechercher (Raison Sociale, Client, ID, SAP, Adresse, Vendeur...)"
             id="search-client"
             name="search-client"
             placeholder="Entrez un nom, ID, mot-clé..."
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
             icon={<FaSearch />}
             wrapperClassName="mb-0"
             disabled={isLoading} // Disable during revalidation
             className="bg-gray-900 text-white border-gray-700 focus:border-jdc-blue focus:ring-jdc-blue" // Use className for input
             labelClassName="text-gray-400" // Use labelClassName for label
           />
        </div>
      </div>

      {/* Loading State during revalidation (optional, handled by spinner in title) */}
      {/* {isLoading && ( ... )} */}

      {/* No Results State */}
      {!isLoading && !loaderError && clientGroups.length === 0 && (
        <div className="text-center text-gray-400 py-10">
          {allTickets.length > 0
            ? "Aucun ticket trouvé correspondant à votre recherche ou filtre."
            : "Aucun ticket SAP avec une raison sociale trouvée pour les secteurs assignés."}
        </div>
      )}


      {/* Tickets List */}
      {!isLoading && !loaderError && clientGroups.length > 0 && (
        <div className="space-y-4">
          {clientGroups.map(([raisonSociale, clientTickets]) => (
            <div key={raisonSociale} className="bg-gray-800 rounded-lg shadow-xl overflow-hidden border border-gray-700">
              <details className="group" open={clientGroups.length < 5}>
                <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-700 list-none transition-colors">
                  <div className="flex items-center min-w-0 mr-2">
                    <FaUserTag className="mr-3 text-jdc-blue text-lg flex-shrink-0" />
                    <div className="min-w-0">
                        <span className="font-semibold text-yellow-400 text-lg block truncate" title={raisonSociale}>{raisonSociale}</span>
                        <span className="ml-0 md:ml-3 text-sm text-gray-400">
                            ({clientTickets.length} ticket{clientTickets.length > 1 ? 's' : ''})
                        </span>
                    </div>
                  </div>
                  <FaChevronRight
                    className="text-gray-400 transition-transform duration-200 group-open:rotate-90 text-xl flex-shrink-0"
                  />
                </summary>
                <div className="border-t border-gray-700 bg-gray-900 p-4 space-y-3">
                  {clientTickets.sort((a, b) => {
                      // Use parsed dates for sorting
                      const dateA = a.date;
                      const dateB = b.date;
                      if (!(dateB instanceof Date)) return -1;
                      if (!(dateA instanceof Date)) return 1;
                      return dateB.getTime() - dateA.getTime(); // Corrected sorting logic
                    }).map((ticket) => {
                    const getStringValueOrDefault = (val: any, defaultValue: string = 'N/A'): string => {
                      if (typeof val === 'string') return val;
                      return val?.stringValue || defaultValue;
                    };
                    
                    const statusStyle = getTicketStatusStyle(getStringValueOrDefault(ticket.statut));
                    
                    // Log the date value and type before formatting for display
                    console.log(`Ticket ID: ${ticket.id}, Date value:`, ticket.date, `, Date type:`, typeof ticket.date, `, instanceof Date:`, ticket.date instanceof Date);

                    const displayDate = formatFirestoreDate(ticket.date instanceof Date ? ticket.date : null); // Use formatFirestoreDate
                    const phoneNumbersArray = (typeof ticket.telephone === 'string' ? ticket.telephone : ticket.telephone?.stringValue)?.split(',').map(num => num.trim()).filter(num => num) || [];

                    return (
                      <div
                        key={ticket.id}
                        className="border-b border-gray-700 pb-3 last:border-b-0 text-sm cursor-pointer hover:bg-gray-800 transition-colors duration-150 p-3 rounded-md"
                        onClick={() => handleTicketClick(ticket)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleTicketClick(ticket); }}
                      >
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-2">
                           <div className="flex-1 min-w-0 mb-2 md:mb-0 md:mr-4">
                              <div className="flex items-center mb-1">
                                <FaInfoCircle className="mr-2 text-jdc-blue w-4 text-center" />
                                <span className="text-white font-semibold" title={`SAP: ${getStringValueOrDefault(ticket.numeroSAP)}`}>
                                  {getStringValueOrDefault(ticket.numeroSAP)}
                                </span>
                                <span className={`ml-3 inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${statusStyle.bgColor} ${statusStyle.textColor}`}>
                                  {getStringValueOrDefault(ticket.statut)}
                                </span>
                              </div>
                              <div className="flex items-center text-xs text-gray-400">
                                <FaCalendarAlt className="mr-2 text-gray-500 w-4 text-center" />
                                <span>{displayDate}</span>
                                <span className="mx-2">|</span>
                                <span className="text-gray-500" title={`ID: ${ticket.id}`}>
                                  ID: {ticket.id.substring(0, 8)}...
                                </span>
                                <span className="mx-2">|</span>
                                <span className="text-gray-500">
                                  Secteur: {ticket.secteur || 'N/A'}
                                </span>
                              </div>
                           </div>
                           <div className="flex-shrink-0 relative">
                              {phoneNumbersArray.length > 0 && (
                                <>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleWebexCall(ticket.id, phoneNumbersArray);
                                    }}
                                    className="text-jdc-blue border-jdc-blue hover:bg-jdc-blue hover:text-white"
                                    title={phoneNumbersArray.length === 1 ? `Appeler ${phoneNumbersArray[0]}` : "Appeler..."}
                                  >
                                    <FaPhone className="mr-2" />
                                    <span>Appeler</span>
                                    {phoneNumbersArray.length > 1 && (
                                      <FaChevronUp className="ml-2" />
                                    )}
                                  </Button>
                                  {showNumberOptions[ticket.id] && phoneNumbersArray.length > 1 && (
                                    <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-md shadow-lg z-10 border border-gray-700">
                                      <ul className="py-1">
                                        {phoneNumbersArray.map((number, index) => (
                                          <li key={index}>
                                            <a
                                              href={`webexphone://call?uri=tel:${number}`}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                e.preventDefault();
                                                handleNumberSelection(number);
                                                setShowNumberOptions(prevState => ({ ...prevState, [ticket.id]: false }));
                                              }}
                                              className="block px-4 py-2 text-sm text-gray-300 hover:bg-jdc-blue hover:text-white"
                                            >
                                              {number}
                                            </a>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </>
                              )}
                           </div>
                        </div>
                        <div className="space-y-1 text-xs text-gray-400">
                           {ticket.deducedSalesperson && (
                             <div className="flex items-center">
                               <FaUserTie className="mr-2 text-gray-500 w-4 text-center" />
                               <span>{ticket.deducedSalesperson}</span>
                             </div>
                           )}
                           {ticket.adresse && (
                             <div className="flex items-center">
                               <FaMapMarkerAlt className="mr-2 text-gray-500 w-4 text-center" />
                               <span className="truncate" title={getStringValueOrDefault(ticket.adresse)}>{getStringValueOrDefault(ticket.adresse)}</span>
                             </div>
                           )}
                           {ticket.description && (
                             <div className="text-gray-300 pt-1">
                               <p className="line-clamp-2" title={getStringValueOrDefault(ticket.description)}>{getStringValueOrDefault(ticket.description)}</p>
                             </div>
                           )}
                           {ticket.demandeSAP && (
                             <div className="text-gray-500 italic pt-1">
                                {(() => {
                                  const demandeSAP = getStringValueOrDefault(ticket.demandeSAP);
                                  return `Demande SAP: (${demandeSAP.length > 40 ? demandeSAP.substring(0, 37) + '...' : demandeSAP})`;
                                })()}
                             </div>
                           )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && selectedTicket && (
        <TicketSAPDetails
          ticket={selectedTicket}
          sectorId={selectedTicket.secteur}
          onClose={handleCloseModal}
          onTicketUpdated={handleTicketUpdated} // Keep this to trigger refresh
        />
      )}
    </div>
  );
}
