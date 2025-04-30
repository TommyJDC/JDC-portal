import React, { useState, useEffect } from 'react';
import type { Installation, InstallationStatus } from '~/types/firestore.types';
import { FaTimes, FaMapMarkerAlt, FaPhone, FaUserTie, FaInfoCircle, FaCalendarAlt, FaCommentDots, FaBuilding, FaSave, FaSpinner, FaEdit, FaCheckCircle, FaClock, FaCalendarCheck } from 'react-icons/fa';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Textarea } from './ui/Textarea';
// Select n'est plus utilisé directement ici, on utilise un select HTML standard
import { useFetcher } from '@remix-run/react';
import { getStatusColor, getStatusIcon } from '~/utils/styleUtils'; // Importer les helpers

interface InstallationDetailsProps {
  installation: Installation;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Installation>) => void; // Ajouter la prop onSave
}

const InstallationDetails: React.FC<InstallationDetailsProps> = ({ installation, onClose, onSave }) => {
  const fetcher = useFetcher(); // Utiliser useFetcher ici pour suivre l'état de la sauvegarde

  const [editableInstallation, setEditableInstallation] = useState<Partial<Installation>>({});
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    // Initialiser l'état éditable avec les données de l'installation
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
      // Ajouter d'autres champs si nécessaire
    });
  }, [installation]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditableInstallation(prevState => ({
      ...prevState,
      [name]: value
    }));
    setIsEditing(true); // Activer le mode édition dès qu'un champ est modifié
  };

  const handleSaveClick = () => {
    onSave(installation.id, editableInstallation);
    setIsEditing(false); // Désactiver le mode édition après la sauvegarde
  };

  const installationStatuses: InstallationStatus[] = ['rendez-vous à prendre', 'rendez-vous pris', 'installation terminée'];
  const isSaving = fetcher.state === 'submitting';
  const statusColor = getStatusColor(editableInstallation.status);
  const StatusIcon = getStatusIcon(editableInstallation.status);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      {/* Utilisation de fetcher.Form pour gérer la soumission */}
      <fetcher.Form method="post" onSubmit={handleSaveClick} className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto relative text-white flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-700 sticky top-0 bg-gradient-to-r from-gray-800 to-gray-850 z-10">
          <h2 className="text-xl font-semibold text-jdc-blue flex items-center">
            <FaBuilding className="mr-2" /> Détails - {installation.nom} ({installation.codeClient})
            {isSaving && <FaSpinner className="ml-3 text-jdc-yellow animate-spin" title="Sauvegarde en cours..." />}
          </h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <FaTimes size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 flex-grow">
          {/* Section Informations Client */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start space-x-3">
              <FaMapMarkerAlt className="text-jdc-blue mt-1 flex-shrink-0" />
              <div>
                <p className="font-semibold text-gray-300">Adresse</p>
                <p>{installation.adresse}, {installation.codePostal} {installation.ville}</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <FaPhone className="text-jdc-blue mt-1 flex-shrink-0" />
              <div>
                <p className="font-semibold text-gray-300">Téléphone</p>
                <p>{installation.telephone || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <FaUserTie className="text-jdc-blue mt-1 flex-shrink-0" />
              <div>
                <p className="font-semibold text-gray-300">Contact</p>
                <Input
                  id="contact"
                  name="contact"
                  value={editableInstallation.contact || ''}
                  onChange={handleInputChange}
                  className="bg-gray-900 text-white border-gray-700 focus:border-jdc-blue focus:ring-jdc-blue text-sm p-1"
                  placeholder="Nom du contact"
                />
              </div>
            </div>
          </div>

          <hr className="border-gray-700" />

          {/* Section Statut et Dates */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
             <div className="flex items-center space-x-2">
               <StatusIcon className="w-5 h-5 flex-shrink-0" style={{ color: statusColor }} />
               <label htmlFor="status" className="font-semibold text-gray-300">Statut:</label>
               <select
                 id="status"
                 name="status"
                 value={editableInstallation.status || ''}
                 onChange={handleInputChange}
                 className="block w-full rounded-md bg-gray-700 border-gray-600 focus:border-jdc-blue focus:ring focus:ring-jdc-blue focus:ring-opacity-50 text-white py-1 pl-2 pr-8 text-sm"
                 style={{ color: statusColor }} // Appliquer la couleur au texte du select
               >
                 <option value="" disabled>Sélectionner...</option>
                 {installationStatuses.map(status => (
                   <option key={status} value={status} style={{ color: getStatusColor(status) }}>{status}</option>
                 ))}
               </select>
             </div>
             <div className="flex items-center space-x-2">
               <FaCalendarAlt className="text-jdc-blue flex-shrink-0" />
               <label htmlFor="dateInstall" className="font-semibold text-gray-300">Date Install:</label>
               <Input
                 id="dateInstall"
                 name="dateInstall"
                 type="date" // Utiliser type date pour une meilleure UX
                 value={editableInstallation.dateInstall || ''}
                 onChange={handleInputChange}
                 className="bg-gray-700 text-white border-gray-600 focus:border-jdc-blue focus:ring-jdc-blue text-sm p-1"
               />
             </div>
          </div>

          <hr className="border-gray-700" />

          {/* Section Équipe */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start space-x-3">
              <FaUserTie className="text-jdc-blue mt-1 flex-shrink-0" />
              <div>
                <p className="font-semibold text-gray-300">Commercial</p>
                <Input
                  id="commercial"
                  name="commercial"
                  value={editableInstallation.commercial || ''}
                  onChange={handleInputChange}
                  className="bg-gray-900 text-white border-gray-700 focus:border-jdc-blue focus:ring-jdc-blue text-sm p-1"
                  placeholder="Nom du commercial"
                />
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <FaUserTie className="text-jdc-blue mt-1 flex-shrink-0" />
              <div>
                <p className="font-semibold text-gray-300">Technicien</p>
                <Input
                  id="tech"
                  name="tech"
                  value={editableInstallation.tech || ''}
                  onChange={handleInputChange}
                  className="bg-gray-900 text-white border-gray-700 focus:border-jdc-blue focus:ring-jdc-blue text-sm p-1"
                  placeholder="Nom du technicien"
                />
              </div>
            </div>
          </div>

          <hr className="border-gray-700" />

          {/* Section Commentaire */}
          <div>
            <label htmlFor="commentaire" className="block text-sm font-medium text-gray-300 mb-1 flex items-center">
              <FaCommentDots className="mr-2 text-jdc-blue" /> Commentaire
            </label>
            <Textarea
              id="commentaire"
              name="commentaire"
              value={editableInstallation.commentaire || ''}
              onChange={handleInputChange}
              className="bg-gray-700 text-white border-gray-600 focus:border-jdc-blue focus:ring-jdc-blue w-full"
              rows={4}
              placeholder="Ajouter un commentaire..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 flex justify-end space-x-3 sticky bottom-0 bg-gradient-to-r from-gray-800 to-gray-850">
          {isEditing && (
            <Button type="submit" disabled={isSaving} className="bg-jdc-blue hover:bg-blue-600">
              {isSaving ? <FaSpinner className="animate-spin mr-2" /> : <FaSave className="mr-2" />}
              Sauvegarder
            </Button>
          )}
          <Button type="button" onClick={onClose} variant="secondary" disabled={isSaving}>Fermer</Button>
        </div>
      </fetcher.Form>
    </div>
  );
};

export default InstallationDetails;
