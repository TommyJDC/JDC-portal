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
import { COLUMN_MAPPINGS } from "~/routes/api.sync-installations"; // Importer les mappings

interface ActionData {
  success?: boolean;
  error?: string;
}

interface LoaderData {
  installations: {
    id: string;
    [key: string]: any; // Accept any field for flexibility
  }[];
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
    const installations = installationsRaw.map(installation => {
      const data = installation as any; // Utiliser 'any' temporairement

      return {
        id: installation.id, // L'ID est toujours présent
        codeClient: data.codeClient || '',
        nom: data.nom || '',
        ville: data.ville || '',
        contact: data.contact || '', // Assurez-vous que cette clé existe dans Firestore pour HACCP
        telephone: data.telephone || '', // Assurez-vous que cette clé existe dans Firestore pour HACCP
        commercial: data.commercial || '',
        tech: data.tech || '', // Assurez-vous que cette clé existe dans Firestore pour HACCP
        status: data.status || '', // Assurez-vous que cette clé existe dans Firestore pour HACCP
        commentaire: data.commentaire || '',

        // Champs spécifiques HACCP
        // Récupérer les dates comme des chaînes brutes
        dateSignatureCde: data.dateSignatureCde ? String(data.dateSignatureCde) : '',
        dateCdeMateriel: data.dateCdeMateriel ? String(data.dateCdeMateriel) : '',
        dateInstall: data.dateInstall ? String(data.dateInstall) : '',
        materielPreParametrage: data.materielPreParametrage || '',
        dossier: data.dossier || '',
        materielLivre: data.materielLivre || '',
        numeroColis: data.numeroColis || '',
        commentaireInstall: data.commentaireInstall || '',
        identifiantMotDePasse: data.identifiantMotDePasse || '',
        numerosSondes: data.numerosSondes || '',
        install: data.install || 'Non', // Assurez-vous que cette clé existe dans Firestore pour HACCP
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

  const handleSave = async (id: string, updates: Partial<Installation>) => {
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
      <h1 className="text-2xl font-semibold text-white">Installations HACCP</h1>

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
            <InstallationHACCPTile
              key={installation.id}
              installation={installation}
              onSave={(values) => handleSave(installation.id, values)}
            />
          ))}
        </div>
      )}

      {!error && installations.length === 0 && (
        <p className="text-jdc-gray-400">Aucune installation HACCP à afficher.</p>
      )}
    </div>
  );
}
