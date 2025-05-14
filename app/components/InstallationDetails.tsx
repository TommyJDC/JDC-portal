import React, { useState, useEffect } from 'react';
import type { Installation, InstallationStatus } from '~/types/firestore.types';
import { FaTimes, FaMapMarkerAlt, FaPhone, FaUserTie, FaInfoCircle, FaCalendarAlt, FaCommentDots, FaBuilding, FaSave, FaSpinner } from 'react-icons/fa';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Textarea } from './ui/Textarea';
import { useFetcher } from '@remix-run/react';
import { getStatusColor, getStatusIcon } from '~/utils/styleUtils';

interface ActionData {
  success?: boolean;
  error?: string;
  installationId?: string;
}

interface InstallationDetailsProps {
  installation: Installation;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Installation>) => void;
  technicians: { id: string; name: string }[];
}

const InstallationDetails: React.FC<InstallationDetailsProps> = ({ installation, onClose, onSave, technicians }) => {
  const fetcher = useFetcher<ActionData>();
  const [editableInstallation, setEditableInstallation] = useState<Partial<Installation>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setEditableInstallation({
      // Champs originaux
      status: installation.status,
      dateInstall: installation.dateInstall,
      dateCdeMateriel: installation.dateCdeMateriel,
      commentaire: installation.commentaire,
      contact: installation.contact,
      telephone: installation.telephone,
      commercial: installation.commercial,
      tech: installation.tech,
      adresse: installation.adresse,
      codePostal: installation.codePostal,
      ville: installation.ville,
      nom: installation.nom,
      codeClient: installation.codeClient,
      // Champs HACCP
      materielPreParametrage: installation.materielPreParametrage,
      materielLivre: installation.materielLivre,
      numeroColis: installation.numeroColis,
      dossier: installation.dossier,
      identifiantMotDePasse: installation.identifiantMotDePasse,
      numerosSondes: installation.numerosSondes,
      commentaireInstall: installation.commentaireInstall,
    });
    setIsEditing(false);
  }, [installation]);

  useEffect(() => {
    if (fetcher.data) {
      if (fetcher.data.success) {
        onClose();
      } else {
        setSaveError(fetcher.data.error || 'Erreur lors de la sauvegarde');
      }
    }
  }, [fetcher.data, onClose]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    // Gestion spéciale pour les champs HACCP
    if (installation.secteur && installation.secteur === 'haccp') {
      if (name === 'dateInstall') {
        setEditableInstallation(prevState => ({ 
          ...prevState, 
          numeroColis: value // La date d'installation est stockée dans numeroColis
        }));
      } else if (name === 'dateCdeMateriel') {
        setEditableInstallation(prevState => ({ 
          ...prevState, 
          codeClient: value // La date de commande est stockée dans codeClient
        }));
      } else if (name === 'commercial') {
        setEditableInstallation(prevState => ({ 
          ...prevState, 
          materielPreParametrage: value // Le commercial est stocké dans materielPreParametrage
        }));
      } else if (name === 'tech') {
        setEditableInstallation(prevState => ({ 
          ...prevState, 
          materielLivre: value // Le technicien est stocké dans materielLivre
        }));
      } else if (name === 'telephone') {
        setEditableInstallation(prevState => ({ 
          ...prevState, 
          commercial: value // Le téléphone est stocké dans commercial
        }));
      } else if (name === 'nom') {
        setEditableInstallation(prevState => ({ 
          ...prevState, 
          ville: value // La raison sociale est stockée dans ville
        }));
      } else if (name === 'codeClient') {
        setEditableInstallation(prevState => ({ 
          ...prevState, 
          nom: value // Le numéro client est stocké dans nom
        }));
      } else {
        setEditableInstallation(prevState => ({ ...prevState, [name]: value }));
      }
    } else {
      setEditableInstallation(prevState => ({ ...prevState, [name]: value }));
    }
    if (!isEditing) setIsEditing(true);
  };

  const handleSaveClick = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaveError(null);
    let updates = { ...editableInstallation };

    // Mapping spécial pour HACCP
    if (installation.secteur && installation.secteur === 'haccp') {
      updates = {
        ...updates,
        dateInstall: editableInstallation.numeroColis,
        dateCdeMateriel: editableInstallation.codeClient,
        commercial: editableInstallation.telephone,
        tech: editableInstallation.materielLivre,
        ville: editableInstallation.nom,
        nom: editableInstallation.codeClient,
      };
    }

    // Vérifier que les champs obligatoires sont remplis
    if (!updates.nom || !updates.codeClient) {
      setSaveError('Le nom et le code client sont obligatoires');
      return;
    }

    onSave(installation.id, updates);
  };

  const installationStatuses: InstallationStatus[] = ['rendez-vous à prendre', 'rendez-vous pris', 'installation terminée'];
  const isSaving = fetcher.state === 'submitting';
  const currentStatus = (editableInstallation.status || installation.status) as InstallationStatus | undefined;
  const statusColor = getStatusColor(currentStatus);
  const StatusIcon = getStatusIcon(currentStatus);

  // Helper pour formater la date pour l'input type="date"
  const formatDateForInput = (dateValue: string | Date | undefined | null): string => {
    if (!dateValue) return '';
    try {
      // Si la date est au format "JJ/MM"
      if (typeof dateValue === 'string' && dateValue.match(/^\d{2}\/\d{2}$/)) {
        const [day, month] = dateValue.split('/');
        return `2025-${month}-${day}`; // Format ISO: YYYY-MM-DD
      }
      // Si la date est au format "JJ/MM/YYYY"
      if (typeof dateValue === 'string' && dateValue.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
        const [day, month, year] = dateValue.split('/');
        return `${year}-${month}-${day}`; // Format ISO: YYYY-MM-DD
      }
      // Si c'est un objet Date
      if (dateValue instanceof Date) {
        return dateValue.toISOString().split('T')[0];
      }
      // Si c'est une chaîne au format ISO
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
      return '';
    } catch (e) {
      return '';
    }
  };

  // Helper pour formater la date pour l'affichage
  const formatDateForDisplay = (dateValue: string | Date | undefined | null): string => {
    if (!dateValue) return '';
    try {
      // Si la date est au format "JJ/MM"
      if (typeof dateValue === 'string' && dateValue.match(/^\d{2}\/\d{2}$/)) {
        return `${dateValue}/2025`;
      }
      // Si la date est au format "JJ/MM/YYYY"
      if (typeof dateValue === 'string' && dateValue.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
        return dateValue;
      }
      // Si c'est un objet Date ou une chaîne ISO
      const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('fr-FR');
      }
      return '';
    } catch (e) {
      return '';
    }
  };

  // Helper pour obtenir la raison sociale
  const getRaisonSociale = () => {
    // Si c'est une installation HACCP, utiliser le champ telephone
    if (installation.secteur && installation.secteur === 'haccp') {
      return installation.telephone || 'Client sans nom';
    }
    // Sinon utiliser le champ nom normal
    return installation.nom || 'Client sans nom';
  };

  // Helper pour obtenir le code client
  const getCodeClient = () => {
    // Si c'est une installation HACCP, utiliser le champ ville
    if (installation.secteur && installation.secteur === 'haccp') {
      return installation.ville || 'Code inconnu';
    }
    // Sinon utiliser le champ codeClient normal
    return installation.codeClient || 'Code inconnu';
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <fetcher.Form method="post" onSubmit={handleSaveClick} className="bg-ui-surface/90 backdrop-blur-lg border border-ui-border/70 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 sm:p-5 border-b border-ui-border/50 sticky top-0 bg-ui-surface/80 backdrop-blur-md z-10">
          <h2 className="text-lg font-semibold text-text-primary flex items-center">
            <FaBuilding className="mr-2 text-brand-blue h-5 w-5" /> Détails - {getRaisonSociale()} ({getCodeClient()})
          </h2>
          <div className="flex items-center">
            {isSaving && <FaSpinner className="mr-3 text-brand-blue animate-spin" title="Sauvegarde en cours..." />}
            <button type="button" onClick={onClose} className="text-text-secondary hover:text-text-primary p-1 rounded-md hover:bg-white/10" disabled={isSaving}>
              <FaTimes className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Error Message */}
        {saveError && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-2 text-sm">
            {saveError}
          </div>
        )}

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-grow text-sm">
          {/* Section Informations Client */}
          <section>
            <h3 className="text-xs font-semibold uppercase text-text-tertiary mb-2">Client & Contact</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3 bg-ui-background/50 p-3 rounded-md border border-ui-border/50">
              <div className="flex items-start space-x-2">
                <FaBuilding className="text-brand-blue mt-0.5 flex-shrink-0 h-4 w-4" />
                <div className="w-full">
                  <p className="font-medium text-text-secondary text-xs">Raison Sociale</p>
                  <Input 
                    id="nom" 
                    name="nom" 
                    value={editableInstallation.nom || ''} 
                    onChange={handleInputChange} 
                    className="bg-ui-input border-ui-border text-text-primary focus:border-brand-blue focus:ring-brand-blue text-sm p-1 w-full" 
                    placeholder="Raison sociale" 
                  />
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <FaInfoCircle className="text-brand-blue mt-0.5 flex-shrink-0 h-4 w-4" />
                <div className="w-full">
                  <p className="font-medium text-text-secondary text-xs">Code Client</p>
                  <Input 
                    id="codeClient" 
                    name="codeClient" 
                    value={editableInstallation.codeClient || ''} 
                    onChange={handleInputChange} 
                    className="bg-ui-input border-ui-border text-text-primary focus:border-brand-blue focus:ring-brand-blue text-sm p-1 w-full" 
                    placeholder="Code client" 
                  />
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <FaMapMarkerAlt className="text-brand-blue mt-0.5 flex-shrink-0 h-4 w-4" />
                <div className="w-full">
                  <p className="font-medium text-text-secondary text-xs">Adresse</p>
                  <Input 
                    id="adresse" 
                    name="adresse" 
                    value={editableInstallation.adresse || ''} 
                    onChange={handleInputChange} 
                    className="bg-ui-input border-ui-border text-text-primary focus:border-brand-blue focus:ring-brand-blue text-sm p-1 w-full" 
                    placeholder="Adresse" 
                  />
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <FaPhone className="text-brand-blue mt-0.5 flex-shrink-0 h-4 w-4" />
                <div className="w-full">
                  <p className="font-medium text-text-secondary text-xs">Téléphone</p>
                  <Input 
                    id="telephone" 
                    name="telephone" 
                    value={editableInstallation.telephone || ''} 
                    onChange={handleInputChange} 
                    className="bg-ui-input border-ui-border text-text-primary focus:border-brand-blue focus:ring-brand-blue text-sm p-1 w-full" 
                    placeholder="Téléphone" 
                  />
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <FaUserTie className="text-brand-blue mt-0.5 flex-shrink-0 h-4 w-4" />
                <div className="w-full">
                  <p className="font-medium text-text-secondary text-xs">Contact</p>
                  <Input 
                    id="contact" 
                    name="contact" 
                    value={editableInstallation.contact || ''} 
                    onChange={handleInputChange} 
                    className="bg-ui-input border-ui-border text-text-primary focus:border-brand-blue focus:ring-brand-blue text-sm p-1 w-full" 
                    placeholder="Nom du contact" 
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Section Statut et Dates */}
          <section>
            <h3 className="text-xs font-semibold uppercase text-text-tertiary mb-2">Statut & Planification</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3 bg-ui-background/50 p-3 rounded-md border border-ui-border/50 items-center">
              <div className="flex items-center space-x-2">
                <StatusIcon className="w-4 h-4 flex-shrink-0" style={{ color: statusColor }} />
                <label htmlFor="status" className="font-medium text-text-secondary text-xs">Statut:</label>
                <select 
                  id="status" 
                  name="status" 
                  value={editableInstallation.status || ''} 
                  onChange={handleInputChange}
                  className="block w-full rounded-md bg-black border-ui-border focus:border-brand-blue focus:ring-1 focus:ring-brand-blue text-white py-1.5 pl-2 pr-8 text-sm shadow-sm [&>option]:bg-black [&>option]:text-white"
                  style={{ color: statusColor }}
                >
                  <option value="" disabled>Sélectionner...</option>
                  {installationStatuses.map(s => (
                    <option key={s} value={s} style={{color: getStatusColor(s)}}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center space-x-2">
               <FaCalendarAlt className="text-brand-blue flex-shrink-0 h-4 w-4" />
               <label htmlFor="dateInstall" className="font-medium text-text-secondary text-xs">Date Install:</label>
               <Input 
                 id="dateInstall" 
                 name="dateInstall" 
                 type="date" 
                 value={formatDateForInput(editableInstallation.dateInstall)} 
                 onChange={handleInputChange} 
                 className="bg-ui-input border-ui-border text-text-primary focus:border-brand-blue focus:ring-brand-blue text-sm p-1 w-full" 
               />
             </div>
             <div className="flex items-center space-x-2">
               <FaCalendarAlt className="text-brand-blue flex-shrink-0 h-4 w-4" />
               <label htmlFor="dateCdeMateriel" className="font-medium text-text-secondary text-xs">Date Cde Matériel:</label>
               <Input 
                 id="dateCdeMateriel" 
                 name="dateCdeMateriel" 
                 type="date" 
                 value={formatDateForInput(editableInstallation.dateCdeMateriel)} 
                 onChange={handleInputChange} 
                 className="bg-ui-input border-ui-border text-text-primary focus:border-brand-blue focus:ring-brand-blue text-sm p-1 w-full" 
               />
             </div>
            </div>
          </section>

          {/* Section Équipe */}
          <section>
            <h3 className="text-xs font-semibold uppercase text-text-tertiary mb-2">Équipe JDC</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3 bg-ui-background/50 p-3 rounded-md border border-ui-border/50">
              <div className="flex items-start space-x-2">
                <FaUserTie className="text-brand-blue mt-0.5 flex-shrink-0 h-4 w-4" />
                <div>
                  <p className="font-medium text-text-secondary text-xs">Commercial</p>
                  <Input id="commercial" name="commercial" value={editableInstallation.commercial || ''} onChange={handleInputChange} className="bg-ui-input border-ui-border text-text-primary focus:border-brand-blue focus:ring-brand-blue text-sm p-1 w-full" placeholder="Nom commercial" />
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <FaUserTie className="text-brand-blue mt-0.5 flex-shrink-0 h-4 w-4" />
                <div>
                  <p className="font-medium text-text-secondary text-xs">Technicien</p>
                  <select
                    id="tech"
                    name="tech"
                    value={editableInstallation.tech || ''}
                    onChange={handleInputChange}
                    className="block w-full rounded-md bg-black border-ui-border focus:border-brand-blue focus:ring-1 focus:ring-brand-blue text-text-primary py-1.5 pl-2 pr-8 text-sm shadow-sm [&>option]:bg-black [&>option]:text-white"
                  >
                    <option value="">Sélectionner un technicien...</option>
                    {technicians.map(tech => (
                      <option key={tech.id} value={tech.name}>
                        {tech.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* Section Commentaire */}
          <section>
            <label htmlFor="commentaire" className="block text-xs font-semibold uppercase text-text-tertiary mb-1 flex items-center">
              <FaCommentDots className="mr-1.5 text-brand-blue h-4 w-4" /> Commentaire
            </label>
            <Textarea 
              id="commentaire" 
              name="commentaire" 
              value={editableInstallation.commentaire || ''} 
              onChange={handleInputChange}
              className="bg-black border-ui-border text-white focus:border-brand-blue focus:ring-brand-blue w-full text-sm p-2 min-h-[60px]"
              rows={3} 
              placeholder="Ajouter un commentaire..." 
            />
          </section>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-ui-border/50 flex justify-end space-x-3 sticky bottom-0 bg-ui-surface/80 backdrop-blur-md z-10">
          <Button type="button" onClick={onClose} variant="outline" size="sm" disabled={isSaving} className="border-ui-border text-text-secondary hover:bg-ui-border">Fermer</Button>
          {isEditing && (
            <Button type="submit" disabled={isSaving} size="sm" variant="primary" className="bg-brand-blue hover:bg-brand-blue-dark text-white">
              {isSaving ? <FaSpinner className="animate-spin mr-2 h-4 w-4" /> : <FaSave className="mr-2 h-4 w-4" />}
              Sauvegarder
            </Button>
          )}
        </div>
      </fetcher.Form>
    </div>
  );
};

export default InstallationDetails;
