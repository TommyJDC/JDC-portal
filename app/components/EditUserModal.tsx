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
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"> {/* z-index plus élevé, fond standard pour modales */}
      <div className="bg-ui-surface/90 backdrop-blur-lg border border-ui-border/70 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 sm:p-6 border-b border-ui-border/50 sticky top-0 bg-ui-surface/80 backdrop-blur-lg z-10">
          <h2 className="text-lg font-semibold text-text-primary">Modifier l'utilisateur</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary p-1 rounded-md hover:bg-white/10" disabled={isSaving}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
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

        <form onSubmit={handleSubmit} className="space-y-4 p-4 sm:p-6 overflow-y-auto flex-1">
          {/* UID (Debug visualisation) */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">ID Utilisateur</label>
            <p className="text-sm text-text-primary bg-ui-background/50 px-3 py-2 rounded-md border border-ui-border">
              {formData.uid || 'Manquant'}
            </p>
          </div>

          {/* Blockchain Address (Debug visualisation) */}
          {user.blockchainAddress && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Adresse Blockchain</label>
              <p className="text-sm text-text-primary bg-ui-background/50 px-3 py-2 rounded-md border border-ui-border truncate">
                {user.blockchainAddress}
              </p>
            </div>
          )}

          {/* Email (Read-only) */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Email</label>
            <p className="text-sm text-text-primary bg-ui-background/50 px-3 py-2 rounded-md border border-ui-border">{formData.email}</p>
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
            className="bg-ui-background/70 border-ui-border text-text-primary focus:border-brand-blue focus:ring-brand-blue"
            labelClassName="text-text-secondary"
          />

          {/* Role */}
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-text-secondary mb-1">Rôle</label>
            <Select
              value={formData.role || ''}
              onValueChange={(value) => setFormData(prev => ({ ...prev, role: value }))}
              disabled={isSaving}
            >
              <SelectTrigger id="role" className="w-full bg-ui-background/70 border-ui-border text-text-primary focus:border-brand-blue focus:ring-1 focus:ring-brand-blue">
                <SelectValue placeholder="Sélectionner un rôle" />
              </SelectTrigger>
              <SelectContent className="bg-ui-surface border-ui-border text-text-primary">
                {roleOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="hover:bg-ui-background focus:bg-ui-background">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sector Buttons */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Secteurs</label>
            <div className="flex flex-wrap gap-2">
              {availableSectors.map((sector) => {
                const isSelected = currentSelectedSectors.includes(sector);
                return (
                  <Button
                    key={sector}
                    type="button"
                    variant={isSelected ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => handleSectorToggle(sector)}
                    disabled={isSaving}
                    className={`${isSelected ? 'bg-brand-blue text-white' : 'border-ui-border text-text-secondary hover:bg-ui-border hover:text-text-primary'}`}
                  >
                    {sector}
                  </Button>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-3 rounded-md text-sm">
              <p>{error}</p>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4 sticky bottom-0 bg-ui-surface/80 backdrop-blur-lg p-4 -mx-6 -mb-6 rounded-b-lg border-t border-ui-border/50">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving} className="border-ui-border text-text-secondary hover:bg-ui-border">
              Annuler
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSaving || Object.keys(validationErrors).length > 0}
              className="bg-brand-blue hover:bg-brand-blue-dark text-white"
            >
              {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
