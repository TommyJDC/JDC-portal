import React, { useState } from 'react';
import { json } from '@remix-run/node';
import type { ActionFunctionArgs } from '@remix-run/node';
import { Form, useActionData } from '@remix-run/react';

// Action simplifiée pour test
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  console.log('Données du formulaire reçues:', Object.fromEntries(formData));
  
  const userId = formData.get('userId') as string;
  const displayName = formData.get('displayName') as string;
  const role = formData.get('role') as string;
  
  // Simuler une mise à jour réussie
  return json({ 
    success: true, 
    message: `Utilisateur ${userId} mis à jour avec nom=${displayName}, role=${role}` 
  });
}

export default function SimpleUpdate() {
  const actionData = useActionData<typeof action>();
  const [userId, setUserId] = useState('user_123');
  
  return (
    <div className="bg-jdc-gray-900 p-6 rounded-lg">
      <h1 className="text-2xl font-bold text-white mb-6">Mise à jour simplifiée</h1>
      
      {actionData && (
        <div className="mb-6 p-4 rounded border bg-green-900/30 border-green-700">
          <p className="text-green-400">
            {actionData.success 
              ? actionData.message 
              : 'Erreur lors de la mise à jour'}
          </p>
        </div>
      )}
      
      <Form method="post" className="space-y-4">
        <div>
          <label className="block text-white mb-2">ID Utilisateur</label>
          <input 
            type="text" 
            name="userId" 
            value={userId} 
            onChange={e => setUserId(e.target.value)}
            className="w-full bg-jdc-gray-800 text-white p-2 rounded border border-jdc-gray-700"
          />
        </div>
        
        <div>
          <label className="block text-white mb-2">Nom d'affichage</label>
          <input 
            type="text" 
            name="displayName" 
            defaultValue="Nouveau nom"
            className="w-full bg-jdc-gray-800 text-white p-2 rounded border border-jdc-gray-700"
          />
        </div>
        
        <div>
          <label className="block text-white mb-2">Rôle</label>
          <select 
            name="role"
            className="w-full bg-jdc-gray-800 text-white p-2 rounded border border-jdc-gray-700"
            defaultValue="Admin"
          >
            <option value="Admin">Admin</option>
            <option value="Technician">Technician</option>
            <option value="Viewer">Viewer</option>
          </select>
        </div>
        
        <div className="flex justify-end space-x-3 mt-6">
          <a 
            href="/admin"
            className="px-4 py-2 bg-jdc-gray-700 text-white rounded"
          >
            Retour
          </a>
          <button
            type="submit"
            className="px-4 py-2 bg-jdc-blue text-white rounded hover:bg-blue-700"
          >
            Mettre à jour
          </button>
        </div>
      </Form>
    </div>
  );
} 