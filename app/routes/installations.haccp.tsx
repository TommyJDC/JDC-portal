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
import { useState } from "react"; // useEffect et useMemo ne sont plus nécessaires ici
// Remplacer InstallationHACCPTile par InstallationListItem et InstallationDetails
import InstallationListItem from "~/components/InstallationListItem"; 
import InstallationDetails from "~/components/InstallationDetails"; 
import type { Installation, Shipment } from "~/types/firestore.types"; // Importer Shipment
import { formatFirestoreDate } from "~/utils/dateUtils"; // Importer la fonction de formatage
import { COLUMN_MAPPINGS } from "~/routes/api.sync-installations"; // Importer les mappings

interface ActionData {
  success?: boolean;
  error?: string;
}

// Plus besoin de ProcessedInstallationHACCP, on utilise Installation directement

// Le loader retourne directement des Installations
interface LoaderData {
  installations: Installation[]; 
  error?: string;
}

// Action pour la sauvegarde
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
    console.error("[installations.haccp Action] Error:", error);
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
    
    // 2. Créer un Set des codeClient pour le secteur 'haccp'
    const haccpShipmentClientCodes = new Set<string>();
    allShipments.forEach((shipment: Shipment) => {
      if (shipment.secteur?.toLowerCase() === 'haccp' && shipment.codeClient) {
        haccpShipmentClientCodes.add(shipment.codeClient);
      }
    });

    // 3. Récupérer les installations HACCP
    const installationsRaw = await getInstallationsBySector('haccp');
    const sector = 'haccp';
    const sectorMapping = COLUMN_MAPPINGS[sector];

    // 4. Mapper les données brutes au type Installation standard
    const installations: Installation[] = installationsRaw.map(installation => {
      const data = installation as any; // Utiliser 'any' temporairement

      return {
        id: installation.id, 
        codeClient: data.codeClient || '',
        nom: data.nom || '',
        ville: data.ville || '',
        contact: data.contact || '', 
        telephone: data.telephone || '', 
        commercial: data.commercial || '',
        tech: data.tech || '', 
        // status: data.status || '', // Supprimer cette ligne dupliquée
        commentaire: data.commentaire || '',

        // Champs spécifiques HACCP (non inclus dans le type Installation de base)
        // dateSignatureCde: data.dateSignatureCde ? formatFirestoreDate(data.dateSignatureCde) : undefined, 
        // dateCdeMateriel: data.dateCdeMateriel ? formatFirestoreDate(data.dateCdeMateriel) : undefined, 
        // materielPreParametrage: data.materielPreParametrage || '',
        // dossier: data.dossier || '',
        // materielLivre: data.materielLivre || '',
        // numeroColis: data.numeroColis || '',
        // commentaireInstall: data.commentaireInstall || '',
        // identifiantMotDePasse: data.identifiantMotDePasse || '',
        // numerosSondes: data.numerosSondes || '',
        // install: data.install || 'Non', 

        // Champs traités pour correspondre à Installation
        dateInstall: data.dateInstall ? formatFirestoreDate(data.dateInstall) : undefined, 
        status: (data.status || 'À planifier') as Installation['status'], // Valeur par défaut et cast
        hasCTN: haccpShipmentClientCodes.has(data.codeClient), // Ajouter la logique hasCTN
        secteur: 'haccp', // Ajouter le secteur
      };
    });

    return json<LoaderData>({ installations });
  } catch (error: any) {
    console.error("[installations.haccp Loader] Error:", error);
    return json<LoaderData>({ 
      installations: [],
      error: error.message || "Erreur lors du chargement des installations HACCP." 
    }, { status: 500 });
  }
};

// --- Component ---
export default function HACCPInstallations() {
  const { installations, error } = useLoaderData<LoaderData>(); // Utiliser LoaderData qui contient Installation[]
  const fetcher = useFetcher<ActionData>();
  const [searchTerm, setSearchTerm] = useState(''); 
  const [isModalOpen, setIsModalOpen] = useState(false); // État pour la modale
  const [selectedInstallation, setSelectedInstallation] = useState<Installation | null>(null); // État pour l'installation sélectionnée

  const handleSave = async (id: string, updates: Partial<Installation>) => {
    fetcher.submit(
      {
        id,
        updates: JSON.stringify(updates)
      },
      { method: "post" }
    );
  };

  // Filtrer les installations en fonction du terme de recherche
  const filteredInstallations = installations.filter(installation => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    return (
      (installation.nom && installation.nom.toLowerCase().includes(lowerCaseSearchTerm)) ||
      (installation.codeClient && installation.codeClient.toLowerCase().includes(lowerCaseSearchTerm)) ||
      (installation.ville && installation.ville.toLowerCase().includes(lowerCaseSearchTerm)) ||
      (installation.contact && installation.contact.toLowerCase().includes(lowerCaseSearchTerm)) ||
      (installation.telephone && installation.telephone.toLowerCase().includes(lowerCaseSearchTerm)) ||
      (installation.commercial && installation.commercial.toLowerCase().includes(lowerCaseSearchTerm)) ||
      (installation.tech && installation.tech.toLowerCase().includes(lowerCaseSearchTerm)) ||
      (installation.commentaire && installation.commentaire.toLowerCase().includes(lowerCaseSearchTerm))
    );
  });

  const handleInstallationClick = (installation: Installation) => {
    setSelectedInstallation(installation);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedInstallation(null);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-white">Installations HACCP</h1>

      <Link to="/dashboard" className="text-jdc-blue hover:underline">
        &larr; Retour au Tableau de Bord
      </Link>

      {/* Champ de recherche */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Rechercher par nom, code client, ville, contact, téléphone, commercial, technicien ou commentaire..."
          className="w-full px-3 py-2 bg-black text-white font-bold border rounded-md focus:outline-none focus:ring focus:border-blue-300"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {error && (
        <div className="bg-red-900 bg-opacity-50 text-red-300 p-4 rounded-md">
          <p className="font-semibold">Erreur :</p>
          <p>{error}</p>
        </div>
      )}

      {!error && filteredInstallations.length > 0 && (
        <div className="space-y-4"> {/* Rétablir l'affichage en liste verticale */}
          {filteredInstallations.map((installation) => (
            <InstallationListItem 
              key={installation.id}
              installation={installation}
              onClick={handleInstallationClick} 
              hasCTN={installation.hasCTN} 
            />
          ))}
        </div>
      )}

      {!error && filteredInstallations.length === 0 && (
        <p className="text-jdc-gray-400">Aucune installation HACCP à afficher.</p>
      )}

      {/* Modale de détails */}
      {isModalOpen && selectedInstallation && (
        <InstallationDetails
          installation={selectedInstallation}
          onClose={handleCloseModal}
          onSave={handleSave} // Passer la fonction handleSave
        />
      )}
    </div>
  );
}
