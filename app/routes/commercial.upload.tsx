import { json } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import { useState } from "react";
import { Button } from "~/components/ui/Button";
import { handleFileUpload } from "../services/commercial.service.server";
import type { ActionFunctionArgs } from "@remix-run/node";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const result = await handleFileUpload(request);
    return json({ success: true, excelUrl: result.excelUrl });
  } catch (error) {
    return json({ 
      error: error instanceof Error ? error.message : "Une erreur est survenue" 
    }, { status: 500 });
  }
};

export default function UploadMenuPage() {
  const actionData = useActionData<{
    error?: string;
    success?: boolean;
    excelUrl?: string;
  }>();
  const navigation = useNavigation();
  const [fileName, setFileName] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Gestion Commerciale - Import Excel</h1>
      
      <Form method="post" encType="multipart/form-data" className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="commercialFile" className="block text-sm font-medium">
            Fichier Commercial (Excel)
          </label>
          <div className="flex items-center gap-4">
            <input
              type="file"
              id="commercialFile"
              name="commercialFile"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-jdc-blue file:text-white
                hover:file:bg-jdc-blue-dark"
              required
            />
            {fileName && (
              <span className="text-sm text-gray-600">{fileName}</span>
            )}
          </div>
        </div>

        <Button
          type="submit"
          disabled={navigation.state === "submitting"}
          className="bg-jdc-green hover:bg-jdc-green-dark"
        >
          {navigation.state === "submitting" ? "Traitement..." : "Générer le fichier commercial"}
        </Button>

        {actionData?.error && (
          <div className="text-red-500 mt-4">{actionData.error}</div>
        )}

        {actionData?.success && actionData.excelUrl && (
          <div className="mt-6 p-4 bg-green-50 rounded-md">
            <h3 className="text-lg font-medium text-green-800">Conversion réussie !</h3>
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
      </Form>
    </div>
  );
}
