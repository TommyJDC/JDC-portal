import { json, redirect } from "@remix-run/node";
import { Form, useLoaderData, useNavigation } from "@remix-run/react";
import { useEffect, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { authenticator } from "~/services/auth.server";
import { getUserProfileSdk, updateUserProfileSdk } from "~/services/firestore.service.server";
import { Button } from "~/components/ui/Button";

// Liste des secteurs disponibles
const AVAILABLE_SECTORS = ["Kezia", "HACCP", "CHR", "Tabac"];

export async function loader({ request }: LoaderFunctionArgs) {
  // Vérifier si l'utilisateur est authentifié
  const session = await authenticator.isAuthenticated(request);
  if (!session) {
    return redirect("/");
  }

  // Récupérer le profil utilisateur
  try {
    const userProfile = await getUserProfileSdk(session.userId);
    
    // Si l'utilisateur a déjà des secteurs, rediriger vers le dashboard
    if (userProfile?.secteurs && userProfile.secteurs.length > 0) {
      return redirect("/dashboard");
    }
    
    return json({ userId: session.userId, email: session.email, displayName: session.displayName });
  } catch (error) {
    // Si une erreur se produit, rediriger vers la page d'accueil
    console.error("Erreur lors de la récupération du profil utilisateur:", error);
    return redirect("/?error=profile-error");
  }
}

export async function action({ request }: ActionFunctionArgs) {
  // Vérifier si l'utilisateur est authentifié
  const session = await authenticator.isAuthenticated(request);
  if (!session) {
    return redirect("/");
  }
  
  // Récupérer les données du formulaire
  const formData = await request.formData();
  const selectedSectors = formData.getAll("sectors") as string[];
  
  // Vérifier que des secteurs ont été sélectionnés
  if (!selectedSectors || selectedSectors.length === 0) {
    return json({ error: "Veuillez sélectionner au moins un secteur" }, { status: 400 });
  }
  
  try {
    // Mettre à jour le profil utilisateur avec les secteurs sélectionnés
    await updateUserProfileSdk(session.userId, { 
      secteurs: selectedSectors
    });
    
    // Rediriger vers le dashboard après la mise à jour
    return redirect("/dashboard");
  } catch (error) {
    console.error("Erreur lors de la mise à jour du profil utilisateur:", error);
    return json({ error: "Une erreur s'est produite lors de la mise à jour de votre profil" }, { status: 500 });
  }
}

export default function CreateProfile() {
  const { userId, email, displayName } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  
  // Gérer la sélection/désélection d'un secteur
  const handleSectorToggle = (sector: string) => {
    setSelectedSectors(prev => 
      prev.includes(sector)
        ? prev.filter(s => s !== sector)
        : [...prev, sector]
    );
  };
  
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-center mb-6">Finaliser votre profil</h1>
        
        <div className="mb-6">
          <p className="text-gray-700 mb-2">Bienvenue, {displayName || email}!</p>
          <p className="text-gray-600 text-sm">Veuillez sélectionner les secteurs qui vous concernent pour finaliser la création de votre profil.</p>
        </div>
        
        <Form method="post">
          <div className="mb-6">
            <label className="block text-gray-700 font-medium mb-3">Sélectionnez vos secteurs :</label>
            
            <div className="space-y-2">
              {AVAILABLE_SECTORS.map(sector => (
                <div key={sector} className="flex items-center">
                  <input
                    type="checkbox"
                    id={`sector-${sector}`}
                    name="sectors"
                    value={sector}
                    checked={selectedSectors.includes(sector)}
                    onChange={() => handleSectorToggle(sector)}
                    className="h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <label htmlFor={`sector-${sector}`} className="ml-2 block text-gray-700">
                    {sector}
                  </label>
                </div>
              ))}
            </div>
            
            {selectedSectors.length === 0 && (
              <p className="text-red-500 text-sm mt-2">Veuillez sélectionner au moins un secteur</p>
            )}
          </div>
          
          <div className="flex justify-center">
            <Button
              type="submit"
              disabled={isSubmitting || selectedSectors.length === 0}
              className="w-full"
            >
              {isSubmitting ? "Enregistrement..." : "Finaliser mon profil"}
            </Button>
          </div>
        </Form>
      </div>
    </div>
  );
}
