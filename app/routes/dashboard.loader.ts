import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { authenticator } from "~/services/auth.server";
import { getGoogleAuthClient, getCalendarEvents } from "~/services/google.server";
import { getWeekDateRangeForAgenda } from "~/utils/dateUtils";
import {
  getUserProfileSdk,
  getRecentTicketsForSectors,
  getAllShipments,
  getDistinctClientCountFromEnvoiSdk,
  getLatestStatsSnapshotsSdk,
  getInstallationsSnapshot,
  getAllInstallations,
  getSapTicketCountBySectorSdk // Importer la nouvelle fonction
} from "~/services/firestore.service.server";
    import type { SapTicket, Shipment, StatsSnapshot, UserProfile, InstallationsDashboardStats, Installation } from "~/types/firestore.types";
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
  installationsStats: InstallationsDashboardStats | null;
  allInstallations: Installation[];
  recentTickets: SapTicket[];
  recentShipments: Shipment[];
  clientError: string | null;
  sapTicketCountsBySector: Record<string, number> | null; // Ajouter le champ pour les comptes par secteur
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
      let installationsStats: InstallationsDashboardStats | null = null;
      let allInstallations: Installation[] = [];
      let clientError: string | null = null;
      let sapTicketCountsBySector: Record<string, number> | null = null; // Initialiser le champ

      if (session?.userId) {
        console.log(`Dashboard Loader: User authenticated (UserID: ${session.userId}), fetching profile and data...`);
        try {
          userProfile = await getUserProfileSdk(session.userId);
          
          // Si le profil utilisateur n'existe pas, rediriger vers la page de création/gestion de profil
          if (!userProfile) {
             console.log(`Dashboard Loader: User profile not found for ${session.userId}, redirecting to /user-profile`);
             return redirect("/user-profile");
          }

          const userSectors = userProfile.secteurs || []; // Assurez-vous que userSectors est toujours un tableau
          // Si l'utilisateur est admin, inclure tous les secteurs pour les tickets, sinon utiliser les secteurs du profil
          const sectorsForTickets = userProfile.role === 'Admin' ? ['CHR', 'HACCP', 'Kezia', 'Tabac'] : userSectors;
          const sectorsForShipments = userProfile.role === 'Admin' ? ['haccp', 'chr', 'tabac', 'kezia'] : userSectors;

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
                // Définir les promesses
                const latestStatsSnapshotsPromise = getLatestStatsSnapshotsSdk(1);
                // Remplacer l'appel à getTotalTicketCountSdk par getSapTicketCountBySectorSdk
                const sapTicketCountsBySectorPromise = getSapTicketCountBySectorSdk(sectorsForTickets);
                const recentTicketsPromise = getRecentTicketsForSectors(sectorsForTickets, 20);
                const allShipmentsPromise = getAllShipments(sectorsForShipments);
                const allInstallationsPromise = getAllInstallations();

                // Définir les promesses dépendantes de userProfile
                const distinctClientCountPromise = userProfile ? getDistinctClientCountFromEnvoiSdk(userProfile) : Promise.resolve(0);
                const installationsSnapshotPromise = userProfile ? getInstallationsSnapshot(userProfile) : Promise.resolve(null);


                // Exécuter toutes les promesses en parallèle
                const results = await Promise.allSettled([
                  latestStatsSnapshotsPromise,
                  sapTicketCountsBySectorPromise, // Utiliser la promesse avec le nom correct
                  distinctClientCountPromise,
                  recentTicketsPromise,
                  allShipmentsPromise,
                  installationsSnapshotPromise,
                  allInstallationsPromise,
                ]);

                // Accéder aux résultats en vérifiant le statut et la valeur
                const snapshotResult = results[0];
                const sapTicketCountBySectorResult = results[1]; // Récupérer le résultat avec le nom correct
                const distinctClientCountResult = results[2];
                const recentTicketsResult = results[3];
                const recentShipmentsResult = results[4];
                const installationsSnapshotResult = results[5];
                const allInstallationsResult = results[6];


                const latestSnapshot = snapshotResult.status === 'fulfilled' && snapshotResult.value && snapshotResult.value.length > 0 ? snapshotResult.value[0] : null;

                // Mettre à jour l'utilisation de stats.liveTicketCount pour utiliser les comptes par secteur
                // Cela nécessite de sommer les comptes par secteur si un total est nécessaire,
                // ou d'utiliser directement sapTicketCountsBySector si l'affichage est par secteur.
                // Pour l'instant, je vais assigner le résultat direct et ajuster l'utilisation plus tard si nécessaire.
                sapTicketCountsBySector = sapTicketCountBySectorResult.status === 'fulfilled' ? sapTicketCountBySectorResult.value : null;

                // L'évolution du total des tickets ne peut plus être calculée directement avec un seul chiffre.
                // Il faudrait soit stocker l'évolution par secteur, soit recalculer le total à partir du snapshot.
                // Pour l'instant, je vais commenter le calcul de l'évolution du ticket count pour éviter l'erreur.
                // stats.liveTicketCount = ticketCountResult.status === 'fulfilled' ? ticketCountResult.value : null; // Cette ligne n'est plus pertinente pour le total global
                stats.liveDistinctClientCountFromEnvoi = distinctClientCountResult.status === 'fulfilled' ? distinctClientCountResult.value : null;


                if (latestSnapshot) {
                    // if (stats.liveTicketCount !== null && latestSnapshot.totalTickets !== undefined) {
                    //     stats.evolution.ticketCount = stats.liveTicketCount - latestSnapshot.totalTickets;
                    // }
                    if (stats.liveDistinctClientCountFromEnvoi !== null && latestSnapshot.activeClients !== undefined) {
                        stats.evolution.distinctClientCountFromEnvoi = stats.liveDistinctClientCountFromEnvoi - latestSnapshot.activeClients;
                    }
                } else if (snapshotResult.status === 'rejected') {
                    console.error("Dashboard Loader: Error fetching snapshot:", snapshotResult.reason);
                    if (!clientError) clientError = "Erreur chargement évolution stats.";
                }

                // if (ticketCountResult.status === 'rejected') { // Cette vérification n'est plus pertinente
                //      console.error("Dashboard Loader: Error fetching ticket count:", ticketCountResult.reason);
                //      if (!clientError) clientError = "Erreur chargement total tickets.";
                // }
                 if (distinctClientCountResult.status === 'rejected') {
                     console.error("Dashboard Loader: Error fetching distinct client count:", distinctClientCountResult.reason);
                     if (!clientError) clientError = "Erreur chargement clients distincts.";
                 }
                 if (sapTicketCountBySectorResult.status === 'rejected') {
                     console.error("Dashboard Loader: Error fetching SAP ticket count by sector:", sapTicketCountBySectorResult.reason);
                     if (!clientError) clientError = "Erreur chargement tickets SAP par secteur.";
                 }


                // Ensure dates in contactAttempts for recentTickets are Date objects
                recentTickets = recentTicketsResult.status === 'fulfilled'
                    ? recentTicketsResult.value.map(ticket => {
                         const processedTicket: SapTicket = {
                            ...ticket,
                            // Ensure date is a Date object
                            date: ticket.date instanceof Date || ticket.date === null ? ticket.date : new Date((ticket.date as any).seconds * 1000),
                            // Ensure dates in contactAttempts are Date objects
                            contactAttempts: ticket.contactAttempts?.map(attempt => ({
                                ...attempt,
                                date: attempt.date instanceof Date ? attempt.date : new Date((attempt.date as any).seconds * 1000)
                            }))
                        };
                        return processedTicket;
                    })
                    : [];

                recentShipments = recentShipmentsResult.status === 'fulfilled' ? recentShipmentsResult.value.slice(0, 20) : [];

                // Filtrer allInstallations par secteurs de l'utilisateur si non-admin
                const rawAllInstallations = allInstallationsResult.status === 'fulfilled' ? allInstallationsResult.value : [];
                allInstallations = userProfile?.role === 'Admin'
                  ? rawAllInstallations
                  : rawAllInstallations.filter(inst => userProfile?.secteurs?.includes(inst.secteur));


                // Transform installations data to match component expectations
                const rawInstallationsStats = installationsSnapshotResult.status === 'fulfilled' ? installationsSnapshotResult.value : null;
                installationsStats = rawInstallationsStats ? {
                  haccp: {
                    total: rawInstallationsStats.bySector?.['HACCP']?.total || 0, // Utiliser ?. pour l'accès sécurisé
                    enAttente: rawInstallationsStats.bySector?.['HACCP']?.byStatus?.['rendez-vous à prendre'] || 0, // Utiliser ?.
                    planifiees: rawInstallationsStats.bySector?.['HACCP']?.byStatus?.['rendez-vous pris'] || 0, // Utiliser ?.
                    terminees: rawInstallationsStats.bySector?.['HACCP']?.byStatus?.['installation terminée'] || 0 // Utiliser ?.
                  },
                  chr: {
                    total: rawInstallationsStats.bySector?.['CHR']?.total || 0, // Utiliser ?.
                    enAttente: rawInstallationsStats.bySector?.['CHR']?.byStatus?.['rendez-vous à prendre'] || 0, // Utiliser ?.
                    planifiees: rawInstallationsStats.bySector?.['CHR']?.byStatus?.['rendez-vous pris'] || 0, // Utiliser ?.
                    terminees: rawInstallationsStats.bySector?.['CHR']?.byStatus?.['installation terminée'] || 0 // Utiliser ?.
                  },
                  tabac: {
                    total: rawInstallationsStats.bySector?.['Tabac']?.total || 0, // Utiliser ?.
                    enAttente: rawInstallationsStats.bySector?.['Tabac']?.byStatus?.['rendez-vous à prendre'] || 0, // Utiliser ?.
                    planifiees: rawInstallationsStats.bySector?.['Tabac']?.byStatus?.['rendez-vous pris'] || 0, // Utiliser ?.
                    terminees: rawInstallationsStats.bySector?.['Tabac']?.byStatus?.['installation terminée'] || 0 // Utiliser ?.
                  },
                  kezia: {
                    total: rawInstallationsStats.bySector?.['Kezia']?.total || 0, // Utiliser ?.
                    enAttente: rawInstallationsStats.bySector?.['Kezia']?.byStatus?.['rendez-vous à prendre'] || 0, // Utiliser ?.
                    planifiees: rawInstallationsStats.bySector?.['Kezia']?.byStatus?.['rendez-vous pris'] || 0, // Utiliser ?.
                    terminees: rawInstallationsStats.bySector?.['Kezia']?.byStatus?.['installation terminée'] || 0 // Utiliser ?.
                  }
                } : null;

                if (installationsSnapshotResult.status === 'rejected') {
                  console.error("Dashboard Loader: Error fetching installations snapshot:", installationsSnapshotResult.reason);
                  if (!clientError) clientError = "Erreur chargement statistiques installations.";
                }
                if (allInstallationsResult.status === 'rejected') {
                  console.error("Dashboard Loader: Error fetching all installations:", allInstallationsResult.reason);
                  if (!clientError) clientError = "Erreur chargement liste installations.";
                }

                if (recentTicketsResult.status === 'rejected') {
                  console.error("Dashboard Loader: Error fetching recent tickets:", recentTicketsResult.reason);
                  if (!clientError) clientError = "Erreur chargement tickets récents.";
                }
                if (recentShipmentsResult.status === 'rejected') {
                  console.error("Dashboard Loader: Error fetching recent shipments:", recentShipmentsResult.reason);
                  if (!clientError) clientError = "Erreur chargement envois récents.";
                }
                // Correction: Utiliser installationsSnapshotResult ici
                if (installationsSnapshotResult.status === 'rejected') {
                  console.error("Dashboard Loader: Error fetching installations stats:", installationsSnapshotResult.reason);
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
          allInstallations = [];
          sapTicketCountsBySector = null; // Réinitialiser en cas d'erreur
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
        allInstallations,
        recentTickets,
        recentShipments,
        clientError,
        sapTicketCountsBySector, // Inclure les comptes par secteur dans les données retournées
      });
    };
