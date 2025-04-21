import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation, Link } from "@remix-run/react";
import { authenticator } from "~/services/auth.server";
import { getUserProfileSdk, getAllUserProfilesSdk, updateUserProfileSdk } from "~/services/firestore.service.server";
import { getGoogleAuthClient } from "~/services/google.server";
import type { UserProfile, GmailProcessingConfig } from "~/types/firestore.types";
import { initializeFirebaseAdmin } from "~/firebase.admin.config.server";
import type { UserSession } from "~/services/session.server";
import { google } from 'googleapis';

interface GmailLabel {
  id: string;
  name: string;
}

interface UserWithLabels extends UserProfile {
  gmailLabels?: GmailLabel[];
}

/**
 * Loader pour récupérer la configuration et les utilisateurs
 */
export async function loader({ request }: LoaderFunctionArgs) {
  // Vérifier l'authentification
  const session = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });

  // Vérifier si l'utilisateur a le rôle Admin
  const userProfile = await getUserProfileSdk(session.userId);
  if (!userProfile || userProfile.role !== "Admin") {
    throw new Response("Accès non autorisé", { status: 403 });
  }

  // Récupérer tous les utilisateurs
  const users = await getAllUserProfilesSdk();

  // Récupérer la configuration Gmail
  const dbAdmin = await initializeFirebaseAdmin();
  const configDoc = await dbAdmin.collection('settings').doc('gmailProcessingConfig').get();
  const config = configDoc.exists ? configDoc.data() as GmailProcessingConfig : {
    maxEmailsPerRun: 50,
    processedLabelName: "Traité",
    refreshInterval: 5,
    sectorCollections: {
      kezia: {
        enabled: false,
        labels: [],
        responsables: []
      },
      haccp: {
        enabled: false,
        labels: [],
        responsables: []
      },
      chr: {
        enabled: false,
        labels: [],
        responsables: []
      },
      tabac: {
        enabled: false,
        labels: [],
        responsables: []
      }
    }
  };

  // Pour chaque utilisateur connecté, récupérer leurs labels Gmail
  const usersWithLabels = await Promise.all(users.map(async (user) => {
    if (user.googleRefreshToken) {
      try {
        const session: UserSession = {
          userId: user.uid,
          email: user.email,
          displayName: user.displayName,
          googleRefreshToken: user.googleRefreshToken
        };
        const authClient = await getGoogleAuthClient(session);
        
        const gmail = google.gmail({ version: 'v1', auth: authClient });
        const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
        const labels = labelsResponse.data.labels || [];
        
        return {
          ...user,
          gmailLabels: labels.map(label => ({ id: label.id, name: label.name }))
        };
      } catch (error) {
        console.error(`Erreur lors de la récupération des labels pour ${user.email}:`, error);
        return user;
      }
    }
    return user;
  }));

  return json({ users: usersWithLabels, config });
}

