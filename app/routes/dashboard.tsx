import type { MetaFunction } from "@remix-run/node";
    import { useOutletContext, useLoaderData } from "@remix-run/react";
    import React, { lazy, Suspense } from "react";
    import { Timestamp } from 'firebase/firestore'; // Import Timestamp for type checking/conversion

    // Import loader and its type
    import { loader } from "./dashboard.loader";
    import type { DashboardLoaderData } from "./dashboard.loader";

    import { StatsCard } from "~/components/StatsCard";
    const InteractiveMap = lazy(() => import("~/components/InteractiveMap"));
    import { RecentTickets } from "~/components/RecentTickets";
    import { RecentShipments } from "~/components/RecentShipments";
    import { ClientOnly } from "~/components/ClientOnly";
    import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
    import { faTicket, faUsers, faMapMarkedAlt, faSpinner, faExclamationTriangle, faMap, faCalendarDays } from "@fortawesome/free-solid-svg-icons";

    // Import types used in the component
    import type { SapTicket, Shipment, AppUser, UserProfile } from "~/types/firestore.types";
    import type { UserSession } from "~/services/session.server";

    // Define CalendarEvent type locally (matching loader)
    interface CalendarEvent {
        id: string;
        summary?: string | null;
        start?: { dateTime?: string | null; date?: string | null } | null;
        end?: { dateTime?: string | null; date?: string | null } | null;
        htmlLink?: string | null;
    }

    export const meta: MetaFunction = () => {
      return [{ title: "Tableau de Bord | JDC Dashboard" }];
    };

    // Export the loader imported from dashboard.loader.ts
    export { loader };

    // Update Outlet context type to match root loader/context
    type OutletContextType = {
        user: UserSession | null; // Assuming root provides UserSession
    };

    // --- Helper Functions ---
    // Helper to parse serialized date/timestamp back to Date | undefined
    const parseSerializedDateOptional = (serializedDate: string | { seconds: number; nanoseconds: number; } | null | undefined): Date | undefined => {
        if (!serializedDate) return undefined; // Return undefined for null/undefined input
        if (typeof serializedDate === 'string') {
            try {
                // Attempt to parse ISO string
                const date = new Date(serializedDate);
                // Check if the date is valid
                if (isNaN(date.getTime())) {
                    console.warn(`Invalid date string encountered during parsing: ${serializedDate}`);
                    return undefined;
                }
                return date;
            } catch {
                console.warn(`Error parsing date string: ${serializedDate}`);
                return undefined; // Handle invalid date string
            }
        }
        // Check if it looks like a Firestore Timestamp object (serialized)
        if (typeof serializedDate === 'object' && 'seconds' in serializedDate && typeof serializedDate.seconds === 'number' && 'nanoseconds' in serializedDate && typeof serializedDate.nanoseconds === 'number') {
             try {
                 // Reconstruct Firestore Timestamp locally if needed, or just convert to Date
                 return new Timestamp(serializedDate.seconds, serializedDate.nanoseconds).toDate();
             } catch {
                 console.warn(`Error converting serialized Timestamp:`, serializedDate);
                 return undefined;
             }
        }
        console.warn(`Unexpected date format encountered during parsing:`, serializedDate);
        return undefined; // Return undefined for other unexpected formats
    };

     // Helper specifically for fields expecting Date | null
     const parseSerializedDateNullable = (serializedDate: string | { seconds: number; nanoseconds: number; } | null | undefined): Date | null => {
        const parsedDate = parseSerializedDateOptional(serializedDate);
        // Ensure the return type matches Date | null
        return parsedDate === undefined ? null : parsedDate;
     };


    // Helper to format event time/date (Keep as is)
    const formatEventTime = (eventDateTime?: { dateTime?: string | null; date?: string | null } | null): string => {
        if (!eventDateTime) return 'N/A';
        if (eventDateTime.dateTime) {
            try { return new Date(eventDateTime.dateTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); }
            catch { return 'Heure invalide'; }
        }
        if (eventDateTime.date) {
             try {
                const [year, month, day] = eventDateTime.date.split('-').map(Number);
                const date = new Date(year, month - 1, day);
                return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
            } catch { return 'Date invalide'; }
        }
        return 'N/A';
    };

    // --- Placeholder Components ---
    const MapLoadingFallback = () => (
      <div className="bg-jdc-card p-4 rounded-lg shadow-lg flex flex-col items-center justify-center min-h-[450px]">
        <FontAwesomeIcon icon={faSpinner} spin className="text-jdc-yellow text-3xl mb-4" />
        <p className="text-jdc-gray-400 text-center">Chargement de la carte...</p>
      </div>
    );

    const MapLoginPrompt = () => (
       <div className="bg-jdc-card p-4 rounded-lg shadow-lg flex flex-col items-center justify-center min-h-[450px]">
            <FontAwesomeIcon icon={faMapMarkedAlt} className="text-jdc-gray-500 text-4xl mb-4" />
            <p className="text-jdc-gray-400 text-center">Connectez-vous pour voir la carte des tickets.</p>
       </div>
    );

    // Placeholder for WeeklyAgenda component
    const WeeklyAgenda: React.FC<{ events: CalendarEvent[], error: string | null }> = ({ events, error }) => {
        if (error) {
            return (
                 <div className="bg-jdc-card p-4 rounded-lg shadow-lg min-h-[200px]">
                     <h3 className="text-lg font-semibold text-white mb-2 flex items-center"><FontAwesomeIcon icon={faCalendarDays} className="mr-2 text-jdc-blue" />Agenda de la semaine</h3>
                     <div className="text-red-400 bg-red-900 bg-opacity-50 p-3 rounded"><FontAwesomeIcon icon={faExclamationTriangle} className="mr-1" /> {error}</div>
                 </div>
            );
        }
         if (!events || events.length === 0) {
            return (
                 <div className="bg-jdc-card p-4 rounded-lg shadow-lg min-h-[200px]">
                     <h3 className="text-lg font-semibold text-white mb-2 flex items-center"><FontAwesomeIcon icon={faCalendarDays} className="mr-2 text-jdc-blue" />Agenda de la semaine</h3>
                     <p className="text-jdc-gray-400">Aucun événement trouvé ou agenda non accessible.</p>
                 </div>
            );
        }
        return (
            <div className="bg-jdc-card p-4 rounded-lg shadow-lg min-h-[200px]">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center"><FontAwesomeIcon icon={faCalendarDays} className="mr-2 text-jdc-blue" />Agenda de la semaine</h3>
                <ul className="space-y-2">
                    {events.map(event => (
                        <li key={event.id} className="text-sm border-b border-jdc-gray-700 pb-1 last:border-b-0">
                            <span className="font-medium text-jdc-gray-200">{event.summary || '(Sans titre)'}</span>
                            <span className="text-xs text-jdc-gray-400 ml-2">({formatEventTime(event.start)} - {formatEventTime(event.end)})</span>
                             {event.htmlLink && <a href={event.htmlLink} target="_blank" rel="noopener noreferrer" className="text-xs text-jdc-blue hover:underline ml-2">(Voir)</a>}
                        </li>
                    ))}
                </ul>
            </div>
        );
    };
    // --- End Placeholder Components ---

    export default function Dashboard() {
      const { user } = useOutletContext<OutletContextType>();
      const {
          userProfile,
          calendarEvents,
          calendarError,
          stats,
          recentTickets: serializedTickets, // Data from loader has serialized dates
          recentShipments: serializedShipments, // Data from loader has serialized dates
          clientError
      } = useLoaderData<typeof loader>();

      // Parse dates on the client-side before passing to components expecting Date objects
      // Ensure the mapped type matches the expected component prop type exactly
      const recentTickets: SapTicket[] = (serializedTickets ?? []).map(ticket => ({
          ...ticket,
          // Use nullable parser for SapTicket.date (Date | Timestamp | null)
          date: parseSerializedDateNullable(ticket.date),
      }));
       const recentShipments: Shipment[] = (serializedShipments ?? []).map(shipment => ({
           ...shipment,
           // Use optional parser for Shipment.dateCreation (Date | Timestamp | undefined)
           dateCreation: parseSerializedDateOptional(shipment.dateCreation),
       }));


      const formatStatValue = (value: number | string | null): string => {
         if (value === null || value === undefined) return "N/A";
         return value.toString();
      };

      const statsData = [
        { title: "Tickets SAP (Total)", valueState: stats.liveTicketCount, icon: faTicket, evolutionKey: 'ticketCount' },
        { title: "Clients CTN (Distincts)", valueState: stats.liveDistinctClientCountFromEnvoi, icon: faUsers, evolutionKey: 'distinctClientCountFromEnvoi' },
      ];

      const ticketsForList = recentTickets.slice(0, 5); // Use parsed tickets

      return (
        <div className="space-y-6">
          <h1 className="text-3xl font-semibold text-white">Tableau de Bord</h1>
          {clientError && (
            <div className="flex items-center p-4 bg-red-800 text-white rounded-lg mb-4">
              <FontAwesomeIcon icon={faExclamationTriangle} className="mr-2" />
              {clientError}
            </div>
          )}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {statsData.map((stat) => {
               const mainValue = stat.valueState;
               const evolutionDisplayValue = stats.evolution[stat.evolutionKey as keyof typeof stats.evolution];
               return (
                 <StatsCard
                   key={stat.title}
                   title={stat.title}
                   value={formatStatValue(mainValue)}
                   icon={stat.icon}
                   isLoading={false}
                   evolutionValue={evolutionDisplayValue}
                 />
               );
             })}
           </div>

            <WeeklyAgenda events={calendarEvents} error={calendarError} />

          <div className="w-full mb-6">
            <ClientOnly fallback={<MapLoadingFallback />}>
              {() =>
                user ? (
                  <Suspense fallback={<MapLoadingFallback />}>
                    <InteractiveMap
                      tickets={recentTickets} // Use parsed tickets
                      isLoadingTickets={false}
                    />
                  </Suspense>
                ) : (
                  <MapLoginPrompt />
                )
              }
            </ClientOnly>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <RecentTickets
               tickets={ticketsForList} // Use parsed tickets
               isLoading={false}
            />
            <RecentShipments
               shipments={recentShipments} // Use parsed shipments
               isLoading={false}
            />
          </div>

          {!user && !clientError && (
             <div className="p-4 bg-jdc-card rounded-lg text-center text-jdc-gray-300 mt-6">
               Veuillez vous connecter pour voir le tableau de bord.
             </div>
           )}
        </div>
      );
    }
