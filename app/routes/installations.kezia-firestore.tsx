import { useLoaderData, Link, useFetcher } from "@remix-run/react";
import type { Installation } from "~/types/firestore.types";
import InstallationTile from "~/components/InstallationTile";
import { loader } from "./installations.kezia-firestore.loader";
import type { LoaderData } from "./installations.kezia-firestore.loader";
import type { ActionData } from "./installations.kezia-firestore.action";
import { action } from "./installations.kezia-firestore.action";

export { loader, action };

export default function KeziaInstallationsFirestore() {
  // Ne plus déstructurer shippedClientCodes car il n'est plus retourné par le loader
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
      <h1 className="text-2xl font-semibold text-white">
        Installations Kezia
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
        {installations.map((installation) => {
          // hasCTN est maintenant directement une propriété de l'objet installation
          // Le formatage de date est également géré dans le loader
          return (
            <InstallationTile 
              key={installation.id}
              installation={installation} // L'objet installation inclut déjà hasCTN et dateInstall formatée
              hasCTN={installation.hasCTN} // Utiliser la prop hasCTN de l'objet installation
              onSave={(values) => handleSave(installation.id, values)}
            />
          );
        })}
      </div>

      {installations.length === 0 && (
        <p className="text-jdc-gray-400">Aucune installation à afficher.</p>
      )}
    </div>
  );
}
