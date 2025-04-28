import React, { useState, useEffect } from 'react';
import type { Installation, InstallationStatus } from '~/types/firestore.types';
import { FaTimes, FaMapMarkerAlt, FaPhone, FaUserTie, FaInfoCircle, FaCalendarAlt, FaCommentDots, FaBuilding, FaSave, FaSpinner } from 'react-icons/fa';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Textarea } from './ui/Textarea';
import { Select } from './ui/Select';
import { useFetcher } from '@remix-run/react'; // Importer useFetcher

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

  // Afficher un indicateur de chargement pendant la sauvegarde
  const isSaving = fetcher.state === 'submitting';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative text-white">
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-jdc-blue flex items-center">
            <FaBuilding className="mr-2" /> Détails de l'Installation
            {isSaving && <FaSpinner className="ml-3 text-jdc-yellow animate-spin" title="Sauvegarde en cours..." />}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <FaTimes size={20} />
          </button>
        </div>
        <div className="p-6 space-y-4 text-gray-300">
          <div className="flex items-center">
            <FaInfoCircle className="mr-3 text-jdc-yellow w-5 text-center" />
            <div>
              <p><span className="font-semibold text-white">Nom :</span> {installation.nom}</p>
              <p><span className="font-semibold text-white">Code Client :</span> {installation.codeClient}</p>
            </div>
          </div>

          {/* Afficher les champs en lecture seule */}
          <div className="flex items-center">
            <FaMapMarkerAlt className="mr-3 text-jdc-yellow w-5 text-center" />
            <p><span className="font-semibold text-white">Adresse :</span> {installation.adresse}, {installation.codePostal} {installation.ville}</p>
          </div>
          <div className="flex items-center">
            <FaPhone className="mr-3 text-jdc-yellow w-5 text-center" />
            <p><span className="font-semibold text-white">Téléphone :</span> {installation.telephone}</p>
          </div>
          <div className="flex items-center">
            <FaUserTie className="mr-3 text-jdc-yellow w-5 text-center" />
            <p><span className="font-semibold text-white">Contact :</span> {installation.contact}</p>
          </div>
           <div className="flex items-center">
            <FaUserTie className="mr-3 text-jdc-yellow w-5 text-center" />
            <p><span className="font-semibold text-white">Commercial :</span> {installation.commercial}</p>
          </div>
           <div className="flex items-center">
            <FaInfoCircle className="mr-3 text-jdc-yellow w-5 text-center" />
            {/* Rendre le statut éditable avec un sélecteur HTML standard */}
             <div className="flex-1"> {/* Utiliser flex-1 pour prendre l'espace disponible */}
                <label htmlFor="status" className="block text-sm font-medium text-gray-400 mb-1 sr-only">Statut</label> {/* Label caché visuellement */}
                <div className="flex items-center"> {/* Conteneur pour l'icône et le sélecteur */}
                   <span className="font-semibold text-white mr-2">Statut :</span>
                   <select
                      id="status" // Ajouter l'ID pour le label
                      name="status"
                      value={editableInstallation.status || ''}
                      onChange={handleInputChange} // Utiliser onChange pour l'élément select standard
                      className="block w-full rounded-md bg-gray-900 border-gray-700 focus:border-jdc-blue focus:ring focus:ring-jdc-blue focus:ring-opacity-50 text-white py-1 pl-2 pr-8 text-sm" // Appliquer le style ici
                   >
                      <option value="">Sélectionner un statut</option>
                      {installationStatuses.map(status => (
                         <option key={status} value={status}>{status}</option>
                      ))}
                   </select>
                </div>
             </div>
          </div>


          {/* Champs éditables */}
           <Input
            label="Technicien"
            id="tech"
            name="tech"
            value={editableInstallation.tech || ''}
            onChange={handleInputChange}
            icon={<FaUserTie />}
            className="bg-gray-900 text-white border-gray-700 focus:border-jdc-blue focus:ring-jdc-blue"
            labelClassName="text-gray-400"
          />
           <Input
            label="Date d'Installation"
            id="dateInstall"
            name="dateInstall"
            value={editableInstallation.dateInstall || ''}
            onChange={handleInputChange}
            icon={<FaCalendarAlt />}
            className="bg-gray-900 text-white border-gray-700 focus:border-jdc-blue focus:ring-jdc-blue"
            labelClassName="text-gray-400"
          />
           <div> {/* Ajouter un conteneur pour le label et la textarea */}
              <label htmlFor="commentaire" className="block text-sm font-medium text-gray-400 mb-1">
                 <FaCommentDots className="mr-1 inline-block" /> Commentaire
              </label>
              <Textarea
                id="commentaire"
                name="commentaire"
                value={editableInstallation.commentaire || ''}
                onChange={handleInputChange}
                className="bg-gray-900 text-white border-gray-700 focus:border-jdc-blue focus:ring-jdc-blue w-full"
              />
           </div>
        </div>
        <div className="p-4 border-t border-gray-700 flex justify-end space-x-2">
          {isEditing && ( // Afficher le bouton de sauvegarde uniquement si des modifications ont été apportées
             <Button onClick={handleSaveClick} disabled={isSaving}>
               {isSaving ? <FaSpinner className="animate-spin mr-2" /> : <FaSave className="mr-2" />}
               Sauvegarder
             </Button>
          )}
          <Button onClick={onClose} variant="secondary" disabled={isSaving}>Fermer</Button>
        </div>
      </div>
    </div>
  );
};

export default InstallationDetails;
