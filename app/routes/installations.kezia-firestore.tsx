import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { authenticator } from "~/services/auth.server";
import { getInstallationsBySector } from "~/services/firestore.service.server";
import InstallationTile from "~/components/InstallationTile";
import type { Installation } from "~/types/firestore.types";

interface LoaderData {
  installations: Installation[];
  error?: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const session = await authenticator.isAuthenticated(request);
  if (!session) {
    return redirect("/auth/google");
  }

  try {
    const installations = await getInstallationsBySector('kezia');
    return json({ installations });
  } catch (error) {
    console.error("Error loading Kezia installations:", error);
    return json({ 
      installations: [], 
      error: "Erreur lors du chargement des installations Kezia" 
    });
  }
};

export default function KeziaInstallationsFirestore() {
  const { installations, error } = useLoaderData<LoaderData>();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-white">
        Installations Kezia (Firestore)
      </h1>

      <Link to="/dashboard" className="text-jdc-blue hover:underline">
        &larr; Retour au Tableau de Bord
      </Link>

      {error && (
        <div className="bg-red-900 bg-opacity-50 text-red-300 p-4 rounded-md">
          <p className="font-semibold">Erreur :</p>
          <p>{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {installations.map((installation) => (
          <InstallationTile 
            key={installation.id}
            installation={installation}
            hasCTN={false}
            onSave={() => {}}
          />
        ))}
      </div>

      {installations.length === 0 && (
        <p className="text-jdc-gray-400">Aucune installation à afficher.</p>
      )}
    </div>
  );
}
