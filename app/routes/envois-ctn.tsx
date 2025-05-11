import type { MetaFunction } from "@remix-run/node";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useOutletContext, useSearchParams, useLoaderData, useFetcher } from "@remix-run/react";
import { Timestamp } from 'firebase/firestore';

import { loader } from "./envois-ctn.loader";
// type EnvoisCtnLoaderData n'est pas utilisé directement ici, mais gardé pour référence si le loader change
// import type { EnvoisCtnLoaderData } from "./envois-ctn.loader"; 
import { action } from "./envois-ctn.action";

import type { Shipment, UserProfile } from "~/types/firestore.types";
import type { UserSessionData } from "~/services/session.server";
import { Input } from "~/components/ui/Input";
import { Button } from "~/components/ui/Button";
import { FaShippingFast, FaFilter, FaSearch, FaBuilding, FaChevronRight, FaExternalLinkAlt, FaSpinner, FaTrash, FaExclamationTriangle } from 'react-icons/fa';
import { getShipmentStatusStyle } from "~/utils/styleUtils"; // Assurez-vous que cette fonction gère bien les nouveaux statuts
import { useToast } from "~/context/ToastContext";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "~/components/ui/Select";

export const meta: MetaFunction = () => {
  return [{ title: "Envois CTN | JDC Dashboard" }];
};

export { loader, action };

type OutletContextType = {
  user: UserSessionData | null;
};

const parseSerializedDateOptional = (serializedDate: string | { seconds: number; nanoseconds: number; } | null | undefined): Date | undefined => {
    if (!serializedDate) return undefined;
    if (typeof serializedDate === 'string') {
        try { const date = new Date(serializedDate); if (isNaN(date.getTime())) return undefined; return date; } catch { return undefined; }
    }
    if (typeof serializedDate === 'object' && 'seconds' in serializedDate && typeof serializedDate.seconds === 'number' && 'nanoseconds' in serializedDate && typeof serializedDate.nanoseconds === 'number') {
         try { return new Timestamp(serializedDate.seconds, serializedDate.nanoseconds).toDate(); } catch { return undefined; }
    }
    return undefined;
};

const groupShipmentsByClient = (shipments: Shipment[]): Map<string, Shipment[]> => {
  const grouped = new Map<string, Shipment[]>();
   if (!Array.isArray(shipments)) return grouped;
  shipments.forEach(shipment => {
    const clientName = shipment.nomClient || shipment.client || 'Client Inconnu'; // Prioriser nomClient
    const existing = grouped.get(clientName);
    if (existing) { existing.push(shipment); } else { grouped.set(clientName, [shipment]); }
  });
  return grouped;
};

function hasErrorProperty(data: any): data is { success: false; error: string } {
    return data && data.success === false && typeof data.error === 'string';
}
function hasMessageProperty(data: any): data is { success: true; message: string } {
    return data && data.success === true && typeof data.message === 'string';
}

const ALL_SECTORS_VALUE = "__ALL_SECTORS__"; // Constante pour la valeur "Tous les secteurs"

