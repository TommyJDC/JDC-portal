import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { useEffect, useState } from "react";
import { makeUserAdmin } from "~/services/make-admin.server";

export async function loader({ request }: LoaderFunctionArgs) {
  // ID visible dans les logs (Tommy VILMEN)
  const defaultId = "105906689661054220398";
  
  return json({ defaultId });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const userId = formData.get("userId") as string;
  
  if (!userId) {
    return json({ success: false, message: "ID utilisateur requis" });
  }
  
  const success = await makeUserAdmin(userId);
  
  return json({ 
    success, 
    message: success 
      ? `Utilisateur ${userId} promu Admin avec succès` 
      : `Échec de la promotion Admin pour ${userId}` 
  });
}

export default function MakeAdmin() {
  const { defaultId } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [userId, setUserId] = useState(defaultId);
  
  useEffect(() => {
    if (defaultId) {
      setUserId(defaultId);
    }
  }, [defaultId]);
  
  return (
    <div className="max-w-xl mx-auto p-6 bg-white shadow-md rounded-lg mt-8">
      <h1 className="text-2xl font-bold mb-6">Promotion Admin</h1>
      
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
        
        <div className="flex justify-end">
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Promouvoir Admin
          </button>
        </div>
      </Form>
      
      {actionData && (
        <div className={`mt-4 p-3 rounded ${actionData.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {actionData.message}
        </div>
      )}
    </div>
  );
} 