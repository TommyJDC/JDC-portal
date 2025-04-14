import type { MetaFunction } from "@remix-run/node";
    import { useState, useMemo, useRef, useCallback } from "react"; // Removed useEffect
    import { useOutletContext, useLoaderData, useRevalidator } from "@remix-run/react"; // Added useLoaderData, useRevalidator
    // Import loader and its type
    import { loader } from "./tickets-sap.loader";
    import type { TicketsSapLoaderData } from "./tickets-sap.loader";
    // Removed direct server imports
    import type { SapTicket, UserProfile } from "~/types/firestore.types";
    import type { UserSession } from "~/services/session.server";
    import { Timestamp } from 'firebase/firestore'; // Keep for type checking/conversion
    import { Input } from "~/components/ui/Input";
    import { Button } from "~/components/ui/Button";
    import TicketSAPDetails from "~/components/TicketSAPDetails";
    import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
    import {
      faTicket, faFilter, faSearch, faUserTag, faChevronDown, faChevronRight, faSpinner,
      faExclamationTriangle, faPhone, faMapMarkerAlt, faUserTie, faInfoCircle,
      faCalendarAlt, faChevronUp
    } from "@fortawesome/free-solid-svg-icons"; // Removed faCircleNodes
    import { getTicketStatusStyle } from "~/utils/styleUtils";
    import { parseFrenchDate, formatDateForDisplay } from "~/utils/dateUtils";

    export const meta: MetaFunction = () => {
      return [{ title: "Tickets SAP | JDC Dashboard" }];
    };

    // Export loader
    export { loader };

    // Update Outlet context type to use UserSession if root provides it
    type OutletContextType = {
      user: UserSession | null;
      // profile: UserProfile | null; // Profile now comes from this route's loader
    };

    // Helper to parse serialized dates (similar to dashboard)
    const parseSerializedDateNullable = (serializedDate: string | { seconds: number; nanoseconds: number; } | null | undefined): Date | null => {
        if (!serializedDate) return null;
        if (typeof serializedDate === 'string') {
            try {
                const date = new Date(serializedDate);
                if (isNaN(date.getTime())) return null;
                return date;
            } catch { return null; }
        }
        if (typeof serializedDate === 'object' && 'seconds' in serializedDate && typeof serializedDate.seconds === 'number' && 'nanoseconds' in serializedDate && typeof serializedDate.nanoseconds === 'number') {
             try { return new Timestamp(serializedDate.seconds, serializedDate.nanoseconds).toDate(); }
             catch { return null; }
        }
        return null;
    };


    const groupTicketsByRaisonSociale = (tickets: SapTicket[]): Map<string, SapTicket[]> => {
      const grouped = new Map<string, SapTicket[]>();
       if (!Array.isArray(tickets)) {
         return grouped;
       }
      tickets.forEach(ticket => {
        const raisonSociale = ticket.raisonSociale; // Use raisonSociale directly
        if (raisonSociale) { // Only group if raisonSociale exists
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

      // State for client-side filtering and UI
      const [selectedSector, setSelectedSector] = useState<string>('');
      const [searchTerm, setSearchTerm] = useState<string>('');
      const [showNumberOptions, setShowNumberOptions] = useState<Record<string, boolean>>({});
      const [isModalOpen, setIsModalOpen] = useState(false);
      const [selectedTicket, setSelectedTicket] = useState<SapTicket | null>(null);

      // Parse tickets dates from loader data
      const allTickets: SapTicket[] = useMemo(() => (serializedTickets ?? []).map(ticket => ({
          ...ticket,
          date: parseSerializedDateNullable(ticket.date),
      })), [serializedTickets]);


      const availableSectors = useMemo(() => {
         // Use profile from loader data
         return userProfile?.secteurs?.slice().sort() ?? [];
      }, [userProfile]);

      const filteredAndGroupedTickets = useMemo(() => {
        let filtered = allTickets; // Use parsed tickets

        if (selectedSector && selectedSector !== '') {
          filtered = filtered.filter(t => t.secteur === selectedSector);
        }

        if (searchTerm.trim() !== '') {
          const lowerSearchTerm = searchTerm.trim().toLowerCase();
          filtered = filtered.filter(t =>
            (t.raisonSociale?.toLowerCase().includes(lowerSearchTerm)) ||
            (t.client?.toLowerCase().includes(lowerSearchTerm)) ||
            (t.id?.toLowerCase().includes(lowerSearchTerm)) ||
            (t.description?.toLowerCase().includes(lowerSearchTerm)) ||
            (t.statut?.toLowerCase().includes(lowerSearchTerm)) ||
            (t.numeroSAP?.toLowerCase().includes(lowerSearchTerm)) ||
            (t.deducedSalesperson?.toLowerCase().includes(lowerSearchTerm)) ||
            (t.adresse?.toLowerCase().includes(lowerSearchTerm)) ||
            (t.telephone?.toLowerCase().includes(lowerSearchTerm))
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
          return b.mostRecentDate.getTime() - a.mostRecentDate.getTime();
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

       // Use revalidator hook to refresh data after modal update
       const handleTicketUpdated = useCallback(() => {
         console.log("Ticket update detected from modal, revalidating data...");
         revalidator.revalidate();
         // Optionally close modal after update:
         // handleCloseModal();
       }, [revalidator]);


      // Show message if user is not logged in (based on context)
      if (!user) {
         return (
            <div className="text-center text-jdc-gray-400 py-10">
                Veuillez vous connecter pour voir les tickets SAP.
            </div>
         )
      }

       // Show loader error if present
       if (loaderError) {
           return <div className="text-center text-red-400 bg-red-900 bg-opacity-50 p-4 rounded-lg flex items-center justify-center">
              <FontAwesomeIcon icon={faExclamationTriangle} className="mr-2" />
              {loaderError}
           </div>;
       }

       // Determine loading state based on revalidator
       const isLoading = revalidator.state === 'loading';

      return (
        <div>
          <h1 className="text-2xl font-semibold text-white mb-4 flex items-center">
            <FontAwesomeIcon icon={faTicket} className="mr-3 text-jdc-blue" />
            Gestion des Tickets SAP
            {isLoading && <FontAwesomeIcon icon={faSpinner} spin className="ml-3 text-jdc-yellow" title="Rafraîchissement..." />}
          </h1>

          {/* Filter and Search Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-jdc-card rounded-lg shadow">
            {/* Sector Filter */}
            <div className="col-span-1">
              <label htmlFor="sector-filter" className="block text-sm font-medium text-jdc-gray-300 mb-1">
                <FontAwesomeIcon icon={faFilter} className="mr-1" /> Filtrer par Secteur
              </label>
              <select
                id="sector-filter"
                name="sector-filter"
                value={selectedSector}
                onChange={(e) => setSelectedSector(e.target.value)}
                className="block w-full rounded-md bg-jdc-gray-800 border-transparent focus:border-jdc-blue focus:ring focus:ring-jdc-blue focus:ring-opacity-50 text-white py-2 pl-3 pr-10"
                disabled={isLoading || availableSectors.length === 0} // Disable during revalidation
              >
                <option value="">Tous les secteurs ({userProfile?.secteurs?.length ?? 0})</option>
                {availableSectors.map(sector => (
                  <option key={sector} value={sector}>{sector}</option>
                ))}
              </select>
               {availableSectors.length === 0 && !isLoading && !loaderError && (
                 <p className="text-xs text-jdc-gray-500 mt-1">Aucun secteur assigné à votre profil.</p>
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
                 icon={<FontAwesomeIcon icon={faSearch} />}
                 wrapperClassName="mb-0"
                 disabled={isLoading} // Disable during revalidation
               />
            </div>
          </div>

          {/* Loading State during revalidation (optional, handled by spinner in title) */}
          {/* {isLoading && ( ... )} */}

          {/* No Results State */}
          {!isLoading && !loaderError && clientGroups.length === 0 && (
            <div className="text-center text-jdc-gray-400 py-10">
              {allTickets.length > 0
                ? "Aucun ticket trouvé correspondant à votre recherche ou filtre."
                : "Aucun ticket SAP avec une raison sociale trouvée pour les secteurs assignés."}
            </div>
          )}


          {/* Tickets List */}
          {!isLoading && !loaderError && clientGroups.length > 0 && (
            <div className="space-y-3">
              {clientGroups.map(([raisonSociale, clientTickets]) => (
                <div key={raisonSociale} className="bg-jdc-card rounded-lg shadow overflow-hidden">
                  <details className="group" open={clientGroups.length < 5}>
                    <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-jdc-gray-800 list-none transition-colors">
                      <div className="flex items-center min-w-0 mr-2">
                        <FontAwesomeIcon icon={faUserTag} className="mr-3 text-jdc-gray-300 text-lg flex-shrink-0" />
                        <div className="min-w-0">
                            <span className="font-semibold text-white text-lg block truncate" title={raisonSociale}>{raisonSociale}</span>
                            <span className="ml-0 md:ml-3 text-sm text-jdc-gray-400">
                                ({clientTickets.length} ticket{clientTickets.length > 1 ? 's' : ''})
                            </span>
                        </div>
                      </div>
                      <FontAwesomeIcon
                        icon={faChevronRight}
                        className="text-jdc-gray-400 transition-transform duration-200 group-open:rotate-90 text-xl flex-shrink-0"
                      />
                    </summary>
                    <div className="border-t border-jdc-gray-700 bg-jdc-gray-900 p-4 space-y-3">
                      {clientTickets.sort((a, b) => {
                          // Use parsed dates for sorting
                          const dateA = a.date;
                          const dateB = b.date;
                          if (!(dateB instanceof Date)) return -1;
                          if (!(dateA instanceof Date)) return 1;
                          return dateB.getTime() - dateA.getTime();
                        }).map((ticket) => {
                        const statusStyle = getTicketStatusStyle(ticket.statut);
                        // Ensure the date passed is Date | null
                        const displayDate = formatDateForDisplay(ticket.date instanceof Date ? ticket.date : null);
                        const phoneNumbersArray = ticket.telephone?.split(',').map((num: string) => num.trim()).filter(num => num) || [];

                        return (
                          <div
                            key={ticket.id}
                            className="border-b border-jdc-gray-700 pb-3 last:border-b-0 text-sm cursor-pointer hover:bg-jdc-gray-800 transition-colors duration-150 p-3 rounded"
                            onClick={() => handleTicketClick(ticket)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleTicketClick(ticket); }}
                          >
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-2">
                               <div className="flex-1 min-w-0 mb-2 md:mb-0 md:mr-4">
                                  <div className="flex items-center mb-1">
                                    <FontAwesomeIcon icon={faInfoCircle} className="mr-2 text-jdc-blue w-4 text-center" />
                                    <span className="text-jdc-gray-100 font-semibold" title={`SAP: ${ticket.numeroSAP || 'N/A'}`}>
                                      {ticket.numeroSAP || 'N/A'}
                                    </span>
                                    <span className={`ml-3 inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${statusStyle.bgColor} ${statusStyle.textColor}`}>
                                      {ticket.statut || 'Inconnu'}
                                    </span>
                                  </div>
                                  <div className="flex items-center text-xs text-jdc-gray-400">
                                    <FontAwesomeIcon icon={faCalendarAlt} className="mr-2 text-jdc-gray-500 w-4 text-center" />
                                    <span>{displayDate}</span>
                                    <span className="mx-2">|</span>
                                    <span className="text-jdc-gray-500" title={`ID: ${ticket.id}`}>
                                      ID: {ticket.id.substring(0, 8)}...
                                    </span>
                                    <span className="mx-2">|</span>
                                    <span className="text-jdc-gray-500">
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
                                        <FontAwesomeIcon icon={faPhone} className="mr-2" />
                                        <span>Appeler</span>
                                        {phoneNumbersArray.length > 1 && (
                                          <FontAwesomeIcon icon={showNumberOptions[ticket.id] ? faChevronUp : faChevronDown} className="ml-2" />
                                        )}
                                      </Button>
                                      {showNumberOptions[ticket.id] && phoneNumbersArray.length > 1 && (
                                        <div className="absolute right-0 mt-2 w-48 bg-jdc-gray-800 rounded-md shadow-lg z-10 border border-jdc-gray-700">
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
                                                  className="block px-4 py-2 text-sm text-jdc-gray-200 hover:bg-jdc-blue hover:text-white"
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
                            <div className="space-y-1 text-xs">
                               {ticket.deducedSalesperson && (
                                 <div className="flex items-center text-jdc-gray-400">
                                   <FontAwesomeIcon icon={faUserTie} className="mr-2 text-jdc-gray-500 w-4 text-center" />
                                   <span>{ticket.deducedSalesperson}</span>
                                 </div>
                               )}
                               {ticket.adresse && (
                                 <div className="flex items-center text-jdc-gray-400">
                                   <FontAwesomeIcon icon={faMapMarkerAlt} className="mr-2 text-jdc-gray-500 w-4 text-center" />
                                   <span className="truncate" title={ticket.adresse}>{ticket.adresse}</span>
                                 </div>
                               )}
                               {ticket.description && (
                                 <div className="text-jdc-gray-300 pt-1">
                                   <p className="line-clamp-2" title={ticket.description}>{ticket.description}</p>
                                 </div>
                               )}
                               {ticket.demandeSAP && (
                                 <div className="text-jdc-gray-500 italic pt-1">
                                    Demande SAP: ({ticket.demandeSAP.length > 40 ? ticket.demandeSAP.substring(0, 37) + '...' : ticket.demandeSAP})
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
