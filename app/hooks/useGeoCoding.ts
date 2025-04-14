import { useState, useEffect, useCallback, useRef } from 'react';
    // Removed server imports

    // Type for individual geocode result
    type Coordinates = { lat: number; lng: number } | null;

    // Return type of the hook
    interface UseGeoCodingResult {
      coordinates: Map<string, Coordinates>; // Map from normalized address to Coordinates
      isLoading: boolean;
      error: string | null;
    }

    // Normalize address
    const normalizeAddress = (address: string): string => {
      return address.trim().toLowerCase().replace(/\s+/g, ' ');
    };

    const useGeoCoding = (addresses: string[]): UseGeoCodingResult => {
      const [coordinatesMap, setCoordinatesMap] = useState<Map<string, Coordinates>>(new Map());
      const [isLoading, setIsLoading] = useState<boolean>(false);
      const [error, setError] = useState<string | null>(null);
      const processingRef = useRef<Set<string>>(new Set()); // Keep track of addresses currently being fetched

      // Use a stable key based on sorted, normalized addresses for the useEffect dependency
      const normalizedAddressesKey = JSON.stringify(addresses.map(normalizeAddress).sort());

      useEffect(() => {
        const abortController = new AbortController();
        const signal = abortController.signal;

        const geocodeBatch = async () => {
          if (!addresses || addresses.length === 0) {
            setCoordinatesMap(new Map());
            setIsLoading(false);
            setError(null);
            processingRef.current.clear();
            return;
          }

          const addressesToFetch: string[] = []; // Addresses needing geocoding in this batch
          const currentProcessing = new Set<string>(); // Normalized addresses being processed in *this* effect run

          // Identify addresses that need fetching (not already fetched and not currently being processed)
          addresses.forEach(addr => {
            if (!addr) return;
            const normalizedAddr = normalizeAddress(addr);
            if (!coordinatesMap.has(normalizedAddr) && !processingRef.current.has(normalizedAddr)) {
              addressesToFetch.push(addr); // Use original address for API call
              processingRef.current.add(normalizedAddr); // Mark as globally processing
              currentProcessing.add(normalizedAddr); // Mark as processing in this run
            }
          });

          // If no new addresses need fetching, just clean up the processing ref and exit
          if (addressesToFetch.length === 0) {
            setIsLoading(false); // Ensure loading is false if nothing to fetch
            const currentNormalizedAddressesSet = new Set(addresses.map(normalizeAddress));
            processingRef.current.forEach(addr => {
                if (!currentNormalizedAddressesSet.has(addr)) {
                    processingRef.current.delete(addr); // Remove addresses no longer in the input list
                }
            });
            return;
          }

          console.log(`[useGeoCoding] Batch geocoding ${addressesToFetch.length} new addresses.`);
          setIsLoading(true);
          setError(null); // Clear previous errors for this batch

          const promises = addressesToFetch.map(async (addr): Promise<[string, Coordinates]> => {
            const normalizedAddr = normalizeAddress(addr);
            try {
              // Call the Remix API route instead of direct server functions or external APIs
              if (signal.aborted) throw new Error('Request aborted');
              console.log(`[useGeoCoding] Calling API route for: "${addr}"`);
              const apiUrl = `/api/geocode?address=${encodeURIComponent(addr)}`;
              const response = await fetch(apiUrl, { signal });

              if (signal.aborted) throw new Error('Request aborted');

              // Check if the response status indicates an error
              if (!response.ok) {
                 let apiErrorMsg = `Erreur API Géocodage (${response.status})`;
                 try {
                     // Try to parse a more specific error message from the API response
                     const errorData = await response.json();
                     apiErrorMsg = errorData?.error || apiErrorMsg;
                 } catch (e) { /* Ignore JSON parsing error if body isn't JSON */ }
                 console.error(`[useGeoCoding] API route error for "${addr}": ${apiErrorMsg}`);
                 throw new Error(apiErrorMsg); // Throw the error to be caught below
              }

              // Expecting { lat: number | null, lng: number | null, error?: string }
              const data = await response.json();

              // Handle errors reported within the API response JSON
              if (data.error) {
                  console.error(`[useGeoCoding] API route reported error for "${addr}": ${data.error}`);
                  setError(prev => prev ? `${prev} | ${data.error}` : data.error); // Append to existing errors
                  return [normalizedAddr, null]; // Return null coordinates on API-reported error
              }

              // Handle successful geocoding (lat/lng might still be null if OpenCage found nothing)
              if (data.lat !== null && data.lng !== null) {
                console.log(`[useGeoCoding] Geocoded "${addr}" via API to:`, { lat: data.lat, lng: data.lng });
                return [normalizedAddr, { lat: data.lat, lng: data.lng }];
              } else {
                console.warn(`[useGeoCoding] API route returned null coordinates for address: "${addr}"`);
                return [normalizedAddr, null]; // API route indicated no results
              }

            } catch (err: any) {
              // Handle fetch errors (network, abort, thrown errors from !response.ok)
              if (err.name === 'AbortError' || (err.message && err.message.includes('aborted'))) {
                 console.log(`[useGeoCoding] Geocode request aborted for "${addr}"`);
              } else {
                 console.error(`[useGeoCoding] Fetch error for address "${addr}":`, err);
                 const errorMessage = err instanceof Error ? err.message : 'Erreur réseau ou inconnue lors du géocodage.';
                 setError(prev => prev ? `${prev} | ${errorMessage}` : errorMessage); // Append to existing errors
              }
              return [normalizedAddr, null]; // Return null coordinates on error/abort
            }
          });

          // Process results after all promises settle
          const results = await Promise.allSettled(promises);

          if (!signal.aborted) {
            setCoordinatesMap(prevMap => {
              const newMap = new Map(prevMap);
              results.forEach(result => {
                // Update map only on fulfilled promises with valid data
                if (result.status === 'fulfilled' && result.value) {
                  const [normalizedAddr, coords] = result.value;
                   // Set coordinates even if null (to indicate it was processed)
                  newMap.set(normalizedAddr, coords);
                   // Remove from processing ref *after* successful processing
                   processingRef.current.delete(normalizedAddr);
                } else if (result.status === 'rejected') {
                  console.error("[useGeoCoding] Geocoding promise rejected:", result.reason);
                  // How to get the address back from a rejected promise?
                  // Need to handle this carefully or ensure errors are caught within the map function.
                  // For now, we rely on the error state being set within the map function.
                  // We also need to remove the address from processingRef if the promise failed.
                  // This requires associating the error back to the address, which is tricky here.
                  // A safer approach might be to clear processingRef only for fulfilled promises.
                }
              });

              // Clean up processingRef for addresses no longer in the input list
               const currentNormalizedAddressesSet = new Set(addresses.map(normalizeAddress));
               processingRef.current.forEach(addr => {
                   if (!currentNormalizedAddressesSet.has(addr)) {
                       processingRef.current.delete(addr);
                   }
               });

              return newMap;
            });
            setIsLoading(false); // Set loading false after processing results
          } else {
             console.log("[useGeoCoding] Effect aborted, skipping state update.");
             // If aborted, clear the addresses that were being processed in this specific run
             currentProcessing.forEach(addr => processingRef.current.delete(addr));
          }
        };

        geocodeBatch();

        // Cleanup function
        return () => {
          console.log("[useGeoCoding] Cleanup effect: Aborting pending requests.");
          abortController.abort();
          // Clear processing flags for addresses that were being handled by this effect run
          // This prevents addresses from getting stuck in processingRef if the component unmounts
          // currentProcessing.forEach(addr => processingRef.current.delete(addr)); // Already handled in abort check? Double check logic.
        };
      }, [normalizedAddressesKey]); // Depend on the stable key

      return { coordinates: coordinatesMap, isLoading: isLoading, error: error };
    };

    export default useGeoCoding;
