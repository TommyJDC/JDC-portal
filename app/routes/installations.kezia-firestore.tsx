import { useLoaderData, Link, useFetcher } from "@remix-run/react";
import type { Installation } from "~/types/firestore.types";
import InstallationTile from "~/components/InstallationTile";
import { loader } from "./installations.kezia-firestore.loader";
import type { LoaderData } from "./installations.kezia-firestore.loader";
import { useState } from 'react'; // Importer useState
import type { ActionData } from "./installations.kezia-firestore.action";
import { action } from "./installations.kezia-firestore.action";

export { loader, action };

export default function KeziaInstallationsFirestore() {
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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-white">
        Installations Kezia
      </h1>

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredInstallations.map((installation) => { // Utiliser la liste filtrée
          return (
            <InstallationTile
              key={installation.id}
              installation={installation}
              hasCTN={installation.hasCTN}
              onSave={(values) => handleSave(installation.id, values)}
            />
          );
        })}
      </div>

      {filteredInstallations.length === 0 && ( // Vérifier la longueur de la liste filtrée
        <p className="text-jdc-gray-400">Aucune installation à afficher.</p>
      )}
    </div>
  );
}
