import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation, Link } from "@remix-run/react";
import { authenticator } from "~/services/auth.server";
import { getUserProfileSdk, getAllUserProfilesSdk, updateUserProfileSdk } from "~/services/firestore.service.server";
import { getGoogleAuthClient } from "~/services/google.server";
import type { UserProfile, GmailProcessingConfig } from "~/types/firestore.types";
import { initializeFirebaseAdmin } from "~/firebase.admin.config.server";
import type { UserSession } from "~/services/session.server";
import { google } from 'googleapis';
import { Card, CardHeader, CardBody } from "~/components/ui/Card"; // Import Card components
import { Input } from "~/components/ui/Input"; // Import Input component
import { Button } from "~/components/ui/Button"; // Import Button component


interface GmailLabel {
  id?: string | null;
  name?: string | null;
}

interface UserWithLabels extends UserProfile {
  gmailLabels?: GmailLabel[];
  gmailAuthStatus?: 'active' | 'expired' | 'unauthorized';
  isGmailProcessor?: boolean;
  googleRefreshToken?: string;
}

// Type pour le loader avec les labels
type LoaderData = {
  users: (UserWithLabels & {
    gmailLabels?: GmailLabel[];
  })[];
  config: GmailProcessingConfig; // Keep general config
  userProfile: UserProfile; // Add userProfile to LoaderData type
  userRole: UserProfile['role'] | undefined; // Add userRole to LoaderData type
};

/**
 * Loader pour récupérer la configuration et les utilisateurs
 */
