import { json, redirect } from "@remix-run/node";
import { Form, useLoaderData, useNavigation, Link } from "@remix-run/react";
import { useEffect, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { sessionStorage } from "~/services/session.server";
import { getUserProfileSdk, updateUserProfileSdk, createUserProfileSdk } from "~/services/firestore.service.server";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import type { UserProfile } from "~/types/firestore.types";

// Liste des secteurs disponibles
const AVAILABLE_SECTORS = ["Kezia", "HACCP", "CHR", "Tabac"];
const AVAILABLE_DEPARTMENTS = ["technique", "commercial", "admin"];

export async function loader({ request }: LoaderFunctionArgs) {
  // Récupérer la session directement depuis le cookie
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) {
    return redirect("/login");
  }
  
  try {
    const session = await sessionStorage.getSession(cookieHeader);
    const userSession = session.get("user"); // Lire l'objet UserSessionData
    
    if (!userSession || !userSession.userId) { // Vérifier l'objet et son userId
      console.log("[user-profile-direct] Session invalide ou userId manquant dans userSession");
      return redirect("/login");
    }
    
    // Utiliser les données de userSession
    const { userId, email, displayName } = userSession;
    const effectiveDisplayName = displayName || (email ? email.split('@')[0] : 'Utilisateur');

    // sessionUser pour le retour json, si nécessaire (ou utiliser userSession directement)
    const sessionUserForContext = { 
      userId, 
      email: email || '', // Assurer que email est une chaîne
      displayName: effectiveDisplayName 
    };
        
    try {
      let userProfile = await getUserProfileSdk(userId); // Utiliser userId de userSession
      let error = null;

      // Si le profil n'existe pas, créer un profil de base
      if (!userProfile) {
        console.log(`[user-profile-direct] Profil non trouvé pour l'ID: ${userId}. Création d'un profil de base.`);
        // Construire un UserProfile de base. Les champs createdAt/updatedAt seront gérés par createUserProfileSdk.
        const baseProfileData: UserProfile = {
          uid: userId,
          email: email || '',
          displayName: effectiveDisplayName,
          role: 'Technician', // Rôle par défaut
          secteurs: [],
          nom: effectiveDisplayName, 
          phone: ''
          // Les autres champs optionnels seront undefined et gérés par createUserProfileSdk si nécessaire
        };
        // Note: On ne crée pas le profil ici dans le loader, on retourne juste les données pour affichage.
        // La création se fait dans l'action si l'utilisateur soumet le formulaire.
        // Ou, si on veut absolument un profil créé dès le premier accès au loader :
        // userProfile = await createUserProfileSdk(baseProfileData);
        // Pour l'instant, on retourne les données de base pour le formulaire.
        userProfile = baseProfileData; // Pour que le formulaire soit pré-rempli
      }

      return json({ userProfile, error, fallbackMode: false, session: sessionUserForContext });
    } catch (error: any) {
      console.error("[user-profile-direct] Erreur lors de la récupération du profil utilisateur:", error);
      
      // Mode de secours: utiliser uniquement les données de session
      const fallbackProfile: UserProfile = {
        uid: userId,
        email: email || '',
        displayName: effectiveDisplayName,
        role: 'Technician', 
        secteurs: [],
        nom: effectiveDisplayName,
        phone: '',
        createdAt: new Date(), // Pour la conformité du type si UserProfile les attend toujours
        updatedAt: new Date()  // Idem
      };
      
      return json({ 
        userProfile: fallbackProfile, 
        error: error.message || "Erreur lors de la récupération du profil",
        fallbackMode: true,
        session: sessionUserForContext
      });
    }
  } catch (error: any) {
    console.error("[user-profile-direct] Erreur lors de la lecture de la session:", error);
    return redirect("/login");
  }
}

