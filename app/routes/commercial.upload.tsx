import { json , unstable_parseMultipartFormData } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import { useState, useEffect } from "react";
import { Button } from "~/components/ui/Button";
import { handleFileUpload, uploadHandler, generateAndUploadExcel, type CommercialUploadResult } from "../services/commercial.service.server";
import type { ActionFunctionArgs } from "@remix-run/node";
import type { CommercialData } from "../lib/excelGenerator";



export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const contentType = request.headers.get("Content-Type");
    
    // Si c'est un multipart form (upload de fichier)
    if (contentType?.startsWith("multipart/form-data")) {
      const formData = await unstable_parseMultipartFormData(
        request,
        uploadHandler
      );
      
      const file = formData.get("commercialFile");
      if (!file || !(file instanceof File)) {
        throw new Error("Fichier non valide fourni pour l'upload.");
      }

      const result = await handleFileUpload(file);
      return json({
        success: true,
        ...result,
        originalFileName: file.name // Ensure originalFileName is passed for download naming
      });
    }
    
    // Si c'est un JSON (génération Excel à partir de données prévisualisées)
    const formData = await request.formData();
    const actionType = formData.get("_action");
    
    if (actionType === 'generate') {
      const commercialDataString = formData.get("commercialData");
      const originalFileName = formData.get("originalFileName");

      if (!commercialDataString || typeof commercialDataString !== 'string' ||
          !originalFileName || typeof originalFileName !== 'string') {
        throw new Error("Données manquantes pour la génération.");
      }

      const commercialData: CommercialData = JSON.parse(commercialDataString);
      
      // Appeler directement generateAndUploadExcel avec les données
      const result = await generateAndUploadExcel(commercialData, originalFileName);
      
      // generateAndUploadExcel retourne excelUrl
      if (!result.excelUrl) {
         throw new Error("La génération Excel a échoué.");
      }

      return json({ success: true, excelUrl: result.excelUrl, originalFileName }); // Retourner excelUrl et originalFileName
    }

    throw new Error("Action non supportée");

  } catch (error) {
    console.error("Action error:", error);
    return json({
      error: error instanceof Error ? error.message : "Une erreur est survenue"
    }, { status: 500 });
  }
};


export default function UploadMenuPage() {
  const actionData = useActionData<CommercialUploadResult & { error?: string; success?: boolean; }>();
  const navigation = useNavigation();
  const [fileName, setFileName] = useState("");
  const [previewData, setPreviewData] = useState<CommercialData | null>(null);
  const [originalFileName, setOriginalFileName] = useState<string | null>(null);


  // Update state based on actionData
  useEffect(() => {
    if (actionData?.success) {
      if (actionData.commercialData) {
        // Result from image upload/processing
        setPreviewData(actionData.commercialData);
        setOriginalFileName(actionData.originalFileName ?? null);
      } else if (actionData.excelUrl) {
        // Result from excel generation/upload
        // The download is handled in the separate download effect
        setPreviewData(null); // Clear preview after generation
        // originalFileName is already set from the initial upload actionData
      }
    } else if (actionData?.error) {
       setPreviewData(null);
       setOriginalFileName(null);
    }
  }, [actionData]);

  // Téléchargement automatique après génération Excel
  useEffect(() => {
    if (actionData?.success && actionData.excelUrl) {
      const link = document.createElement('a');
      link.href = actionData.excelUrl;
      // Use the originalFileName stored in state for the download name
      link.download = originalFileName 
        ? `${originalFileName.replace(/\.[^/.]+$/, "")}.xlsx`
        : `commercial_${new Date().toISOString().slice(0,10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [actionData, originalFileName]); // Depend on originalFileName state

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      setPreviewData(null); // Clear preview when a new file is selected
      setOriginalFileName(null); // Clear originalFileName as well
    } else {
      setFileName("");
      setPreviewData(null);
      setOriginalFileName(null);
    }
  };

  // Determine which button is currently submitting
  const isSubmittingUpload = navigation.state === "submitting" && navigation.formData?.get('_action') === 'upload';
  const isSubmittingGenerate = navigation.state === "submitting" && navigation.formData?.get('_action') === 'generate';

  // Show download link directly if excelUrl is available
  const canShowDownloadDirect = !!actionData?.excelUrl && actionData.success;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Gestion Commerciale - Importation de Menu par Image</h1>

      {/* Formulaire d'import uniquement si pas encore de fichier généré */}
      {!canShowDownloadDirect && (
        <Form method="post" encType="multipart/form-data" className="space-y-8">
          <div className="border p-4 rounded-md space-y-4">
            <h2 className="text-xl font-semibold">Importer un menu par image (via IA)</h2>
            <div className="space-y-2">
              <label htmlFor="commercialImage" className="block text-sm font-medium">
                Fichier Image (.png, .jpg, .jpeg, .gif, .webp)
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="file"
                  id="commercialImage"
                  name="commercialFile"
                  accept=".png,.jpg,.jpeg,.gif,.webp"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-semibold
                    file:bg-jdc-green file:text-white
                    hover:file:bg-jdc-green-dark"
                  required
                />
                {fileName && (
                  <span className="text-sm text-gray-600">{fileName}</span>
                )}
              </div>
            </div>
            <p className="text-sm text-gray-600">
              L'importation par image utilise l'intelligence artificielle pour transcrire le texte du menu.
              Assurez-vous que l'image est claire et lisible.
            </p>
            <input type="hidden" name="_action" value="upload" />
            <Button
              type="submit"
              disabled={isSubmittingUpload || !fileName}
              className="bg-jdc-green hover:bg-jdc-green-dark"
            >
              {isSubmittingUpload ? "Traitement..." : "Extraire les données du menu"}
            </Button>
          </div>
          {actionData?.error && (
            <div className="text-red-500 mt-4">{actionData.error}</div>
          )}
        </Form>
      )}

      {/* Aperçu des données et génération Excel */}
      {previewData && (
        <div className="mt-6 p-4 bg-blue-50 rounded-md">
          <h3 className="text-lg font-medium text-blue-800">Aperçu des données extraites</h3>
          <div className="mt-4 max-h-96 overflow-y-auto">
            <pre className="text-xs p-2 bg-white rounded">
              {JSON.stringify(previewData, null, 2)}
            </pre>
          </div>
          
          <Form method="post" className="mt-4">
            <input 
              type="hidden" 
              name="commercialData" 
              value={JSON.stringify(previewData)} 
            />
            <input 
              type="hidden" 
              name="originalFileName" 
              value={originalFileName || ''} 
            />
            <input type="hidden" name="_action" value="generate" />
            
            <Button
              type="submit"
              disabled={isSubmittingGenerate}
              className="bg-jdc-green hover:bg-jdc-green-dark"
            >
              {isSubmittingGenerate ? "Génération en cours..." : "Générer le fichier Excel"}
            </Button>
          </Form>
        </div>
      )}

      {/* Téléchargement direct du fichier généré */}
      {actionData?.success && actionData.excelUrl && (
        <div className="mt-6 p-4 bg-green-50 rounded-md">
          <h3 className="text-lg font-medium text-green-800">Fichier prêt !</h3>
          <p className="mt-2 text-green-700">
            Le fichier commercial a été généré avec succès.
          </p>
          <a
            href={actionData.excelUrl}
            download
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-jdc-green hover:bg-jdc-green-dark"
          >
            Télécharger le fichier commercial
          </a>
        </div>
      )}
    </div>
  );
}
