import { getDb } from "~/firebase.admin.config.server"; // Modifié l'import
import type { SAPArchive } from "~/types/firestore.types";
import { Timestamp } from 'firebase/firestore'; // Import Timestamp from firebase/firestore
import type { LoaderFunctionArgs } from "@remix-run/node"; // Importer le type LoaderFunctionArgs
import { json } from "@remix-run/node";
import { sessionStorage, type UserSessionData } from "~/services/session.server";

export interface SapArchiveLoaderData {
  archivedTickets: SAPArchive[];
  error: string | null;
}

// Helper function to safely extract string values from { stringValue: string } or simple strings
function getSafeStringValue(prop: { stringValue: string } | string | undefined | null, defaultValue: string = ''): string {
  if (prop === undefined || prop === null) {
    return defaultValue;
  }
  if (typeof prop === 'string') {
    return prop;
  }
  if (typeof prop === 'object' && prop !== null && 'stringValue' in prop && typeof prop.stringValue === 'string') {
    return prop.stringValue;
  }
  return defaultValue;
}


async function getArchivedSapTickets(): Promise<SAPArchive[]> {
  try {
    const db = getDb(); // Remplacé initializeFirebaseAdmin par getDb et supprimé await
    const snapshot = await db.collection("sap-archive").get();

    const archivedTickets: SAPArchive[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      archivedTickets.push({
        originalTicketId: data.originalTicketId,
        archivedDate: data.archivedDate instanceof Timestamp ? data.archivedDate.toDate() : data.archivedDate, // Convertir Timestamp en Date
        closureReason: data.closureReason as 'resolved' | 'no-response', // Assurer le type correct
        technicianNotes: getSafeStringValue(data.technicianNotes), // Utiliser la fonction helper
        technician: getSafeStringValue(data.technician, 'Technicien inconnu'), // Utiliser la fonction helper, ajouter une valeur par défaut
        // Extraire les valeurs des champs { stringValue: string }
        client: { stringValue: getSafeStringValue(data.client) }, // Assurer le format { stringValue: string }
        raisonSociale: { stringValue: getSafeStringValue(data.raisonSociale) }, // Assurer le format { stringValue: string }
        description: { stringValue: getSafeStringValue(data.description) }, // Assurer le format { stringValue: string }
        secteur: data.secteur as 'CHR' | 'HACCP' | 'Kezia' | 'Tabac', // Assurer le type correct
        numeroSAP: { stringValue: getSafeStringValue(data.numeroSAP) }, // Assurer le format { stringValue: string }
        mailId: getSafeStringValue(data.mailId), // Utiliser la fonction helper
        documents: Array.isArray(data.documents) ? data.documents.map((doc: any) => getSafeStringValue(doc)) : [], // Assurer que documents est un tableau de strings
      });
    });

    return archivedTickets;
  } catch (error) {
    console.error("Erreur lors de la récupération des tickets archivés :", error);
    return [];
  }
}

// Ajouter la fonction loader pour appeler getArchivedSapTickets côté serveur
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const cookieHeader = request.headers.get("Cookie");
  let userSession: UserSessionData | null = null;
  
  if (cookieHeader) {
    try {
      const sessionStore = await sessionStorage.getSession(cookieHeader);
      userSession = sessionStore.get("user") ?? null;
      if (!userSession?.userId) {
        return json<SapArchiveLoaderData>({ archivedTickets: [], error: "Utilisateur non authentifié." });
      }
    } catch (e) {
      console.error("SAP Archive Loader: Erreur lors de la lecture de la session:", e);
      return json<SapArchiveLoaderData>({ archivedTickets: [], error: "Erreur d'authentification." });
    }
  } else {
    return json<SapArchiveLoaderData>({ archivedTickets: [], error: "Session non trouvée." });
  }

  const archivedTickets = await getArchivedSapTickets();
  return json<SapArchiveLoaderData>({ archivedTickets, error: null });
};
