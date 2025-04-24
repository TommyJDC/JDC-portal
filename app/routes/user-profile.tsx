import { json, redirect } from "@remix-run/node";
import { Form, useLoaderData, useNavigation, Link } from "@remix-run/react"; // Import Link
import { useEffect, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { authenticator } from "~/services/auth.server";
import { getUserProfileSdk, updateUserProfileSdk } from "~/services/firestore.service.server";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input"; // Importer le composant Input
import { Select } from "~/components/ui/Select"; // Importer le composant Select
import type { UserProfile } from "~/types/firestore.types"; // Importer le type UserProfile

// Liste des secteurs disponibles (peut être déplacée vers un fichier de constantes si nécessaire)
const AVAILABLE_SECTORS = ["Kezia", "HACCP", "CHR", "Tabac"];
const AVAILABLE_DEPARTMENTS = ["technique", "commercial", "admin"]; // Ajouter les départements

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await authenticator.isAuthenticated(request);
  if (!session) {
    return redirect("/");
  }

  try {
    let userProfile = await getUserProfileSdk(session.userId);

    // Si le profil n'existe pas, créer un profil de base
    if (!userProfile) {
      userProfile = {
        uid: session.userId,
        email: session.email || '',
        displayName: session.displayName || '',
        role: 'Technician', // Rôle par défaut
        secteurs: [],
        nom: session.displayName || '', // Utiliser displayName comme nom par défaut
      };
      // Optionnel: Enregistrer ce profil de base dans Firestore immédiatement
      // await updateUserProfileSdk(session.userId, userProfile);
    }

    return json({ userProfile });
  } catch (error) {
    console.error("Erreur lors de la récupération ou création du profil utilisateur:", error);
    // Rediriger vers la page d'accueil avec un message d'erreur
    return redirect("/?error=profile-load-error");
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const session = await authenticator.isAuthenticated(request);
  if (!session) {
    return redirect("/");
  }

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

  console.log("UserProfile Action: Received formData:", Object.fromEntries(formData.entries()));
  console.log("UserProfile Action: Constructed updatedProfileData:", updatedProfileData);

  // S'assurer que le rôle ne peut pas être modifié via cette action
  if ('role' in updatedProfileData) {
    console.warn("UserProfile Action: Attempted to modify role, ignoring.");
    delete updatedProfileData.role;
  }

  try {
    await updateUserProfileSdk(session.userId, updatedProfileData);
    console.log("UserProfile Action: Profile updated successfully.");
    // Rediriger vers le dashboard ou une page de confirmation après la mise à jour
    return redirect("/dashboard");
  } catch (error) {
    console.error("UserProfile Action: Erreur lors de la mise à jour du profil utilisateur:", error);
    return json({ error: "Une erreur s'est produite lors de la mise à jour de votre profil" }, { status: 500 });
  }
}

export default function UserProfilePage() {
  const { userProfile } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  // Initialiser l'état local avec les données du loader, en excluant les champs de timestamp sérialisés
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
    department: userProfile?.department, // Initialiser avec undefined si nul/indéfini
    // Exclure createdAt et updatedAt car leur type est modifié par JsonifyObject
  });

  useEffect(() => {
    // Mettre à jour l'état local lorsque les données du loader changent, en excluant les champs de timestamp
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
      department: userProfile?.department, // Mettre à jour avec undefined si nul/indéfini
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
    <div className="min-h-screen bg-jdc-gray-900 flex flex-col items-center justify-center p-4">
      <div className="bg-jdc-card rounded-lg shadow-lg p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-white text-center mb-6">Mon Profil</h1>

        <Form method="post" className="space-y-4">
          {/* Email (Read-only) */}
          <div>
            <label className="block text-sm font-medium text-jdc-gray-300 mb-1">Email</label>
            <p className="text-sm text-white bg-jdc-gray-800 px-3 py-2 rounded">{formData.email}</p>
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
          />

          {/* Department */}
          <Select
            label="Département"
            id="department"
            name="department"
            options={departmentOptions}
            value={formData.department || ''}
            onChange={handleChange}
            disabled={isSubmitting}
          />


          {/* Sector Buttons */}
          <div>
            <label className="block text-sm font-medium text-jdc-gray-300 mb-2">Secteurs</label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_SECTORS.map((sector) => {
                const isSelected = (formData.secteurs || []).includes(sector);
                return (
                  <Button
                    key={sector}
                    type="button" // Important: prevent form submission
                    variant={isSelected ? 'primary' : 'secondary'} // Style based on selection
                    size="sm"
                    onClick={() => handleSectorToggle(sector)}
                    disabled={isSubmitting}
                    className={`transition-colors duration-150 ${
                      isSelected
                        ? 'bg-jdc-yellow text-black hover:bg-yellow-300' // Utiliser les couleurs JDC
                        : 'bg-jdc-gray-800 text-jdc-gray-300 hover:bg-jdc-gray-700' // Utiliser les couleurs JDC
                    } px-3 py-1.5 rounded-md text-sm font-medium ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {sector}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Hidden inputs for selected sectors */}
          {(formData.secteurs || []).map(sector => (
            <input key={sector} type="hidden" name="sectors" value={sector} />
          ))}

          {/* Role (Read-only) */}
           <div>
            <label className="block text-sm font-medium text-jdc-gray-300 mb-1">Rôle</label>
            <p className="text-sm text-white bg-jdc-gray-800 px-3 py-2 rounded">{formData.role}</p>
          </div>

          {/* Link to Gmail Configuration */}
          <div className="pt-4">
            <Link to="/gmail-config" className="text-jdc-blue hover:text-jdc-blue-dark text-sm font-medium">
              Gérer la configuration Gmail
            </Link>
          </div>


          <div className="flex justify-center pt-4">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-jdc-yellow text-black hover:bg-yellow-300" // Utiliser les couleurs JDC pour le bouton principal
            >
              {isSubmitting ? "Sauvegarde..." : "Sauvegarder le profil"}
            </Button>
          </div>
        </Form>
      </div>
    </div>
  );
}
