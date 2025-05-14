import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
// import { authenticator } from "~/services/auth.server"; // Plus utilisé directement
import { sessionStorage, type UserSessionData } from "~/services/session.server"; // Importer sessionStorage et UserSessionData
import { getGoogleAuthClient, getCalendarEvents } from "~/services/google.server";
import { getCache, setCache } from "~/services/cache.server";
import { getWeekDateRangeForAgenda } from "~/utils/dateUtils";
import { triggerScheduledTasks } from "~/services/scheduledTasks.server"; // Réintégré
import {
  getUserProfileSdk,
  getRecentTicketsForSectors,
  getAllShipments,
  getDistinctClientCountFromEnvoiSdk,
  getLatestStatsSnapshotsSdk,
  getInstallationsSnapshot,
  getAllInstallations,
  getSapTicketCountBySectorSdk,
  getSapEvolution24h
} from "~/services/firestore.service.server";
import type { SapTicket, Shipment, StatsSnapshot, UserProfile, InstallationsDashboardStats, Installation } from "~/types/firestore.types";
// import type { UserSession } from "~/services/session.server"; // Remplacé par UserSessionData

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
    liveDistinctClientCountFromEnvoi: number | null;
    evolution: {
      distinctClientCountFromEnvoi: number | null;
    };
  };
  installationsStats: InstallationsDashboardStats | null;
  allInstallations: Installation[];
  recentTickets: SapTicket[];
  recentShipments: Shipment[];
  clientError: string | null;
  sapTicketCountsBySector: Record<string, number> | null;
  sapEvolution24h: {
    yesterday: Record<string, number>;
    current: Record<string, number>;
    evolution: Record<string, number>;
  } | null;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const cookieHeader = request.headers.get("Cookie");
  const sessionStore = await sessionStorage.getSession(cookieHeader);
  const userSession: UserSessionData | null = sessionStore.get("user") ?? null;

  const data: DashboardLoaderData = {
    userProfile: null,
    calendarEvents: [],
    calendarError: null,
    stats: { liveDistinctClientCountFromEnvoi: null, evolution: { distinctClientCountFromEnvoi: null } },
    installationsStats: null,
    allInstallations: [],
    recentTickets: [],
    recentShipments: [],
    clientError: null,
    sapTicketCountsBySector: null,
    sapEvolution24h: null
  };

  if (!userSession?.userId) return json(data); // Utiliser userSession

  // Déclencher les tâches planifiées (maintenant uniquement sap-notification)
  await triggerScheduledTasks();

  try {
    data.userProfile = await getUserProfileSdk(userSession.userId); // Utiliser userSession
    if (!data.userProfile) return redirect("/user-profile"); // Rediriger si le profil n'est pas trouvé après une session valide

    const userSectors = data.userProfile.secteurs || [];
    const sectorsForTickets = data.userProfile.role === 'Admin' ? ['CHR', 'HACCP', 'Kezia', 'Tabac'] : userSectors;
    const sectorsForShipments = data.userProfile.role === 'Admin' ? ['haccp', 'chr', 'tabac', 'kezia'] : userSectors; // Garder la casse si nécessaire pour Firestore

    // Chargement des données en parallèle
    // Chargement optimisé avec cache de 5 secondes pour les données fréquentes
    const cacheKey = `dashboard:${userSession.userId}`; // Utiliser userSession
    const cachedData = await getCache(cacheKey);
    
    if (cachedData) {
      console.log(`[dashboard.loader] Cache hit for ${cacheKey}`);
      return json(cachedData);
    }
    console.log(`[dashboard.loader] Cache miss for ${cacheKey}`);

    const [calendarData, firestoreData] = await Promise.allSettled([
      loadCalendarData(userSession), // Utiliser userSession
      loadFirestoreData(data.userProfile, sectorsForTickets, sectorsForShipments)
    ]);

  // Cache les données non sensibles pendant 5s
  await setCache(cacheKey, data, 5); // 'data' sera mis à jour ci-dessous

    if (calendarData.status === 'fulfilled') {
      data.calendarEvents = calendarData.value.events;
      data.calendarError = calendarData.value.error;
    } else {
      console.error("[dashboard.loader] Erreur loadCalendarData:", calendarData.reason);
      data.calendarError = getCalendarErrorMessage(calendarData.reason);
    }

    if (firestoreData.status === 'fulfilled' && firestoreData.value) {
      Object.assign(data, firestoreData.value);
    } else if (firestoreData.status === 'rejected') {
      console.error("[dashboard.loader] Erreur loadFirestoreData:", firestoreData.reason);
      data.clientError = "Erreur de chargement des données Firestore";
    }
    
    // Mettre en cache les données finales après assignation
    await setCache(cacheKey, data, 5);


  } catch (error) {
    console.error("Erreur principale du loader:", error);
    data.clientError = "Erreur lors du chargement des données";
  }

  return json(data);
};

