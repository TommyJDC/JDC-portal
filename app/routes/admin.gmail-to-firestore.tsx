import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node"; // Response supprimée de l'import
import { Form, useActionData, useNavigation } from "@remix-run/react";
// import { authenticator } from "~/services/auth.server"; // Plus utilisé directement
import { requireAdminUser } from "~/services/auth-utils.server"; // Pour le loader
import { sessionStorage, type UserSessionData } from "~/services/session.server"; // Pour l'action
import { getUserProfileSdk } from "~/services/firestore.service.server";
import { getGoogleAuthClient } from "~/services/google.server";
import { processGmailToFirestore } from "~/services/gmail.service.server";
import { initializeFirebaseAdmin } from "~/firebase.admin.config.server";
import type { GmailProcessingConfig } from "~/types/firestore.types";

/**
 * Loader pour vérifier l'authentification et les autorisations
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    await requireAdminUser(request); // Vérifie l'authentification et le rôle Admin, lance une Response en cas d'échec
    return json({ ok: true });
  } catch (error) {
    // Si requireAdminUser lance une Response (redirection ou erreur), la relancer
    if (error instanceof Response) {
      throw error;
    }
    // Gérer d'autres erreurs potentielles du loader
    console.error("[admin.gmail-to-firestore] Erreur inattendue dans le loader:", error);
    throw new Response("Erreur interne du serveur", { status: 500 });
  }
}

/**
 * Action pour traiter les emails Gmail et les envoyer à Firestore
 */
export async function action({ request }: ActionFunctionArgs) {
  try {
    // Vérifier l'authentification manuellement pour l'action
    const cookie = request.headers.get("Cookie");
    const sessionStore = await sessionStorage.getSession(cookie);
    const userSession: UserSessionData | null = sessionStore.get("user") ?? null;

    if (!userSession || !userSession.userId) {
      return json({ success: false, error: "Non authentifié (session manuelle)" }, { status: 401 });
    }

    // Vérifier si l'utilisateur a le rôle Admin
    const userProfile = await getUserProfileSdk(userSession.userId);
    if (!userProfile || userProfile.role?.toLowerCase() !== "admin") {
      return json({ success: false, error: "Accès non autorisé. Rôle Admin requis." }, { status: 403 });
    }

    // Obtenir le client Google authentifié en utilisant userSession
    const authClient = await getGoogleAuthClient(userSession);
    if (!authClient) {
      return json({ success: false, error: "Impossible d'obtenir le client Google authentifié" }, { status: 500 });
    }

    // Récupérer la configuration Gmail
    const dbAdmin = await initializeFirebaseAdmin();
    const configDoc = await dbAdmin.collection('settings').doc('gmailProcessingConfig').get();
    const config = configDoc.exists ? configDoc.data() as GmailProcessingConfig : {
      maxEmailsPerRun: 50,
      processedLabelName: "Traité-JDC-Portail",
      refreshInterval: 15,
      sectorCollections: {
        kezia: { enabled: false, labels: [], responsables: [] },
        haccp: { enabled: false, labels: [], responsables: [] },
        chr: { enabled: false, labels: [], responsables: [] },
        tabac: { enabled: false, labels: [], responsables: [] }
      }
    };

    // Traiter les emails et les envoyer à Firestore
    console.log("[Admin Gmail-to-Firestore] Début du traitement");
    const result = await processGmailToFirestore(authClient, config);
    console.log("[Admin Gmail-to-Firestore] Résultat:", result);

    return json({ success: true, message: "Traitement Gmail vers Firestore terminé avec succès" });
  } catch (error) {
    console.error("[Admin Gmail-to-Firestore] Erreur:", error);
    return json(
      { 
        success: false, 
        error: `Erreur lors du traitement: ${error instanceof Error ? error.message : String(error)}` 
      }, 
      { status: 500 }
    );
  }
}

/**
 * Composant pour la page d'administration Gmail vers Firestore
 */
export default function AdminGmailToFirestore() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Traitement Gmail vers Firestore</h1>
      
      <div className="bg-white shadow-md rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">À propos de cette fonctionnalité</h2>
        <p className="mb-4">
          Cette page vous permet de déclencher manuellement le processus qui extrait les données des emails Gmail 
          et les envoie aux collections Firestore configurées (Kezia, HACCP, CHR, Tabac) selon les paramètres définis 
          dans la page de configuration Gmail.
        </p>
        <p className="mb-4">
          Le processus effectue les opérations suivantes :
        </p>
        <ol className="list-decimal list-inside mb-4 space-y-2">
          <li>Extraction des données des emails avec les labels configurés</li>
          <li>Normalisation des numéros SAP</li>
          <li>Vérification des doublons par collection</li>
          <li>Envoi des nouvelles données vers les collections Firestore sélectionnées</li>
          <li>Application du label "Traité" aux emails traités</li>
        </ol>
        <p className="text-sm text-gray-600">
          Note : Ce processus utilise votre compte Google authentifié pour accéder à Gmail.
        </p>
      </div>

      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Lancer le traitement</h2>
        <Form method="post">
          <button
            type="submit"
            disabled={isSubmitting}
            className={`px-4 py-2 rounded-md text-white font-medium ${
              isSubmitting 
                ? "bg-blue-400 cursor-not-allowed" 
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {isSubmitting ? "Traitement en cours..." : "Lancer le traitement"}
          </button>
        </Form>

          {actionData ? (
            <div className={`mt-4 p-4 rounded-md ${
              actionData.success 
                ? "bg-green-100 text-green-800" 
                : "bg-red-100 text-red-800"
            }`}>
              {actionData.success 
                ? (actionData as { success: true; message: string }).message 
                : `Erreur: ${(actionData as { success: false; error: string }).error}`
              }
            </div>
          ) : isSubmitting ? (
            <div className="mt-4 p-4 bg-blue-100 text-blue-800 rounded-md">
              Traitement en cours... Veuillez patienter
            </div>
          ) : null}
      </div>
    </div>
  );
}
