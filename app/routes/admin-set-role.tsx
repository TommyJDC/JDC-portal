import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData } from "@remix-run/react";
import { useState } from "react";
import { getUserProfileSdk, updateUserProfileSdk } from "~/services/firestore.service.server";
import type { UserProfile } from "~/types/firestore.types";

type ActionData = 
  | { success: true; message: string; profile: { email: string; role: string; displayName: string } }
  | { success: false; message: string; currentRole?: string };

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const userId = formData.get("userId") as string;
    const newRole = formData.get("role") as UserProfile['role']; // Utiliser le type UserProfile['role']
    
    if (!userId || !newRole) {
      return json<ActionData>({ success: false, message: "ID utilisateur et rôle requis" });
    }
    
    console.log(`AdminSetRole: Tentative de modification du rôle pour l'utilisateur ${userId} en ${newRole}`);
    
    // Récupérer le profil actuel
    const profile = await getUserProfileSdk(userId);
    if (!profile) {
      return json<ActionData>({ success: false, message: `Utilisateur ${userId} non trouvé` });
    }
    
    console.log(`AdminSetRole: Profil actuel - Email: ${profile.email}, Rôle: ${profile.role}`);
    
    // Mettre à jour le rôle
    await updateUserProfileSdk(userId, {
      role: newRole,
      // updatedAt: new Date() // Supprimé car non présent dans UserProfile
    });
    
    // Vérifier la mise à jour
    const updatedProfile = await getUserProfileSdk(userId);
    
    if (updatedProfile && updatedProfile.role === newRole) {
      return json<ActionData>({ 
        success: true, 
        message: `Succès: Le rôle de l'utilisateur ${userId} a été modifié en ${newRole}`,
        profile: {
          email: updatedProfile.email || "",
          role: updatedProfile.role || "Unknown",
          displayName: updatedProfile.displayName || ""
        }
      });
    } else {
      return json<ActionData>({ 
        success: false, 
        message: `Échec: Le rôle n'a pas été modifié correctement`,
        currentRole: updatedProfile?.role
      });
    }
  } catch (error: any) {
    console.error("AdminSetRole Error:", error);
    return json<ActionData>({ 
      success: false, 
      message: `Erreur: ${error.message || "Erreur inconnue"}` 
    });
  }
}

export default function AdminSetRole() {
  const actionData = useActionData<typeof action>();
  const [userId, setUserId] = useState("105906689661054220398"); // ID de Tommy VILMEN par défaut
  
  return (
    <div className="p-6 max-w-xl mx-auto bg-white shadow-md rounded-lg mt-8">
      <h1 className="text-2xl font-bold mb-6">Modifier le rôle d'un utilisateur</h1>
      
      <Form method="post" className="space-y-4">
        <div>
          <label htmlFor="userId" className="block text-sm font-medium mb-1">
            ID Utilisateur
          </label>
          <input
            type="text"
            id="userId"
            name="userId"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
            required
          />
        </div>
        
        <div>
          <label htmlFor="role" className="block text-sm font-medium mb-1">
            Nouveau rôle
          </label>
          <select
            id="role"
            name="role"
            className="w-full border border-gray-300 rounded px-3 py-2"
            defaultValue="Admin"
          >
            <option value="Admin">Admin</option>
            <option value="Technician">Technician</option>
            <option value="Logistics">Logistics</option>
            <option value="Client">Client</option>
            <option value="Other">Other</option>
          </select>
        </div>
        
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Modifier le rôle
        </button>
      </Form>
      
      {actionData && (
        <div className={`mt-4 p-3 rounded ${actionData.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          <p className="font-semibold">{actionData.message}</p>
          
          {actionData.success && actionData.profile && (
            <div className="mt-2">
              <p><span className="font-medium">Email:</span> {actionData.profile.email}</p>
              <p><span className="font-medium">Rôle:</span> {actionData.profile.role}</p>
              <p><span className="font-medium">Nom:</span> {actionData.profile.displayName}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
