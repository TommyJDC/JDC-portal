import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
// import { authenticator } from "~/services/auth.server"; // Plus utilisé directement
import { sessionStorage, type UserSessionData } from "~/services/session.server"; // Importer pour session manuelle
import { getGoogleAuthClient, getCalendarEvents } from "~/services/google.server";
import { getWeekDateRangeForAgenda } from "~/utils/dateUtils";
import { 
  getUserProfileSdk, 
  getSapTicketCountBySectorSdk, 
  getRecentTicketsForSectors, 
  getDistinctClientCountFromEnvoiSdk, 
  getInstallationsSnapshot, 
  getAllInstallations,
  getAllShipments // Import Firestore shipments service
} from "~/services/firestore.service.server"; // Use Firestore SDK for user profile and other data
// L'import de blockchain.service.server et ses fonctions commentées sont entièrement supprimés
import type { UserProfile, SapTicket, Shipment, InstallationsSnapshot, Installation } from "~/types/firestore.types"; // Use Firestore types
// Keep blockchain types only if data is still fetched from blockchain (currently none for dashboard loader)
// import type { BlockchainSapTicket, BlockchainShipment, BlockchainInstallation } from "~/types/blockchain.types"; 
// import type { UserSession } from "~/services/session.server"; // Remplacé par UserSessionData

interface CalendarEvent {
  id: string;
  summary?: string | null;
  start?: { dateTime?: string | null; date?: string | null } | null;
  end?: { dateTime?: string | null; date?: string | null } | null;
  htmlLink?: string | null;
}

export interface DashboardLoaderData {
  userProfile: UserProfile | null; // Use Firestore UserProfile type
  calendarEvents: CalendarEvent[];
  calendarError: string | null;
  stats: {
    liveDistinctClientCountFromEnvoi: number | null;
    evolution: {
      distinctClientCountFromEnvoi: number | null;
    };
  };
  installationsStats: InstallationsSnapshot | null; // Use Firestore InstallationsSnapshot type
  allInstallations: Installation[]; // Use Firestore Installation type
  recentTickets: SapTicket[]; // Use Firestore SapTicket type
  recentShipments: Shipment[]; // Use Firestore Shipment type
  clientError: string | null;
  sapTicketCountsBySector: Record<string, number> | null;
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
    recentShipments: [], // Initialize with empty array of Firestore Shipment type
    clientError: null,
    sapTicketCountsBySector: null
  };

  if (!userSession?.userId) return json(data); // Utiliser userSession

  try {
    // Fetch user profile from Firestore
    data.userProfile = await getUserProfileSdk(userSession.userId); // Utiliser userSession
    if (!data.userProfile) return redirect("/user-profile");

    const userSectors = data.userProfile.secteurs || [];
    const sectorsForTickets = data.userProfile.role === 'Admin' ? ['CHR', 'HACCP', 'Kezia', 'Tabac'] : userSectors;
    // const sectorsForShipments = data.userProfile.role === 'Admin' ? ['haccp', 'chr', 'tabac', 'kezia'] : userSectors;

    const [calendarData, firestoreData] = await Promise.allSettled([
      loadCalendarData(userSession), // Utiliser userSession
      loadFirestoreData(data.userProfile, sectorsForTickets), 
    ]);

    if (calendarData.status === 'fulfilled') {
      data.calendarEvents = calendarData.value.events;
      data.calendarError = calendarData.value.error;
    }

    if (firestoreData.status === 'fulfilled') {
      // Merge Firestore data into the main data object
      Object.assign(data, firestoreData.value);
    } else if (firestoreData.status === 'rejected') {
      // Handle Firestore data loading errors
      console.error("Erreur lors du chargement des données Firestore:", firestoreData.reason);
      data.clientError = "Erreur lors du chargement des données"; // More generic error message
    }

  } catch (error) {
    console.error("Erreur principale du loader:", error);
    data.clientError = "Erreur lors du chargement des données"; // More generic error message
  }

  return json(data);
};

async function loadCalendarData(session: UserSessionData) { // Utiliser UserSessionData
  try {
    const authClient = await getGoogleAuthClient(session); // Assurer que getGoogleAuthClient accepte UserSessionData
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

async function loadFirestoreData(
  userProfile: UserProfile, // Use Firestore UserProfile type here
  sectorsForTickets: string[]
) {
  try {
    const [
      sapTicketCounts,
      recentTickets,
      distinctClientCount,
      installationsStats,
      allInstallations, // Fetch all installations from Firestore
      recentShipments // Fetch recent shipments from Firestore
    ] = await Promise.all([
      getSapTicketCountBySectorSdk(sectorsForTickets), // Use Firestore SDK
      getRecentTicketsForSectors(sectorsForTickets, 5), // Use Firestore SDK
      getDistinctClientCountFromEnvoiSdk(userProfile), // Use Firestore SDK
      getInstallationsSnapshot(userProfile), // Use Firestore SDK
      getAllInstallations(), // Use Firestore SDK
      getAllShipments() // Use Firestore SDK to get all shipments (need to filter/limit later if needed)
    ]);

    // Filter and limit recent shipments if necessary (e.g., by date or count)
    // For now, just return all shipments fetched by getAllShipments
    const limitedRecentShipments = recentShipments.slice(0, 5); // Example: limit to 5

    return {
      sapTicketCountsBySector: sapTicketCounts,
      recentTickets,
      stats: {
        liveDistinctClientCountFromEnvoi: distinctClientCount,
        evolution: {
          distinctClientCountFromEnvoi: null // Evolution stats might need a different approach with Firestore
        }
      },
      installationsStats,
      allInstallations, // Include all installations from Firestore
      recentShipments: limitedRecentShipments // Include recent shipments
    };
  } catch (error) {
    console.error("Erreur Firestore (avec envois):", error);
    // Return partial data or an error indicator
    return { 
      clientError: "Erreur de chargement des données Firestore (avec envois)",
      sapTicketCountsBySector: null,
      recentTickets: [],
      stats: { liveDistinctClientCountFromEnvoi: null, evolution: { distinctClientCountFromEnvoi: null } },
      installationsStats: null,
      allInstallations: [],
      recentShipments: [] // Return empty array for shipments on error
    };
  }
}

function getCalendarErrorMessage(error: any) {
  if (error.message?.includes("token")) return "Erreur d'authentification";
  if (error.message?.includes("Permission denied")) return "Accès refusé";
  if (error.message?.includes("Quota exceeded")) return "Quota dépassé";
  return "Erreur de récupération";
}