export async function loader({ request }: LoaderFunctionArgs) {
  // Vérifier l'authentification
  const session = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login", // Redirect unauthenticated users
  });

  // Récupérer le profil de l'utilisateur authentifié
  const userProfile = await getUserProfileSdk(session.userId);
  // Note: We don't throw 403 here anymore, allowing non-admins to view.
  // The component and action will handle permissions for editing.

  // Récupérer tous les utilisateurs (peut être nécessaire pour les responsables)
  const users = await getAllUserProfilesSdk();

  // Récupérer la configuration Gmail (globale, pour les paramètres non spécifiques à l'utilisateur)
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
    },
    // Default values for AI template fields if config doesn't exist (labels are now per user)
    aiClosureTemplate: '',
    aiRmaTemplate: '',
    aiNoResponseTemplate: '',
  };

  // Pour chaque utilisateur, récupérer leurs labels Gmail
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

  // Ensure userProfile is not null before returning
  if (!userProfile) {
      throw new Response("User profile not found", { status: 404 });
  }

  return json({ users: usersWithLabels, config, userProfile, userRole: userProfile?.role });
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

    // Récupérer le profil de l'utilisateur pour vérifier le rôle
    const userProfile = await getUserProfileSdk(session.userId);
    const isAdmin = userProfile?.role === "Admin";

    switch (action) {
      case "updateConfig": {
        // Only allow admins to update restricted fields
        if (!isAdmin) {
             return json({ success: false, error: "Accès non autorisé pour modifier cette configuration." }, { status: 403 });
        }

        const maxEmailsPerRun = parseInt(formData.get("maxEmailsPerRun") as string);
        const processedLabelName = formData.get("processedLabelName") as string;
        const refreshInterval = parseInt(formData.get("refreshInterval") as string);

        // Récupérer les labels pour chaque collection
        const sectorCollections = {
          kezia: {
            enabled: formData.get("kezia-enabled") === "true",
            labels: (formData.getAll("kezia-labels") as string[]).map(l => l.trim()).filter(l => l),
            responsables: (formData.getAll("kezia-responsables") as string[]).map(r => r.trim()).filter(r => r)
          },
          haccp: {
            enabled: formData.get("haccp-enabled") === "true",
            labels: (formData.getAll("haccp-labels") as string[]).map(l => l.trim()).filter(l => l),
            responsables: (formData.getAll("haccp-responsables") as string[]).map(r => r.trim()).filter(r => r)
          },
          chr: {
            enabled: formData.get("chr-enabled") === "true",
            labels: (formData.getAll("chr-labels") as string[]).map(l => l.trim()).filter(l => l),
            responsables: (formData.getAll("chr-responsables") as string[]).map(r => r.trim()).filter(r => r)
          },
          tabac: {
            enabled: formData.get("tabac-enabled") === "true",
            labels: (formData.getAll("tabac-labels") as string[]).map(l => l.trim()).filter(l => l),
            responsables: (formData.getAll("tabac-responsables") as string[]).map(r => r.trim()).filter(r => r)
          }
        };

        // Update global config fields (only accessible to admins)
        const dbAdmin = await initializeFirebaseAdmin();
        await dbAdmin.collection('settings').doc('gmailProcessingConfig').set({
          maxEmailsPerRun,
          processedLabelName,
          refreshInterval,
          sectorCollections,
          // AI template fields (accessible to all for viewing, but only admin for saving)
          aiClosureTemplate: formData.get("aiClosureTemplate") as string,
          aiRmaTemplate: formData.get("aiRmaTemplate") as string,
          aiNoResponseTemplate: formData.get("aiNoResponseTemplate") as string,
        });

        // Update user-specific Gmail label fields
        await updateUserProfileSdk(session.userId, {
          labelSapClosed: formData.get("labelSapClosed") as string,
          labelSapRma: formData.get("labelSapRma") as string,
          labelSapNoResponse: formData.get("labelSapNoResponse") as string,
        });


        return json({ success: true, message: "Configuration mise à jour avec succès" });
      }

      case "toggleProcessor": {
        // Only allow admins to toggle processor status
        if (!isAdmin) {
             return json({ success: false, error: "Accès non autorisé pour modifier le statut du processeur." }, { status: 403 });
        }

        const userId = formData.get("userId") as string;
        const isProcessor = formData.get("isProcessor") === "true";

        if (!userId || typeof userId !== "string" || userId.trim() === "") {
          return json({ 
            success: false, 
            error: "ID utilisateur invalide ou manquant" 
          }, { status: 400 });
        }

        try {
          await updateUserProfileSdk(userId, {
            isGmailProcessor: isProcessor
          });
          return json({ success: true, message: "Statut du processeur mis à jour avec succès" });
        } catch (error) {
          console.error("Erreur lors de la mise à jour du profil utilisateur:", error);
          return json({ 
            success: false, 
            error: `Erreur lors de la mise à jour: ${error instanceof Error ? error.message : String(error)}`
          }, { status: 500 });
        }
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
import { useEffect } from 'react'; // Import useEffect

export default function AdminGmailConfig() {
  const { users, config, userProfile, userRole } = useLoaderData<LoaderData>(); // Get userRole and userProfile from loader
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  useEffect(() => {
    console.log("Loader Data:", { users, config, userProfile, userRole });
  }, [users, config, userProfile, userRole]);

  const isSubmitting = navigation.state === "submitting";

  const isAdmin = userRole === 'Admin'; // Determine if the user is an admin

  // Fonction pour obtenir les labels d'un responsable
  const getResponsableLabels = (responsableId: string) => {
    return users.find(u => u.uid === responsableId)?.gmailLabels || [];
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Configuration du Traitement Gmail</h1>
        <Link to="/user-profile" className="text-jdc-blue hover:text-jdc-blue-dark">
          ← Retour au profil utilisateur
        </Link>
      </div>

      {/* Configuration générale */}
      <Card className="mb-8">
        <CardHeader>
          <h2 className="text-xl font-semibold">Configuration Générale</h2>
        </CardHeader>
        <CardBody>
          <Form method="post" className="space-y-4">
            <input type="hidden" name="_action" value="updateConfig" />
            
            <Input
              label="Nombre d'emails à traiter par exécution"
              type="number"
              name="maxEmailsPerRun"
              defaultValue={config.maxEmailsPerRun}
              min="1"
              max="100"
              disabled={!isAdmin}
            />

            <Input
              label='Nom du label "Traité"'
              type="text"
              name="processedLabelName"
              defaultValue={config.processedLabelName}
              disabled={!isAdmin}
            />

            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                Configuration des collections
              </label>
              {!isAdmin && (
                <p className="text-sm text-gray-500 italic">
                  Certaines options de configuration sont réservées aux administrateurs.
                </p>
              )}

              {/* Kezia */}
              <div className={`border rounded-md p-4 ${!isAdmin ? 'disabled:bg-gray-100 disabled:opacity-50' : ''}`}>
                <div className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    id="kezia-enabled"
                    name="kezia-enabled"
                    defaultChecked={config.sectorCollections.kezia.enabled}
                    value="true"
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded disabled:cursor-not-allowed"
                    disabled={!isAdmin}
                  />
                  <label htmlFor="kezia-enabled" className={`ml-2 text-sm font-medium ${!isAdmin ? 'text-gray-500' : 'text-gray-700'}`}>
                    Kezia
                  </label>
                </div>
                <div>
                  <label className={`block text-sm mb-1 ${!isAdmin ? 'text-gray-500' : 'text-gray-600'}`}>
                    Labels Gmail
                  </label>
                  <select
                    name="kezia-labels"
                    multiple
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-100 disabled:cursor-not-allowed bg-jdc-gray-800 text-white font-semibold"
                  defaultValue={config.sectorCollections.kezia.labels}
                  disabled={!isAdmin}
                >
                    {users
                      .find(u => config.sectorCollections.kezia.responsables.includes(u.uid))
                      ?.gmailLabels?.filter(label => label.name)
                      .map(label => (
                        <option key={label.id} value={label.name || ''}>
                          {label.name}
                        </option>
                      ))}
                  </select>
                  <span className="text-xs text-gray-400">Maintenir Ctrl (Windows) ou Cmd (Mac) pour sélection multiple</span>
                </div>
                <div className="mt-2">
                  <label className={`block text-sm mb-1 ${!isAdmin ? 'text-gray-500' : 'text-gray-600'}`}>
                    Responsables Kezia
                  </label>
                  <select
                    name="kezia-responsables"
                    multiple
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-100 disabled:cursor-not-allowed bg-jdc-gray-800 text-white font-semibold"
                  defaultValue={config.sectorCollections.kezia.responsables || []}
                  disabled={!isAdmin}
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
              <div className={`border rounded-md p-4 ${!isAdmin ? 'disabled:bg-gray-100 disabled:opacity-50' : ''}`}>
                <div className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    id="haccp-enabled"
                    name="haccp-enabled"
                    defaultChecked={config.sectorCollections.haccp.enabled}
                    value="true"
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded disabled:cursor-not-allowed"
                    disabled={!isAdmin}
                  />
                  <label htmlFor="haccp-enabled" className={`ml-2 text-sm font-medium ${!isAdmin ? 'text-gray-500' : 'text-gray-700'}`}>
                    HACCP
                  </label>
                </div>
                <div>
                  <label className={`block text-sm mb-1 ${!isAdmin ? 'text-gray-500' : 'text-gray-600'}`}>
                    Labels Gmail
                  </label>
                  <select
                    name="haccp-labels"
                    multiple
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-100 disabled:cursor-not-allowed bg-jdc-gray-800 text-white font-semibold"
                  defaultValue={config.sectorCollections.haccp.labels}
                  disabled={!isAdmin}
                >
                    {users
                      .find(u => config.sectorCollections.haccp.responsables.includes(u.uid))
                      ?.gmailLabels?.filter(label => label.name)
                      .map(label => (
                        <option key={label.id} value={label.name || ''}>
                          {label.name}
                        </option>
                      ))}
                  </select>
                  <span className="text-xs text-gray-400">Maintenir Ctrl (Windows) ou Cmd (Mac) pour sélection multiple</span>
                </div>
                <div className="mt-2">
                  <label className={`block text-sm mb-1 ${!isAdmin ? 'text-gray-500' : 'text-gray-600'}`}>
                    Responsables HACCP
                  </label>
                  <select
                    name="haccp-responsables"
                    multiple
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-100 disabled:cursor-not-allowed bg-jdc-gray-800 text-white font-semibold"
                  defaultValue={config.sectorCollections.haccp.responsables || []}
                  disabled={!isAdmin}
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
              <div className={`border rounded-md p-4 ${!isAdmin ? 'disabled:bg-gray-100 disabled:opacity-50' : ''}`}>
                <div className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    id="chr-enabled"
                    name="chr-enabled"
                    defaultChecked={config.sectorCollections.chr.enabled}
                    value="true"
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded disabled:cursor-not-allowed"
                    disabled={!isAdmin}
                  />
                  <label htmlFor="chr-enabled" className={`ml-2 text-sm font-medium ${!isAdmin ? 'text-gray-500' : 'text-gray-700'}`}>
                    CHR
                  </label>
                </div>
                <div>
                  <label className={`block text-sm mb-1 ${!isAdmin ? 'text-gray-500' : 'text-gray-600'}`}>
                    Labels Gmail
                  </label>
                  <select
                    name="chr-labels"
                    multiple
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-100 disabled:cursor-not-allowed bg-jdc-gray-800 text-white font-semibold"
                  defaultValue={config.sectorCollections.chr.labels}
                  disabled={!isAdmin}
                >
                    {users
                      .find(u => config.sectorCollections.chr.responsables.includes(u.uid))
                      ?.gmailLabels?.filter(label => label.name)
                      .map(label => (
                        <option key={label.id} value={label.name || ''}>
                          {label.name}
                        </option>
                      ))}
                  </select>
                  <span className="text-xs text-gray-400">Maintenir Ctrl (Windows) ou Cmd (Mac) pour sélection multiple</span>
                </div>
                <div className="mt-2">
                  <label className={`block text-sm mb-1 ${!isAdmin ? 'text-gray-500' : 'text-gray-600'}`}>
                    Responsables CHR
                  </label>
                  <select
                    name="chr-responsables"
                    multiple
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-100 disabled:cursor-not-allowed bg-jdc-gray-800 text-white font-semibold"
                  defaultValue={config.sectorCollections.chr.responsables || []}
                  disabled={!isAdmin}
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
              <div className={`border rounded-md p-4 ${!isAdmin ? 'disabled:bg-gray-100 disabled:opacity-50' : ''}`}>
                <div className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    id="tabac-enabled"
                    name="tabac-enabled"
                    defaultChecked={config.sectorCollections.tabac.enabled}
                    value="true"
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded disabled:cursor-not-allowed"
                    disabled={!isAdmin}
                  />
                  <label htmlFor="tabac-enabled" className={`ml-2 text-sm font-medium ${!isAdmin ? 'text-gray-500' : 'text-gray-700'}`}>
                    Tabac
                  </label>
                </div>
                <div>
                  <label className={`block text-sm mb-1 ${!isAdmin ? 'text-gray-500' : 'text-gray-600'}`}>
                    Labels Gmail
                  </label>
                  <select
                    name="tabac-labels"
                    multiple
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-100 disabled:cursor-not-allowed bg-jdc-gray-800 text-white font-semibold"
                  defaultValue={config.sectorCollections.tabac.labels}
                  disabled={!isAdmin}
                >
                    {users
                      .find(u => config.sectorCollections.tabac.responsables.includes(u.uid))
                      ?.gmailLabels?.filter(label => label.name)
                      .map(label => (
                        <option key={label.id} value={label.name || ''}>
                          {label.name}
                        </option>
                      ))}
                  </select>
                  <span className="text-xs text-gray-400">Maintenir Ctrl (Windows) ou Cmd (Mac) pour sélection multiple</span>
                </div>
                <div className="mt-2">
                  <label className={`block text-sm mb-1 ${!isAdmin ? 'text-gray-500' : 'text-gray-600'}`}>
                    Responsables Tabac
                  </label>
                  <select
                    name="tabac-responsables"
                    multiple
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-100 disabled:cursor-not-allowed bg-jdc-gray-800 text-white font-semibold"
                  defaultValue={config.sectorCollections.tabac.responsables || []}
                  disabled={!isAdmin}
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

            {/* Configuration des Labels Spécifiques */}
            <div className="border rounded-md p-4 space-y-4">
              <h3 className="text-lg font-semibold mb-2">Configuration des Labels Gmail Spécifiques</h3>
               <p className="text-sm text-gray-600 mb-4">Sélectionnez les labels Gmail à appliquer automatiquement pour chaque cas de figure. Les options disponibles proviennent des comptes Gmail autorisés.</p>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Label "Ticket Clôturé"
                </label>
                 <select
                    name="labelSapClosed"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-jdc-gray-800 text-white font-semibold"
                    defaultValue={userProfile.labelSapClosed || ''}
                  >
                     <option value="">-- Sélectionner un label --</option>
                     {users
                      .filter(u => u.googleRefreshToken)
                      .flatMap(user => user.gmailLabels || [])
                      .filter((label, index, self) => label.name && self.findIndex(l => l.name === label.name) === index)
                      .map(label => (
                        <option key={label.id} value={label.name || ''}>
                          {label.name}
                        </option>
                      ))}
                  </select>
              </div>

               <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Label "Demande RMA / Matériel"
                </label>
                 <select
                    name="labelSapRma"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-jdc-gray-800 text-white font-semibold"
                    defaultValue={userProfile.labelSapRma || ''}
                  >
                     <option value="">-- Sélectionner un label --</option>
                     {users
                      .filter(u => u.googleRefreshToken)
                      .flatMap(user => user.gmailLabels || [])
                      .filter((label, index, self) => label.name && self.findIndex(l => l.name === label.name) === index)
                      .map(label => (
                        <option key={label.id} value={label.name || ''}>
                          {label.name}
                        </option>
                      ))}
                  </select>
              </div>

               <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Label "Client Aucune Réponse"
                </label>
                 <select
                    name="labelSapNoResponse"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-jdc-gray-800 text-white font-semibold"
                    defaultValue={userProfile.labelSapNoResponse || ''}
                  >
                     <option value="">-- Sélectionner un label --</option>
                     {users
                      .filter(u => u.googleRefreshToken)
                      .flatMap(user => user.gmailLabels || [])
                      .filter((label, index, self) => label.name && self.findIndex(l => l.name === label.name) === index)
                      .map(label => (
                        <option key={label.id} value={label.name || ''}>
                          {label.name}
                        </option>
                      ))}
                  </select>
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
        </CardBody>
      </Card>

      {/* Gestion des responsables */}
      <Card>
        <CardHeader>
        <h2 className="text-xl font-semibold">Gestion des Responsables</h2>
        </CardHeader>
        <CardBody>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-jdc-gray-800"> {/* Adjusted divider color */}
              <thead className="bg-jdc-gray-800"> {/* Adjusted header background color */}
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-jdc-gray-300 uppercase tracking-wider"> {/* Adjusted text color */}
                    Utilisateur
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-jdc-gray-300 uppercase tracking-wider"> {/* Adjusted text color */}
                    Statut Gmail
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-jdc-gray-300 uppercase tracking-wider"> {/* Adjusted text color */}
                    Processeur Actif
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-jdc-gray-300 uppercase tracking-wider"> {/* Adjusted text color */}
                    Labels Gmail
                  </th>
                </tr>
              </thead>
              <tbody className="bg-jdc-card divide-y divide-jdc-gray-800"> {/* Adjusted body background and divider color */}
                {users.map((user) => (
                  <tr key={user.uid}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-white">{user.displayName}</div> {/* Adjusted text color */}
                      <div className="text-sm text-jdc-gray-300">{user.email}</div> {/* Adjusted text color */}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.gmailAuthStatus === 'active'
                          ? 'bg-green-500 text-white' // Adjusted colors
                          : user.gmailAuthStatus === 'expired'
                          ? 'bg-yellow-500 text-white' // Adjusted colors
                          : 'bg-red-500 text-white' // Adjusted colors
                      }`}>
                        {user.gmailAuthStatus === 'active' ? 'Autorisé' :
                         user.gmailAuthStatus === 'expired' ? 'Expiré' : 'Non autorisé'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Form method="post" className="inline" key={user.uid}>
                        <input type="hidden" name="_action" value="toggleProcessor" />
                        <input
                          type="hidden"
                          name="userId"
                          value={user.uid || ''}
                          onChange={() => {}}
                        />
                        <input
                          type="hidden"
                          name="isProcessor"
                          value={(!user.isGmailProcessor).toString()}
                          onChange={() => {}}
                        />
                        <button
                          type="submit"
                          disabled={!user.googleRefreshToken || !isAdmin}
                          className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                            user.isGmailProcessor ? 'bg-jdc-yellow' : 'bg-jdc-gray-600' // Adjusted colors
                          } ${!user.googleRefreshToken || !isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                          onClick={(e) => {
                            if (!user.uid) {
                              e.preventDefault();
                              alert("ID utilisateur manquant");
                            }
                          }}
                        >
                          <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${
                            user.isGmailProcessor ? 'translate-x-5' : 'translate-x-0'
                          }`} />
                        </button>
                      </Form>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.gmailLabels?.length ? (
                        <div className="text-sm text-jdc-gray-300 max-w-xs truncate"> {/* Adjusted text color */}
                          {user.gmailLabels?.map(label => label.name).filter(Boolean).join(', ')}
                        </div>
                      ) : (
                        <div className="text-sm text-jdc-gray-500">Aucun label</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

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
