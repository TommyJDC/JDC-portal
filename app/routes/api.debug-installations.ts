import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
// import { debugInstallationsData } from "~/services/blockchain.service.server"; // Supprimé
import { getAllInstallations } from "~/services/firestore.service.server"; // Importation pour déboguer Firestore

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    console.log("[api.debug-installations] Début du débogage des installations Firestore");
    
    // Optionnel: Ajouter une vérification d'authentification/autorisation si nécessaire
    // const user = await authenticator.isAuthenticated(request);
    // if (!user || user.role !== 'Admin') {
    //   return json({ error: "Accès non autorisé" }, { status: 403 });
    // }

    const installations = await getAllInstallations(); // Récupère toutes les installations de Firestore
    
    console.log(`[api.debug-installations] ${installations.length} installations récupérées de Firestore.`);
    
    // Retourne un sous-ensemble ou un résumé pour éviter de surcharger la réponse
    // si le nombre d'installations est très grand.
    // Pour un vrai débogage, on pourrait vouloir les données complètes ou des statistiques.
    return json({
      message: "Débogage des installations via Firestore.",
      count: installations.length,
      sample: installations.slice(0, 5), // Un échantillon des 5 premières installations
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("[api.debug-installations] Erreur:", error);
    return json({ 
      error: "Erreur lors du débogage des installations Firestore",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
};