async function loadCalendarData(session: UserSessionData) { // Changer UserSession en UserSessionData
  try {
    const authClient = await getGoogleAuthClient(session); // getGoogleAuthClient doit accepter UserSessionData
    const today = new Date();
    const { start, end } = getWeekDateRangeForAgenda(today);
    const rawEvents = await getCalendarEvents(authClient, start.toISOString(), end.toISOString());
    
    return {
      events: rawEvents.map(event => ({
        id: event.id,
        summary: event.summary,
        start: event.start,
        end: event.end,
        htmlLink: event.htmlLink
      })),
      error: null
    };
  } catch (error) {
    console.error("Erreur calendrier:", error);
    return { events: [], error: getCalendarErrorMessage(error) };
  }
}

async function loadFirestoreData(userProfile: UserProfile, sectorsForTickets: string[], sectorsForShipments: string[]) {
  try {
    console.log('[loadFirestoreData] Début du chargement des données avec:', {
      userRole: userProfile.role,
      userName: userProfile.nom,
      userSectors: userProfile.secteurs
    });

    const [sapTicketCounts, recentTickets, shipments, installations, statsSnapshot, clientCount, sapEvolution] = await Promise.all([
      getSapTicketCountBySectorSdk(sectorsForTickets),
      getRecentTicketsForSectors(sectorsForTickets, 5),
      getAllShipments(sectorsForShipments).then(s => s.slice(0, 5)),
      getAllInstallations(),
      getLatestStatsSnapshotsSdk(1),
      getDistinctClientCountFromEnvoiSdk(userProfile),
      getSapEvolution24h()
    ]);

    console.log('[loadFirestoreData] Données chargées:', {
      installationsCount: installations.length,
      hasStatsSnapshot: !!statsSnapshot,
      hasClientCount: clientCount !== null,
      hasSapEvolution: !!sapEvolution
    });

    const result: Partial<DashboardLoaderData> = {
      sapTicketCountsBySector: sapTicketCounts,
      recentTickets: recentTickets.map(cleanTicketDates),
      recentShipments: shipments,
      allInstallations: filterInstallations(installations, userProfile),
      stats: {
        liveDistinctClientCountFromEnvoi: clientCount,
        evolution: {
          distinctClientCountFromEnvoi: calculateClientEvolution(clientCount, statsSnapshot?.[0])
        }
      },
      sapEvolution24h: sapEvolution
    };

    const installationsData = await getInstallationsSnapshot(userProfile);
    console.log('[loadFirestoreData] Données d\'installations:', {
      hasInstallationsData: !!installationsData,
      installationsData
    });

    if (installationsData) {
      result.installationsStats = transformInstallationsData(installationsData);
    }

    return result;
  } catch (error) {
    console.error("[loadFirestoreData] Erreur Firestore:", error);
    return { clientError: "Erreur de chargement des données" };
  }
}

