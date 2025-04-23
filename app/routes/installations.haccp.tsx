import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Link, useFetcher } from "@remix-run/react";
import { authenticator } from "~/services/auth.server";
import { 
  getInstallationsBySector, 
  updateInstallation,
  deleteInstallation,
  bulkUpdateInstallations
} from "~/services/firestore.service.server";
import { useState, useEffect, useMemo } from "react";
import InstallationHACCPTile from "~/components/InstallationHACCPTile";
import type { Installation } from "~/types/firestore.types";
import { formatFirestoreDate } from "~/utils/dateUtils"; // Importer la fonction de formatage
import { COLUMN_MAPPINGS } from "~/routes/api.sync-installations"; // Importer les mappings

interface ActionData {
  success?: boolean;
  error?: string;
}

// Interface pour les données d'installation HACCP traitées
interface ProcessedInstallationHACCP {
  id: string;
  codeClient: string;
  nom: string;
  ville?: string;
  contact?: string;
  telephone?: string;
  commercial?: string;
  dateInstall?: string | Date; // Type attendu par InstallationHACCPTile
  tech?: string;
  status?: string;
  commentaire?: string;
  dateCdeMateriel?: string | Date; // Champ spécifique HACCP
  configCaisse?: string; // Champ spécifique HACCP
  offreTpe?: string; // Champ spécifique HACCP
  install?: string; // Champ spécifique HACCP
  [key: string]: any; // Permettre d'autres champs spécifiques au loader si nécessaire
}


interface LoaderData {
  installations: ProcessedInstallationHACCP[]; // Utiliser le type traité spécifique à HACCP
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
    const installationsRaw = await getInstallationsBySector('haccp');
    const sector = 'haccp';
    const sectorMapping = COLUMN_MAPPINGS[sector];

    // Mapper les données brutes de Firestore aux clés attendues par InstallationHACCPTile
    const installations: ProcessedInstallationHACCP[] = installationsRaw.map(installation => {
      const data = installation as any; // Utiliser 'any' temporairement

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

        // Champs spécifiques HACCP
        dateSignatureCde: data.dateSignatureCde ? formatFirestoreDate(data.dateSignatureCde) : '', 
        dateCdeMateriel: data.dateCdeMateriel ? formatFirestoreDate(data.dateCdeMateriel) : '', 
        dateInstall: data.dateInstall ? formatFirestoreDate(data.dateInstall) : '', 
        materielPreParametrage: data.materielPreParametrage || '',
        dossier: data.dossier || '',
        materielLivre: data.materielLivre || '',
        numeroColis: data.numeroColis || '',
        commentaireInstall: data.commentaireInstall || '',
        identifiantMotDePasse: data.identifiantMotDePasse || '',
        numerosSondes: data.numerosSondes || '',
        install: data.install || 'Non', 
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
  const { installations, error } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<ActionData>();
  const [searchTerm, setSearchTerm] = useState(''); // Ajouter l'état pour le terme de recherche

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

      {!error && filteredInstallations.length > 0 && ( // Utiliser la liste filtrée
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInstallations.map((installation) => ( // Utiliser la liste filtrée
            <InstallationHACCPTile
              key={installation.id}
              installation={installation}
              onSave={(values) => handleSave(installation.id, values)}
            />
          ))}
        </div>
      )}

      {!error && filteredInstallations.length === 0 && ( // Vérifier la longueur de la liste filtrée
        <p className="text-jdc-gray-400">Aucune installation HACCP à afficher.</p>
      )}
    </div>
  );
}
