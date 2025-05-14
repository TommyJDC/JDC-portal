import React, { useEffect, useState } from 'react';
import { 
  useOutletContext, 
  Link,
  useLoaderData,
  useFetcher,
  Outlet,
  useLocation
} from '@remix-run/react';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { json, redirect } from '@remix-run/node'; // Ajout de redirect
import { getAllUserProfilesSdk } from '~/services/firestore.service.server'; // getUserProfileSdk n'est plus utilisé directement ici
// import { authenticator } from '~/services/auth.server'; // Remplacé par requireAdminUser
// import { getSessionFromCookie } from '~/services/session-utils.server'; // Non utilisé ici
import { requireAdminUser } from '~/services/auth-utils.server'; // Importer requireAdminUser
import { action } from './admin.action'; // Assurez-vous que admin.action est aussi à jour si besoin
import type { UserProfile } from '~/types/firestore.types';
import { Card, CardHeader, CardBody } from '~/components/ui/Card';
import { Button } from '~/components/ui/Button';
import { EditUserModal } from '~/components/EditUserModal';
import { DebugAuth } from '~/components/DebugAuth';
import { useToast } from '~/context/ToastContext';
import type { UserSessionData } from '~/services/session.server'; // Utiliser UserSessionData
import { UserManagementPanel } from '~/components/UserManagementPanel';
import { StatsPanel } from '~/components/StatsPanel';
import { LogsPanel } from '~/components/LogsPanel';
import { NotificationPanel } from '~/components/NotificationPanel';
import { SyncPanel } from '~/components/SyncPanel';
import { FaCogs, FaUsers, FaChartBar, FaBell, FaBug, FaSync } from 'react-icons/fa';

// Loader Firestore uniquement
export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await requireAdminUser(request); // Vérifie l'authentification et le rôle Admin
    const users = await getAllUserProfilesSdk();
    return json({ users });
  } catch (error) {
    // requireAdminUser lance une Response en cas d'échec, qui sera gérée par Remix (typiquement une redirection)
    // Si une autre erreur se produit, la relancer ou la gérer
    if (error instanceof Response) {
      throw error;
    }
    console.error("Erreur dans le loader admin:", error);
    // Rediriger vers login en cas d'erreur inattendue
    return redirect("/login"); 
  }
};

export default function Admin() {
  const { users: serialisedUsers } = useLoaderData<{ users: UserProfile[] }>();
  const fetcher = useFetcher(); // Initialiser useFetcher
  const { addToast } = useToast(); // Pour les notifications

  // Parser les dates sérialisées en objets Date
  const users: UserProfile[] = React.useMemo(() => serialisedUsers.map(u => ({
    ...u,
    createdAt: u.createdAt ? new Date(u.createdAt) : undefined,
    updatedAt: u.updatedAt ? new Date(u.updatedAt) : undefined,
  })), [serialisedUsers]);
  
  const context = useOutletContext<{ user: UserSessionData | null }>(); 
  const user = context?.user;
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const location = useLocation();

  const handleEditUser = (userToEdit: UserProfile) => {
    setSelectedUser(userToEdit);
    setIsEditModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsEditModalOpen(false);
    setSelectedUser(null);
  };

  const handleSaveUser = async (updatedUserData: Partial<UserProfile>) => {
    if (!selectedUser) return;

    const formData = new FormData();
    formData.append('userId', selectedUser.uid);
    // Ne pas inclure uid dans l'objet updates lui-même
    const updatesForAction = { ...updatedUserData };
    delete updatesForAction.uid; 
    
    formData.append('updates', JSON.stringify(updatesForAction));
    // Si vous avez une action spécifique pour la mise à jour depuis le modal, utilisez-la.
    // Sinon, si admin.action.tsx gère cela, utilisez son chemin.
    // Pour l'instant, on suppose que admin.action.tsx peut gérer cela.
    fetcher.submit(formData, { method: 'POST', action: '/admin/action' });
    
    // Gérer la réponse du fetcher
    // Ceci est un exemple, adaptez selon la réponse de votre action
    if (fetcher.data && (fetcher.data as any).success) {
        addToast({ type: 'success', message: (fetcher.data as any).message || 'Utilisateur mis à jour avec succès!' });
        // Revalider les données du loader pour mettre à jour la liste des utilisateurs
        // navigate(location.pathname, { replace: true }); // Ou utiliser useRevalidator
    } else if (fetcher.data && (fetcher.data as any).error) {
        addToast({ type: 'error', message: (fetcher.data as any).error || 'Erreur lors de la mise à jour.' });
    }

    handleCloseModal();
  };

  // Panels d'administration (sans blockchain)
  return (
    <div className="space-y-6"> {/* Fond géré par root.tsx, p-6 est déjà sur main dans root.tsx */}
      <h1 className="text-2xl font-semibold text-text-primary">Administration</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6"> {/* mb-8 retiré, l'espacement est géré par space-y-6 */}
        <Card className="bg-ui-surface"> {/* Appliquer le fond de carte ici */}
          <CardHeader>
            <div className="flex items-center text-text-primary">
              <FaUsers className="mr-3 h-5 w-5 text-brand-blue" />
              <span className="font-semibold text-lg">Utilisateurs</span>
            </div>
          </CardHeader>
          <CardBody> {/* Le padding est géré par CardBody ou Card si noPadding=false */}
            <UserManagementPanel users={users} onEditUser={handleEditUser} />
          </CardBody>
        </Card>
        <Card className="bg-ui-surface">
          <CardHeader>
            <div className="flex items-center text-text-primary">
              <FaChartBar className="mr-3 h-5 w-5 text-brand-blue" />
              <span className="font-semibold text-lg">Statistiques</span>
            </div>
          </CardHeader>
          <CardBody>
            <StatsPanel />
          </CardBody>
        </Card>
        <Card className="bg-ui-surface">
          <CardHeader>
            <div className="flex items-center text-text-primary">
              <FaBell className="mr-3 h-5 w-5 text-brand-blue" />
              <span className="font-semibold text-lg">Notifications</span>
            </div>
          </CardHeader>
          <CardBody>
            <NotificationPanel />
          </CardBody>
        </Card>
        <Card className="bg-ui-surface">
          <CardHeader>
            <div className="flex items-center text-text-primary">
              <FaBug className="mr-3 h-5 w-5 text-brand-blue" />
              <span className="font-semibold text-lg">Logs</span>
            </div>
          </CardHeader>
          <CardBody>
            <LogsPanel />
          </CardBody>
        </Card>
        <Card className="bg-ui-surface">
          <CardHeader>
            <div className="flex items-center text-text-primary">
              <FaSync className="mr-3 h-5 w-5 text-brand-blue" />
              <span className="font-semibold text-lg">Synchronisation</span>
            </div>
          </CardHeader>
          <CardBody>
            <SyncPanel />
          </CardBody>
        </Card>
      </div>
      {selectedUser && isEditModalOpen && (
        <EditUserModal 
          user={selectedUser} 
          isOpen={isEditModalOpen}
          onClose={handleCloseModal}
          onSave={handleSaveUser} 
        />
      )}
      <Outlet />
    </div>
  );
}
