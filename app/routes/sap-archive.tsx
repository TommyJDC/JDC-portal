import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { getArchivedSapTickets } from "./sap-archive.loader"; // Utilisation d'un chemin relatif
import type { SAPArchive } from "~/types/firestore.types"; // Utiliser SAPArchive
import { Timestamp } from 'firebase/firestore'; // Importer Timestamp depuis firebase/firestore

// Helper function to safely extract string values from { stringValue: string } or simple strings
function getSafeStringValue(prop: { stringValue: string } | string | undefined | null, defaultValue: string = ''): string {
  if (prop === undefined || prop === null) {
    return defaultValue;
  }
  if (typeof prop === 'string') {
    return prop;
  }
  if (typeof prop === 'object' && prop !== null && 'stringValue' in prop && typeof prop.stringValue === 'string') {
    return prop.stringValue;
  }
  return defaultValue;
}


export async function loader({ request }: LoaderFunctionArgs) {
  const archivedTickets = await getArchivedSapTickets();
  return json({ archivedTickets });
}


export default function SapArchivePage() {
  // Laisser TypeScript inférer le type des données du loader
  const { archivedTickets } = useLoaderData<typeof loader>();

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Tickets SAP Archivés</h1>
      {archivedTickets.length === 0 ? (
        <p>Aucun ticket archivé trouvé.</p>
      ) : (
        <ul className="space-y-4">
          {archivedTickets.map((ticket) => { // Retirer l'annotation de type explicite
            // Gérer l'affichage de la date archivée
            // Les Timestamps sont convertis en { seconds: number, nanoseconds: number } par Remix
            // Les Dates sont converties en string par Remix
            const archivedDate = typeof ticket.archivedDate === 'object' && ticket.archivedDate !== null && 'seconds' in ticket.archivedDate
              ? new Date(ticket.archivedDate.seconds * 1000) // Gère les Timestamps désérialisés
              : typeof ticket.archivedDate === 'string'
              ? new Date(ticket.archivedDate) // Gère les Dates désérialisées en string
              : null; // Gère les autres cas (null, undefined, etc.)


            return (
              <li key={ticket.originalTicketId} className="border p-4 rounded shadow">
                <h2 className="text-xl font-semibold">{getSafeStringValue(ticket.raisonSociale, getSafeStringValue(ticket.client, 'Client inconnu'))}</h2> {/* Afficher le client/raison sociale */}
                <p><strong>Secteur :</strong> {ticket.secteur}</p> {/* Afficher le secteur */}
                <p><strong>Numéro SAP :</strong> {getSafeStringValue(ticket.numeroSAP, 'N/A')}</p> {/* Afficher le numéro SAP */}
                <p><strong>Description :</strong> {getSafeStringValue(ticket.description, 'N/A')}</p> {/* Afficher la description */}
                <p><strong>Date Archivage :</strong> {archivedDate ? archivedDate.toLocaleString() : 'Date inconnue'}</p> {/* Afficher la date archivée */}
                <p><strong>Raison Clôture :</strong> {ticket.closureReason || 'Non spécifié'}</p> {/* Afficher la raison de clôture */}
                <p><strong>Notes Technicien :</strong> {ticket.technicianNotes || 'Aucune'}</p> {/* Afficher les notes technicien */}
                {/* Ajoutez d'autres champs pertinents de SAPArchive ici */}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