/**
 * Action pour mettre à jour la configuration ou les utilisateurs
 */
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const action = formData.get("_action");

  try {
    // Vérifier l'authentification
    const session = await authenticator.isAuthenticated(request);
    if (!session) {
      return json({ success: false, error: "Non authentifié" }, { status: 401 });
    }

    // Vérifier si l'utilisateur a le rôle Admin
    const userProfile = await getUserProfileSdk(session.userId);
    if (!userProfile || userProfile.role !== "Admin") {
      return json({ success: false, error: "Accès non autorisé" }, { status: 403 });
    }

    switch (action) {
      case "updateConfig": {
        const maxEmailsPerRun = parseInt(formData.get("maxEmailsPerRun") as string);
        const processedLabelName = formData.get("processedLabelName") as string;
        const refreshInterval = parseInt(formData.get("refreshInterval") as string);

        // Récupérer les labels pour chaque collection
        const sectorCollections = {
          kezia: {
            enabled: formData.get("kezia-enabled") === "true",
            labels: (formData.get("kezia-labels") as string || "").split(",").map(l => l.trim()).filter(l => l),
            responsables: (formData.getAll("kezia-responsables") as string[]).map(r => r.trim()).filter(r => r)
          },
          haccp: {
            enabled: formData.get("haccp-enabled") === "true",
            labels: (formData.get("haccp-labels") as string || "").split(",").map(l => l.trim()).filter(l => l),
            responsables: (formData.getAll("haccp-responsables") as string[]).map(r => r.trim()).filter(r => r)
          },
          chr: {
            enabled: formData.get("chr-enabled") === "true",
            labels: (formData.get("chr-labels") as string || "").split(",").map(l => l.trim()).filter(l => l),
            responsables: (formData.getAll("chr-responsables") as string[]).map(r => r.trim()).filter(r => r)
          },
          tabac: {
            enabled: formData.get("tabac-enabled") === "true",
            labels: (formData.get("tabac-labels") as string || "").split(",").map(l => l.trim()).filter(l => l),
            responsables: (formData.getAll("tabac-responsables") as string[]).map(r => r.trim()).filter(r => r)
          }
        };

        const dbAdmin = await initializeFirebaseAdmin();
        await dbAdmin.collection('settings').doc('gmailProcessingConfig').set({
          maxEmailsPerRun,
          processedLabelName,
          refreshInterval,
          sectorCollections
        });

        return json({ success: true, message: "Configuration mise à jour avec succès" });
      }

      case "toggleProcessor": {
        const userId = formData.get("userId") as string;
        const isProcessor = formData.get("isProcessor") === "true";

        await updateUserProfileSdk(userId, {
          isGmailProcessor: isProcessor
        });

        return json({ success: true, message: "Statut du processeur mis à jour avec succès" });
      }

      default:
        return json({ success: false, error: "Action non reconnue" }, { status: 400 });
    }
  } catch (error) {
    console.error("Erreur lors de l'action:", error);
    return json(
      { 
        success: false, 
        error: `Erreur: ${error instanceof Error ? error.message : String(error)}` 
      }, 
      { status: 500 }
    );
  }
}

/**
 * Composant principal
 */
