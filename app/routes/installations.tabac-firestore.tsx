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
// Remplacer InstallationTile par InstallationListItem et InstallationDetails
import InstallationListItem from "~/components/InstallationListItem"; 
import InstallationDetails from "~/components/InstallationDetails"; 
import type { Installation, Shipment } from "~/types/firestore.types"; // Importer les types
import { formatFirestoreDate } from "~/utils/dateUtils"; // Importer la fonction de formatage
import { COLUMN_MAPPINGS } from "~/routes/api.sync-installations"; // Importer les mappings
import { useState } from 'react'; // Importer useState

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
  dateInstall?: string | Date; // Accepter string ou Date
  tech?: string;
  status?: string;
} // Supprimer cette accolade fermante de l'ancienne interface

// Plus besoin de ProcessedInstallation, on utilise Installation directement

// Le loader retourne directement des Installations
interface LoaderData {
  installations: Installation[]; 
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
    console.error("[installations.tabac Action] Error:", error);
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
    
    // 2. Créer un Set des codeClient pour le secteur 'tabac'
    const tabacShipmentClientCodes = new Set<string>();
    allShipments.forEach((shipment: Shipment) => {
      // Assurez-vous que les champs existent et correspondent au secteur 'tabac'
      if (shipment.secteur?.toLowerCase() === 'tabac' && shipment.codeClient) {
        tabacShipmentClientCodes.add(shipment.codeClient);
      }
    });

    // 3. Récupérer les installations Tabac
    const installationsRaw = await getInstallationsBySector('tabac');

    const sector = 'tabac';
    const sectorMapping = COLUMN_MAPPINGS[sector];

    // 4. Mapper les données brutes au type Installation standard
    const installations: Installation[] = installationsRaw.map(installation => {
      const data = installation as any; // Utiliser 'any' temporairement

      // Accéder aux propriétés directement par leur nom, car les données de Firestore
      // sont déjà mappées avec les clés correctes par la fonction de synchronisation.
      return {
        id: installation.id, // L'ID est toujours présent
        codeClient: data.codeClient || '',
        nom: data.nom || '',
        ville: data.ville || '',
        contact: data.contact || '', // Utiliser la clé directe
        telephone: data.telephone || '', // Utiliser la clé directe (assurez-vous que la synchronisation mappe coordonneesTel à telephone)
        commercial: data.commercial || '',
        tech: data.tech || '',
        // status: data.status || '', // Sera géré ci-dessous avec valeur par défaut
        commentaire: data.commentaire || '',
        
        // --- Champs traités ---
        dateInstall: data.dateInstall ? formatFirestoreDate(data.dateInstall) : undefined, // Retourne string ou undefined
        status: (data.status || 'À planifier') as Installation['status'], // Valeur par défaut et cast
        hasCTN: tabacShipmentClientCodes.has(data.codeClient), 
        secteur: 'tabac', // Ajouter le secteur
        
        // Champs spécifiques au secteur Tabac (non inclus dans Installation de base)
        dateSignatureCde: data.dateSignatureCde ? formatFirestoreDate(data.dateSignatureCde) : '', // Utiliser formatFirestoreDate
        materielBalance: data.materielBalance || '',
        offreTpe: data.offreTpe || '',
        cdc: data.cdc || '',
        typeInstall: data.typeInstall || '',
        commentaireEtatMateriel: data.commentaireEtatMateriel || '',
        // dateSignatureCde: data.dateSignatureCde ? formatFirestoreDate(data.dateSignatureCde) : undefined, 
        // materielBalance: data.materielBalance || '',
        // offreTpe: data.offreTpe || '',
        // cdc: data.cdc || '',
        // typeInstall: data.typeInstall || '',
        // commentaireEtatMateriel: data.commentaireEtatMateriel || '',
      };
    });

    return json<LoaderData>({ installations });
  } catch (error: any) {
    console.error("[installations.tabac Loader] Error fetching data:", error);
    return json<LoaderData>({ 
      installations: [],
      error: error.message || "Erreur lors du chargement des installations Tabac." 
    }, { status: 500 });
  }
};

export default function TabacInstallations() {
  const { installations, error } = useLoaderData<LoaderData>(); // Utiliser LoaderData qui contient Installation[]
  const fetcher = useFetcher<ActionData>();
  const [searchTerm, setSearchTerm] = useState(''); 
  const [isModalOpen, setIsModalOpen] = useState(false); // État pour la modale
  const [selectedInstallation, setSelectedInstallation] = useState<Installation | null>(null); // État pour l'installation sélectionnée

  const handleSave = async (id: string, updates: Partial<Installation>) => { // Utiliser Partial<Installation>
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
      installation.nom.toLowerCase().includes(lowerCaseSearchTerm) ||
      installation.codeClient.toLowerCase().includes(lowerCaseSearchTerm) ||
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
      <h1 className="text-2xl font-semibold text-white">Installations Tabac</h1>

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
        <p className="text-jdc-gray-400">Aucune installation Tabac à afficher.</p>
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
