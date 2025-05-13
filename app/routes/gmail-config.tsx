import { json, type ActionFunctionArgs, type LoaderFunctionArgs, redirect } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation, Link, useFetcher } from "@remix-run/react";
import { sessionStorage, type UserSessionData } from "~/services/session.server";
import { getUserProfileSdk, getAllUserProfilesSdk, updateUserProfileSdk } from "~/services/firestore.service.server";
import { getGoogleAuthClient } from "~/services/google.server";
import type { UserProfile, GmailProcessingConfig, SectorGmailConfig } from "~/types/firestore.types";
import { initializeFirebaseAdmin } from "~/firebase.admin.config.server";
import { google } from 'googleapis';
import { Card, CardHeader, CardBody } from "~/components/ui/Card";
import { Input } from "~/components/ui/Input";
import { Textarea } from "~/components/ui/Textarea";
import { Button } from "~/components/ui/Button";
import { useEffect, useMemo, useState } from 'react';
import { FaCog, FaChevronLeft, FaSpinner, FaSave } from 'react-icons/fa';
import { Switch } from "~/components/ui/Switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/Select";

interface GmailLabel {
  id?: string | null;
  name?: string | null;
}

interface UserWithLabels extends UserProfile {
  gmailLabels?: GmailLabel[];
  gmailAuthStatus?: 'active' | 'expired' | 'unauthorized';
}

type LoaderData = {
  users: UserWithLabels[];
  config: GmailProcessingConfig;
  userProfile: UserProfile;
  userRole: UserProfile['role'] | undefined;
};

const DEFAULT_SECTOR_CONFIG: SectorGmailConfig = {
  enabled: false,
  labels: [],
  responsables: []
};

const NO_LABEL_VALUE = "__NO_LABEL_SELECTED__";

interface TestResponse {
  success: boolean;
  message?: string;
  error?: string;
  details?: any;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const sessionCookie = request.headers.get("Cookie");
  const sessionStore = await sessionStorage.getSession(sessionCookie);
  const userSession: UserSessionData | null = sessionStore.get("user") ?? null;

  if (!userSession || !userSession.userId) throw redirect("/login");

  const userProfile = await getUserProfileSdk(userSession.userId);
  if (!userProfile) throw new Response("User profile not found", { status: 404 });

  const isAdmin = userProfile.role === 'Admin';
  let usersForSelect: UserProfile[] = isAdmin ? await getAllUserProfilesSdk() : [userProfile];

  const dbAdmin = await initializeFirebaseAdmin();
  const configDoc = await dbAdmin.collection('settings').doc('gmailProcessingConfig').get();
  
  const defaultConfig: GmailProcessingConfig = {
    maxEmailsPerRun: 50,
    processedLabelName: "Traité-JDC-Portail",
    refreshInterval: 15,
    sectorCollections: {
      kezia: { ...DEFAULT_SECTOR_CONFIG },
      haccp: { ...DEFAULT_SECTOR_CONFIG },
      chr: { ...DEFAULT_SECTOR_CONFIG },
      tabac: { ...DEFAULT_SECTOR_CONFIG }
    }
  };
  
  let configData = configDoc.exists ? configDoc.data() as GmailProcessingConfig : defaultConfig;
  // Assurer que sectorCollections et ses sous-objets existent
  configData.sectorCollections = {
    kezia: { ...DEFAULT_SECTOR_CONFIG, ...(configData.sectorCollections?.kezia || {}) },
    haccp: { ...DEFAULT_SECTOR_CONFIG, ...(configData.sectorCollections?.haccp || {}) },
    chr: { ...DEFAULT_SECTOR_CONFIG, ...(configData.sectorCollections?.chr || {}) },
    tabac: { ...DEFAULT_SECTOR_CONFIG, ...(configData.sectorCollections?.tabac || {}) },
  };
  
  const usersWithLabels = await Promise.all(usersForSelect.map(async (user) => {
    if (user.googleRefreshToken) {
      try {
        const tempUserSession: UserSessionData = { userId: user.uid, email: user.email, displayName: user.displayName || '', role: user.role, secteurs: user.secteurs || [], googleRefreshToken: user.googleRefreshToken };
        const authClient = await getGoogleAuthClient(tempUserSession);
        const gmail = google.gmail({ version: 'v1', auth: authClient });
        const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
        const labels = labelsResponse.data.labels || [];
        return { ...user, gmailLabels: labels.map(label => ({ id: label.id, name: label.name })) };
      } catch (error) { console.error(`Error fetching labels for ${user.email}:`, error); return user; }
    }
    return user;
  }));

