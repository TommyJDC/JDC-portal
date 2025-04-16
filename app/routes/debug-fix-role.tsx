import { json, LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { authenticator } from "~/services/auth.server";
import { getUserProfileSdk, updateUserProfileSdk } from "~/services/firestore.service.server";
import { useState } from "react";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await authenticator.isAuthenticated(request);
  
  let profile = null;
  if (user?.userId) {
    try {
      profile = await getUserProfileSdk(user.userId);
    } catch (error) {
      console.error("Error loading profile:", error);
    }
  }
  
  return json({ user, profile });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const userId = formData.get("userId") as string;
  const newRole = formData.get("role") as string;
  
  if (!userId || !newRole) {
    return json({ success: false, error: "ID utilisateur et rôle sont requis" });
  }
  
  try {
    await updateUserProfileSdk(userId, { role: newRole });
    return json({ success: true, message: `Rôle mis à jour avec succès pour l'utilisateur ${userId}` });
  } catch (error: any) {
    return json({ success: false, error: error.message || "Erreur lors de la mise à jour du rôle" });
  }
}

export default function DebugFixRole() {
  const { user, profile } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [customUserId, setCustomUserId] = useState("");
  const [useCustomId, setUseCustomId] = useState(false);
  
  return (
    <div className="max-w-4xl mx-auto py-8">
      <h1 className="text-2xl font-bold text-white mb-6">Correction du rôle utilisateur</h1>
      
      {actionData && (
        <div className={`p-4 mb-6 rounded ${actionData.success ? 'bg-green-900/50 border border-green-700' : 'bg-red-900/50 border border-red-700'}`}>
          <p className="text-white">
            {actionData.success 
              ? ('message' in actionData ? actionData.message : 'Opération réussie') 
              : ('error' in actionData ? actionData.error : 'Une erreur est survenue')}
          </p>
        </div>
      )}
      
      <div className="bg-jdc-blue-darker p-6 rounded-lg mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">Informations actuelles</h2>
        
        {user ? (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-jdc-gray-300"><strong>ID Utilisateur:</strong> {user.userId}</p>
              <p className="text-jdc-gray-300"><strong>Email:</strong> {user.email}</p>
            </div>
            {profile && (
              <div>
                <p className="text-jdc-gray-300"><strong>Nom:</strong> {profile.displayName}</p>
                <p className="text-jdc-gray-300">
                  <strong>Rôle actuel:</strong>{" "}
                  <span className={profile.role?.toLowerCase() === 'admin' ? 'text-green-400' : 'text-yellow-400'}>
                    {profile.role || "Non défini"}
                  </span>
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-red-400 mb-4">Vous n'êtes pas connecté. Connectez-vous pour voir vos informations.</p>
        )}
        
        <div className="mb-4">
          <label className="flex items-center space-x-2 text-jdc-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={useCustomId}
              onChange={() => setUseCustomId(!useCustomId)}
              className="rounded text-blue-500 focus:ring-blue-500"
            />
            <span>Utiliser un ID personnalisé</span>
          </label>
        </div>
        
        <Form method="post" className="space-y-4">
          {useCustomId ? (
            <div>
              <label htmlFor="userId" className="block text-sm font-medium text-jdc-gray-300 mb-1">
                ID Utilisateur personnalisé
              </label>
              <Input
                id="userId"
                name="userId"
                value={customUserId}
                onChange={(e) => setCustomUserId(e.target.value)}
                placeholder="Entrez l'ID utilisateur"
                required
              />
            </div>
          ) : (
            user && (
              <input type="hidden" name="userId" value={user.userId} />
            )
          )}
          
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-jdc-gray-300 mb-1">
              Nouveau rôle
            </label>
            <select
              id="role"
              name="role"
              className="w-full bg-jdc-gray-800 border border-jdc-gray-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              defaultValue={profile?.role || "Admin"}
              required
            >
              <option value="Admin">Admin</option>
              <option value="Technician">Technician</option>
              <option value="Viewer">Viewer</option>
            </select>
          </div>
          
          <div className="pt-2">
            <Button
              type="submit"
              disabled={!user && !useCustomId}
              className="w-full"
            >
              Mettre à jour le rôle
            </Button>
          </div>
        </Form>
      </div>
      
      <div className="bg-yellow-900/30 p-6 rounded-lg border border-yellow-800">
        <h2 className="text-xl font-semibold text-white mb-4">Instructions</h2>
        <ul className="list-disc list-inside text-jdc-gray-300 space-y-2">
          <li>Utilisez cet outil pour corriger le rôle d'un utilisateur dans Firestore.</li>
          <li>Par défaut, votre propre ID utilisateur est utilisé.</li>
          <li>Cochez "Utiliser un ID personnalisé" pour mettre à jour le rôle d'un autre utilisateur.</li>
          <li>Après la mise à jour, vous devrez vous déconnecter et vous reconnecter pour que les changements prennent effet.</li>
          <li>Le rôle "Admin" donne accès au panneau d'administration.</li>
        </ul>
        
        <div className="mt-4 flex space-x-4">
          <a href="/debug" className="text-blue-400 hover:underline">Retour au diagnostic</a>
          <a href="/" className="text-blue-400 hover:underline">Retour à l'accueil</a>
        </div>
      </div>
    </div>
  );
}
