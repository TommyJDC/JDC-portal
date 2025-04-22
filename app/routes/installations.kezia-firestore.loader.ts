import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { authenticator } from "~/services/auth.server";
import { 
  getInstallationsBySector, 
  getClientCodesWithShipment
} from "~/services/firestore.service.server";
import type { Installation } from "~/types/firestore.types";

export interface LoaderData {
  installations: Installation[];
  shippedClientCodes: string[];
  error?: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const session = await authenticator.isAuthenticated(request);
  if (!session) {
    return redirect("/auth/google");
  }

  const sector = 'kezia';

  try {
    const [installations, shippedClientCodesSet] = await Promise.all([
      getInstallationsBySector(sector),
      getClientCodesWithShipment(sector)
    ]);

    const shippedClientCodes: string[] = Array.from(shippedClientCodesSet).map(code => String(code));

    return json<LoaderData>({ installations, shippedClientCodes });
  } catch (error) {
    console.error(`Error loading ${sector} installations or shipments:`, error);
    return json<LoaderData>({ 
      installations: [], 
      shippedClientCodes: [],
      error: `Erreur lors du chargement des installations ${sector}` 
    }, { status: 500 });
  }
};