  return json({ users: usersWithLabels, config: configData, userProfile, userRole: userProfile.role });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const formAction = formData.get("_action");

  const sessionCookie = request.headers.get("Cookie");
  const sessionStore = await sessionStorage.getSession(sessionCookie);
  const userSession: UserSessionData | null = sessionStore.get("user") ?? null;

  if (!userSession || !userSession.userId) return json({ success: false, error: "Non authentifié" }, { status: 401 });

  const currentUserProfile = await getUserProfileSdk(userSession.userId);
  const isAdmin = currentUserProfile?.role === "Admin";

  try {
    switch (formAction) {
      case "updateConfig": {
        const getLabelValue = (key: string): string => {
          const value = formData.get(key) as string;
          return value === NO_LABEL_VALUE ? "" : value;
        };

        const userProfileUpdates: Partial<UserProfile> = {
          labelSapClosed: getLabelValue("labelSapClosed"),
          labelSapRma: getLabelValue("labelSapRma"),
          labelSapNoResponse: getLabelValue("labelSapNoResponse"),
        };
        
        if (Object.keys(userProfileUpdates).length > 0) {
          await updateUserProfileSdk(userSession.userId, userProfileUpdates);
        }

        if (isAdmin) {
          const updates: Partial<GmailProcessingConfig> = {
            maxEmailsPerRun: parseInt(formData.get("maxEmailsPerRun") as string) || 50,
            processedLabelName: formData.get("processedLabelName") as string || "Traité-JDC-Portail",
            refreshInterval: parseInt(formData.get("refreshInterval") as string) || 15,
            sectorCollections: {
              kezia: {
                enabled: formData.get("kezia-enabled") === "on",
                labels: (formData.getAll("kezia-labels[]") as string[]).map(l => l.trim()).filter(l => l && l !== NO_LABEL_VALUE),
                responsables: (formData.getAll("kezia-responsables[]") as string[]).map(r => r.trim()).filter(r => r)
              },
              haccp: {
                enabled: formData.get("haccp-enabled") === "on",
                labels: (formData.getAll("haccp-labels[]") as string[]).map(l => l.trim()).filter(l => l && l !== NO_LABEL_VALUE),
                responsables: (formData.getAll("haccp-responsables[]") as string[]).map(r => r.trim()).filter(r => r)
              },
              chr: {
                enabled: formData.get("chr-enabled") === "on",
                labels: (formData.getAll("chr-labels[]") as string[]).map(l => l.trim()).filter(l => l && l !== NO_LABEL_VALUE),
                responsables: (formData.getAll("chr-responsables[]") as string[]).map(r => r.trim()).filter(r => r)
              },
              tabac: {
                enabled: formData.get("tabac-enabled") === "on",
                labels: (formData.getAll("tabac-labels[]") as string[]).map(l => l.trim()).filter(l => l && l !== NO_LABEL_VALUE),
                responsables: (formData.getAll("tabac-responsables[]") as string[]).map(r => r.trim()).filter(r => r)
              }
            }
          };
          const dbAdmin = await initializeFirebaseAdmin();
          await dbAdmin.collection('settings').doc('gmailProcessingConfig').set(updates, { merge: true });
        }
        return json({ success: true, message: "Configuration mise à jour." });
      }
      case "toggleProcessor": {
        if (!isAdmin) return json({ success: false, error: "Accès non autorisé." }, { status: 403 });
        const userId = formData.get("userId") as string;
        const isProcessor = formData.get("isProcessor") === "true";
        if (!userId) return json({ success: false, error: "ID utilisateur manquant." }, { status: 400 });
        await updateUserProfileSdk(userId, { 
          isGmailProcessor: isProcessor,
          gmailAuthStatus: isProcessor ? 'active' : 'inactive'
        });
        return json({ success: true, message: "Statut du processeur mis à jour." });
      }
      default:
        return json({ success: false, error: "Action non reconnue." }, { status: 400 });
    }
  } catch (error: any) {
    return json({ success: false, error: error.message || "Erreur serveur." }, { status: 500 });
  }
}

