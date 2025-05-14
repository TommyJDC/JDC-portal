import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { getEmails } from "~/services/email.service.server";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const result = await getEmails();
    return json(result);
  } catch (error) {
    return json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Erreur inconnue" 
    }, { status: 500 });
  }
} 