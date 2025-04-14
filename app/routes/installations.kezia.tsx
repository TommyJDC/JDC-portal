import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { authenticator } from "~/services/auth.server";
import { getGoogleAuthClient, readSheetData } from "~/services/google.server"; // Import Google helpers (removed .ts)
import { useState } from "react"; // For handling input changes

// --- Configuration for Kezia Sheet ---
const KEZIA_SPREADSHEET_ID = "1uzzHN8tzc53mOOpH8WuXJHIUsk9f17eYc0qsod-Yryk";
const KEZIA_SHEET_NAME = "EN COURS"; // From user input
const KEZIA_DATA_RANGE = `${KEZIA_SHEET_NAME}!A:P`; // From user input (Columns A to P)
const EDITABLE_COLUMNS = ['N', 'O', 'P']; // From user input (0-based index: 13, 14, 15)
const EDITABLE_COL_INDICES = [13, 14, 15]; // N=13, O=14, P=15 (0-based)
// --- End Configuration ---

interface SheetLoaderData {
  headers: string[];
  rows: any[][];
  error?: string;
  warning?: string; // To display the unique ID warning
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const session = await authenticator.isAuthenticated(request);
  if (!session) {
    return redirect("/?error=unauthenticated");
  }

  try {
    const authClient = await getGoogleAuthClient(session);
    const sheetValues = await readSheetData(authClient, KEZIA_SPREADSHEET_ID, KEZIA_DATA_RANGE);

    if (!sheetValues || sheetValues.length === 0) {
      return json<SheetLoaderData>({ headers: [], rows: [], error: "Aucune donnée trouvée dans la feuille." });
    }

    // Assume first row is headers
    const headers = sheetValues[0];
    const rows = sheetValues.slice(1);

    return json<SheetLoaderData>({
        headers,
        rows,
        warning: "Modification désactivée : Aucune colonne d'identification unique n'a été spécifiée pour cette feuille."
    });

  } catch (error: any) {
    console.error("[installations.kezia Loader] Error:", error);
     // Handle potential token errors from getGoogleAuthClient
     if (error.message.includes("token") || error.message.includes("authenticate")) {
        // Consider destroying session: await authenticator.logout(request, { redirectTo: "/auth/google?error=token_error" });
        return redirect("/auth/google?error=token_error");
     }
    return json<SheetLoaderData>({ headers: [], rows: [], error: error.message || "Erreur lors du chargement des données Kezia." }, { status: 500 });
  }
};

// --- Component ---
export default function KeziaInstallations() {
  const { headers, rows, error, warning } = useLoaderData<typeof loader>();
  // Local state to manage edits (though saving is disabled)
  const [editedData, setEditedData] = useState<Record<number, Record<number, any>>>({});

  const handleInputChange = (rowIndex: number, colIndex: number, value: any) => {
    setEditedData(prev => ({
      ...prev,
      [rowIndex]: {
        ...prev[rowIndex],
        [colIndex]: value,
      }
    }));
  };

  // Placeholder for future save function
  const handleSave = (rowIndex: number) => {
      alert(`Sauvegarde désactivée. Données modifiées pour la ligne ${rowIndex + 1}: ${JSON.stringify(editedData[rowIndex])}`);
      // In future: call an action function with row identifier and editedData[rowIndex]
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-white">Installations Kezia (Feuille: {KEZIA_SHEET_NAME})</h1>

      <Link to="/dashboard" className="text-jdc-blue hover:underline">
        &larr; Retour au Tableau de Bord
      </Link>

      {error && (
        <div className="bg-red-900 bg-opacity-50 text-red-300 p-4 rounded-md">
          <p className="font-semibold">Erreur :</p>
          <p>{error}</p>
        </div>
      )}

       {warning && (
        <div className="bg-yellow-900 bg-opacity-70 text-yellow-300 p-4 rounded-md">
          <p className="font-semibold">Attention :</p>
          <p>{warning}</p>
        </div>
      )}

      {!error && rows.length > 0 && (
        <div className="overflow-x-auto bg-jdc-card rounded-lg shadow">
          <table className="min-w-full divide-y divide-jdc-gray-700">
            <thead className="bg-jdc-gray-800">
              <tr>
                {/* Add row number header */}
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-jdc-gray-300 uppercase tracking-wider sticky left-0 bg-jdc-gray-800 z-10">
                  #
                </th>
                {headers.map((header, index) => (
                  <th
                    key={index}
                    scope="col"
                    className={`px-3 py-3 text-left text-xs font-medium text-jdc-gray-300 uppercase tracking-wider ${index < 1 ? 'sticky left-10 bg-jdc-gray-800 z-10' : ''}`} // Make first data column sticky too
                  >
                    {header || `Colonne ${String.fromCharCode(65 + index)}`} {/* Display letter if header empty */}
                  </th>
                ))}
                 {/* Add Save button header if needed */}
                 {/* <th scope="col" className="relative px-3 py-3">
                   <span className="sr-only">Sauvegarder</span>
                 </th> */}
              </tr>
            </thead>
            <tbody className="bg-jdc-card divide-y divide-jdc-gray-700">
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-jdc-gray-800/50">
                   {/* Row number cell */}
                   <td className="px-3 py-2 whitespace-nowrap text-sm text-jdc-gray-400 sticky left-0 bg-inherit z-10">
                     {rowIndex + 2} {/* +2 because header is row 1, data starts row 2 */}
                   </td>
                  {row.map((cell, colIndex) => (
                    <td
                      key={colIndex}
                      className={`px-3 py-2 whitespace-nowrap text-sm ${colIndex < 1 ? 'sticky left-10 bg-inherit z-10' : ''}`} // Corrected: Use colIndex for sticky check
                    >
                      {EDITABLE_COL_INDICES.includes(colIndex) ? (
                        <input
                          type={colIndex === 14 ? "date" : "text"} // Use date type for column O (index 14)
                          value={editedData[rowIndex]?.[colIndex] ?? cell ?? ''}
                          onChange={(e) => handleInputChange(rowIndex, colIndex, e.target.value)}
                          className="bg-jdc-gray-700 text-white rounded px-2 py-1 w-full focus:ring-jdc-blue focus:border-jdc-blue"
                          // disabled={!!warning} // Disable if saving is impossible
                          placeholder={`Modifier ${headers[colIndex] || `Col ${String.fromCharCode(65 + colIndex)}`}`}
                        />
                      ) : (
                        <span className="text-jdc-gray-300">{cell}</span>
                      )}
                    </td>
                  ))}
                   {/* Save button cell - disabled */}
                   {/* <td className="px-3 py-2 whitespace-nowrap text-right text-sm font-medium">
                     <Button size="sm" onClick={() => handleSave(rowIndex)} disabled={!!warning}>
                       Save (Disabled)
                     </Button>
                   </td> */}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

       {!error && rows.length === 0 && !warning && (
         <p className="text-jdc-gray-400">Aucune donnée à afficher.</p>
       )}
    </div>
  );
}
