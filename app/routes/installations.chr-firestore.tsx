import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Link, useFetcher } from "@remix-run/react";
import { authenticator } from "~/services/auth.server";
import { 
  getInstallationsBySector, 
  updateInstallation,
  deleteInstallation,
  bulkUpdateInstallations,
  getAllShipments // Importer la fonction pour récupérer les envois
} from "~/services/firestore.service.server";
import InstallationTile from "~/components/InstallationTile";
import type { Installation, Shipment } from "~/types/firestore.types"; // Importer les types
import { formatFirestoreDate } from "~/utils/dateUtils"; // Importer la fonction de formatage
import { COLUMN_MAPPINGS } from "~/routes/api.sync-installations"; // Importer les mappings

interface ActionData {
  success?: boolean;
  error?: string;
}

// Interface pour les données d'installation traitées, correspondant aux props de InstallationTile
interface ProcessedInstallation {
  id: string;
  codeClient: string;
  nom: string;
  ville?: string;
  contact?: string;
  telephone?: string;
  commercial?: string;
  dateInstall?: string; // Type attendu par InstallationTile
  tech?: string;
  status?: string;
  commentaire?: string;
  hasCTN: boolean; // Propriété ajoutée
  // Inclure d'autres champs si nécessaire, en s'assurant que les types correspondent
}

interface LoaderData {
  installations: ProcessedInstallation[]; // Utiliser le type traité
  error?: string;
}

export const action = async ({ request }: ActionFunctionArgs): Promise<Response> => {
  const session = await authenticator.isAuthenticated(request);
  if (!session) {
    return json({ error: "Non authentifié" }, { status: 401 });
  }

  const formData = await request.formData();
  const id = formData.get("id");
  const updates = JSON.parse(formData.get("updates") as string);

  if (!id || !updates) {
    return json({ error: "Données manquantes" }, { status: 400 });
  }

  try {
    await updateInstallation(id as string, updates);
    return json({ success: true });
  } catch (error: any) {
    console.error("[installations.chr Action] Error:", error);
    return json({ error: error.message }, { status: 500 });
  }
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const session = await authenticator.isAuthenticated(request);
  if (!session) {
    return redirect("/?error=unauthenticated");
  }

  try {
    // 1. Récupérer tous les envois
    const allShipments = await getAllShipments();
    
    // 2. Créer un Set des codeClient pour le secteur 'chr'
    const chrShipmentClientCodes = new Set<string>();
    allShipments.forEach((shipment: Shipment) => {
      // Assurez-vous que les champs existent et correspondent au secteur 'chr'
      if (shipment.secteur?.toLowerCase() === 'chr' && shipment.codeClient) {
        chrShipmentClientCodes.add(shipment.codeClient);
      }
    });

    // 3. Récupérer les installations CHR
    const installationsRaw = await getInstallationsBySector('chr');

    console.log(`[CHR Loader][DEBUG] installationsRaw from Firestore:`, installationsRaw);

    const sector = 'chr';
    const sectorMapping = COLUMN_MAPPINGS[sector];

    // 4. Mapper les données brutes, formater la date et ajouter la propriété hasCTN à chaque installation
    const installations: ProcessedInstallation[] = installationsRaw.map(installation => {
      const data = installation as any; // Utiliser 'any' temporairement pour accéder aux champs par index si nécessaire, bien que les noms de champs Firestore devraient correspondre aux clés du mapping

      // Accéder aux propriétés directement par leur nom, car les données de Firestore
      // sont déjà mappées avec les clés correctes par la fonction de synchronisation.
      return {
        id: installation.id, // L'ID est toujours présent
        codeClient: data.codeClient || '',
        nom: data.nom || '',
        ville: data.ville || '',
        contact: data.contact || '',
        telephone: data.telephone || '',
        commercial: data.commercial || '',
        tech: data.tech || '',
        status: data.status || '',
        commentaire: data.commentaire || '',
        
        // --- Champs traités ---
        // Récupérer les dates comme des chaînes brutes
        dateInstall: data.dateInstall ? String(data.dateInstall) : '', 
        hasCTN: chrShipmentClientCodes.has(data.codeClient), 
        
        // Inclure d'autres champs spécifiques au secteur si nécessaire
        configCaisse: data.configCaisse || '',
        cdc: data.cdc || '',
        integrationJalia: data.integrationJalia || '',
        dossier: data.dossier || '',
        heure: data.heure || '',
        commentaireTech: data.commentaireTech || '',
        materielLivre: data.materielLivre || '',
        commentaireEnvoiBT: data.commentaireEnvoiBT || '',
        techSecu: data.techSecu || '',
        techAffecte: data.techAffecte || '',
      };
    });

    return json<LoaderData>({ installations });
  } catch (error: any) {
    console.error("[installations.chr Loader] Error fetching data:", error);
    return json<LoaderData>({ 
      installations: [],
      error: error.message || "Erreur lors du chargement des installations CHR." 
    }, { status: 500 });
  }
};

export default function CHRInstallations() {
  const { installations, error } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<ActionData>();

  const handleSave = async (id: string, updates: any) => {
    fetcher.submit(
      {
        id,
        updates: JSON.stringify(updates)
      },
      { method: "post" }
    );
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-white">Installations CHR</h1>

      <Link to="/dashboard" className="text-jdc-blue hover:underline">
        &larr; Retour au Tableau de Bord
      </Link>

      {error && (
        <div className="bg-red-900 bg-opacity-50 text-red-300 p-4 rounded-md">
          <p className="font-semibold">Erreur :</p>
          <p>{error}</p>
        </div>
      )}

      {!error && installations.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {installations.map((installation) => (
            <InstallationTile
              key={installation.id}
              installation={installation}
              hasCTN={installation.hasCTN} // Passer la prop hasCTN
              onSave={(values) => handleSave(installation.id, values)}
            />
          ))}
        </div>
      )}

      {!error && installations.length === 0 && (
        <p className="text-jdc-gray-400">Aucune installation CHR à afficher.</p>
      )}
    </div>
  );
}
