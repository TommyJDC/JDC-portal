import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node"; // Ajout de ActionFunctionArgs
import { json } from "@remix-run/node";
import { useLoaderData, Link, useFetcher, useOutletContext } from "@remix-run/react"; // useFetcher était déjà là
import { authenticator } from "~/services/auth.server";
import { getInstallationsBySector } from "~/services/firestore.service.server";
import InstallationListItem from "~/components/InstallationListItem";
import InstallationDetails from "~/components/InstallationDetails";
import type { Installation } from "~/types/firestore.types";
import type { UserSession } from "~/services/session.server";
import { useState } from 'react';
import { toast } from "react-hot-toast";

type OutletContextType = {
  user: UserSession | null;
};

interface ActionData {
  success?: boolean;
  error?: string;
  installationId?: string;
  _action?: string;
}

import { updateInstallation } from "~/services/firestore.service.server"; // Importer la fonction de mise à jour

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const installationId = formData.get("installationId") as string;
  const updates = JSON.parse(formData.get("updates") as string) as Partial<Installation>;

  if (!installationId || !updates) {
    return json({ success: false, error: "Données manquantes pour la mise à jour." }, { status: 400 });
  }

  try {
    await updateInstallation(installationId, updates);
    return json({ success: true, installationId });
  } catch (error: any) {
    return json({ success: false, error: error.message || "Erreur lors de la mise à jour de l'installation." }, { status: 500 });
  }
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    // Récupérer les installations depuis Firestore
    const installations = await getInstallationsBySector('kezia'); // Modifié en minuscules
    return json<{ installations: Installation[] }>({ installations });
  } catch (error: any) {
    return json<{ installations: Installation[]; error: string }>({
      installations: [],
      error: error.message || "Erreur lors du chargement des installations Kezia depuis Firestore."
    });
  }
};

export default function KeziaInstallations() {
  const { user } = useOutletContext<OutletContextType>();
  const { installations, error } = useLoaderData<{ installations: Installation[]; error: string }>();
  const fetcher = useFetcher<ActionData>(); // fetcher était déjà utilisé implicitement par useActionData, mais on le déclare pour submit
  const [searchTerm, setSearchTerm] = useState(''); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInstallation, setSelectedInstallation] = useState<Installation | null>(null);

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a1120] via-[#1a2250] to-[#1e2746] p-6 font-bold font-jetbrains">
        <h1 className="text-3xl font-extrabold text-jdc-yellow drop-shadow-neon mb-4">Installations Kezia</h1>
        <div className="bg-[#10182a] p-6 rounded-xl shadow-xl border-2 border-jdc-yellow/20 text-center">
          <p className="text-jdc-yellow-200 mb-4">Vous devez être connecté pour accéder aux installations Kezia.</p>
          <Link 
            to="/auth/google" 
            className="inline-block bg-gradient-to-r from-jdc-blue to-jdc-blue-dark px-6 py-3 rounded-lg font-bold text-white shadow-lg hover:scale-105 transition-transform"
          >
            Se connecter avec Google
          </Link>
        </div>
      </div>
    );
  }

  const handleSave = async (updatedInstallation: Partial<Installation>) => {
    if (!selectedInstallation) return;

    const updatesToSubmit: Partial<Installation> = {
      dateInstall: updatedInstallation.dateInstall,
      tech: updatedInstallation.tech,
      status: updatedInstallation.status,
      commentaire: updatedInstallation.commentaire,
    };

    fetcher.submit(
      { 
        installationId: selectedInstallation.id, 
        updates: JSON.stringify(updatesToSubmit),
        _action: "updateInstallation"
      },
      { method: "post" }
    );
    handleCloseModal(); 
    toast.success("Mise à jour en cours..."); 
  };

  const handleInstallationClick = (installation: Installation) => {
    setSelectedInstallation(installation);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedInstallation(null);
  };

  const filteredInstallations = installations.filter(installation => {
    if (!searchTerm.trim()) return true;
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
    <div className="min-h-screen bg-gradient-to-br from-[#0a1120] via-[#1a2250] to-[#1e2746] p-6 font-bold font-jetbrains">
      <h1 className="text-3xl font-extrabold text-jdc-yellow drop-shadow-neon mb-4">Installations Kezia</h1>
      <Link to="/dashboard" className="text-jdc-blue font-bold hover:text-jdc-yellow transition-colors hover:underline drop-shadow-neon">
        &larr; Retour au Tableau de Bord
      </Link>
      <div className="mb-4 mt-4">
        <input
          type="text"
          placeholder="Rechercher par nom, code client, ville, contact, téléphone, commercial, technicien ou commentaire..."
          className="w-full px-4 py-3 bg-[#10182a] text-jdc-yellow font-bold border-2 border-jdc-yellow/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-jdc-yellow/60 text-lg font-jetbrains placeholder-jdc-yellow/40"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      {error && (
        <div className="bg-red-900/80 text-jdc-yellow p-4 rounded-xl font-bold shadow-xl">
          <p className="font-bold">Erreur :</p>
          <p>{error}</p>
        </div>
      )}
      {!error && filteredInstallations.length > 0 && (
        <div className="space-y-4 mt-4">
          {filteredInstallations.map((installation) => (
            <InstallationListItem 
              key={installation.id}
              installation={installation}
              onClick={handleInstallationClick} 
              hasCTN={installation.hasCTN ?? false}
            />
          ))}
        </div>
      )}
      {!error && filteredInstallations.length === 0 && (
        <div className="bg-[#10182a] p-6 rounded-xl shadow-xl border-2 border-jdc-yellow/20 mt-4 text-center">
          <p className="text-jdc-yellow-200 font-bold">Aucune installation Kezia à afficher.</p>
          {searchTerm && <p className="text-jdc-yellow-200 mt-2">Essayez avec d'autres termes de recherche.</p>}
        </div>
      )}
      {isModalOpen && selectedInstallation && (
        <InstallationDetails
          installation={selectedInstallation}
          onClose={handleCloseModal}
          onSave={() => handleSave(selectedInstallation)}
        />
      )}
    </div>
  );
}
