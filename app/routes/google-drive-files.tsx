import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
// import { authenticator } from "~/services/auth.server"; // Plus utilisé directement
import { sessionStorage, type UserSessionData } from "~/services/session.server"; // Importer pour session manuelle

// Define the expected structure of the Google Drive API response (simplified)
interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
}

// Define the possible structure of the data returned by the loader
interface LoaderData {
  files: GoogleDriveFile[];
  error?: string; // Error message is optional
}

interface GoogleDriveFilesListResponse {
  files: GoogleDriveFile[];
  nextPageToken?: string;
}

// Loader function to fetch files from Google Drive
export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Ensure the user is authenticated
  const session = await sessionStorage.getSession(request.headers.get("Cookie"));
  const userSession: UserSessionData | null = session.get("user") ?? null;

  if (!userSession || !userSession.userId) {
    // Redirect to login or homepage if not authenticated
    return redirect("/login?error=unauthenticated_drive_access");
  }

  // IMPORTANT: UserSessionData ne contient pas googleAccessToken par défaut.
  // Il contient googleRefreshToken. Si googleAccessToken est nécessaire,
  // il faudrait l'ajouter à UserSessionData et le stocker lors de la connexion.
  // Pour l'instant, on suppose qu'il pourrait être ajouté à UserSessionData.
  const accessToken = (userSession as any).googleAccessToken; // Cast temporaire

  if (!accessToken) {
    // This might happen if the token expired and we haven't implemented refresh logic yet,
    // or if it wasn't obtained correctly during login.
    console.error("[google-drive-files Loader] No access token found in session.");
    // For now, redirect to re-authenticate. Later, implement refresh token logic.
    return redirect("/login?error=token_missing_drive"); // Rediriger vers /login
  }

  console.log("[google-drive-files Loader] Access token found. Fetching Drive files...");

  try {
    // Call the Google Drive API (Files: list)
    // We'll fetch a small number of files for this test
    const driveApiUrl = `https://www.googleapis.com/drive/v3/files?pageSize=10&fields=files(id,name,mimeType,webViewLink)`;

    const response = await fetch(driveApiUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      // Handle API errors (e.g., token expired, insufficient permissions)
      const errorBody = await response.json();
      console.error("[google-drive-files Loader] Google Drive API error:", response.status, errorBody);
      // Specific check for invalid credentials (token expired/revoked)
      if (response.status === 401) {
         // Token is likely invalid/expired. Redirect to re-authenticate.
         return redirect("/login?error=token_invalid_drive"); // Rediriger vers /login
      }
      // Throw a generic error for other API issues
      throw new Error(`Google Drive API request failed: ${response.statusText}`);
    }

    const data: GoogleDriveFilesListResponse = await response.json();
    console.log(`[google-drive-files Loader] Successfully fetched ${data.files?.length ?? 0} files.`);

    // Return the list of files
    return json({ files: data.files ?? [] });

  } catch (error: any) {
    console.error("[google-drive-files Loader] Error fetching Google Drive files:", error);
    // Return an error state to the component
    return json({ files: [], error: error.message || "Failed to fetch files" }, { status: 500 });
  }
};

// Component to display the files
import { FaGoogleDrive, FaArrowLeft, FaExclamationTriangle, FaFolderOpen } from 'react-icons/fa'; // Importer des icônes

export default function GoogleDriveFiles() {
  const { files, error } = useLoaderData<LoaderData>();

  return (
    <div className="space-y-6"> {/* Augmenter l'espacement global */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text-primary flex items-center">
          <FaGoogleDrive className="mr-3 text-brand-blue h-6 w-6" />
          Fichiers Google Drive
        </h1>
        <Link to="/dashboard" className="inline-flex items-center text-sm text-brand-blue hover:text-brand-blue-light hover:underline">
          <FaArrowLeft className="mr-1.5 h-4 w-4" />
          Retour au Tableau de Bord
        </Link>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-4 rounded-md shadow-md">
          <div className="flex items-center mb-2">
            <FaExclamationTriangle className="h-5 w-5 mr-2 text-red-400" />
            <p className="font-semibold text-red-200">Erreur lors de la récupération des fichiers :</p>
          </div>
          <p className="text-sm">{error}</p>
          <p className="mt-2 text-xs text-red-300/80">Cela peut être dû à un jeton expiré ou à des permissions insuffisantes. Essayez de vous reconnecter via Google.</p>
           <Link to="/login?error=token_invalid_drive_ui" className="text-brand-yellow hover:underline font-semibold mt-2 text-sm inline-block">
             Se reconnecter
           </Link>
        </div>
      )}

      {!error && files && files.length > 0 && (
        <div className="bg-ui-surface rounded-lg shadow-md border border-ui-border">
          <ul className="divide-y divide-ui-border/70">
            {files.map((file) => (
              <li key={file.id} className="p-3 sm:p-4 hover:bg-ui-surface-hover transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-text-primary text-sm">{file.name}</p>
                    <p className="text-xs text-text-secondary">{file.mimeType}</p>
                  </div>
                  {file.webViewLink && (
                    <a
                      href={file.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-brand-blue hover:text-brand-blue-light hover:underline ml-4 flex-shrink-0"
                    >
                      Ouvrir
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!error && files && files.length === 0 && (
        <div className="text-center py-10 text-text-secondary bg-ui-surface rounded-lg shadow-md border border-ui-border">
          <FaFolderOpen className="mx-auto text-4xl mb-3 opacity-40" />
          <p>Aucun fichier trouvé (ou accès non autorisé).</p>
        </div>
      )}
    </div>
  );
}
