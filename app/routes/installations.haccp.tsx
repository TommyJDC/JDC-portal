import React, { useEffect, useState } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node"; // Ajout de ActionFunctionArgs
import { json } from "@remix-run/node";
import { useLoaderData, Link, useFetcher, useOutletContext, useNavigate } from "@remix-run/react"; // Ajout de useFetcher et useNavigate
import { authenticator } from "~/services/auth.server";
import { getInstallationsBySector, getTechnicians } from "~/services/firestore.service.server";
import InstallationListItem from "~/components/InstallationListItem";
import InstallationDetails from "~/components/InstallationDetails";
import type { Installation } from "~/types/firestore.types";
import type { UserSessionData } from "~/services/session.server"; // Correction du type
import { useToast } from "~/context/ToastContext";

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
    // Vérifier si l'utilisateur est authentifié
    const user = await authenticator.isAuthenticated(request);
    if (!user) {
      return json({ 
        installations: [], 
        technicians: [], 
        error: "Vous devez être connecté pour accéder à cette page." 
      });
    }

    // Vérifier si l'utilisateur a accès au secteur HACCP
    const userSectors = user.secteurs.map(s => s.toLowerCase());
    if (!userSectors.includes('haccp') && user.role !== 'Admin') {
      return json({ 
        installations: [], 
        technicians: [], 
        error: "Vous n'avez pas accès au secteur HACCP." 
      });
    }

    // Récupérer les installations depuis Firestore
    const installations = await getInstallationsBySector('haccp');
    
    // Transformer les données pour corriger le mapping
    const transformedInstallations = installations.map(installation => {
      // Fonction pour convertir la date au format JJ/MM en format ISO
      const formatDate = (dateStr: string | undefined) => {
        if (!dateStr) return '';
        // Si la date est au format "JJ/MM"
        if (dateStr.match(/^\d{2}\/\d{2}$/)) {
          const [day, month] = dateStr.split('/');
          return `2025-${month}-${day}`; // Format ISO: YYYY-MM-DD
        }
        return dateStr;
      };

      return {
        ...installation,
        // Correction des champs mal mappés
        codeClient: installation.nom || '', // Le numéro client était dans nom
        nom: installation.ville || '', // La raison sociale était dans ville
        ville: installation.adresse?.split(' ')[0] || '', // La ville est le premier mot de l'adresse
        adresse: installation.adresse?.split(' ').slice(1).join(' ') || '', // Le reste de l'adresse sans la ville
        telephone: installation.commercial || '', // Le téléphone était dans commercial
        commercial: installation.materielPreParametrage || '', // Le commercial était dans materielPreParametrage
        tech: installation.materielLivre || '', // Le technicien était dans materielLivre
        dateInstall: formatDate(installation.numeroColis), // La date d'installation était dans numeroColis
        dateCdeMateriel: formatDate(installation.codeClient), // La date commande matériel était dans codeClient
        commentaireInstall: installation.commentaire || '', // L'heure de RDV était dans commentaire
        status: installation.status === 'rendez-vous à prendre' ? 'En attente' : installation.status,
      };
    });

    // Récupérer les techniciens avec accès au secteur HACCP
    const technicians = await getTechnicians('haccp');
    
    return json<{ installations: Installation[]; technicians: { id: string; name: string }[] }>({ 
      installations: transformedInstallations,
      technicians 
    });
  } catch (error: any) {
    return json<{ installations: Installation[]; technicians: { id: string; name: string }[]; error: string }>({
      installations: [],
      technicians: [],
      error: error.message || "Erreur lors du chargement des installations HACCP depuis Firestore."
    });
  }
};

export default function HACCPInstallations() {
  const { user } = useOutletContext<OutletContextType>();
  const { installations, technicians, error } = useLoaderData<{ installations: Installation[]; technicians: { id: string; name: string }[]; error?: string }>();
  const fetcher = useFetcher<ActionData>();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInstallation, setSelectedInstallation] = useState<Installation | null>(null);
  const navigate = useNavigate(); // Ajout de useNavigate
  const { addToast } = useToast(); // Ajout de useToast

  // Vérifier l'accès au secteur et gérer la réponse du fetcher pour la sauvegarde
  useEffect(() => {
    if (user) {
      const userSectors = user.secteurs.map(s => s.toLowerCase());
      if (!userSectors.includes('haccp') && user.role !== 'Admin') {
        navigate('/dashboard');
      }
    }
  }, [user, navigate]);

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      if (fetcher.data.success && fetcher.data.installationId) {
        addToast({ type: 'success', message: "Installation HACCP mise à jour !" });
        handleCloseModal();
      } else if (fetcher.data.error) {
        addToast({ type: 'error', message: `Erreur HACCP: ${fetcher.data.error}` });
      }
    }
  }, [fetcher.state, fetcher.data, navigate, addToast]); // navigate et addToast ajoutés aux dépendances

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a1120] via-[#1a2250] to-[#1e2746] p-6 font-bold font-jetbrains">
        <h1 className="text-3xl font-extrabold text-jdc-yellow drop-shadow-neon mb-4">Installations HACCP</h1>
        <div className="bg-[#10182a] p-6 rounded-xl shadow-xl border-2 border-jdc-yellow/20 text-center">
          <p className="text-jdc-yellow-200 mb-4">Erreur lors du chargement des installations HACCP.</p>
          <Link 
            to="/dashboard" 
            className="inline-block bg-gradient-to-r from-jdc-blue to-jdc-blue-dark px-6 py-3 rounded-lg font-bold text-white shadow-lg hover:scale-105 transition-transform"
          >
            Retour au Tableau de Bord
          </Link>
        </div>
      </div>
    );
  }

  const handleSave = (id: string, updates: Partial<Installation>) => {
    if (!id) return;

    fetcher.submit(
      { 
        installationId: id, 
        updates: JSON.stringify(updates),
        _action: "updateInstallation"
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
    <div className="space-y-6"> {/* Fond géré par root.tsx */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-text-primary">Installations HACCP</h1>
        <Link to="/dashboard" className="text-sm text-brand-blue hover:text-brand-blue-light hover:underline">
          &larr; Retour au Tableau de Bord
        </Link>
      </div>
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
      {fetcher.state === "loading" && !installations.length && (
        <div className="p-6 rounded-lg bg-ui-surface border border-ui-border text-center text-text-secondary">
          <svg className="animate-spin h-6 w-6 text-brand-blue mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Chargement des installations...
        </div>
      )}
      {fetcher.state !== "loading" && filteredInstallations.length > 0 && (
        <div className="space-y-3">
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
      {fetcher.state !== "loading" && filteredInstallations.length === 0 && (
        <div className="p-6 rounded-lg bg-ui-surface border border-ui-border text-center text-text-secondary">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 mx-auto mb-3 text-text-tertiary">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          <p className="font-medium">Aucune installation HACCP à afficher.</p>
          {searchTerm && <p className="text-xs mt-1">Essayez avec d'autres termes de recherche.</p>}
        </div>
      )}
      {isModalOpen && selectedInstallation && (
        <InstallationDetails
          installation={selectedInstallation}
          onClose={handleCloseModal}
          onSave={handleSave}
          technicians={technicians}
        />
      )}
    </div>
  );
}
