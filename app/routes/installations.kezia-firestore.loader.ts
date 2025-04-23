import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { authenticator } from "~/services/auth.server";
import { 
  getInstallationsBySector, 
  getAllShipments // Importer la fonction pour récupérer tous les envois
} from "~/services/firestore.service.server";
import type { Installation, Shipment } from "~/types/firestore.types"; // Importer les types
import { formatFirestoreDate } from "~/utils/dateUtils"; // Importer la fonction de formatage
import { COLUMN_MAPPINGS } from "~/routes/api.sync-installations"; // Importer les mappings

// Interface pour les données d'installation traitées, correspondant aux props de InstallationTile
interface ProcessedInstallation {
  id: string;
  codeClient: string;
  nom: string;
  ville?: string;
  contact?: string;
  telephone?: string; // Champ générique attendu par InstallationTile
  commercial?: string;
  dateInstall?: string | Date; // Accepter string ou Date
  tech?: string;
  status?: string;
  commentaire?: string;
  hasCTN: boolean; // Propriété ajoutée
  // Inclure d'autres champs spécifiques si nécessaire, en s'assurant que les types correspondent
  configCaisse?: string;
  offreTpe?: string;
  cdc?: string;
  dossier?: string;
  personneContact?: string;
  materielEnvoye?: string;
  confirmationReception?: string;
}

export interface LoaderData {
  installations: ProcessedInstallation[]; // Utiliser le type traité
  error?: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const session = await authenticator.isAuthenticated(request);
  if (!session) {
    return redirect("/auth/google");
  }

  const sector = 'kezia';

  try {
    // 1. Récupérer tous les envois et les installations
    const [allShipments, installationsRaw] = await Promise.all([
      getAllShipments(),
      getInstallationsBySector(sector)
    ]);
    
    // 2. Créer un Set des codeClient pour le secteur 'kezia'
    const keziaShipmentClientCodes = new Set<string>();
    allShipments.forEach((shipment: Shipment) => {
      // Assurez-vous que les champs existent et correspondent au secteur 'kezia'
      if (shipment.secteur?.toLowerCase() === 'kezia' && shipment.codeClient) {
        keziaShipmentClientCodes.add(shipment.codeClient);
      }
    });

    const sectorMapping = COLUMN_MAPPINGS[sector];

    console.log(`[Kezia Loader][DEBUG] installationsRaw from Firestore:`, installationsRaw);

    // 3. Mapper les données brutes, formater la date et ajouter la propriété hasCTN à chaque installation
    const installations: ProcessedInstallation[] = installationsRaw.map(installation => {
      const data = installation as any; // Utiliser 'any' temporairement

      // Accéder aux propriétés directement par leur nom, car les données de Firestore
      // sont déjà mappées avec les clés correctes par la fonction de synchronisation.
      return {
        id: installation.id, // L'ID est toujours présent
        codeClient: data.codeClient || '',
        nom: data.nom || '',
        ville: data.ville || '',
        contact: data.contact || '', // Utiliser la clé directe
        telephone: data.telephone || '', // Utiliser la clé directe
        commercial: data.commercial || '',
        tech: data.tech || '',
        status: data.status || '', // Utiliser la clé directe
        commentaire: data.commentaire || '',
        
        // --- Champs traités ---
        dateInstall: data.dateInstall ? formatFirestoreDate(data.dateInstall) : '', // Utiliser formatFirestoreDate
        hasCTN: keziaShipmentClientCodes.has(data.codeClient), 
        
        // Inclure d'autres champs spécifiques au secteur Kezia si nécessaire
        configCaisse: data.configCaisse || '',
        offreTpe: data.offreTpe || '',
        cdc: data.cdc || '',
        dossier: data.dossier || '',
        materielEnvoye: data.materielEnvoye || '',
        confirmationReception: data.confirmationReception || '',
        colonne1: data.colonne1 || '', // Utiliser la clé directe
      };
    });

    return json<LoaderData>({ installations });
  } catch (error: any) {
    console.error(`Error loading ${sector} installations or shipments:`, error);
    return json<LoaderData>({ 
      installations: [], 
      error: `Erreur lors du chargement des installations ${sector}` 
    }, { status: 500 });
  }
};
