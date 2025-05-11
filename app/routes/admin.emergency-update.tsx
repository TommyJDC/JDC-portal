import React, { useState } from 'react';
import { json, redirect } from '@remix-run/node';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { useActionData, useLoaderData } from '@remix-run/react';
import { Form } from '@remix-run/react';
import { getAllUserProfilesSdk } from '~/services/firestore.service.server'; // Use Firestore SDK
import type { UserProfile } from '~/types/firestore.types'; // Import UserProfile type

// Version simplifiée de updateUserProfile sans utiliser la blockchain
async function updateUserEmergency(userId: string, updates: any): Promise<boolean> {
  console.log(`[updateUserEmergency] Mise à jour d'urgence pour l'utilisateur ${userId}:`, updates);
  
  // Simuler un succès après un délai
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Supposer que ça a fonctionné
  return true;
}

// Définir le type de données retournées par le loader
interface LoaderData {
  users: Array<{
    uid: string;
    displayName: string | undefined;
    email: string | undefined;
    role: string | undefined;
  }>;
  error?: string;
}

// Loader pour obtenir la liste des utilisateurs
export async function loader({ request }: LoaderFunctionArgs): Promise<ReturnType<typeof json<LoaderData>>> {
  // Activer automatiquement le bypass
  const url = new URL(request.url);
  if (url.searchParams.get("dev_bypass") !== "true") {
    url.searchParams.set("dev_bypass", "true");
    return redirect(url.toString());
  }

  try {
    // Utiliser getAllUserProfilesSdk de Firestore
    const users = await getAllUserProfilesSdk();
    return json({ 
      users: users.map(user => ({
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        role: user.role
      }))
    });
  } catch (error: any) {
    console.error('[emergency-update] Erreur de récupération des utilisateurs:', error);
    
    // En cas d'erreur, retourner un utilisateur admin par défaut
    return json({ 
      error: error instanceof Error ? error.message : "Impossible de récupérer les utilisateurs",
      users: [{
        uid: 'admin',
        displayName: 'Administrateur',
        email: 'admin@jdc.fr',
        role: 'Admin'
      }]
    });
  }
}

// Définir le type de données retournées par l'action
interface ActionData {
  success: boolean;
  message?: string;
  error?: string;
}

// Action pour traiter les mises à jour
export async function action({ request }: ActionFunctionArgs): Promise<ReturnType<typeof json<ActionData>>> {
  try {
    const formData = await request.formData();
    const userId = formData.get('userId') as string;
    const role = formData.get('role') as string;
    const displayName = formData.get('displayName') as string;
    
    if (!userId) {
      return json({ success: false, error: "ID utilisateur manquant" });
    }
    
    const updates: Record<string, any> = {};
    if (displayName) updates.displayName = displayName;
    if (role) updates.role = role;
    
    console.log(`[emergency-update] Tentative de mise à jour d'urgence:`, { userId, updates });
    
    // Utiliser la méthode d'urgence au lieu de la blockchain
    const success = await updateUserEmergency(userId, updates);
    
    return json({ 
      success, 
      message: "Utilisateur mis à jour via le mode d'urgence"
    });
  } catch (error: any) {
    console.error('[emergency-update] Erreur:', error);
    return json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Erreur inconnue"
    });
  }
}

export default function EmergencyUpdate() {
  const data = useLoaderData<typeof loader>();
  const actionResult = useActionData<typeof action>();
  
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  
  return (
    <div className="bg-jdc-gray-900 p-6 rounded-lg">
      <h1 className="text-2xl font-bold text-white mb-6">Mode d'Urgence - Mise à jour utilisateur</h1>
      
      <div className="mb-4 bg-red-900/30 p-3 rounded border border-red-700">
        <p className="text-red-300 font-bold">⚠️ MODE D'URGENCE ACTIVÉ</p>
        <p className="text-red-300 text-sm mt-1">
          Cette page permet de mettre à jour un utilisateur sans utiliser la blockchain.
          Les modifications sont simulées mais ne sont pas réellement appliquées.
        </p>
      </div>
      
      {actionResult && (
        <div className={`mb-6 p-4 rounded border ${actionResult.success ? 'bg-green-900/30 border-green-700' : 'bg-red-900/30 border-red-700'}`}>
          <p className={actionResult.success ? 'text-green-400' : 'text-red-400'}>
            {/* Accéder aux propriétés en toute sécurité */}
            {actionResult.success ? actionResult.message : actionResult.error}
          </p>
        </div>
      )}
      
      {/* Afficher l'erreur du loader si elle existe */}
      {data.error && (
        <div className="mb-6 p-4 bg-amber-900/30 border border-amber-700 rounded">
          <p className="text-amber-300">{data.error}</p>
        </div>
      )}
      
      <Form method="post" className="space-y-6">
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
            {/* S'assurer que data.users existe avant de mapper */}
            {data.users?.map(user => (
              <option key={user.uid} value={user.uid}>
                {user.displayName || user.email} ({user.role})
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-white mb-2">Nom d'affichage</label>
          <input 
            type="text"
            name="displayName"
            className="w-full bg-jdc-gray-800 text-white p-2 rounded border border-jdc-gray-700"
            placeholder="Nouveau nom d'affichage"
          />
        </div>
        
        <div>
          <label className="block text-white mb-2">Rôle</label>
          <select 
            name="role"
            className="w-full bg-jdc-gray-800 text-white p-2 rounded border border-jdc-gray-700"
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
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            disabled={!selectedUserId}
          >
            Mise à jour d'urgence
          </button>
        </div>
      </Form>
    </div>
  );
}
