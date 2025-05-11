import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node"; // Ajout de ActionFunctionArgs
import { json } from "@remix-run/node";
import { useLoaderData, Link, useFetcher, useOutletContext } from "@remix-run/react";
import { authenticator } from "~/services/auth.server";
import { getInstallationsBySector } from "~/services/firestore.service.server";
import InstallationListItem from "~/components/InstallationListItem";
import InstallationDetails from "~/components/InstallationDetails";
import type { Installation } from "~/types/firestore.types";
import type { UserSessionData } from "~/services/session.server"; // Correction du type
import { useState, useEffect } from 'react';
import { toast } from "react-hot-toast";

type OutletContextType = {
  user: UserSessionData | null; // Correction du type
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
    // Récupérer les installations depuis Firestore, en utilisant la casse correcte pour le secteur
    const installations = await getInstallationsBySector('chr'); // Modifié en minuscules
    return json<{ installations: Installation[] }>({ installations });
  } catch (error: any) {
    return json<{ installations: Installation[]; error: string }>({
      installations: [],
      error: error.message || "Erreur lors du chargement des installations CHR depuis Firestore."
    });
  }
};

export default function CHRInstallations() {
  const { user } = useOutletContext<OutletContextType>();
  const { installations, error } = useLoaderData<{ installations: Installation[]; error: string }>();
  const fetcher = useFetcher<ActionData>();
  const [searchTerm, setSearchTerm] = useState(''); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInstallation, setSelectedInstallation] = useState<Installation | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Si l'utilisateur n'est pas connecté, afficher un message convivial
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a1120] via-[#1a2250] to-[#1e2746] p-6 font-bold font-jetbrains">
        <h1 className="text-3xl font-extrabold text-jdc-yellow drop-shadow-neon mb-4">Installations CHR</h1>
        
        <div className="bg-[#10182a] p-6 rounded-xl shadow-xl border-2 border-jdc-yellow/20 text-center">
          <p className="text-jdc-yellow-200 mb-4">Vous devez être connecté pour accéder aux installations CHR.</p>
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

    // Ne soumettre que les champs qui ont changé et qui sont pertinents pour la sauvegarde.
    // L'ID est nécessaire pour identifier le document à mettre à jour.
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
        _action: "updateInstallation" // Pour identifier l'action si plusieurs existent
      },
      { method: "post" }
    );
    // Fermer la modale après la soumission, le rechargement des données se fera via Remix
    // ou manuellement si l'action retourne les données mises à jour.
    // Pour l'instant, on ferme la modale. L'UI pourrait afficher un indicateur de chargement.
    handleCloseModal(); 
    // Afficher un toast de succès ou d'attente
    toast.success("Mise à jour en cours..."); 
    // Idéalement, le fetcher.data contiendrait le résultat de l'action pour un feedback plus précis.
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
    <div className="space-y-6"> {/* Fond géré par root.tsx, p-6 est déjà sur le main dans root.tsx */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-text-primary">Installations CHR</h1>
        <Link to="/dashboard" className="text-sm text-brand-blue hover:text-brand-blue-light hover:underline">
          &larr; Retour au Tableau de Bord
        </Link>
      </div>

      {/* Champ de recherche */}
      <div className="relative">
        <input
          type="text"
          placeholder="Rechercher une installation..."
          className="w-full rounded-md bg-ui-background border-ui-border text-text-primary focus:border-brand-blue focus:ring-1 focus:ring-brand-blue py-2 pl-10 pr-3 text-sm shadow-sm placeholder-text-tertiary"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-text-tertiary absolute left-3 top-1/2 transform -translate-y-1/2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
      </div>

      {error && (
        <div className="p-4 rounded-md bg-red-500/10 border border-red-500/30 text-red-300">
          <p className="font-semibold text-sm">Erreur de chargement :</p>
          <p className="text-xs">{error}</p>
        </div>
      )}
      
      {isLoading && (
        <div className="p-6 rounded-lg bg-ui-surface border border-ui-border text-center text-text-secondary">
          <svg className="animate-spin h-6 w-6 text-brand-blue mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Chargement des installations...
        </div>
      )}

      {!error && !isLoading && filteredInstallations.length > 0 && (
        <div className="space-y-3"> {/* Réduction de l'espacement entre les items */}
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

      {!error && !isLoading && filteredInstallations.length === 0 && (
        <div className="p-6 rounded-lg bg-ui-surface border border-ui-border text-center text-text-secondary">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 mx-auto mb-3 text-text-tertiary">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          <p className="font-medium">Aucune installation CHR à afficher.</p>
          {searchTerm && <p className="text-xs mt-1">Essayez avec d'autres termes de recherche.</p>}
        </div>
      )}

      {/* Modale de détails */}
      {isModalOpen && selectedInstallation && (
        <InstallationDetails
          installation={selectedInstallation}
          onClose={handleCloseModal}
          onSave={() => handleSave(selectedInstallation)} // Adapter pour passer l'objet complet ou les updates
        />
      )}
    </div>
  );
}
