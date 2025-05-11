import { json , unstable_parseMultipartFormData } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import { useState, useEffect } from "react";
import { Button } from "~/components/ui/Button";
import { handleFileUpload, uploadHandler, generateAndUploadExcel, type CommercialUploadResult } from "../services/commercial.service.server";
import type { ActionFunctionArgs } from "@remix-run/node";
import type { CommercialData } from "../lib/excelGenerator";
import { FaUpload, FaFileImage, FaFileExcel, FaSpinner, FaCheckCircle, FaExclamationTriangle } from "react-icons/fa";



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
  const [originalFileNameForDownload, setOriginalFileNameForDownload] = useState<string | null>(null); // Renommé pour clarté


  // Update state based on actionData
  useEffect(() => {
    if (actionData?.success) {
      if (actionData.commercialData) {
        setPreviewData(actionData.commercialData);
        setOriginalFileNameForDownload(actionData.originalFileName ?? null); // Utiliser le nouveau nom
      } else if (actionData.excelUrl) {
        setPreviewData(null); 
      }
    } else if (actionData?.error) {
       setPreviewData(null);
       setOriginalFileNameForDownload(null); // Utiliser le nouveau nom
    }
  }, [actionData]);

  useEffect(() => {
    if (actionData?.success && actionData.excelUrl) {
      const link = document.createElement('a');
      link.href = actionData.excelUrl;
      link.download = originalFileNameForDownload // Utiliser le nom stocké pour le téléchargement
        ? `${originalFileNameForDownload.replace(/\.[^/.]+$/, "")}.xlsx`
        : `commercial_${new Date().toISOString().slice(0,10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [actionData, originalFileNameForDownload]); // Dépendre du nouveau nom

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      setPreviewData(null); 
      setOriginalFileNameForDownload(file.name); // Stocker le nom original pour le téléchargement
    } else {
      setFileName("");
      setPreviewData(null);
      setOriginalFileNameForDownload(null);
    }
  };

  // Determine which button is currently submitting
  const isSubmittingUpload = navigation.state === "submitting" && navigation.formData?.get('_action') === 'upload';
  const isSubmittingGenerate = navigation.state === "submitting" && navigation.formData?.get('_action') === 'generate';

  // Show download link directly if excelUrl is available
  const canShowDownloadDirect = !!actionData?.excelUrl && actionData.success;

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-8">
      <h1 className="text-2xl font-semibold text-text-primary mb-6 flex items-center">
        <FaUpload className="mr-3 text-brand-blue" />
        Gestion Commerciale - Import Menu par Image
      </h1>

      {!canShowDownloadDirect && (
        <Form method="post" encType="multipart/form-data" className="space-y-6">
          <div className="bg-ui-surface rounded-lg shadow-md p-4 sm:p-6 space-y-4 border border-ui-border">
            <h2 className="text-lg font-semibold text-text-primary flex items-center">
              <FaFileImage className="mr-2 text-brand-blue-light" />
              Importer un menu par image (via IA)
            </h2>
            <div>
              <label htmlFor="commercialImage" className="block text-xs font-medium text-text-secondary mb-1">
                Fichier Image (.png, .jpg, .jpeg, .gif, .webp)
              </label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <input
                  type="file"
                  id="commercialImage"
                  name="commercialFile"
                  accept=".png,.jpg,.jpeg,.gif,.webp"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-text-tertiary file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brand-blue file:text-white hover:file:bg-brand-blue-dark cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-brand-blue"
                  required
                />
                {fileName && (
                  <span className="text-xs text-text-secondary mt-1 sm:mt-0 flex-shrink-0">{fileName}</span>
                )}
              </div>
            </div>
            <p className="text-xs text-text-secondary">
              L'importation par image utilise l'IA pour transcrire le menu. Assurez-vous que l'image est claire.
            </p>
            <input type="hidden" name="_action" value="upload" />
            <Button
              type="submit"
              disabled={isSubmittingUpload || !fileName}
              variant="primary"
              className="w-full sm:w-auto bg-brand-blue hover:bg-brand-blue-dark"
            >
              {isSubmittingUpload ? <FaSpinner className="animate-spin mr-2" /> : <FaFileImage className="mr-2" />}
              {isSubmittingUpload ? "Traitement..." : "Extraire les données"}
            </Button>
          </div>
        </Form>
      )}
      
      {actionData?.error && !actionData.success && (
        <div className="flex items-start p-3 text-sm rounded-md bg-red-500/10 border border-red-500/30 text-red-300">
            <FaExclamationTriangle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
            <span>{actionData.error}</span>
        </div>
      )}

      {previewData && !actionData?.excelUrl && (
        <div className="mt-6 p-4 sm:p-6 bg-ui-surface-accent rounded-lg shadow-md border border-brand-blue/30 space-y-4">
          <h3 className="text-lg font-medium text-brand-blue-light">Aperçu des données extraites</h3>
          <div className="mt-2 max-h-80 overflow-y-auto bg-ui-background rounded p-3 border border-ui-border">
            <pre className="text-xs text-text-secondary whitespace-pre-wrap break-all">
              {JSON.stringify(previewData, null, 2)}
            </pre>
          </div>
          
          <Form method="post">
            <input type="hidden" name="commercialData" value={JSON.stringify(previewData)} />
            <input type="hidden" name="originalFileName" value={originalFileNameForDownload || ''} />
            <input type="hidden" name="_action" value="generate" />
            <Button
              type="submit"
              disabled={isSubmittingGenerate}
              variant="primary"
              className="w-full sm:w-auto bg-brand-blue hover:bg-brand-blue-dark"
            >
              {isSubmittingGenerate ? <FaSpinner className="animate-spin mr-2" /> : <FaFileExcel className="mr-2" />}
              {isSubmittingGenerate ? "Génération..." : "Générer Fichier Excel"}
            </Button>
          </Form>
        </div>
      )}

      {actionData?.success && actionData.excelUrl && (
        <div className="mt-6 p-4 sm:p-6 bg-green-500/10 rounded-lg shadow-md border border-green-500/30 text-center space-y-3">
          <FaCheckCircle className="text-3xl text-green-600 mx-auto" />
          <h3 className="text-lg font-medium text-green-700">Fichier Excel Prêt !</h3>
          <p className="text-sm text-green-600">
            Le fichier commercial a été généré avec succès. Le téléchargement devrait commencer automatiquement.
          </p>
          <a
            href={actionData.excelUrl}
            download={originalFileNameForDownload ? `${originalFileNameForDownload.replace(/\.[^/.]+$/, "")}.xlsx` : `commercial.xlsx`}
            className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 focus-visible:ring-green-500"
          >
            <FaFileExcel className="mr-2 h-4 w-4" />
            Télécharger à nouveau
          </a>
        </div>
      )}
    </div>
  );
}
