import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { authenticator } from "~/services/auth.server";
import type { UserSession } from "~/services/session.server";

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
  const userSession = await authenticator.isAuthenticated(request);
  if (!userSession) {
    // Redirect to login or homepage if not authenticated
    // Maybe add a message indicating why they were redirected
    return redirect("/?error=unauthenticated");
  }

  const accessToken = userSession.googleAccessToken;

  if (!accessToken) {
    // This might happen if the token expired and we haven't implemented refresh logic yet,
    // or if it wasn't obtained correctly during login.
    console.error("[google-drive-files Loader] No access token found in session.");
    // For now, redirect to re-authenticate. Later, implement refresh token logic.
    // You might want a specific error page or message.
    // Consider destroying the session here? authenticator.logout(request, { redirectTo: "/auth/google" });
    return redirect("/auth/google?error=token_missing"); // Force re-auth
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
         // Consider destroying the session here? authenticator.logout(request, { redirectTo: "/auth/google" });
         return redirect("/auth/google?error=token_invalid");
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
export default function GoogleDriveFiles() {
  // Use the explicit LoaderData interface
  const { files, error } = useLoaderData<LoaderData>();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-white">Fichiers Google Drive (Test API)</h1>

      <Link to="/dashboard" className="text-jdc-blue hover:underline">
        &larr; Retour au Tableau de Bord
      </Link>

      {error && (
        <div className="bg-red-900 bg-opacity-50 text-red-300 p-4 rounded-md">
          <p className="font-semibold">Erreur lors de la récupération des fichiers :</p>
          <p>{error}</p>
          <p className="mt-2 text-sm">Cela peut être dû à un jeton expiré ou à des permissions insuffisantes. Essayez de vous reconnecter via Google.</p>
           <Link to="/auth/google" className="text-jdc-yellow hover:underline font-semibold mt-1 block">
             Se reconnecter avec Google
           </Link>
        </div>
      )}

      {!error && files && files.length > 0 && (
        <ul className="bg-jdc-card rounded-lg shadow p-4 space-y-2">
          {files.map((file) => (
            <li key={file.id} className="border-b border-jdc-gray-700 pb-2 last:border-b-0">
              <p className="font-medium text-white">{file.name}</p>
              <p className="text-sm text-jdc-gray-400">{file.mimeType}</p>
              {file.webViewLink && (
                <a
                  href={file.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-jdc-blue hover:underline"
                >
                  Ouvrir dans Drive
                </a>
              )}
            </li>
          ))}
        </ul>
      )}

      {!error && files && files.length === 0 && (
        <p className="text-jdc-gray-400">Aucun fichier trouvé (ou accès non autorisé).</p>
      )}
    </div>
  );
}
