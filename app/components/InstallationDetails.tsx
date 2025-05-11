import React, { useState, useEffect } from 'react';
import type { Installation, InstallationStatus } from '~/types/firestore.types';
import { FaTimes, FaMapMarkerAlt, FaPhone, FaUserTie, FaInfoCircle, FaCalendarAlt, FaCommentDots, FaBuilding, FaSave, FaSpinner } from 'react-icons/fa';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Textarea } from './ui/Textarea';
import { useFetcher } from '@remix-run/react';
import { getStatusColor, getStatusIcon } from '~/utils/styleUtils';

interface InstallationDetailsProps {
  installation: Installation;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Installation>) => void;
}

const InstallationDetails: React.FC<InstallationDetailsProps> = ({ installation, onClose, onSave }) => {
  const fetcher = useFetcher();
  const [editableInstallation, setEditableInstallation] = useState<Partial<Installation>>({});
  const [isEditing, setIsEditing] = useState(false); // Gérer si des modifications ont été faites

  useEffect(() => {
    setEditableInstallation({
      status: installation.status,
      dateInstall: installation.dateInstall,
      commentaire: installation.commentaire,
      contact: installation.contact,
      telephone: installation.telephone,
      commercial: installation.commercial,
      tech: installation.tech,
      adresse: installation.adresse,
      codePostal: installation.codePostal,
      ville: installation.ville,
    });
    setIsEditing(false); // Réinitialiser l'état d'édition
  }, [installation]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditableInstallation(prevState => ({ ...prevState, [name]: value }));
    if (!isEditing) setIsEditing(true);
  };

  const handleSaveClick = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // Empêcher le rechargement de la page par le formulaire
    onSave(installation.id, editableInstallation);
    // La modale sera fermée par le parent ou après confirmation du fetcher.data
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
      const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
      // Vérifier si la date est valide
      if (isNaN(date.getTime())) return '';
      return date.toISOString().split('T')[0];
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <fetcher.Form method="post" onSubmit={handleSaveClick} className="bg-ui-surface/90 backdrop-blur-lg border border-ui-border/70 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 sm:p-5 border-b border-ui-border/50 sticky top-0 bg-ui-surface/80 backdrop-blur-md z-10">
          <h2 className="text-lg font-semibold text-text-primary flex items-center">
            <FaBuilding className="mr-2 text-brand-blue h-5 w-5" /> Détails - {installation.nom} ({installation.codeClient})
          </h2>
          <div className="flex items-center">
            {isSaving && <FaSpinner className="mr-3 text-brand-blue animate-spin" title="Sauvegarde en cours..." />}
            <button type="button" onClick={onClose} className="text-text-secondary hover:text-text-primary p-1 rounded-md hover:bg-white/10" disabled={isSaving}>
              <FaTimes className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-grow text-sm">
          {/* Section Informations Client */}
          <section>
            <h3 className="text-xs font-semibold uppercase text-text-tertiary mb-2">Client & Contact</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3 bg-ui-background/50 p-3 rounded-md border border-ui-border/50">
              <div className="flex items-start space-x-2">
                <FaMapMarkerAlt className="text-brand-blue mt-0.5 flex-shrink-0 h-4 w-4" />
                <div>
                  <p className="font-medium text-text-secondary text-xs">Adresse</p>
                  <p className="text-text-primary">{installation.adresse}, {installation.codePostal} {installation.ville}</p>
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <FaPhone className="text-brand-blue mt-0.5 flex-shrink-0 h-4 w-4" />
                <div>
                  <p className="font-medium text-text-secondary text-xs">Téléphone</p>
                  <Input id="telephone" name="telephone" value={editableInstallation.telephone || ''} onChange={handleInputChange} className="bg-ui-input border-ui-border text-text-primary focus:border-brand-blue focus:ring-brand-blue text-sm p-1 w-full" placeholder="Téléphone" />
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <FaUserTie className="text-brand-blue mt-0.5 flex-shrink-0 h-4 w-4" />
                <div>
                  <p className="font-medium text-text-secondary text-xs">Contact</p>
                  <Input id="contact" name="contact" value={editableInstallation.contact || ''} onChange={handleInputChange} className="bg-ui-input border-ui-border text-text-primary focus:border-brand-blue focus:ring-brand-blue text-sm p-1 w-full" placeholder="Nom du contact" />
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
                <select id="status" name="status" value={editableInstallation.status || ''} onChange={handleInputChange}
                  className="block w-full rounded-md bg-ui-input border-ui-border focus:border-brand-blue focus:ring-1 focus:ring-brand-blue text-text-primary py-1.5 pl-2 pr-8 text-sm shadow-sm"
                  style={{ color: statusColor }}
                >
                  <option value="" disabled>Sélectionner...</option>
                  {installationStatuses.map(s => (<option key={s} value={s} style={{color: getStatusColor(s)}}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>))}
                </select>
              </div>
              <div className="flex items-center space-x-2">
               <FaCalendarAlt className="text-brand-blue flex-shrink-0 h-4 w-4" />
               <label htmlFor="dateInstall" className="font-medium text-text-secondary text-xs">Date Install:</label>
               <Input id="dateInstall" name="dateInstall" type="date" value={formatDateForInput(editableInstallation.dateInstall)} onChange={handleInputChange} className="bg-ui-input border-ui-border text-text-primary focus:border-brand-blue focus:ring-brand-blue text-sm p-1 w-full" />
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
                  <Input id="tech" name="tech" value={editableInstallation.tech || ''} onChange={handleInputChange} className="bg-ui-input border-ui-border text-text-primary focus:border-brand-blue focus:ring-brand-blue text-sm p-1 w-full" placeholder="Nom technicien" />
                </div>
              </div>
            </div>
          </section>

          {/* Section Commentaire */}
          <section>
            <label htmlFor="commentaire" className="block text-xs font-semibold uppercase text-text-tertiary mb-1 flex items-center">
              <FaCommentDots className="mr-1.5 text-brand-blue h-4 w-4" /> Commentaire
            </label>
            <Textarea id="commentaire" name="commentaire" value={editableInstallation.commentaire || ''} onChange={handleInputChange}
              className="bg-ui-input border-ui-border text-text-primary focus:border-brand-blue focus:ring-brand-blue w-full text-sm p-2 min-h-[60px]"
              rows={3} placeholder="Ajouter un commentaire..." />
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
