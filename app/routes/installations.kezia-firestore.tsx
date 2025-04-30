import { useLoaderData, Link, useFetcher } from "@remix-run/react";
import type { Installation } from "~/types/firestore.types";
import InstallationListItem from "~/components/InstallationListItem"; // Importer le composant de liste
import InstallationDetails from "~/components/InstallationDetails"; // Importer le composant de détails
import { loader } from "./installations.kezia-firestore.loader";
import type { LoaderData } from "./installations.kezia-firestore.loader";
import { useState } from 'react';
import type { ActionData } from "./installations.kezia-firestore.action";
import { action } from "./installations.kezia-firestore.action";

export { loader, action };

export default function KeziaInstallationsFirestore() {
  const loaderData = useLoaderData<typeof loader>();
  const installations: Installation[] = loaderData.installations.map(inst => ({
    id: inst.id,
    secteur: inst.secteur,
    codeClient: inst.codeClient,
    nom: inst.nom,
    ville: inst.ville,
    contact: inst.contact,
    telephone: inst.telephone,
    commercial: inst.commercial,
    tech: inst.tech,
    status: inst.status || 'rendez-vous à prendre', // Fournir une valeur par défaut si undefined
    dateInstall: inst.dateInstall,
    commentaire: inst.commentaire,
    adresse: inst.adresse,
    codePostal: inst.codePostal,
    hasCTN: inst.hasCTN, // Inclure la propriété hasCTN
    // Assurez-vous d'inclure toutes les propriétés requises par le type Installation
  }));
  const error = loaderData.error;

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

  const handleInstallationClick = (installation: Installation) => {
    setSelectedInstallation(installation);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedInstallation(null);
  };

  // Filtrer les installations en fonction du terme de recherche
  const filteredInstallations = installations.filter(installation => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    // Utiliser l'opérateur ?. pour accéder aux propriétés potentiellement undefined
    return (
      installation.nom.toLowerCase().includes(lowerCaseSearchTerm) ||
      installation.codeClient.toLowerCase().includes(lowerCaseSearchTerm) ||
      installation.ville?.toLowerCase().includes(lowerCaseSearchTerm) ||
      installation.contact?.toLowerCase().includes(lowerCaseSearchTerm) ||
      installation.telephone?.toLowerCase().includes(lowerCaseSearchTerm) ||
      installation.commercial?.toLowerCase().includes(lowerCaseSearchTerm) || // Correction ici
      installation.tech?.toLowerCase().includes(lowerCaseSearchTerm) ||
      installation.commentaire?.toLowerCase().includes(lowerCaseSearchTerm)
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

      {/* Affichage en liste verticale */}
      <div className="space-y-4"> 
        {filteredInstallations.map((installation) => {
          return (
            <InstallationListItem
              key={installation.id}
              installation={installation}
              onClick={handleInstallationClick} // Gérer le clic
              hasCTN={installation.hasCTN} // Passer la prop hasCTN
            />
          );
        })}
      </div>

      {filteredInstallations.length === 0 && (
        <p className="text-jdc-gray-400">Aucune installation à afficher.</p>
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