// Fonctions utilitaires
function cleanTicketDates(ticket: SapTicket) {
  return {
    ...ticket,
    contactAttempts: ticket.contactAttempts?.map(attempt => ({
      ...attempt,
      date: attempt.date // Les dates sont déjà formatées depuis Firestore
    }))
  };
}

function filterInstallations(installations: Installation[], userProfile: UserProfile) {
  console.log("[filterInstallations] Début du filtrage avec:", {
    totalInstallations: installations.length,
    userRole: userProfile.role,
    userName: userProfile.nom,
    userSectors: userProfile.secteurs
  });

  let filtered: Installation[];
  if (userProfile.role === 'Admin') {
    console.log("[filterInstallations] Utilisateur Admin - retourne toutes les installations");
    filtered = installations;
  } else if (userProfile.role === 'Technique') {
    filtered = installations.filter(inst => inst.tech === userProfile.nom);
    console.log("[filterInstallations] Filtrage Technique:", {
      techName: userProfile.nom,
      installationsAvantFiltrage: installations.length,
      installationsApresFiltrage: filtered.length
    });
  } else if (userProfile.role === 'Commercial') {
    filtered = installations.filter(inst => inst.commercial === userProfile.nom);
    console.log("[filterInstallations] Filtrage Commercial:", {
      commercialName: userProfile.nom,
      installationsAvantFiltrage: installations.length,
      installationsApresFiltrage: filtered.length
    });
  } else {
    filtered = installations.filter(inst => userProfile.secteurs?.includes(inst.secteur));
    console.log("[filterInstallations] Filtrage par secteurs:", {
      userSectors: userProfile.secteurs,
      installationsAvantFiltrage: installations.length,
      installationsApresFiltrage: filtered.length
    });
  }

  console.log("[filterInstallations] Résultat final:", {
    totalInstallations: filtered.length,
    secteurs: [...new Set(filtered.map(inst => inst.secteur))]
  });

  return filtered;
}

function calculateClientEvolution(currentCount: number | null, snapshot?: StatsSnapshot) {
  // Utiliser clientCount de StatsSnapshot au lieu de activeClients
  return currentCount !== null && snapshot && typeof snapshot.clientCount === 'number' 
    ? currentCount - snapshot.clientCount 
    : null;
}

function transformInstallationsData(data: any): InstallationsDashboardStats {
  console.log('[transformInstallationsData] Données reçues:', data);
  
  const result = {
    haccp: parseSectorData(data, 'HACCP'),
    chr: parseSectorData(data, 'CHR'),
    tabac: parseSectorData(data, 'Tabac'),
    kezia: parseSectorData(data, 'Kezia')
  };

  console.log('[transformInstallationsData] Données transformées:', result);
  return result;
}

function parseSectorData(data: any, sector: string) {
  const sectorKey = sector.toLowerCase();
  const sectorData = data.bySector?.[sectorKey];

  console.log(`[parseSectorData] Traitement du secteur ${sector}:`, {
    bySector: sectorData,
    total: sectorData?.total || 0,
    enAttente: sectorData?.byStatus?.['rendez-vous à prendre'] || 0,
    planifiees: sectorData?.byStatus?.['rendez-vous pris'] || 0,
    terminees: sectorData?.byStatus?.['installation terminée'] || 0
  });

  return {
    total: sectorData?.total || 0,
    enAttente: sectorData?.byStatus?.['rendez-vous à prendre'] || 0,
    planifiees: sectorData?.byStatus?.['rendez-vous pris'] || 0,
    terminees: sectorData?.byStatus?.['installation terminée'] || 0
  };
}

function getCalendarErrorMessage(error: any) {
  if (error.message?.includes("token")) return "Erreur d'authentification";
  if (error.message?.includes("Permission denied")) return "Accès refusé";
  if (error.message?.includes("Quota exceeded")) return "Quota dépassé";
  return "Erreur de récupération";
}
