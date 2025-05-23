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
import type { SAPArchive } from "~/types/firestore.types";
import { Timestamp } from 'firebase/firestore';
import type { SapArchiveLoaderData } from "./sap-archive.loader";
import { loader } from "./sap-archive.loader";

export { loader };

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

export default function SapArchivePage() {
  const { archivedTickets, error } = useLoaderData<typeof loader>() as SapArchiveLoaderData;
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSector, setSelectedSector] = useState<string>("all");

  if (error) {
    return (
      <div className="p-6 rounded-lg bg-ui-surface border border-ui-border text-center text-text-secondary">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 mx-auto mb-3 text-text-tertiary">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <p className="font-medium">{error}</p>
      </div>
    );
  }

  const filteredTickets = archivedTickets.filter((ticket) => {
    if (selectedSector !== "all" && ticket.secteur !== selectedSector) {
      return false;
    }
    const searchLower = searchTerm.toLowerCase();
    return (
      getSafeStringValue(ticket.client).toLowerCase().includes(searchLower) ||
      getSafeStringValue(ticket.raisonSociale).toLowerCase().includes(searchLower) ||
      getSafeStringValue(ticket.description).toLowerCase().includes(searchLower) ||
      getSafeStringValue(ticket.numeroSAP).toLowerCase().includes(searchLower) ||
      (ticket.technician && ticket.technician.toLowerCase().includes(searchLower)) ||
      (ticket.technicianNotes && ticket.technicianNotes.toLowerCase().includes(searchLower))
    );
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-text-primary">Tickets SAP Archivés</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end p-4 bg-ui-surface/80 backdrop-blur-lg border border-ui-border/70 rounded-xl shadow-lg">
        <div className="md:col-span-2">
          <label htmlFor="archiveSearch" className="block text-xs font-medium text-text-secondary mb-1">Rechercher</label>
          <Input
            id="archiveSearch"
            placeholder="Client, raison sociale, description, N°SAP, technicien..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-ui-input border-ui-border text-text-primary focus:border-brand-blue focus:ring-brand-blue rounded-md placeholder:text-text-tertiary text-sm"
          />
        </div>
        
        <div>
          <label htmlFor="sectorSelect" className="block text-xs font-medium text-text-secondary mb-1">Secteur</label>
          <Select value={selectedSector} onValueChange={setSelectedSector}>
            <SelectTrigger id="sectorSelect" className="w-full bg-ui-input border-ui-border text-text-primary focus:border-brand-blue focus:ring-brand-blue rounded-md text-sm">
              <SelectValue placeholder="Secteur" />
            </SelectTrigger>
            <SelectContent className="bg-ui-surface border-ui-border text-text-primary">
              <SelectItem value="all" className="hover:bg-ui-hover focus:bg-ui-hover">Tous les secteurs</SelectItem>
              <SelectItem value="CHR" className="hover:bg-ui-hover focus:bg-ui-hover">CHR</SelectItem>
              <SelectItem value="HACCP" className="hover:bg-ui-hover focus:bg-ui-hover">HACCP</SelectItem>
              <SelectItem value="Kezia" className="hover:bg-ui-hover focus:bg-ui-hover">Kezia</SelectItem>
              <SelectItem value="Tabac" className="hover:bg-ui-hover focus:bg-ui-hover">Tabac</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredTickets.length === 0 ? (
        <div className="p-6 rounded-lg bg-ui-surface border border-ui-border text-center text-text-secondary">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 mx-auto mb-3 text-text-tertiary">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125V6.375c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v.001c0 .621.504 1.125 1.125 1.125z" />
          </svg>
          <p className="font-medium">Aucun ticket archivé trouvé pour ces critères.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTickets.map((ticket) => {
            let displayDate: Date | null = null;
            if (typeof ticket.archivedDate === 'string') {
              displayDate = new Date(ticket.archivedDate);
            } else if (typeof ticket.archivedDate === 'number') {
              displayDate = new Date(ticket.archivedDate);
            } else if (ticket.archivedDate && 'seconds' in ticket.archivedDate && 'nanoseconds' in ticket.archivedDate) {
              displayDate = new Timestamp((ticket.archivedDate as any).seconds, (ticket.archivedDate as any).nanoseconds).toDate();
            }

            return (
              <div key={ticket.originalTicketId} className="bg-ui-surface hover:bg-ui-surface-hover rounded-lg shadow-md p-4 border border-ui-border/70 transition-all">
                <h2 className="text-base font-semibold text-text-primary mb-1">{getSafeStringValue(ticket.raisonSociale, getSafeStringValue(ticket.client, 'Client inconnu'))}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-xs">
                  <p><strong className="text-text-secondary">Secteur:</strong> <span className="text-text-primary">{ticket.secteur}</span></p>
                  <p><strong className="text-text-secondary">N° SAP:</strong> <span className="text-text-primary">{getSafeStringValue(ticket.numeroSAP, 'N/A')}</span></p>
                  <p><strong className="text-text-secondary">Archivé le:</strong> <span className="text-text-primary">{displayDate ? displayDate.toLocaleDateString() : 'Date inconnue'}</span></p>
                  <p className="sm:col-span-2 md:col-span-3"><strong className="text-text-secondary">Description:</strong> <span className="text-text-primary">{getSafeStringValue(ticket.description, 'N/A')}</span></p>
                  <p><strong className="text-text-secondary">Clôture:</strong> <span className="text-text-primary">{ticket.closureReason || 'Non spécifié'}</span></p>
                  <p className="sm:col-span-2"><strong className="text-text-secondary">Technicien:</strong> <span className="text-text-primary">{ticket.technician}</span></p>
                  <p className="sm:col-span-3"><strong className="text-text-secondary">Notes Tech:</strong> <span className="text-text-primary whitespace-pre-wrap">{ticket.technicianNotes || 'Aucune'}</span></p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
