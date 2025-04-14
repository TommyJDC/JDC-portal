import type { LoaderFunctionArgs } from "@remix-run/node";
    import { json } from "@remix-run/node";
    import { getGeocodeFromCache, saveGeocodeToCache } from "~/services/firestore.service.server";

    // Consider moving API key to environment variables for security
    const OPENCAGE_API_KEY = "b93a76ecb4b0439dbfe9e64c3c6aff07"; // Replace with process.env.OPENCAGE_API_KEY

    // Helper to normalize address (same as in the hook)
    const normalizeAddress = (address: string): string => {
      return address.trim().toLowerCase().replace(/\s+/g, ' ');
    };

    // Type for OpenCage API response (simplified)
    interface OpenCageResult {
      geometry: { lat: number; lng: number };
    }
    interface OpenCageResponse {
      results: OpenCageResult[];
      status: { code: number; message: string };
    }

    export const loader = async ({ request }: LoaderFunctionArgs) => {
      const url = new URL(request.url);
      const address = url.searchParams.get("address");

      if (!address) {
        return json({ error: "Address parameter is required" }, { status: 400 });
      }

      if (!OPENCAGE_API_KEY) {
          console.error("API Route: OpenCage API Key is missing.");
          return json({ error: "Server configuration error" }, { status: 500 });
      }

      const normalizedAddr = normalizeAddress(address);

      try {
        // 1. Check Firestore Cache
        console.log(`API Route: Checking cache for: "${normalizedAddr}"`);
        const cachedData = await getGeocodeFromCache(normalizedAddr);
        if (cachedData) {
          console.log(`API Route: Cache hit for "${normalizedAddr}"`);
          return json({ lat: cachedData.latitude, lng: cachedData.longitude });
        }

        // 2. Cache miss - Call OpenCageData API
        console.log(`API Route: Cache miss. Calling OpenCage API for: "${address}"`);
        const apiUrl = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(address)}&key=${OPENCAGE_API_KEY}&language=fr`;
        const response = await fetch(apiUrl);

        if (!response.ok) {
            let errorMessage = `Erreur API OpenCage (${response.status})`;
             try {
                 const errorData = await response.json();
                 errorMessage = `Erreur API (${response.status}): ${errorData?.status?.message || 'Erreur inconnue'}`;
                 if (response.status === 401 || response.status === 403) errorMessage = 'Clé API invalide';
                 else if (response.status === 402) errorMessage = 'Quota API dépassé';
             } catch (e) { /* Ignore JSON parsing error */ }
             console.error(`API Route: OpenCage API error for "${address}": ${errorMessage}`);
             // Return null coordinates but indicate the error source if needed
             return json({ error: errorMessage, lat: null, lng: null }, { status: response.status > 499 ? 503 : 400 });
        }

        const data: OpenCageResponse = await response.json();

        if (data?.results?.length > 0) {
          const { lat, lng } = data.results[0].geometry;
          console.log(`API Route: Geocoded "${address}" to:`, { lat, lng });
          // 3. Store result in Firestore Cache (fire and forget)
          saveGeocodeToCache(normalizedAddr, lat, lng).catch(cacheErr => {
            console.error(`API Route: Error storing geocode cache for "${normalizedAddr}":`, cacheErr);
          });
          return json({ lat, lng });
        } else {
          console.warn(`API Route: No results found for address: "${address}"`);
          // Optionally save null to cache here if desired
          return json({ lat: null, lng: null }); // Return null coordinates for no results
        }

      } catch (error: any) {
        console.error(`API Route: Error geocoding address "${address}":`, error);
         // Check for specific Firestore errors if needed
         if (error.code === 'permission-denied') {
             return json({ error: "Permission refusée pour le cache de géocodage.", lat: null, lng: null }, { status: 500 });
         }
        return json({ error: error.message || "Erreur serveur de géocodage", lat: null, lng: null }, { status: 500 });
      }
    };