export async function action({ request }: ActionFunctionArgs) {
  // Récupérer la session directement depuis le cookie
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) {
    return redirect("/login");
  }
  
  try {
    const session = await sessionStorage.getSession(cookieHeader);
    const userSession = session.get("user"); // Lire l'objet UserSessionData
    
    if (!userSession || !userSession.userId) { // Vérifier l'objet et son userId
      console.log("[user-profile-direct] Action: Session invalide ou userId manquant");
      return redirect("/login");
    }
    const { userId, email, displayName } = userSession; // Utiliser les données de userSession
    const effectiveDisplayName = displayName || (email ? email.split('@')[0] : 'Utilisateur');
    
    try {
      const formData = await request.formData();
      const updatedProfileData: Partial<UserProfile> = {
        displayName: formData.get("displayName") as string,
        nom: formData.get("nom") as string,
        phone: formData.get("phone") as string,
        address: formData.get("address") as string,
        jobTitle: formData.get("jobTitle") as string,
        department: formData.get("department") as 'technique' | 'commercial' | 'admin',
        secteurs: formData.getAll("sectors") as string[],
      };

      console.log("[user-profile-direct] Action: Données du formulaire reçues:", Object.fromEntries(formData.entries()));
      console.log("[user-profile-direct] Action: Données de mise à jour:", updatedProfileData);

      // S'assurer que le rôle ne peut pas être modifié via cette action
      if ('role' in updatedProfileData) {
        console.warn("[user-profile-direct] Action: Tentative de modification du rôle, ignorée.");
        delete updatedProfileData.role;
      }

      try {
        // Tenter de récupérer le profil existant
        let userProfile = await getUserProfileSdk(userId);

        if (!userProfile) {
          console.log(`[user-profile-direct] Action: Profil non trouvé pour l'ID: ${userId}. Tentative de création.`);
          // Si le profil n'existe pas, créer un profil de base avec les données du formulaire
          const defaultProfile: UserProfile = {
            uid: userId,
            email: email || '', // email de la session
            displayName: updatedProfileData.displayName || effectiveDisplayName,
            role: 'Technician', // Rôle par défaut
            secteurs: updatedProfileData.secteurs || [],
            nom: updatedProfileData.nom || effectiveDisplayName,
            phone: updatedProfileData.phone || '',
            address: updatedProfileData.address || '',
            jobTitle: updatedProfileData.jobTitle || '',
            department: updatedProfileData.department || undefined,
            // Ajouter d'autres champs par défaut si nécessaire
            gmailAuthStatus: 'inactive', // Statut par défaut
            isGmailProcessor: false, // Statut par défaut
            gmailAuthorizedScopes: [], // Statut par défaut
            labelSapClosed: '', // Statut par défaut
            labelSapNoResponse: '', // Statut par défaut
            labelSapRma: '' // Statut par défaut
          };

          try {
            await createUserProfileSdk(defaultProfile);
            console.log(`[user-profile-direct] Action: Profil créé avec succès pour l'ID: ${userId}.`);
          } catch (createError: any) {
            console.error("[user-profile-direct] Action: Erreur lors de la création du profil:", createError);
            return json({
              error: `Erreur lors de la création du profil: ${createError.message || "Erreur inconnue"}`,
              success: false
            }, { status: 500 });
          }
        } else {
          console.log(`[user-profile-direct] Action: Profil existant trouvé pour l'ID: ${userId}. Mise à jour en cours.`);
          try {
            await updateUserProfileSdk(userId, updatedProfileData);
            console.log("[user-profile-direct] Action: Profil mis à jour avec succès.");
          } catch (updateError: any) {
            console.error("[user-profile-direct] Action: Erreur lors de la mise à jour du profil:", updateError);
            return json({
              error: `Erreur lors de la mise à jour du profil: ${updateError.message || "Erreur inconnue"}`,
              success: false
            }, { status: 500 });
          }
        }

        // Rediriger vers le dashboard après une mise à jour réussie
        return redirect("/dashboard");
      } catch (blockchainError: any) {
        console.error("[user-profile-direct] Action: Erreur blockchain critique:", blockchainError);
        return json({
          error: `Erreur de blockchain: ${blockchainError.message || "Erreur inconnue"}`,
          success: false
        }, { status: 500 });
      }
    } catch (error: any) {
      console.error("[user-profile-direct] Action: Erreur critique:", error);
      return json({
        error: `Une erreur s'est produite: ${error.message || "Erreur inconnue"}`,
        success: false
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error("[user-profile-direct] Erreur lors de la lecture de la session:", error);
    return redirect("/login");
  }
}

export default function UserProfileDirectPage() {
  const { userProfile, error, fallbackMode, session } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  // Initialiser l'état local avec les données du loader
  const [formData, setFormData] = useState<Partial<UserProfile>>({
    uid: userProfile?.uid,
    email: userProfile?.email,
    displayName: userProfile?.displayName || '',
    role: userProfile?.role,
    secteurs: userProfile?.secteurs || [],
    nom: userProfile?.nom || '',
    phone: userProfile?.phone || '',
    address: userProfile?.address || '',
    jobTitle: userProfile?.jobTitle || '',
    department: userProfile?.department,
  });

  useEffect(() => {
    // Mettre à jour l'état local lorsque les données du loader changent
    setFormData({
      uid: userProfile?.uid,
      email: userProfile?.email,
      displayName: userProfile?.displayName || '',
      role: userProfile?.role,
      secteurs: userProfile?.secteurs || [],
      nom: userProfile?.nom || '',
      phone: userProfile?.phone || '',
      address: userProfile?.address || '',
      jobTitle: userProfile?.jobTitle || '',
      department: userProfile?.department,
    });
  }, [userProfile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSectorToggle = (sector: string) => {
    setFormData(prev => {
      const currentSectors = prev.secteurs || [];
      const isSelected = currentSectors.includes(sector);
      let newSectors: string[];

      if (isSelected) {
        newSectors = currentSectors.filter(s => s !== sector);
      } else {
        newSectors = [...currentSectors, sector];
      }
      return { ...prev, secteurs: newSectors };
    });
  };

  const departmentOptions = AVAILABLE_DEPARTMENTS.map(dept => ({ value: dept, label: dept.charAt(0).toUpperCase() + dept.slice(1) }));

  return (
    <div className="min-h-full flex flex-col items-center justify-start py-8 px-4"> {/* Fond géré par root, ajustement du padding et de la justification */}
      {/* Les messages d'info/erreur seront stylisés avec le nouveau thème */}
      <div className="bg-ui-surface shadow-lg rounded-lg p-6 sm:p-8 max-w-lg w-full"> {/* Carte principale pour le formulaire */}
        <h1 className="text-2xl font-semibold text-text-primary text-center mb-6">
          Mon Profil 
          {/* Le "(Direct)" peut être conditionnel ou stylisé différemment si besoin */}
          {/* <span className="text-brand-blue-light text-lg">(Direct)</span> */}
        </h1>
        
        {/* Message d'info sur le mode d'authentification (si pertinent de le garder) */}
        {/* <div className="bg-brand-blue/10 border border-brand-blue/30 text-brand-blue-light px-4 py-3 rounded-md mb-6 text-sm text-center">
          <p>Ce profil utilise la méthode d'authentification directe.</p>
        </div> */}

        {fallbackMode && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 px-4 py-3 rounded-md mb-6 text-sm">
            <p className="font-semibold">Mode de secours actif</p>
            <p>L'accès à la blockchain a échoué. Certaines fonctionnalités sont limitées.</p>
            {error && <p className="text-xs mt-1">{error}</p>}
          </div>
        )}

        <Form method="post" className="space-y-5">
          {/* Email (Read-only) */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Email</label>
            <p className="text-sm text-text-primary bg-ui-background/50 px-3 py-2 rounded-md border border-ui-border">{formData.email}</p>
          </div>

          {/* Display Name */}
          <Input
            label="Nom d'affichage"
            id="displayName"
            name="displayName"
            value={formData.displayName || ''}
            onChange={handleChange}
            disabled={isSubmitting}
            placeholder="Nom affiché dans l'application"
            className="bg-ui-background/70 border-ui-border text-text-primary focus:border-brand-blue focus:ring-brand-blue"
            labelClassName="text-text-secondary"
          />

          {/* Nom */}
          <Input
            label="Nom complet"
            id="nom"
            name="nom"
            value={formData.nom || ''}
            onChange={handleChange}
            disabled={isSubmitting}
            placeholder="Votre nom complet"
            className="bg-ui-background/70 border-ui-border text-text-primary focus:border-brand-blue focus:ring-brand-blue"
            labelClassName="text-text-secondary"
          />

          {/* Phone */}
          <Input
            label="Téléphone"
            id="phone"
            name="phone"
            value={formData.phone || ''}
            onChange={handleChange}
            disabled={isSubmitting}
            placeholder="Votre numéro de téléphone"
            className="bg-ui-background/70 border-ui-border text-text-primary focus:border-brand-blue focus:ring-brand-blue"
            labelClassName="text-text-secondary"
          />

          {/* Address */}
          <Input
            label="Adresse"
            id="address"
            name="address"
            value={formData.address || ''}
            onChange={handleChange}
            disabled={isSubmitting}
            placeholder="Votre adresse"
            className="bg-ui-background/70 border-ui-border text-text-primary focus:border-brand-blue focus:ring-brand-blue"
            labelClassName="text-text-secondary"
          />

          {/* Job Title */}
          <Input
            label="Titre du poste"
            id="jobTitle"
            name="jobTitle"
            value={formData.jobTitle || ''}
            onChange={handleChange}
            disabled={isSubmitting}
            placeholder="Votre titre de poste"
            className="bg-ui-background/70 border-ui-border text-text-primary focus:border-brand-blue focus:ring-brand-blue"
            labelClassName="text-text-secondary"
          />

          {/* Department */}
          <div>
            <label htmlFor="department" className="block text-sm font-medium text-text-secondary mb-1">
              Département
            </label>
            <select
              id="department"
              name="department"
              value={formData.department || ''}
              onChange={handleChange}
              disabled={isSubmitting}
              className="w-full block rounded-md bg-ui-background/70 border-ui-border text-text-primary focus:border-brand-blue focus:ring-1 focus:ring-brand-blue py-2 px-3 shadow-sm"
            >
              <option value="">Sélectionnez un département</option>
              {departmentOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Sectors */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Secteurs
            </label>
            <div className="grid grid-cols-2 gap-3">
              {AVAILABLE_SECTORS.map((sector) => (
                <div
                  key={sector}
                  className={`
                    cursor-pointer px-3 py-2 rounded-md text-sm font-medium border
                    ${
                      formData.secteurs?.includes(sector)
                        ? 'bg-brand-blue text-white border-brand-blue-dark'
                        : 'bg-ui-background/70 text-text-secondary border-ui-border hover:bg-ui-border'
                    }
                  `}
                  onClick={() => handleSectorToggle(sector)}
                >
                  {/* Checkbox cachée pour la sémantique du formulaire */}
                  <input
                    type="checkbox"
                    name="sectors"
                    value={sector}
                    checked={formData.secteurs?.includes(sector) || false}
                    onChange={() => {}} // Géré par onClick sur le div parent
                    className="hidden" 
                    aria-hidden="true"
                  />
                  <span>{sector}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            variant="primary"
            className="w-full bg-brand-blue hover:bg-brand-blue-dark"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Enregistrement..." : "Enregistrer les modifications"}
          </Button>

          {/* Bouton Retour */}
          <div className="text-center">
            <Link to="/dashboard" className="text-sm text-text-secondary hover:text-brand-blue hover:underline">
              Retour au tableau de bord
            </Link>
          </div>
        </Form>

        {/* Section Paramètres */}
        <div className="mt-8 border-t border-ui-border/50 pt-6">
          <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">Paramètres</h3>
          <div className="flex flex-col space-y-2">
            <Link 
              to="/gmail-config" 
              className="text-sm text-brand-blue hover:text-brand-blue-light hover:underline"
            >
              Configuration Gmail et Traitement Automatique
            </Link>
            {/* Vous pouvez ajouter d'autres liens de paramètres ici si nécessaire */}
          </div>
        </div>
      </div>
    </div>
  );
}
