import type { LoaderFunctionArgs } from "@remix-run/node";
    import { json } from "@remix-run/node";
    import { authenticator } from "~/services/auth.server";
    import { getGoogleAuthClient, getCalendarEvents } from "~/services/google.server";
    import { getWeekDateRangeForAgenda } from "~/utils/dateUtils";
    import {
      getUserProfileSdk, // Needed to determine sectors
      getRecentTicketsForSectors,
      getRecentShipmentsForSectors,
      getTotalTicketCountSdk,
      getDistinctClientCountFromEnvoiSdk,
      getLatestStatsSnapshotsSdk,
    } from "~/services/firestore.service.server";
    import type { SapTicket, Shipment, StatsSnapshot, UserProfile } from "~/types/firestore.types"; // Removed CalendarEvent import
    import type { UserSession } from "~/services/session.server"; // Ensure UserSession is imported

    // Define CalendarEvent type locally
    interface CalendarEvent {
        id: string;
        summary?: string | null;
        start?: { dateTime?: string | null; date?: string | null } | null;
        end?: { dateTime?: string | null; date?: string | null } | null;
        htmlLink?: string | null;
    }

    // Define loader return type
    export interface DashboardLoaderData { // Export interface for use in component
        userProfile: UserProfile | null; // Pass profile fetched on server
        calendarEvents: CalendarEvent[];
        calendarError: string | null;
        stats: {
            liveTicketCount: number | null;
            liveDistinctClientCountFromEnvoi: number | null;
            evolution: {
                ticketCount: number | null;
                distinctClientCountFromEnvoi: number | null;
            };
        };
        recentTickets: SapTicket[];
        recentShipments: Shipment[];
        clientError: string | null; // Consolidated error reporting
    }

    export const loader = async ({ request }: LoaderFunctionArgs): Promise<ReturnType<typeof json<DashboardLoaderData>>> => {
      console.log("Dashboard Loader: Executing...");
      // Assuming authenticator.isAuthenticated returns UserSession | null
      const session: UserSession | null = await authenticator.isAuthenticated(request);

      let userProfile: UserProfile | null = null;
      let calendarEvents: CalendarEvent[] = [];
      let calendarError: string | null = null;
      let stats: DashboardLoaderData['stats'] = { liveTicketCount: null, liveDistinctClientCountFromEnvoi: null, evolution: { ticketCount: null, distinctClientCountFromEnvoi: null } };
      let recentTickets: SapTicket[] = [];
      let recentShipments: Shipment[] = [];
      let clientError: string | null = null; // Use this for Firestore errors

      // Check for session and the userId property
      if (session?.userId) { // Use userId instead of id/uid
        console.log(`Dashboard Loader: User authenticated (UserID: ${session.userId}), fetching profile and data...`);
        try {
          // 1. Fetch User Profile (needed for sectors)
          userProfile = await getUserProfileSdk(session.userId); // Use session.userId
          const userSectors = userProfile?.secteurs ?? [];
          const sectorsForTickets = userSectors;
          const sectorsForShipments = userProfile?.role === 'Admin' ? [] : userSectors; // Empty array for admin means all sectors

          // 2. Fetch Calendar Events (concurrently with other data)
          const calendarPromise = (async () => {
            try {
              const authClient = await getGoogleAuthClient(session);
              const { startOfWeek, endOfWeek } = getWeekDateRangeForAgenda();
              const timeMin = startOfWeek.toISOString();
              const timeMax = endOfWeek.toISOString();
              const rawEvents = await getCalendarEvents(authClient, timeMin, timeMax);
              calendarEvents = rawEvents.map((event: any) => ({
                  id: event.id, summary: event.summary, start: event.start, end: event.end, htmlLink: event.htmlLink,
              }));
              console.log(`Dashboard Loader: Fetched ${calendarEvents.length} calendar events.`);
            } catch (error: any) {
              console.error("Dashboard Loader: Error fetching calendar events:", error);
              calendarError = error.message?.includes("token") || error.message?.includes("authenticate")
                ? "Erreur d'authentification Google Calendar. Veuillez vous reconnecter."
                : error.message?.includes("Permission denied")
                ? "Accès à Google Calendar refusé. Vérifiez les autorisations."
                : error.message?.includes("Quota exceeded") || error.message?.includes("RESOURCE_EXHAUSTED")
                ? "Quota Google Calendar dépassé."
                : "Erreur lors de la récupération de l'agenda.";
            }
          })();

          // 3. Fetch Stats and Recent Items (concurrently)
          const dataPromise = (async () => {
            try {
                const results = await Promise.allSettled([
                  getLatestStatsSnapshotsSdk(1),
                  getTotalTicketCountSdk(sectorsForTickets),
                  getDistinctClientCountFromEnvoiSdk(userProfile), // Pass profile
                  getRecentTicketsForSectors(sectorsForTickets, 20),
                  getRecentShipmentsForSectors(sectorsForShipments, 20)
                ]);

                // Process stats
                const snapshotResult = results[0];
                const ticketCountResult = results[1];
                const distinctClientCountResult = results[2];
                const latestSnapshot = snapshotResult.status === 'fulfilled' && snapshotResult.value.length > 0 ? snapshotResult.value[0] : null;

                stats.liveTicketCount = ticketCountResult.status === 'fulfilled' ? ticketCountResult.value : null;
                stats.liveDistinctClientCountFromEnvoi = distinctClientCountResult.status === 'fulfilled' ? distinctClientCountResult.value : null;

                if (latestSnapshot) {
                    if (stats.liveTicketCount !== null && latestSnapshot.totalTickets !== undefined) {
                        stats.evolution.ticketCount = stats.liveTicketCount - latestSnapshot.totalTickets;
                    }
                    if (stats.liveDistinctClientCountFromEnvoi !== null && latestSnapshot.activeClients !== undefined) {
                        stats.evolution.distinctClientCountFromEnvoi = stats.liveDistinctClientCountFromEnvoi - latestSnapshot.activeClients;
                    }
                } else if (snapshotResult.status === 'rejected') {
                    console.error("Dashboard Loader: Error fetching snapshot:", snapshotResult.reason);
                    if (!clientError) clientError = "Erreur chargement évolution stats.";
                }

                if (ticketCountResult.status === 'rejected') {
                     console.error("Dashboard Loader: Error fetching ticket count:", ticketCountResult.reason);
                     if (!clientError) clientError = "Erreur chargement total tickets.";
                }
                 if (distinctClientCountResult.status === 'rejected') {
                     console.error("Dashboard Loader: Error fetching distinct client count:", distinctClientCountResult.reason);
                     if (!clientError) clientError = "Erreur chargement clients distincts.";
                 }


                // Process recent items
                const recentTicketsResult = results[3];
                const recentShipmentsResult = results[4];
                recentTickets = recentTicketsResult.status === 'fulfilled' ? recentTicketsResult.value : [];
                recentShipments = recentShipmentsResult.status === 'fulfilled' ? recentShipmentsResult.value : [];

                 if (recentTicketsResult.status === 'rejected') {
                     console.error("Dashboard Loader: Error fetching recent tickets:", recentTicketsResult.reason);
                     if (!clientError) clientError = "Erreur chargement tickets récents.";
                 }
                  if (recentShipmentsResult.status === 'rejected') {
                     console.error("Dashboard Loader: Error fetching recent shipments:", recentShipmentsResult.reason);
                     if (!clientError) clientError = "Erreur chargement envois récents.";
                 }

            } catch (err: any) {
                 console.error("Dashboard Loader: General error fetching stats/recent items:", err);
                 if (!clientError) clientError = "Erreur générale chargement données.";
            }
          })();

          // Wait for all promises
          await Promise.all([calendarPromise, dataPromise]);
          console.log("Dashboard Loader: All server-side data fetching finished.");

        } catch (error: any) {
          console.error("Dashboard Loader: Error fetching user profile:", error);
          // Handle profile fetch error - maybe redirect to login or show error
           clientError = "Impossible de charger les informations utilisateur.";
           // Reset other data if profile fails
           userProfile = null; calendarEvents = []; stats = { liveTicketCount: null, liveDistinctClientCountFromEnvoi: null, evolution: { ticketCount: null, distinctClientCountFromEnvoi: null } }; recentTickets = []; recentShipments = [];
        }
      } else {
          console.log("Dashboard Loader: User not authenticated.");
          // No need to set calendarError here unless specifically required when logged out
      }

      return json<DashboardLoaderData>({
          userProfile, // Pass profile fetched on server
          calendarEvents,
          calendarError,
          stats,
          recentTickets,
          recentShipments,
          clientError // Pass consolidated Firestore/data error
      });
    };