export default function EnvoisCtn() {
  const { user } = useOutletContext<OutletContextType>();
  const { addToast } = useToast();
  const { userProfile, allShipments: serializedShipments, error: loaderError } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();

  const [deletingGroup, setDeletingGroup] = useState<string | null>(null);
  const [selectedSector, setSelectedSector] = useState<string>(ALL_SECTORS_VALUE); // Initialiser avec la valeur pour "Tous"
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState<string>(searchParams.get('client') || '');

  const allShipments: Shipment[] = useMemo(() => (serializedShipments ?? []).map(shipment => ({
       ...shipment,
       date: parseSerializedDateOptional(shipment.date as any), // Parser le champ 'date'
       createdAt: parseSerializedDateOptional(shipment.createdAt as any), 
       dateLivraison: parseSerializedDateOptional(shipment.dateLivraison as any),
       updatedAt: parseSerializedDateOptional(shipment.updatedAt as any),
   })), [serializedShipments]);

  useEffect(() => { setSearchTerm(searchParams.get('client') || ''); }, [searchParams]);

   useEffect(() => {
     if (fetcher.state === 'idle' && fetcher.data) {
       if (fetcher.data.success) {
         const message = hasMessageProperty(fetcher.data) ? fetcher.data.message : 'Groupe supprimé.';
         addToast({ type: 'success', message: message });
       } else {
         const errorMsg = hasErrorProperty(fetcher.data) ? fetcher.data.error : 'Erreur suppression.';
         addToast({ type: 'error', message: errorMsg });
       }
       setDeletingGroup(null);
     }
   }, [fetcher.state, fetcher.data, addToast]);

  const filteredAndGroupedShipments = useMemo(() => {
    let filtered = allShipments;
    if (selectedSector !== ALL_SECTORS_VALUE) { 
       filtered = filtered.filter(s => s.secteur === selectedSector);
    }
    const lowerSearchTerm = searchTerm.trim().toLowerCase();
    if (lowerSearchTerm) {
      filtered = filtered.filter(s =>
        (s.nomClient?.toLowerCase().includes(lowerSearchTerm)) || // Utiliser nomClient
        (s.client?.toLowerCase().includes(lowerSearchTerm)) || 
        (s.codeClient?.toLowerCase().includes(lowerSearchTerm)) ||
        (s.id?.toLowerCase().includes(lowerSearchTerm)) ||
        (s.articleNom?.toLowerCase().includes(lowerSearchTerm)) || // Utiliser articleNom
        (s.produits?.[0]?.toLowerCase().includes(lowerSearchTerm)) 
      );
    }
    return groupShipmentsByClient(filtered);
  }, [allShipments, selectedSector, searchTerm]);

  const clientGroups = useMemo(() => {
      return Array.from(filteredAndGroupedShipments.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredAndGroupedShipments]);

  const availableSectors = useMemo(() => {
     const uniqueSectors = new Set(serializedShipments?.map(s => s.secteur).filter(Boolean));
     return Array.from(uniqueSectors).sort();
  }, [serializedShipments]);

  const handleDeleteGroup = useCallback((clientName: string, shipmentsToDelete: Shipment[]) => {
    if (!shipmentsToDelete || shipmentsToDelete.length === 0) return;
    const shipmentCount = shipmentsToDelete.length;
    const confirmation = window.confirm(`Supprimer les ${shipmentCount} envoi${shipmentCount > 1 ? 's' : ''} pour "${clientName}" ?`);
    if (confirmation) {
      setDeletingGroup(clientName);
      const shipmentIds = shipmentsToDelete.map(s => s.id).filter(Boolean).join(','); // S'assurer que les IDs existent
      if (!shipmentIds) {
        addToast({type: 'error', message: 'Aucun ID d\'envoi valide à supprimer.'});
        setDeletingGroup(null);
        return;
      }
      const formData = new FormData();
      formData.append("intent", "delete_group");
      formData.append("shipmentIds", shipmentIds);
      fetcher.submit(formData, { method: "POST" });
    }
  }, [fetcher, addToast]);

  const isAdmin = userProfile?.role === 'Admin';
  const isLoading = fetcher.state !== 'idle';

  if (!user) {
     return ( <div className="flex flex-col items-center justify-center h-[calc(100vh-150px)] text-text-secondary"><FaShippingFast className="text-4xl mb-4 text-brand-blue" /><p>Veuillez vous connecter pour voir les envois.</p></div> )
  }

   if (loaderError) {
       return <div className="p-4 rounded-md bg-red-500/10 border border-red-500/30 text-red-300 text-center"><FaExclamationTriangle className="inline mr-2" />{loaderError}</div>;
   }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-text-primary flex items-center">
        <FaShippingFast className="mr-3 text-brand-blue h-6 w-6" />
        Suivi des Envois CTN
        {isLoading && clientGroups.length > 0 && <FaSpinner className="ml-3 text-brand-blue animate-spin" title="Rafraîchissement..." />}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end p-4 bg-ui-surface/80 backdrop-blur-lg border border-ui-border/70 rounded-xl shadow-lg">
        <div className="md:col-span-2">
          <label htmlFor="ctn-search" className="block text-xs font-medium text-text-secondary mb-1">
            <FaSearch className="inline mr-1.5 h-3.5 w-3.5" /> Rechercher
          </label>
          <Input
            id="ctn-search"
            placeholder="Client, ID, produit..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={isLoading}
            className="w-full bg-ui-input border-ui-border text-text-primary focus:border-brand-blue focus:ring-brand-blue rounded-md placeholder:text-text-tertiary text-sm"
          />
        </div>
        <div>
          <label htmlFor="ctn-sector-filter" className="block text-xs font-medium text-text-secondary mb-1">
            <FaFilter className="inline mr-1.5 h-3.5 w-3.5" /> Secteur
          </label>
          <Select 
            value={selectedSector} 
            onValueChange={setSelectedSector} 
            disabled={isLoading || availableSectors.length === 0}
          >
            <SelectTrigger id="ctn-sector-filter" className="w-full bg-ui-input border-ui-border text-text-primary focus:border-brand-blue focus:ring-brand-blue rounded-md text-sm">
              <SelectValue placeholder="Tous les secteurs" />
            </SelectTrigger>
            <SelectContent className="bg-ui-surface border-ui-border text-text-primary">
              <SelectItem value={ALL_SECTORS_VALUE} className="hover:bg-ui-hover focus:bg-ui-hover">Tous les secteurs</SelectItem>
              {availableSectors.map(sector => (
                <SelectItem key={sector} value={sector} className="hover:bg-ui-hover focus:bg-ui-hover">{sector}</SelectItem>
              ))}
            </SelectContent>
          </Select>
           {availableSectors.length === 0 && !isLoading && allShipments.length > 0 && (
             <p className="text-xs text-text-tertiary mt-1">Aucun secteur dans les envois affichés.</p>
           )}
           {availableSectors.length === 0 && !isLoading && allShipments.length === 0 && !loaderError && (
             <p className="text-xs text-text-tertiary mt-1">Aucun envoi trouvé.</p>
           )}
        </div>
      </div>

      {isLoading && clientGroups.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-text-secondary"><FaSpinner className="text-2xl animate-spin mb-2" />Chargement...</div>
      )}

      {!isLoading && !loaderError && clientGroups.length === 0 && (
        <div className="p-6 rounded-lg bg-ui-surface border border-ui-border text-center text-text-secondary">
          <FaShippingFast className="mx-auto text-4xl mb-3 opacity-40" />
          <p className="font-medium">
            {allShipments.length > 0 ? "Aucun envoi trouvé pour ces critères." : "Aucun envoi accessible."}
          </p>
        </div>
      )}

      {!isLoading && !loaderError && clientGroups.length > 0 && (
        <div className="space-y-4">
          {clientGroups.map(([clientName, clientShipments]) => (
            <div key={clientName} className="bg-ui-surface rounded-lg shadow-md border border-ui-border/70 overflow-hidden">
              <details className="group" open={clientGroups.length === 1 || searchTerm.length > 0}>
                <summary className="flex items-center justify-between p-3 sm:p-4 cursor-pointer hover:bg-ui-surface-hover list-none transition-colors gap-3">
                  <div className="flex items-center min-w-0 mr-2 flex-grow">
                    <FaBuilding className="mr-2.5 text-brand-blue text-lg flex-shrink-0" />
                    <div className="min-w-0">
                        <span className="font-semibold text-text-primary text-base block truncate" title={clientName}>{clientName}</span>
                        <span className="ml-0 md:ml-0.5 text-xs text-text-secondary">
                            ({clientShipments.length} envoi{clientShipments.length > 1 ? 's' : ''})
                        </span>
                         {clientShipments[0]?.codeClient && clientShipments[0].codeClient !== clientName && (
                            <span className="block text-xs text-text-tertiary truncate" title={`Code: ${clientShipments[0].codeClient}`}>Code: {clientShipments[0].codeClient}</span>
                         )}
                    </div>
                  </div>
                  <div className="flex items-center flex-shrink-0 space-x-2">
                    {isAdmin && (
                        <Button
                            as="button"
                            variant="danger"
                            size="icon"
                            title={`Supprimer envois pour ${clientName}`}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteGroup(clientName, clientShipments); }}
                            isLoading={deletingGroup === clientName}
                            disabled={isLoading}
                            className="h-7 w-7 p-1"
                        >
                           <FaTrash className="h-3.5 w-3.5" />
                        </Button>
                    )}
                    <FaChevronRight className="text-text-secondary transition-transform duration-200 group-open:rotate-90 text-lg flex-shrink-0" />
                  </div>
                </summary>
                <div className="border-t border-ui-border bg-ui-background p-3 sm:p-4 space-y-3">
                  {clientShipments.map((shipment) => {
                    const statusStyle = getShipmentStatusStyle(shipment.statutExpedition || shipment.statut || 'Inconnu'); // Prioriser statutExpedition
                    const articleDisplay = shipment.articleNom || shipment.produits?.[0] || 'Article non spécifié';
                    const truncatedArticle = articleDisplay.length > 40 ? `${articleDisplay.substring(0, 37)}...` : articleDisplay;
                    
                    // Utiliser directement borderColor de statusStyle car il est maintenant inclus
                    const itemBorderColor = statusStyle.borderColor.replace('border-', 'var(--color-') + ')'; // Convertit la classe en variable CSS

                    return (
                      <div key={shipment.id} className={`bg-ui-background-hover rounded-md shadow-sm p-3 border-l-4 ${statusStyle.borderColor.replace('border-', 'border-')}`} > {/* Appliquer la classe de bordure */}
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-text-primary font-medium text-sm truncate" title={articleDisplay}>
                            {truncatedArticle}
                          </span>
                          <span className={`ml-2 inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${statusStyle.bgColor} ${statusStyle.textColor} ${statusStyle.borderColor}`}>
                            {shipment.statutExpedition || shipment.statut || 'Inconnu'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-0.5 text-xs text-text-secondary">
                          <p title={`ID: ${shipment.id}`}>ID: <span className="text-text-tertiary">{shipment.id ? shipment.id.substring(0, 8) + '...' : 'N/A'}</span></p>
                          <p>Secteur: <span className="text-text-primary">{shipment.secteur || 'N/A'}</span></p>
                          {(shipment.date || shipment.createdAt) && <p>Date: <span className="text-text-primary">{new Date(shipment.date || shipment.createdAt!).toLocaleDateString()}</span></p>}
                          {shipment.numeroCTN && <p>N° CTN: <span className="text-text-primary">{shipment.numeroCTN}</span></p>}
                        </div>
                        {shipment.trackingLink && (
                          <div className="mt-2">
                            <a 
                              href={shipment.trackingLink} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="inline-flex items-center text-xs text-brand-blue-light hover:underline p-0 h-auto"
                            >
                              <FaExternalLinkAlt className="mr-1 h-3 w-3" /> Suivre le colis
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
