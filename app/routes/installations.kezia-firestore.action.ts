import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticator } from "~/services/auth.server";
import { updateInstallation } from "~/services/firestore.service.server";

export interface ActionData {
  success?: boolean;
  error?: string;
}

export const action = async ({ request }: ActionFunctionArgs): Promise<Response> => {
  const session = await authenticator.isAuthenticated(request);
  if (!session) {
    return json({ error: "Non authentifié" }, { status: 401 });
  }

  const formData = await request.formData();
  const id = formData.get("id");
  const updates = JSON.parse(formData.get("updates") as string);

  if (!id || !updates) {
    return json({ error: "Données manquantes" }, { status: 400 });
  }

  try {
    await updateInstallation(id as string, updates);
    return json({ success: true });
  } catch (error: any) {
    console.error("[installations.kezia Action] Error:", error);
    return json({ error: error.message }, { status: 500 });
  }
};