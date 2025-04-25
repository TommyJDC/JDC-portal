import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useState } from "react";
import { Input } from "~/components/ui/Input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "~/components/ui/Select";
import type { SAPArchive } from "~/types/firestore.types"; // Utiliser SAPArchive
import { Timestamp } from 'firebase/firestore'; // Importer Timestamp depuis firebase/firestore
import { initializeFirebaseAdmin } from "~/services/firestore.service.server"; // Importer initializeFirebaseAdmin

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

// Déplacer la fonction getArchivedSapTickets ici pour qu'elle soit locale à ce fichier
async function getArchivedSapTickets(): Promise<SAPArchive[]> {
  try {
    const db = await initializeFirebaseAdmin(); // Utiliser la fonction exportée
    const snapshot = await db.collection("sap-archive").get();

    const archivedTickets: SAPArchive[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      archivedTickets.push({
        originalTicketId: data.originalTicketId,
        archivedDate: data.archivedDate instanceof Timestamp ? data.archivedDate.toDate() : data.archivedDate, // Convertir Timestamp en Date
        closureReason: data.closureReason as 'resolved' | 'no-response', // Assurer le type correct
        technicianNotes: getSafeStringValue(data.technicianNotes), // Utiliser la fonction helper
        technician: getSafeStringValue(data.technician, 'Technicien inconnu'), // Utiliser la fonction helper, ajouter une valeur par défaut
        // Extraire les valeurs des champs { stringValue: string }
        client: { stringValue: getSafeStringValue(data.client) }, // Assurer le format { stringValue: string }
        raisonSociale: { stringValue: getSafeStringValue(data.raisonSociale) }, // Assurer le format { stringValue: string }
        description: { stringValue: getSafeStringValue(data.description) }, // Assurer le format { stringValue: string }
        secteur: data.secteur as 'CHR' | 'HACCP' | 'Kezia' | 'Tabac', // Assurer le type correct
        numeroSAP: { stringValue: getSafeStringValue(data.numeroSAP) }, // Assurer le format { stringValue: string }
        mailId: getSafeStringValue(data.mailId), // Utiliser la fonction helper
        documents: Array.isArray(data.documents) ? data.documents.map((doc: any) => getSafeStringValue(doc)) : [], // Assurer que documents est un tableau de strings
      });
    });

    return archivedTickets;
  } catch (error) {
    console.error("Erreur lors de la récupération des tickets archivés :", error);
    return [];
  }
}


export async function loader({ request }: LoaderFunctionArgs) {
  const archivedTickets = await getArchivedSapTickets();
  return json({ archivedTickets });
}


export default function SapArchivePage() {
  const { archivedTickets } = useLoaderData<typeof loader>();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSector, setSelectedSector] = useState<string>("all");

  const filteredTickets = archivedTickets.filter((ticket) => {
    // Filtre par secteur
    if (selectedSector !== "all" && ticket.secteur !== selectedSector) {
      return false;
    }
    
    // Filtre par recherche
    const searchLower = searchTerm.toLowerCase();
    return (
      getSafeStringValue(ticket.client).toLowerCase().includes(searchLower) ||
      getSafeStringValue(ticket.raisonSociale).toLowerCase().includes(searchLower) ||
      getSafeStringValue(ticket.description).toLowerCase().includes(searchLower) ||
      getSafeStringValue(ticket.numeroSAP).toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Tickets SAP Archivés</h1>
      
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <Input
          placeholder="Rechercher par client, raison sociale ou description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1"
        />
        
        <Select value={selectedSector} onValueChange={setSelectedSector}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="Secteur" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les secteurs</SelectItem>
            <SelectItem value="CHR">CHR</SelectItem>
            <SelectItem value="HACCP">HACCP</SelectItem>
            <SelectItem value="Kezia">Kezia</SelectItem>
            <SelectItem value="Tabac">Tabac</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredTickets.length === 0 ? (
        <p>Aucun ticket archivé trouvé.</p>
      ) : (
        <ul className="space-y-4">
          {filteredTickets.map((ticket: SAPArchive) => { // Ajouter l'annotation de type explicite
            // Gérer l'affichage de la date archivée
            // Gérer l'affichage de la date archivée
            // Les Timestamps sont convertis en { seconds: number, nanoseconds: number } par Remix
            // Les Dates sont converties en string par Remix
            let archivedDate: Date | null = null;
            if (typeof ticket.archivedDate === 'object' && ticket.archivedDate !== null && 'seconds' in ticket.archivedDate) {
              // Gère les Timestamps désérialisés
              archivedDate = new Date(ticket.archivedDate.seconds * 1000);
            } else if (typeof ticket.archivedDate === 'string') {
              // Gère les Dates désérialisées en string
              archivedDate = new Date(ticket.archivedDate);
            }
            // Gère les autres cas (null, undefined, etc.)


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