export default function AdminGmailConfig() {
  const { users, config, userProfile, userRole } = useLoaderData<LoaderData>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const fetcher = useFetcher();
  const testFetcher = useFetcher<TestResponse>();
  const isSubmitting = navigation.state === "submitting" || fetcher.state === "submitting";
  const isTesting = testFetcher.state === "submitting";
  const isAdmin = userRole === 'Admin';

  const allUserGmailLabels = useMemo(() => {
    const labelSet = new Map<string, string>();
    users.forEach(user => {
      user.gmailLabels?.forEach((label: GmailLabel) => {
        if (label.name && !labelSet.has(label.name)) {
          labelSet.set(label.name, label.id || label.name);
        }
      });
    });
    return Array.from(labelSet.entries()).map(([name, id]) => ({ id, name })).sort((a,b) => a.name.localeCompare(b.name));
  }, [users]);

  const secteursConfig: Array<{key: keyof GmailProcessingConfig['sectorCollections'], name: string}> = [
    { key: 'kezia', name: 'Kezia' },
    { key: 'haccp', name: 'HACCP' },
    { key: 'chr', name: 'CHR' },
    { key: 'tabac', name: 'Tabac' },
  ];

  const [selectedResponsables, setSelectedResponsables] = useState<Record<string, string[]>>({});
  const [selectedLabels, setSelectedLabels] = useState<Record<string, string[]>>({});

  // Fonction pour obtenir les labels des responsables sélectionnés
  const getAvailableLabelsForSector = (secteurKey: string) => {
    const selectedResponsablesForSector = selectedResponsables[secteurKey] || [];
    if (selectedResponsablesForSector.length === 0) return [];

    const labelsSet = new Set<string>();
    selectedResponsablesForSector.forEach(responsableId => {
      const user = users.find(u => u.uid === responsableId);
      if (user?.gmailLabels) {
        user.gmailLabels.forEach(label => {
          if (label.name) labelsSet.add(label.name);
        });
      }
    });

    return Array.from(labelsSet).sort();
  };

  useEffect(() => {
    // Initialiser les états avec les valeurs existantes
    const initialResponsables: Record<string, string[]> = {};
    const initialLabels: Record<string, string[]> = {};
    
    secteursConfig.forEach(secteur => {
      initialResponsables[secteur.key] = config.sectorCollections?.[secteur.key]?.responsables || [];
      initialLabels[secteur.key] = config.sectorCollections?.[secteur.key]?.labels || [];
    });
    
    setSelectedResponsables(initialResponsables);
    setSelectedLabels(initialLabels);
  }, [config.sectorCollections]);

  // Effet pour réinitialiser les labels quand les responsables changent
  useEffect(() => {
    const newLabels: Record<string, string[]> = {};
    secteursConfig.forEach(secteur => {
      const availableLabels = getAvailableLabelsForSector(secteur.key);
      // Ne garder que les labels qui sont toujours disponibles
      newLabels[secteur.key] = (selectedLabels[secteur.key] || []).filter(label => 
        availableLabels.includes(label)
      );
    });
    setSelectedLabels(newLabels);
  }, [selectedResponsables]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text-primary flex items-center">
          <FaCog className="mr-3 text-brand-blue h-6 w-6" />
          Configuration du Traitement Gmail
        </h1>
        <div className="flex items-center space-x-4">
          {isAdmin && (
            <testFetcher.Form method="post" action="/api/gmail-to-firestore">
              <Button
                type="submit"
                disabled={isTesting}
                variant="primary"
                className="bg-green-600 hover:bg-green-700"
              >
                {isTesting ? (
                  <>
                    <FaSpinner className="animate-spin mr-2" />
                    Test en cours...
                  </>
                ) : (
                  <>
                    <FaSpinner className="mr-2" />
                    Tester la récupération
                  </>
                )}
              </Button>
            </testFetcher.Form>
          )}
          <Link to="/user-profile" className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-ui-border text-text-secondary hover:bg-ui-border h-9 px-3 py-2">
            <FaChevronLeft className="mr-2 h-3 w-3" />
            Retour au profil
          </Link>
        </div>
      </div>

      {testFetcher.data && (
        <div className={`p-3 rounded-md border text-sm ${
          (testFetcher.data as TestResponse).success 
            ? 'bg-green-500/10 border-green-500/30 text-green-700' 
            : 'bg-red-500/10 border-red-500/30 text-red-700'
        }`}>
          {(testFetcher.data as TestResponse).success 
            ? (testFetcher.data as TestResponse).message 
            : (testFetcher.data as TestResponse).error}
          {(testFetcher.data as TestResponse).details && (
            <div className="mt-2 text-xs">
              <pre className="whitespace-pre-wrap">
                {JSON.stringify((testFetcher.data as TestResponse).details, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {actionData && (
        <div className={`p-3 rounded-md border text-sm ${ actionData.success ? 'bg-green-500/10 border-green-500/30 text-green-700' : 'bg-red-500/10 border-red-500/30 text-red-700' }`}>
          {actionData.success ? (actionData as {message: string}).message : (actionData as {error: string}).error}
        </div>
      )}

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-text-primary">Configuration Générale</h3>
          <p className="text-sm text-text-secondary">Paramètres globaux et spécifiques à l'utilisateur.</p>
        </CardHeader>
        <CardBody>
          <Form method="post" className="space-y-6">
            <input type="hidden" name="_action" value="updateConfig" />
            
            {isAdmin && (<>
              <Input label="Emails max par exécution" type="number" name="maxEmailsPerRun" defaultValue={config.maxEmailsPerRun} disabled={!isAdmin} className="bg-ui-input border-ui-border" />
              <Input label='Nom du label "Traité"' type="text" name="processedLabelName" defaultValue={config.processedLabelName} disabled={!isAdmin} className="bg-ui-input border-ui-border" />
              <Input label="Intervalle de rafraîchissement (minutes)" type="number" name="refreshInterval" defaultValue={config.refreshInterval} disabled={!isAdmin} className="bg-ui-input border-ui-border" />
            </>)}

            <div className="space-y-4 pt-4 border-t border-ui-border/50">
              <h3 className="text-base font-medium text-text-primary">Labels pour réponses automatiques (vos paramètres)</h3>
              {[
                { name: "labelSapClosed", labelText: "Label 'Ticket Clôturé'", defaultValue: userProfile.labelSapClosed },
                { name: "labelSapRma", labelText: "Label 'Demande RMA / Matériel'", defaultValue: userProfile.labelSapRma },
                { name: "labelSapNoResponse", labelText: "Label 'Client Aucune Réponse'", defaultValue: userProfile.labelSapNoResponse },
              ].map(field => (
                <div key={field.name}>
                  <label htmlFor={field.name} className="block text-xs font-medium text-text-secondary mb-1">{field.labelText}</label>
                  <Select name={field.name} defaultValue={field.defaultValue || NO_LABEL_VALUE}>
                    <SelectTrigger className="w-full bg-slate-900 border-slate-700 text-slate-100 focus:border-brand-blue focus:ring-brand-blue">
                      <SelectValue placeholder="-- Sélectionner un label --" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700 text-slate-100 max-h-[300px] overflow-y-auto z-50">
                      <SelectItem value={NO_LABEL_VALUE} className="text-slate-400 italic hover:bg-slate-700 focus:bg-slate-700 cursor-pointer">
                        -- Aucun --
                      </SelectItem>
                      {allUserGmailLabels.map(label => (
                        <SelectItem 
                          key={label.id || label.name} 
                          value={label.name!} 
                          className="hover:bg-slate-700 focus:bg-slate-700 cursor-pointer"
                        >
                          {label.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            
            {isAdmin && (
              <div className="space-y-6 pt-4 border-t border-ui-border/50">
                <h3 className="text-base font-medium text-text-primary">Configuration par Secteur (Admin)</h3>
                {secteursConfig.map(secteurItem => (
                  <div key={secteurItem.key} className="p-4 border border-ui-border rounded-lg bg-ui-background/30 space-y-3">
                    <div className="flex items-center">
                      <Switch
                        id={`${secteurItem.key}-enabled`}
                        name={`${secteurItem.key}-enabled`}
                        defaultChecked={config.sectorCollections?.[secteurItem.key]?.enabled || false}
                        disabled={!isAdmin}
                        className="data-[state=checked]:bg-brand-blue data-[state=unchecked]:bg-slate-700 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      <label 
                        htmlFor={`${secteurItem.key}-enabled`} 
                        className={`ml-2 text-sm font-medium ${!isAdmin ? 'text-slate-500' : 'text-text-primary'} cursor-pointer`}
                      >
                        Activer pour {secteurItem.name}
                      </label>
                    </div>
                    <div>
                      <label htmlFor={`${secteurItem.key}-responsables`} className="block text-xs font-medium text-text-secondary mb-1">Responsables {secteurItem.name}</label>
                      <Select
                        name={`${secteurItem.key}-responsables[]`}
                        value={selectedResponsables[secteurItem.key]?.join(',') || ''}
                        disabled={!isAdmin}
                        onValueChange={(value) => {
                          const newValue = value.split(',').filter(Boolean);
                          setSelectedResponsables(prev => ({
                            ...prev,
                            [secteurItem.key]: newValue
                          }));
                        }}
                      >
                        <SelectTrigger className="w-full bg-slate-900 border-slate-700 text-slate-100 focus:border-brand-blue focus:ring-brand-blue">
                          <SelectValue placeholder="Sélectionner les responsables" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-700 text-slate-100 max-h-[300px] overflow-y-auto">
                          {users.filter(u => u.googleRefreshToken).map(user => (
                            <SelectItem 
                              key={user.uid} 
                              value={user.uid}
                              className="hover:bg-slate-700 focus:bg-slate-700 cursor-pointer"
                            >
                              {user.displayName} ({user.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <input 
                        type="hidden" 
                        name={`${secteurItem.key}-responsables[]`} 
                        value={selectedResponsables[secteurItem.key]?.join(',') || ''} 
                      />
                    </div>
                    {selectedResponsables[secteurItem.key]?.length > 0 && (
                      <div>
                        <label htmlFor={`${secteurItem.key}-labels`} className="block text-xs font-medium text-text-secondary mb-1">
                          Labels Gmail pour {secteurItem.name}
                        </label>
                        <Select
                          name={`${secteurItem.key}-labels[]`}
                          value={selectedLabels[secteurItem.key]?.join(',') || ''}
                          disabled={!isAdmin}
                          onValueChange={(value) => {
                            const newValue = value.split(',').filter(Boolean);
                            setSelectedLabels(prev => ({
                              ...prev,
                              [secteurItem.key]: newValue
                            }));
                          }}
                        >
                          <SelectTrigger className="w-full bg-slate-900 border-slate-700 text-slate-100 focus:border-brand-blue focus:ring-brand-blue">
                            <SelectValue placeholder="Sélectionner les labels" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-slate-700 text-slate-100 max-h-[300px] overflow-y-auto">
                            {getAvailableLabelsForSector(secteurItem.key).map(label => (
                              <SelectItem 
                                key={label} 
                                value={label}
                                className="hover:bg-slate-700 focus:bg-slate-700 cursor-pointer"
                              >
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <input 
                          type="hidden" 
                          name={`${secteurItem.key}-labels[]`} 
                          value={selectedLabels[secteurItem.key]?.join(',') || ''} 
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-ui-border/50">
              <Button type="submit" disabled={isSubmitting} variant="primary" className="bg-brand-blue hover:bg-brand-blue-dark">
                {isSubmitting ? <FaSpinner className="animate-spin mr-2" /> : <FaSave className="mr-2" />}
                Enregistrer les modifications
              </Button>
            </div>
          </Form>
        </CardBody>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-text-primary">Gestion des Processeurs Gmail</h3>
            <p className="text-sm text-text-secondary">Activer ou désactiver le traitement Gmail pour des utilisateurs spécifiques.</p>
          </CardHeader>
          <CardBody>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-ui-border">
                <thead className="bg-ui-background/70">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Utilisateur</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Statut Gmail</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Processeur Actif</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ui-border">
                  {users.map((u) => (
                    <tr key={u.uid} className="hover:bg-ui-surface-hover">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-medium text-text-primary">{u.displayName}</div>
                        <div className="text-xs text-text-tertiary">{u.email}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          u.googleRefreshToken && u.gmailAuthStatus !== 'expired' && u.gmailAuthStatus !== 'unauthorized'
                            ? 'bg-green-500/10 text-green-700'
                            : u.gmailAuthStatus === 'expired'
                            ? 'bg-yellow-500/10 text-yellow-700'
                            : 'bg-red-500/10 text-red-700'
                        }`}>
                          {u.googleRefreshToken && u.gmailAuthStatus !== 'expired' && u.gmailAuthStatus !== 'unauthorized' ? 'Autorisé' :
                           u.gmailAuthStatus === 'expired' ? 'Expiré' : 'Non Autorisé'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <fetcher.Form method="post" className="inline">
                          <input type="hidden" name="_action" value="toggleProcessor" />
                          <input type="hidden" name="userId" value={u.uid} />
                          <div className="flex items-center group relative">
                            <Switch
                              checked={u.isGmailProcessor || false}
                              onCheckedChange={(checked) => {
                                const formDataSwitch = new FormData();
                                formDataSwitch.append("_action", "toggleProcessor");
                                formDataSwitch.append("userId", u.uid);
                                formDataSwitch.append("isProcessor", checked.toString());
                                fetcher.submit(formDataSwitch, { method: "post"});
                              }}
                              disabled={isSubmitting || !isAdmin || !u.googleRefreshToken}
                              aria-label={`Activer processeur pour ${u.displayName}`}
                              className="border-2 border-red-500 bg-blue-500"
                            />
                            {(!u.googleRefreshToken) && (
                              <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-slate-800 text-slate-100 text-xs rounded px-2 py-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                                L'utilisateur doit connecter son Gmail pour activer le traitement.
                              </span>
                            )}
                          </div>
                        </fetcher.Form>
                        <div className="mt-1 text-xs text-gray-500">
                          Debug: Token: {u.googleRefreshToken ? "Présent" : "Absent"}, isGmailProcessor: {u.isGmailProcessor ? "Oui" : "Non"}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
