import React, { useEffect, useState } from 'react';
import { 
  useOutletContext, 
  Link,
  useLoaderData,
  useFetcher
} from '@remix-run/react';
import { loader } from './admin.loader';
import { action } from './admin.action';
import type { AppUser, UserProfile } from '~/types/firestore.types';
import { Card, CardHeader, CardBody } from '~/components/ui/Card';
import { Button } from '~/components/ui/Button';
import { EditUserModal } from '~/components/EditUserModal';
import { useToast } from '~/context/ToastContext';

interface OutletContext {
  user: AppUser | null;
  profile: UserProfile | null;
  loadingAuth: boolean;
}

const AVAILABLE_SECTORS = ['CHR', 'HACCP', 'Kezia', 'Tabac'];
const AVAILABLE_ROLES = ['Admin', 'Technician', 'Viewer'];

export default function AdminPanel() {
  const { user, profile, loadingAuth } = useOutletContext<OutletContext>();
  const { addToast } = useToast();
  const { users: initialUsers } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [users, setUsers] = useState<UserProfile[]>(
    initialUsers?.map(u => ({
      ...u,
      createdAt: u.createdAt ? (typeof u.createdAt === 'string' ? new Date(u.createdAt) : new Date(u.createdAt.seconds * 1000)) : undefined,
      updatedAt: u.updatedAt ? (typeof u.updatedAt === 'string' ? new Date(u.updatedAt) : new Date(u.updatedAt.seconds * 1000)) : undefined
    })) || []
  );
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (loadingAuth) {
      setIsAuthorized(null);
      return;
    }
    const isAdmin = user && profile?.role?.toLowerCase() === 'admin';
    setIsAuthorized(isAdmin);
  }, [user, profile, loadingAuth]);

  const handleOpenEditModal = (userToEdit: UserProfile) => {
    setEditingUser(userToEdit);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingUser(null);
  };

  const handleSaveUser = async (updatedUser: UserProfile) => {
    if (!editingUser) return;

    const dataToUpdate: Partial<UserProfile> = {};
    if (updatedUser.displayName !== editingUser.displayName) {
      dataToUpdate.displayName = updatedUser.displayName;
    }
    if (updatedUser.role !== editingUser.role) {
      dataToUpdate.role = updatedUser.role;
    }
    const sortedCurrentSectors = [...(editingUser.secteurs || [])].sort();
    const sortedUpdatedSectors = [...(updatedUser.secteurs || [])].sort();
    if (JSON.stringify(sortedCurrentSectors) !== JSON.stringify(sortedUpdatedSectors)) {
      dataToUpdate.secteurs = updatedUser.secteurs || [];
    }

    if (Object.keys(dataToUpdate).length === 0) {
      addToast({ type: "info", message: "Aucune modification détectée." });
      handleCloseEditModal();
      return;
    }

    fetcher.submit(
      {
        userId: editingUser.uid,
        updates: JSON.stringify(dataToUpdate)
      },
      { method: "POST" }
    );

    handleCloseEditModal();
    addToast({ type: "success", message: "Utilisateur mis à jour avec succès." });
  };

  if (loadingAuth || isAuthorized === null) {
    return <div className="flex justify-center items-center h-64"><p className="text-jdc-gray-400 animate-pulse">Vérification de l'accès...</p></div>;
  }

  if (!isAuthorized) {
    return (
      <div className="text-center py-10">
        <h1 className="text-2xl font-bold text-red-500 mb-4">Accès Refusé</h1>
        <p className="text-jdc-gray-300">Vous n'avez pas les permissions nécessaires.</p>
        <Link to="/dashboard" className="text-jdc-yellow hover:underline mt-4 inline-block">Retour au tableau de bord</Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-white mb-6">Panneau d'Administration</h1>

      <Card>
        <CardHeader><h2 className="text-lg font-medium text-white">Informations Administrateur</h2></CardHeader>
        <CardBody>
            <p className="text-jdc-gray-300">Connecté en tant que : <span className="font-medium text-white">{profile?.email}</span></p>
            <p className="text-jdc-gray-300">Rôle : <span className="font-medium text-white">{profile?.role}</span></p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-medium text-white">Gestion des Utilisateurs Existants</h2>
          <p className="mt-1 text-sm text-jdc-gray-400">Modifier les rôles et les secteurs des utilisateurs.</p>
        </CardHeader>
        <CardBody>
          {users.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-jdc-gray-700">
                <thead className="bg-jdc-gray-800/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-jdc-gray-300 uppercase tracking-wider">Nom</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-jdc-gray-300 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-jdc-gray-300 uppercase tracking-wider">Rôle</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-jdc-gray-300 uppercase tracking-wider">Secteurs</th>
                    <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="bg-jdc-card divide-y divide-jdc-gray-700">
                  {users.map((u) => (
                    <tr key={u.uid}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{u.displayName || <i className="text-jdc-gray-500">Non défini</i>}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-jdc-gray-300">{u.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-jdc-gray-300">{u.role}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-jdc-gray-300">{u.secteurs?.join(', ') || <i className="text-jdc-gray-500">Aucun</i>}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleOpenEditModal(u)}
                        >
                          Modifier
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-4 text-jdc-gray-400"><p>Aucun utilisateur trouvé.</p></div>
          )}
        </CardBody>
      </Card>

      <EditUserModal
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        user={editingUser}
        onSave={handleSaveUser}
        availableRoles={AVAILABLE_ROLES}
        availableSectors={AVAILABLE_SECTORS}
      />
    </div>
  );
}
