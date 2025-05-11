import React, { useState, useEffect } from 'react';
import type { UserProfile } from '~/types/firestore.types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/Select'; // Import des sous-composants

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onSave: (updatedUser: UserProfile) => Promise<void>;
  availableRoles?: string[];
  availableSectors?: string[]; // Now receiving available sectors
}

// Default values if props are not provided
const DEFAULT_ROLES = ['Admin', 'Technician', 'Viewer'];
const DEFAULT_SECTORS = ['CHR', 'HACCP', 'Kezia', 'Tabac'];

export const EditUserModal: React.FC<EditUserModalProps> = ({
  isOpen,
  onClose,
  user,
  onSave,
  availableRoles = DEFAULT_ROLES,
  availableSectors = DEFAULT_SECTORS, // Use passed or default sectors
}) => {
  const [formData, setFormData] = useState<Partial<UserProfile>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (user && isOpen) {
      // Vérifier que l'utilisateur a un ID valide
      if (!user.uid || user.uid.trim() === '') {
        console.error('EditUserModal: Utilisateur avec ID manquant ou invalide', user);
        setError('ID utilisateur manquant ou invalide. Cette modification pourrait échouer.');
        setValidationErrors({ uid: 'ID utilisateur manquant ou invalide' });
      } else {
        setError(null);
        setValidationErrors({});
      }

      setFormData({
        uid: user.uid?.trim(), // S'assurer que l'ID n'a pas d'espaces
        email: user.email,
        displayName: user.displayName || '',
        role: formData.role || user.role || 'Technician', // Use formData.role if set, otherwise user.role, fallback to Technician
        secteurs: user.secteurs || [], // Initialize with current sectors
        blockchainAddress: user.blockchainAddress || '', // Préserver l'adresse blockchain si présente
      });
    } else if (!isOpen) {
      setFormData({});
      setIsSaving(false);
      setError(null);
      setValidationErrors({});
    }
  }, [user, isOpen]); // formData.role is intentionally not a dependency here to prevent infinite loops on state updates

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handler for toggling a sector button
  const handleSectorToggle = (sector: string) => {
    setFormData(prev => {
      const currentSectors = prev.secteurs || [];
      const isSelected = currentSectors.includes(sector);
      let newSectors: string[];

      if (isSelected) {
        // Remove the sector
        newSectors = currentSectors.filter(s => s !== sector);
      } else {
        // Add the sector
        newSectors = [...currentSectors, sector];
      }
      return { ...prev, secteurs: newSectors };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Valider la présence d'un ID utilisateur
    if (!user.uid || user.uid.trim() === '') {
      setError('Impossible de sauvegarder: ID utilisateur manquant ou invalide');
      return;
    }

    setIsSaving(true);
    setError(null);

    // Construct the final user data based on the form state
    const updatedUserData: UserProfile = {
      ...user, // Start with original user data
      displayName: formData.displayName || user.displayName,
      role: formData.role || user.role, // Use formData.role if set, otherwise user.role
      secteurs: formData.secteurs || [], // Use the updated sectors array
      uid: user.uid.trim(), // Ensure the ID is trimmed of any whitespace
      email: user.email,
      blockchainAddress: user.blockchainAddress || formData.blockchainAddress, // Inclure l'adresse blockchain pour la mise à jour
    };

    // Log pour débogage
    console.log('[EditUserModal] Données avant sauvegarde:', {
      uid: updatedUserData.uid,
      displayName: updatedUserData.displayName,
      role: updatedUserData.role,
      secteurs: updatedUserData.secteurs,
      blockchainAddress: updatedUserData.blockchainAddress, 
    });

    try {
      await onSave(updatedUserData);
      // Parent component (admin.tsx) handles closing on success
    } catch (err: any) { // Using 'any' for error type as it can be varied
      console.error("Error saving user:", err);
      
      // Messages d'erreur spécifiques
      if (err.message && err.message.includes('ID utilisateur manquant')) {
        setError('ID utilisateur manquant ou invalide. Rafraîchissez la page et réessayez.');
      } else if (err.message && err.message.includes('non trouvé sur la blockchain')) {
        setError(`${err.message}. Vérifiez que l'ID ou l'adresse blockchain est correcte.`);
      } else {
        setError(err.message || "Erreur lors de la sauvegarde.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !user) {
    return null;
  }

  const roleOptions = availableRoles.map(role => ({ value: role, label: role }));
  const currentSelectedSectors = formData.secteurs || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 transition-opacity duration-300 ease-in-out">
      <div className="bg-gray-800 p-6 rounded-xl shadow-2xl border border-gray-700 hover:border-jdc-blue transition-all duration-300 ease-in-out w-full max-w-md transform scale-100">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">Modifier l'utilisateur</h2>
          <button onClick={onClose} className="text-jdc-gray-400 hover:text-white" disabled={isSaving}>
            &times;
          </button>
        </div>

        {/* Afficher les messages d'erreur de validation en haut du formulaire */}
        {Object.keys(validationErrors).length > 0 && (
          <div className="bg-red-900/30 border border-red-700 rounded p-2 mb-4">
            <ul className="text-sm text-red-400">
              {Object.entries(validationErrors).map(([field, message]) => (
                <li key={field}>{message}</li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* UID (Debug visualisation) */}
          <div>
            <label className="block text-sm font-medium text-jdc-gray-300 mb-1">ID Utilisateur</label>
            <p className="text-sm text-white bg-jdc-gray-800 px-3 py-2 rounded border border-gray-700">
              {formData.uid || 'Manquant'}
            </p>
          </div>

          {/* Blockchain Address (Debug visualisation) */}
          {user.blockchainAddress && (
            <div>
              <label className="block text-sm font-medium text-jdc-gray-300 mb-1">Adresse Blockchain</label>
              <p className="text-sm text-white bg-jdc-gray-800 px-3 py-2 rounded border border-gray-700 truncate">
                {user.blockchainAddress}
              </p>
            </div>
          )}

          {/* Email (Read-only) */}
          <div>
            <label className="block text-sm font-medium text-jdc-gray-300 mb-1">Email</label>
            <p className="text-sm text-white bg-jdc-gray-800 px-3 py-2 rounded">{formData.email}</p>
          </div>

          {/* Display Name */}
          <Input
            label="Nom d'affichage"
            id="displayName"
            name="displayName"
            value={formData.displayName || ''}
            onChange={handleChange}
            disabled={isSaving}
            placeholder="Nom affiché dans l'application"
          />

          {/* Role */}
          <div> {/* Wrap Select with a div for label */}
            <label htmlFor="role" className="block text-sm font-medium text-jdc-gray-300 mb-1">Rôle</label>
            <Select
              value={formData.role || ''}
              onValueChange={(value) => setFormData(prev => ({ ...prev, role: value }))}
              disabled={isSaving}
              required
            >
              <SelectTrigger id="role" name="role" className="w-full bg-gray-900 text-white rounded-md px-3 py-2 text-sm border border-gray-700 focus:ring-jdc-blue focus:border-jdc-blue">
                <SelectValue placeholder="Sélectionner un rôle" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border border-gray-700">
                {roleOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="text-white hover:bg-gray-700">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sector Buttons */}
          <div>
            <label className="block text-sm font-medium text-jdc-gray-300 mb-2">Secteurs</label>
            <div className="flex flex-wrap gap-2">
              {availableSectors.map((sector) => {
                const isSelected = currentSelectedSectors.includes(sector);
                return (
                  <Button
                    key={sector}
                    type="button" // Important: prevent form submission
                    variant={isSelected ? 'primary' : 'secondary'} // Style based on selection
                    size="sm"
                    onClick={() => handleSectorToggle(sector)}
                    disabled={isSaving}
                    className={`transition-colors duration-150 ${
                      isSelected
                        ? 'bg-jdc-yellow text-black hover:bg-yellow-300'
                        : 'bg-jdc-800 text-jdc-gray-300 hover:bg-jdc-gray-700 border border-gray-700' // Added border for consistency
                    } px-3 py-1.5 rounded-md text-sm font-medium ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {sector}
                  </Button>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded p-2">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
              Annuler
            </Button>
            <button
              type="submit"
              disabled={isSaving || Object.keys(validationErrors).length > 0}
              className={`w-full px-4 py-2 text-sm font-medium text-black bg-jdc-yellow rounded-md hover:bg-yellow-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 ${
                isSaving || Object.keys(validationErrors).length > 0 ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isSaving ? 'Sauvegarde en cours...' : 'Sauvegarder les modifications'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
