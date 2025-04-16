import React, { useState } from 'react';
import { json } from '@remix-run/node';
import { Form, useActionData } from '@remix-run/react';
import { Button } from '~/components/ui/Button';
import { Input } from '~/components/ui/Input';
import { doc, getDoc } from 'firebase/firestore';
import { db as clientDb } from '~/firebase.config';
import type { ActionFunctionArgs } from '@remix-run/node';

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const userId = formData.get('userId') as string;
  
  if (!userId) {
    return json({ error: 'ID utilisateur requis' });
  }
  
  return json({ userId });
}

export default function DebugProfile() {
  const actionData = useActionData<typeof action>();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fetchProfile = async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const userDocRef = doc(clientDb, 'users', userId);
      console.log(`[Debug] Document reference created for 'users/${userId}'`);
      
      const userDocSnap = await getDoc(userDocRef);
      console.log(`[Debug] Document snapshot retrieved, exists: ${userDocSnap.exists()}`);
      
      if (userDocSnap.exists()) {
        const data = userDocSnap.data();
        console.log(`[Debug] Raw data from Firestore:`, data);
        setProfile(data);
      } else {
        setError(`Aucun profil trouvé pour l'ID: ${userId}`);
        setProfile(null);
      }
    } catch (err: any) {
      console.error(`[Debug] Error fetching profile:`, err);
      setError(`Erreur: ${err.message}`);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch profile when userId is available from action
  React.useEffect(() => {
    if (actionData && 'userId' in actionData && actionData.userId) {
      fetchProfile(actionData.userId);
    }
  }, [actionData]);
  
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Débogage Profil Utilisateur</h1>
      
      <div className="bg-jdc-blue-darker p-6 rounded-lg mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">Récupérer un profil par ID</h2>
        <Form method="post" className="flex gap-4 items-end">
          <div className="flex-1">
            <label htmlFor="userId" className="block text-sm font-medium text-jdc-gray-300 mb-1">
              ID Utilisateur
            </label>
            <Input
              id="userId"
              name="userId"
              placeholder="Entrez l'ID utilisateur"
              defaultValue={(actionData && 'userId' in actionData) ? actionData.userId : ''}
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? 'Chargement...' : 'Récupérer le profil'}
          </Button>
        </Form>
        
        {error && (
          <div className="mt-4 p-3 bg-red-900/50 border border-red-700 rounded text-white">
            {error}
          </div>
        )}
      </div>
      
      {profile && (
        <div className="bg-jdc-blue-darker p-6 rounded-lg">
          <h2 className="text-xl font-semibold text-white mb-4">Profil Trouvé</h2>
          <div className="bg-jdc-gray-800 p-4 rounded overflow-auto max-h-96">
            <pre className="text-jdc-gray-300 whitespace-pre-wrap">
              {JSON.stringify(profile, null, 2)}
            </pre>
          </div>
          
          <div className="mt-6 space-y-2">
            <h3 className="text-lg font-medium text-white">Informations importantes</h3>
            <p><strong className="text-jdc-yellow">Email:</strong> {profile.email}</p>
            <p><strong className="text-jdc-yellow">Nom:</strong> {profile.displayName}</p>
            <p><strong className="text-jdc-yellow">Rôle:</strong> {profile.role}</p>
            <p><strong className="text-jdc-yellow">Type du rôle:</strong> {typeof profile.role}</p>
            <p><strong className="text-jdc-yellow">Rôle (minuscules):</strong> {profile.role?.toLowerCase()}</p>
            <p><strong className="text-jdc-yellow">Est Admin:</strong> {profile.role?.toLowerCase() === 'admin' ? 'Oui' : 'Non'}</p>
            <p><strong className="text-jdc-yellow">Secteurs:</strong> {profile.secteurs?.join(', ') || 'Aucun'}</p>
          </div>
        </div>
      )}
    </div>
  );
}
