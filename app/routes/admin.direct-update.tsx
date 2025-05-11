import React, { useState } from 'react';
import { json, redirect } from '@remix-run/node';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { useActionData, useLoaderData, useSearchParams, Form } from '@remix-run/react';
import { getAllUserProfilesSdk, updateUserProfileSdk } from '~/services/firestore.service.server'; // Modifié pour Firestore
import type { UserProfile as FirestoreUserProfile } from '~/types/firestore.types'; // Importer le type UserProfile de Firestore

interface UserInfo {
  uid: string;
  displayName?: string;
  email?: string;
  role?: string;
}

interface LoaderData {
  users: UserInfo[];
  error?: string;
}

interface ActionData {
  success: boolean;
  message?: string;
  error?: string;
}

// Loader pour obtenir la liste des utilisateurs
export async function loader({ request }: LoaderFunctionArgs): Promise<ReturnType<typeof json>> {
  const url = new URL(request.url);
  if (url.searchParams.get("dev_bypass") !== "true") {
    url.searchParams.set("dev_bypass", "true");
    console.log('[admin.direct-update] Activation automatique du mode bypass');
    return redirect(url.toString());
  }

  try {
    const users: FirestoreUserProfile[] = await getAllUserProfilesSdk(); // Modifié pour Firestore
    return json({ 
      users: users.map(user => ({
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        role: user.role
      }))
    } as LoaderData);
  } catch (error) {
    return json({ 
      error: error instanceof Error ? error.message : "Erreur inconnue en récupérant les utilisateurs via Firestore",
      users: []
    } as LoaderData);
  }
}

// Action pour traiter les mises à jour
export async function action({ request }: ActionFunctionArgs): Promise<ReturnType<typeof json>> {
  try {
    const formData = await request.formData();
    const userId = formData.get('userId') as string;
    const role = formData.get('role') as string;
    const displayName = formData.get('displayName') as string;
    
    if (!userId) {
      return json({ success: false, error: "ID utilisateur manquant" } as ActionData);
    }
    
    const updates: Record<string, any> = {};
    if (displayName) updates.displayName = displayName;
    if (role) updates.role = role;
    
    if (Object.keys(updates).length === 0) {
      return json({ success: false, error: "Aucune donnée à mettre à jour" } as ActionData);
    }

    console.log(`[admin.direct-update] Mise à jour directe de l'utilisateur ${userId} via Firestore:`, updates);
    
    await updateUserProfileSdk(userId, updates); // Modifié pour Firestore
    
    return json({ success: true, message: "Utilisateur mis à jour avec succès via Firestore" } as ActionData);
  } catch (error) {
    console.error('[admin.direct-update] Erreur de mise à jour:', error);
    return json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Erreur inconnue lors de la mise à jour"
    } as ActionData);
  }
}

export default function DirectUpdate() {
  const data = useLoaderData<LoaderData>();
  const actionResult = useActionData<ActionData>();
  const [searchParams] = useSearchParams();
  
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleSubmit = (e: React.FormEvent) => {
    setIsSubmitting(true);
  };
  
  return (
    <div className="bg-jdc-gray-900 p-6 rounded-lg">
      <h1 className="text-2xl font-bold text-white mb-6">Mise à jour directe d'utilisateur</h1>
      
      <div className="mb-4 bg-amber-900/30 p-3 rounded border border-amber-700">
        <p className="text-amber-300 text-sm">Mode bypass activé: {searchParams.get("dev_bypass") === "true" ? "Oui" : "Non"}</p>
      </div>
      
      {actionResult && (
        <div className={`mb-6 p-4 rounded border ${actionResult.success ? 'bg-green-900/30 border-green-700' : 'bg-red-900/30 border-red-700'}`}>
          <p className={actionResult.success ? 'text-green-400' : 'text-red-400'}>
            {actionResult.success 
              ? actionResult.message || "Opération terminée"
              : actionResult.error || "Erreur lors de l'opération"}
          </p>
        </div>
      )}
      
      {data.error && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded">
          <p className="text-red-400">Erreur de chargement: {data.error}</p>
        </div>
      )}
      
      <Form method="post" action="/admin/action" className="space-y-6" onSubmit={handleSubmit}>
        <input type="hidden" name="dev_bypass" value="true" />
        
        <div>
          <label className="block text-white mb-2">Sélectionner un utilisateur</label>
          <select 
            name="userId" 
            className="w-full bg-jdc-gray-800 text-white p-2 rounded border border-jdc-gray-700"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            required
          >
            <option value="">-- Sélectionner un utilisateur --</option>
            {data.users.map(user => (
              <option key={user.uid} value={user.uid}>
                {user.displayName || user.email} ({user.role})
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-white mb-2">Nom d'affichage (laisser vide pour ne pas changer)</label>
          <input 
            type="text"
            name="displayName"
            className="w-full bg-jdc-gray-800 text-white p-2 rounded border border-jdc-gray-700"
            placeholder={data.users.find(u => u.uid === selectedUserId)?.displayName || "Nom actuel"}
          />
        </div>
        
        <div>
          <label className="block text-white mb-2">Rôle (laisser vide pour ne pas changer)</label>
          <select 
            name="role"
            className="w-full bg-jdc-gray-800 text-white p-2 rounded border border-jdc-gray-700"
            defaultValue=""
          >
            <option value="">-- Conserver le rôle actuel --</option>
            <option value="Admin">Admin</option>
            <option value="Technician">Technician</option>
            <option value="Viewer">Viewer</option>
          </select>
        </div>
        
        <div className="flex justify-end space-x-3">
          <a 
            href="/admin"
            className="px-4 py-2 bg-jdc-gray-700 text-white rounded"
          >
            Retour
          </a>
          <button
            type="submit"
            className="px-4 py-2 bg-jdc-blue text-white rounded hover:bg-blue-700 disabled:opacity-50"
            disabled={!selectedUserId || isSubmitting}
          >
            {isSubmitting ? "Mise à jour en cours..." : "Mettre à jour"}
          </button>
        </div>
      </Form>
    </div>
  );
}
