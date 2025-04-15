import React, { useState, useEffect } from 'react';
import type { UserProfile } from '~/types/firestore.types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';

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

  useEffect(() => {
    if (user && isOpen) {
      setFormData({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || '',
        role: user.role || 'Technician',
        secteurs: user.secteurs || [], // Initialize with current sectors
      });
      setError(null);
    } else if (!isOpen) {
      setFormData({});
      setIsSaving(false);
      setError(null);
    }
  }, [user, isOpen]);

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
      // Sort for consistent comparison later if needed
      // newSectors.sort();
      return { ...prev, secteurs: newSectors };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    setError(null);

    // Construct the final user data based on the form state
    const updatedUserData: UserProfile = {
      ...user, // Start with original user data
      displayName: formData.displayName || user.displayName,
      role: formData.role || user.role,
      secteurs: formData.secteurs || [], // Use the updated sectors array
      uid: user.uid,
      email: user.email,
    };

    try {
      await onSave(updatedUserData);
      // Parent component (admin.tsx) handles closing on success
    } catch (err: any) {
      console.error("Error saving user:", err);
      setError(err.message || "Erreur lors de la sauvegarde.");
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
      <div className="bg-jdc-card rounded-lg shadow-xl p-6 w-full max-w-md transform transition-all duration-300 ease-in-out scale-100">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">Modifier l'utilisateur</h2>
          <button onClick={onClose} className="text-jdc-gray-400 hover:text-white" disabled={isSaving}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
          <Select
            label="Rôle"
            id="role"
            name="role"
            options={roleOptions}
            value={formData.role || ''}
            onChange={handleChange}
            disabled={isSaving}
            required
          />

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
                    className={`transition-colors duration-150 ${isSelected ? '' : 'opacity-70 hover:opacity-100'}`} // Add visual feedback
                  >
                    {sector}
                  </Button>
                );
              })}
            </div>
          </div>

          {error && <p className="text-sm text-red-400 mt-2">{error}</p>}

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
              Annuler
            </Button>
            <Button type="submit" variant="primary" isLoading={isSaving} disabled={isSaving}>
              Enregistrer
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