export default function AdminGmailConfig() {
  const { users, config } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Configuration du Traitement Gmail</h1>
        <Link to=".." className="text-jdc-blue hover:text-jdc-blue-dark">
          ← Retour au panneau d'administration
        </Link>
      </div>

      {/* Configuration générale */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Configuration Générale</h2>
        <Form method="post" className="space-y-4">
          <input type="hidden" name="_action" value="updateConfig" />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre d'emails à traiter par exécution
            </label>
            <input
              type="number"
              name="maxEmailsPerRun"
              defaultValue={config.maxEmailsPerRun}
              min="1"
              max="100"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom du label "Traité"
            </label>
            <input
              type="text"
              name="processedLabelName"
              defaultValue={config.processedLabelName}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Délai de rafraîchissement (minutes)
            </label>
            <input
              type="number"
              name="refreshInterval"
              defaultValue={config.refreshInterval}
              min="1"
              max="60"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">
              Configuration des collections
            </label>

            {/* Kezia */}
            <div className="border rounded-md p-4">
              <div className="flex items-center mb-2">
                <input
                  type="checkbox"
                  id="kezia-enabled"
                  name="kezia-enabled"
                  defaultChecked={config.sectorCollections.kezia.enabled}
                  value="true"
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
                <label htmlFor="kezia-enabled" className="ml-2 text-sm font-medium text-gray-700">
                  Kezia
                </label>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Labels Gmail (séparés par des virgules)
                </label>
                <input
                  type="text"
                  name="kezia-labels"
                  defaultValue={config.sectorCollections.kezia.labels.join(", ")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div className="mt-2">
                <label className="block text-sm text-gray-600 mb-1">
                  Responsables Kezia
                </label>
                <select
                  name="kezia-responsables"
                  multiple
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  defaultValue={config.sectorCollections.kezia.responsables || []}
                >
                  {users.filter(u => u.googleRefreshToken).map(user => (
                    <option key={user.uid} value={user.uid}>
                      {user.displayName} ({user.email})
                    </option>
                  ))}
                </select>
                <span className="text-xs text-gray-400">Maintenir Ctrl (Windows) ou Cmd (Mac) pour sélection multiple</span>
              </div>
            </div>

            {/* HACCP */}
            <div className="border rounded-md p-4">
              <div className="flex items-center mb-2">
                <input
                  type="checkbox"
                  id="haccp-enabled"
                  name="haccp-enabled"
                  defaultChecked={config.sectorCollections.haccp.enabled}
                  value="true"
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
                <label htmlFor="haccp-enabled" className="ml-2 text-sm font-medium text-gray-700">
                  HACCP
                </label>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Labels Gmail (séparés par des virgules)
                </label>
                <input
                  type="text"
                  name="haccp-labels"
                  defaultValue={config.sectorCollections.haccp.labels.join(", ")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div className="mt-2">
                <label className="block text-sm text-gray-600 mb-1">
                  Responsables HACCP
                </label>
                <select
                  name="haccp-responsables"
                  multiple
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  defaultValue={config.sectorCollections.haccp.responsables || []}
                >
                  {users.filter(u => u.googleRefreshToken).map(user => (
                    <option key={user.uid} value={user.uid}>
                      {user.displayName} ({user.email})
                    </option>
                  ))}
                </select>
                <span className="text-xs text-gray-400">Maintenir Ctrl (Windows) ou Cmd (Mac) pour sélection multiple</span>
              </div>
            </div>

            {/* CHR */}
            <div className="border rounded-md p-4">
              <div className="flex items-center mb-2">
                <input
                  type="checkbox"
                  id="chr-enabled"
                  name="chr-enabled"
                  defaultChecked={config.sectorCollections.chr.enabled}
                  value="true"
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
                <label htmlFor="chr-enabled" className="ml-2 text-sm font-medium text-gray-700">
                  CHR
                </label>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Labels Gmail (séparés par des virgules)
                </label>
                <input
                  type="text"
                  name="chr-labels"
                  defaultValue={config.sectorCollections.chr.labels.join(", ")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div className="mt-2">
                <label className="block text-sm text-gray-600 mb-1">
                  Responsables CHR
                </label>
                <select
                  name="chr-responsables"
                  multiple
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  defaultValue={config.sectorCollections.chr.responsables || []}
                >
                  {users.filter(u => u.googleRefreshToken).map(user => (
                    <option key={user.uid} value={user.uid}>
                      {user.displayName} ({user.email})
                    </option>
                  ))}
                </select>
                <span className="text-xs text-gray-400">Maintenir Ctrl (Windows) ou Cmd (Mac) pour sélection multiple</span>
              </div>
            </div>

            {/* Tabac */}
            <div className="border rounded-md p-4">
              <div className="flex items-center mb-2">
                <input
                  type="checkbox"
                  id="tabac-enabled"
                  name="tabac-enabled"
                  defaultChecked={config.sectorCollections.tabac.enabled}
                  value="true"
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
                <label htmlFor="tabac-enabled" className="ml-2 text-sm font-medium text-gray-700">
                  Tabac
                </label>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Labels Gmail (séparés par des virgules)
                </label>
                <input
                  type="text"
                  name="tabac-labels"
                  defaultValue={config.sectorCollections.tabac.labels.join(", ")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div className="mt-2">
                <label className="block text-sm text-gray-600 mb-1">
                  Responsables Tabac
                </label>
                <select
                  name="tabac-responsables"
                  multiple
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  defaultValue={config.sectorCollections.tabac.responsables || []}
                >
                  {users.filter(u => u.googleRefreshToken).map(user => (
                    <option key={user.uid} value={user.uid}>
                      {user.displayName} ({user.email})
                    </option>
                  ))}
                </select>
                <span className="text-xs text-gray-400">Maintenir Ctrl (Windows) ou Cmd (Mac) pour sélection multiple</span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`px-4 py-2 rounded-md text-white font-medium ${
              isSubmitting 
                ? "bg-blue-400 cursor-not-allowed" 
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {isSubmitting ? "Enregistrement..." : "Enregistrer la configuration"}
          </button>
        </Form>
      </div>

      {/* Gestion des responsables */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Gestion des Responsables</h2>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Utilisateur
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut Gmail
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Processeur Actif
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.uid}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{user.displayName}</div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      user.gmailAuthStatus === 'active' 
                        ? 'bg-green-100 text-green-800'
                        : user.gmailAuthStatus === 'expired'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {user.gmailAuthStatus === 'active' ? 'Autorisé' :
                       user.gmailAuthStatus === 'expired' ? 'Expiré' : 'Non autorisé'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Form method="post" className="inline">
                      <input type="hidden" name="_action" value="toggleProcessor" />
                      <input type="hidden" name="userId" value={user.uid} />
                      <input type="hidden" name="isProcessor" value={(!user.isGmailProcessor).toString()} />
                      <button
                        type="submit"
                        disabled={!user.googleRefreshToken}
                        className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                          user.isGmailProcessor ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${
                          user.isGmailProcessor ? 'translate-x-5' : 'translate-x-0'
                        }`} />
                      </button>
                    </Form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Message de résultat */}
      {actionData && (
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
      )}
    </div>
  );
}
