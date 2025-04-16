import React from 'react';
import type { UserSession } from '~/services/session.server';
import type { UserProfile } from '~/types/firestore.types';

interface DebugAuthProps {
  user: UserSession | null;
  profile: UserProfile | null;
  loadingAuth: boolean;
}

export const DebugAuth: React.FC<DebugAuthProps> = ({ user, profile, loadingAuth }) => {
  if (!user) {
    return <div className="bg-red-900 p-4 rounded-md mb-4">
      <h2 className="text-white font-bold">Débogage Auth: Non connecté</h2>
    </div>;
  }

  return (
    <div className="bg-blue-900 p-4 rounded-md mb-4">
      <h2 className="text-white font-bold">Débogage Auth</h2>
      <div className="mt-2 text-white">
        <p><strong>Loading Auth:</strong> {loadingAuth ? 'Oui' : 'Non'}</p>
        <p><strong>User ID:</strong> {user.userId}</p>
        <p><strong>Email:</strong> {user.email}</p>
        <p><strong>Display Name:</strong> {user.displayName}</p>
        <hr className="my-2 border-blue-700" />
        <p><strong>Profile:</strong> {profile ? 'Chargé' : 'Non chargé'}</p>
        {profile && (
          <>
            <p><strong>Profile UID:</strong> {profile.uid}</p>
            <p><strong>Profile Email:</strong> {profile.email}</p>
            <p><strong>Profile Display Name:</strong> {profile.displayName}</p>
            <p><strong>Profile Role:</strong> {profile.role}</p>
            <p><strong>Profile Role (lowercase):</strong> {profile.role?.toLowerCase()}</p>
            <p><strong>Is Admin:</strong> {profile.role?.toLowerCase() === 'admin' ? 'Oui' : 'Non'}</p>
            <p><strong>Secteurs:</strong> {profile.secteurs?.join(', ') || 'Aucun'}</p>
          </>
        )}
      </div>
    </div>
  );
};
