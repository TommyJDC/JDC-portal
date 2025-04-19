import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { authenticator } from "~/services/auth.server";
import { getGoogleAuthClient, getCalendarEvents } from "~/services/google.server";
import { getWeekDateRangeForAgenda } from "~/utils/dateUtils";
import {
  getUserProfileSdk,
  getRecentTicketsForSectors,
  getAllShipments,
  getTotalTicketCountSdk,
  getDistinctClientCountFromEnvoiSdk,
  getLatestStatsSnapshotsSdk,
  getInstallationsSnapshot,
  type InstallationsSnapshot
} from "~/services/firestore.service.server";
    import type { SapTicket, Shipment, StatsSnapshot, UserProfile } from "~/types/firestore.types";
    import type { UserSession } from "~/services/session.server";

    interface CalendarEvent {
        id: string;
        summary?: string | null;
        start?: { dateTime?: string | null; date?: string | null } | null;
        end?: { dateTime?: string | null; date?: string | null } | null;
        htmlLink?: string | null;
    }

export interface DashboardLoaderData {
  userProfile: UserProfile | null;
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
  installationsStats: InstallationsSnapshot | null;
  recentTickets: SapTicket[];
  recentShipments: Shipment[];
  clientError: string | null;
}

    export const loader = async ({ request }: LoaderFunctionArgs): Promise<ReturnType<typeof json<DashboardLoaderData>>> => {
      console.log("Dashboard Loader: Executing...");
      const session: UserSession | null = await authenticator.isAuthenticated(request);

      let userProfile: UserProfile | null = null;
      let calendarEvents: CalendarEvent[] = [];
      let calendarError: string | null = null;
      let stats: DashboardLoaderData['stats'] = { liveTicketCount: null, liveDistinctClientCountFromEnvoi: null, evolution: { ticketCount: null, distinctClientCountFromEnvoi: null } };
      let recentTickets: SapTicket[] = [];
      let recentShipments: Shipment[] = [];
      let installationsStats: InstallationsSnapshot | null = null;
      let clientError: string | null = null;

      if (session?.userId) {
        console.log(`Dashboard Loader: User authenticated (UserID: ${session.userId}), fetching profile and data...`);
        try {
          userProfile = await getUserProfileSdk(session.userId);
          
          if (!userProfile?.secteurs || userProfile.secteurs.length === 0) {
            return redirect("/create-profile");
          }

          const userSectors = userProfile.secteurs;
          const sectorsForTickets = userSectors;
          const sectorsForShipments = userProfile?.role === 'Admin' ? ['haccp', 'chr', 'tabac', 'kezia'] : userSectors;

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

          const dataPromise = (async () => {
            try {
                const results = await Promise.allSettled([
                  getLatestStatsSnapshotsSdk(1),
                  getTotalTicketCountSdk(sectorsForTickets),
                  getDistinctClientCountFromEnvoiSdk(userProfile),
                  getRecentTicketsForSectors(sectorsForTickets, 20),
                  getAllShipments(sectorsForShipments),
                  getInstallationsSnapshot(userProfile)
                ]);

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

                const recentTicketsResult = results[3];
                const recentShipmentsResult = results[4];
                const installationsResult = results[5];
                
                recentTickets = recentTicketsResult.status === 'fulfilled' ? recentTicketsResult.value : [];
                recentShipments = recentShipmentsResult.status === 'fulfilled' ? recentShipmentsResult.value.slice(0, 20) : [];
                installationsStats = installationsResult.status === 'fulfilled' ? installationsResult.value : null;

                if (recentTicketsResult.status === 'rejected') {
                  console.error("Dashboard Loader: Error fetching recent tickets:", recentTicketsResult.reason);
                  if (!clientError) clientError = "Erreur chargement tickets récents.";
                }
                if (recentShipmentsResult.status === 'rejected') {
                  console.error("Dashboard Loader: Error fetching recent shipments:", recentShipmentsResult.reason);
                  if (!clientError) clientError = "Erreur chargement envois récents.";
                }
                if (installationsResult.status === 'rejected') {
                  console.error("Dashboard Loader: Error fetching installations stats:", installationsResult.reason);
                  if (!clientError) clientError = "Erreur chargement statistiques installations.";
                }

            } catch (err: any) {
                 console.error("Dashboard Loader: General error fetching stats/recent items:", err);
                 if (!clientError) clientError = "Erreur générale chargement données.";
            }
          })();

          await Promise.all([calendarPromise, dataPromise]);
          console.log("Dashboard Loader: All server-side data fetching finished.");

        } catch (error: any) {
          console.error("Dashboard Loader: Error fetching user profile:", error);
          clientError = "Impossible de charger les informations utilisateur.";
          userProfile = null;
          calendarEvents = [];
          stats = { liveTicketCount: null, liveDistinctClientCountFromEnvoi: null, evolution: { ticketCount: null, distinctClientCountFromEnvoi: null } };
          recentTickets = [];
          recentShipments = [];
          installationsStats = null;
        }
      } else {
          console.log("Dashboard Loader: User not authenticated.");
      }

      return json<DashboardLoaderData>({
        userProfile,
        calendarEvents,
        calendarError,
        stats,
        installationsStats,
        recentTickets,
        recentShipments,
        clientError
      });
    };
