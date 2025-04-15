import type { MetaFunction } from "@remix-run/node";
    import { useState, useMemo, useCallback, useEffect } from "react";
    import { useOutletContext, useSearchParams, useLoaderData, useFetcher } from "@remix-run/react";
    import { Timestamp } from 'firebase/firestore'; // Import Timestamp for type checking/conversion

    // Import loader and action
    import { loader } from "./envois-ctn.loader";
    import type { EnvoisCtnLoaderData } from "./envois-ctn.loader";
    import { action } from "./envois-ctn.action";

    import type { Shipment, UserProfile, AppUser } from "~/types/firestore.types";
    import { Input } from "~/components/ui/Input";
    import { Button } from "~/components/ui/Button";
    import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
    import { faTruckFast, faFilter, faSearch, faBuilding, faChevronRight, faExternalLinkAlt, faSpinner, faTrash } from "@fortawesome/free-solid-svg-icons";
    import { getShipmentStatusStyle } from "~/utils/styleUtils";
    import { useToast } from "~/context/ToastContext";

    export const meta: MetaFunction = () => {
      return [{ title: "Envois CTN | JDC Dashboard" }];
    };

    // Export loader and action
    export { loader, action };

    // Outlet context likely provides UserSession now, adjust if needed based on root
    type OutletContextType = {
      user: AppUser | null; // Keep AppUser if root provides it, or change to UserSession
    };

    // Helper to parse serialized dates (similar to dashboard)
    const parseSerializedDateOptional = (serializedDate: string | { seconds: number; nanoseconds: number; } | null | undefined): Date | undefined => {
        if (!serializedDate) return undefined;
        if (typeof serializedDate === 'string') {
            try {
                const date = new Date(serializedDate);
                if (isNaN(date.getTime())) return undefined;
                return date;
            } catch { return undefined; }
        }
        if (typeof serializedDate === 'object' && 'seconds' in serializedDate && typeof serializedDate.seconds === 'number' && 'nanoseconds' in serializedDate && typeof serializedDate.nanoseconds === 'number') {
             try { return new Timestamp(serializedDate.seconds, serializedDate.nanoseconds).toDate(); }
             catch { return undefined; }
        }
        return undefined;
    };


    const groupShipmentsByClient = (shipments: Shipment[]): Map<string, Shipment[]> => {
      const grouped = new Map<string, Shipment[]>();
       if (!Array.isArray(shipments)) {
         return grouped;
       }
      shipments.forEach(shipment => {
        // Ensure dateCreation is handled correctly if needed for grouping/sorting logic later
        const clientName = shipment.nomClient || 'Client Inconnu';
        const existing = grouped.get(clientName);
        if (existing) {
          existing.push(shipment);
        } else {
          grouped.set(clientName, [shipment]);
        }
      });
      return grouped;
    };

    // Type guard for fetcher data with error
    function hasErrorProperty(data: any): data is { success: false; error: string } {
        return data && data.success === false && typeof data.error === 'string';
    }

    // Type guard for fetcher data with message
    function hasMessageProperty(data: any): data is { success: true; message: string } {
        return data && data.success === true && typeof data.message === 'string';
    }


    export default function EnvoisCtn() {
      const { user } = useOutletContext<OutletContextType>(); // User session from context
      const { addToast } = useToast();
      // Get data from loader
      const { userProfile, allShipments: serializedShipments, error: loaderError } = useLoaderData<typeof loader>();
      const fetcher = useFetcher<typeof action>(); // Fetcher for delete action

      // State for client-side filtering and UI
      const [deletingGroup, setDeletingGroup] = useState<string | null>(null); // Client name being deleted
      const [selectedSector, setSelectedSector] = useState<string>('');
      const [searchParams] = useSearchParams(); // Keep for reading URL params
      const [searchTerm, setSearchTerm] = useState<string>(searchParams.get('client') || ''); // Initialize from URL

      // Parse shipments dates from loader data
      const allShipments: Shipment[] = useMemo(() => (serializedShipments ?? []).map(shipment => ({
           ...shipment,
           dateCreation: parseSerializedDateOptional(shipment.dateCreation),
       })), [serializedShipments]);

      // Effect to sync search term with URL params (client-side only)
      useEffect(() => {
        setSearchTerm(searchParams.get('client') || '');
      }, [searchParams]);

       // Effect to handle fetcher results (for delete action)
       useEffect(() => {
         if (fetcher.state === 'idle' && fetcher.data) {
           if (fetcher.data.success) {
             // Use type guard for success message
             const message = hasMessageProperty(fetcher.data)
               ? fetcher.data.message
               : 'Groupe supprimé avec succès.'; // Default success message
             addToast({ type: 'success', message: message });
           } else {
             // Use type guard for error message
             const errorMsg = hasErrorProperty(fetcher.data)
               ? fetcher.data.error
               : 'Erreur lors de la suppression.'; // Default error message
             addToast({ type: 'error', message: errorMsg });
           }
           setDeletingGroup(null); // Reset deleting state regardless of outcome
         }
       }, [fetcher.state, fetcher.data, addToast]);


      const filteredAndGroupedShipments = useMemo(() => {
        let filtered = allShipments; // Use parsed shipments

        // Filter by Sector
        if (selectedSector && selectedSector !== '') {
           filtered = filtered.filter(s => s.secteur === selectedSector);
        }

        // Filter by Search Term (case-insensitive)
        const lowerSearchTerm = searchTerm.trim().toLowerCase();
        if (lowerSearchTerm) {
          filtered = filtered.filter(s =>
            (s.nomClient?.toLowerCase().includes(lowerSearchTerm)) ||
            (s.codeClient?.toLowerCase().includes(lowerSearchTerm)) ||
            (s.id?.toLowerCase().includes(lowerSearchTerm)) ||
            (s.articleNom?.toLowerCase().includes(lowerSearchTerm))
          );
        }

        return groupShipmentsByClient(filtered);
      }, [allShipments, selectedSector, searchTerm]);

      const clientGroups = useMemo(() => {
          return Array.from(filteredAndGroupedShipments.entries())
                      .sort((a, b) => a[0].localeCompare(b[0]));
      }, [filteredAndGroupedShipments]);

      const availableSectors = useMemo(() => {
         // Calculate sectors from the originally loaded (serialized) data to avoid re-computation on filter
         const uniqueSectors = new Set(serializedShipments?.map(s => s.secteur).filter(Boolean));
         return Array.from(uniqueSectors).sort();
      }, [serializedShipments]);

      // --- Delete Group Handler (using fetcher) ---
      const handleDeleteGroup = useCallback((clientName: string, shipmentsToDelete: Shipment[]) => {
        if (!shipmentsToDelete || shipmentsToDelete.length === 0) return;

        const shipmentCount = shipmentsToDelete.length;
        const confirmation = window.confirm(`Êtes-vous sûr de vouloir supprimer les ${shipmentCount} envoi${shipmentCount > 1 ? 's' : ''} pour le client "${clientName}" ? Cette action est irréversible.`);

        if (confirmation) {
          setDeletingGroup(clientName); // Set UI state
          const shipmentIds = shipmentsToDelete.map(s => s.id).join(','); // Comma-separated IDs

          const formData = new FormData();
          formData.append("intent", "delete_group");
          formData.append("shipmentIds", shipmentIds);

          fetcher.submit(formData, { method: "POST" });
          // UI update will happen via loader revalidation triggered by the action
        }
      }, [fetcher]); // Depend on fetcher

      const isAdmin = userProfile?.role === 'Admin'; // Use profile from loader
      const isLoading = fetcher.state !== 'idle'; // Loading state based on fetcher

      // Show message if user is not logged in (based on context)
      if (!user) {
         return (
            <div className="text-center text-jdc-gray-400 py-10">
                Veuillez vous connecter pour voir les envois.
            </div>
         )
      }

      // Show loader error if present
       if (loaderError) {
           return <div className="text-center text-red-400 bg-red-900 bg-opacity-50 p-4 rounded-lg">{loaderError}</div>;
       }

      return (
        <div>
          <h1 className="text-2xl font-semibold text-white mb-4 flex items-center">
            <FontAwesomeIcon icon={faTruckFast} className="mr-3 text-jdc-yellow" />
            Suivi des Envois CTN
          </h1>

          {/* Filter and Search Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-jdc-card rounded-lg shadow">
            {/* Sector Filter - Disable based on fetcher state */}
            <div className="col-span-1">
              <label htmlFor="sector-filter" className="block text-sm font-medium text-jdc-gray-300 mb-1">
                <FontAwesomeIcon icon={faFilter} className="mr-1" /> Filtrer par Secteur
              </label>
              <select
                id="sector-filter"
                name="sector-filter"
                value={selectedSector}
                onChange={(e) => setSelectedSector(e.target.value)}
                className="block w-full rounded-md bg-jdc-gray-800 border-transparent focus:border-jdc-yellow focus:ring focus:ring-jdc-yellow focus:ring-opacity-50 text-white py-2 pl-3 pr-10"
                disabled={isLoading || availableSectors.length === 0} // Disable during action
              >
                <option value="">Tous les secteurs</option>
                {availableSectors.map(sector => (
                  <option key={sector} value={sector}>{sector}</option>
                ))}
              </select>
               {/* Messages adjusted based on loader data */}
               {availableSectors.length === 0 && !isLoading && allShipments.length > 0 && (
                 <p className="text-xs text-jdc-gray-500 mt-1">Aucun secteur trouvé dans les envois affichés.</p>
               )}
               {availableSectors.length === 0 && !isLoading && allShipments.length === 0 && !loaderError && (
                 <p className="text-xs text-jdc-gray-500 mt-1">Aucun envoi accessible trouvé.</p>
               )}
            </div>

            {/* Search Input - Disable based on fetcher state */}
            <div className="col-span-1 md:col-span-2">
               <Input
                 label="Rechercher (Client, ID, Article...)"
                 id="search-client"
                 name="search-client"
                 placeholder="Entrez un nom, code, ID, article..."
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 icon={<FontAwesomeIcon icon={faSearch} />}
                 wrapperClassName="mb-0"
                 disabled={isLoading} // Disable during action
               />
            </div>
          </div>

          {/* Loading State for Action */}
          {isLoading && (
            <div className="text-center text-jdc-gray-400 py-10">
              <FontAwesomeIcon icon={faSpinner} spin className="text-2xl mr-2" />
              Traitement en cours...
            </div>
          )}

          {/* No Results State */}
          {!isLoading && !loaderError && clientGroups.length === 0 && (
            <div className="text-center text-jdc-gray-400 py-10">
              {allShipments.length > 0
                ? "Aucun envoi trouvé correspondant à votre recherche ou filtre."
                : "Aucun envoi accessible trouvé."}
            </div>
          )}


          {/* Shipments List */}
          {!isLoading && !loaderError && clientGroups.length > 0 && (
            <div className="space-y-3">
              {clientGroups.map(([clientName, clientShipments]) => (
                <div key={clientName} className="bg-jdc-card rounded-lg shadow overflow-hidden">
                  <details className="group">
                    <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-jdc-gray-800 list-none transition-colors gap-4">
                      <div className="flex items-center min-w-0 mr-2 flex-grow">
                        <FontAwesomeIcon icon={faBuilding} className="mr-3 text-jdc-gray-300 text-lg flex-shrink-0" />
                        <div className="min-w-0">
                            <span className="font-semibold text-white text-lg block truncate" title={clientName}>{clientName}</span>
                            <span className="ml-0 md:ml-3 text-sm text-jdc-gray-400">
                                ({clientShipments.length} envoi{clientShipments.length > 1 ? 's' : ''})
                            </span>
                             {clientShipments[0]?.codeClient && clientShipments[0].codeClient !== clientName && (
                                <span className="block text-xs text-jdc-gray-500 truncate" title={`Code: ${clientShipments[0].codeClient}`}>Code: {clientShipments[0].codeClient}</span>
                             )}
                        </div>
                      </div>

                      <div className="flex items-center flex-shrink-0 space-x-3">
                        {isAdmin && (
                            <Button
                                variant="danger"
                                size="sm"
                                title={`Supprimer tous les envois pour ${clientName}`}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleDeleteGroup(clientName, clientShipments);
                                }}
                                isLoading={deletingGroup === clientName}
                                disabled={isLoading} // Disable if any action is in progress
                                leftIcon={<FontAwesomeIcon icon={faTrash} />}
                                className="flex-shrink-0"
                            >
                                Suppr. Groupe
                            </Button>
                        )}
                        <FontAwesomeIcon
                          icon={faChevronRight}
                          className="text-jdc-gray-400 transition-transform duration-200 group-open:rotate-90 text-xl flex-shrink-0"
                        />
                      </div>
                    </summary>

                    <div className="border-t border-jdc-gray-700 bg-jdc-gray-900 p-4 space-y-3">
                      {clientShipments.map((shipment) => {
                        const statusStyle = getShipmentStatusStyle(shipment.statutExpedition);
                        const truncatedArticle = shipment.articleNom && shipment.articleNom.length > 50
                          ? `${shipment.articleNom.substring(0, 47)}...`
                          : shipment.articleNom;

                        // Parse dateCreation for display if needed, or format directly if possible
                        // const displayDate = shipment.dateCreation ? shipment.dateCreation.toLocaleDateString('fr-FR') : 'N/A';

                        return (
                          <div key={shipment.id} className="flex items-center justify-between text-sm border-b border-jdc-gray-700 pb-2 last:border-b-0 gap-2">
                            <div className="flex-1 min-w-0 mr-1">
                              <span className="text-jdc-gray-200 block font-medium truncate" title={shipment.articleNom}>
                                {truncatedArticle || 'Article non spécifié'}
                              </span>
                              <div className="flex items-center flex-wrap mt-1 space-x-2">
                                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${statusStyle.bgColor} ${statusStyle.textColor}`}>
                                    {shipment.statutExpedition || 'Inconnu'}
                                  </span>
                                  <span className="text-jdc-gray-500 text-xs whitespace-nowrap" title={`ID: ${shipment.id}`}>
                                    ID: {shipment.id.substring(0, 8)}...
                                  </span>
                                   <span className="text-jdc-gray-500 text-xs whitespace-nowrap">
                                     Secteur: {shipment.secteur || 'N/A'}
                                   </span>
                                   {/* Optionally display parsed dateCreation */}
                                   {/* <span className="text-jdc-gray-500 text-xs whitespace-nowrap">Créé le: {displayDate}</span> */}
                              </div>
                            </div>

                            <div className="flex items-center flex-shrink-0 space-x-2">
                                {shipment.trackingLink && (
                                  <Button
                                    as="link"
                                    to={shipment.trackingLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    variant="secondary"
                                    size="sm"
                                    title="Suivre le colis"
                                    leftIcon={<FontAwesomeIcon icon={faExternalLinkAlt} />}
                                  >
                                    Suivi
                                  </Button>
                                )}
                            </div>
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
