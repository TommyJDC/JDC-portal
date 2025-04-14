import React, { useState, useMemo, useEffect, useCallback } from 'react';
// Import MarkerEvent and ViewStateChangeEvent for v7/v8 compatibility if needed
import Map, { Marker, Popup, Source, Layer, MapRef, MarkerEvent, ViewStateChangeEvent } from 'react-map-gl';
import mapboxgl from 'mapbox-gl'; // Import mapboxgl types/namespace
import type { Feature, FeatureCollection, Point } from 'geojson';
import useGeoCoding from '~/hooks/useGeoCoding';
import { kmlZones } from '~/utils/kmlZones';
import type { SapTicket } from '~/types/firestore.types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faExclamationTriangle, faMapMarkedAlt } from '@fortawesome/free-solid-svg-icons';

// Mapbox Access Token (Ensure this is securely managed, e.g., via environment variables)
const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1Ijoic2ltcGVyZnk0MDQiLCJhIjoiY201ZnFuNG5wMDBoejJpczZkNXMxNTBveCJ9.BM3MvMHuUkhQj91tQTChoQ';

// Interface for props
interface InteractiveMapProps {
  tickets: SapTicket[];
  isLoadingTickets: boolean;
}

// Zone colors mapping (adjust structure for Mapbox layer paint properties)
const zoneColorMap: { [key: string]: { color: string; opacity: number } } = {
  'Baptiste': { color: '#FFEA00', opacity: 0.3 }, // Yellow
  'julien Isère': { color: '#000000', opacity: 0.3 }, // Black
  'Julien': { color: '#097138', opacity: 0.3 }, // Green
  'Florian': { color: '#E65100', opacity: 0.3 }, // Orange
  'Matthieu': { color: '#9C27B0', opacity: 0.3 }, // Purple
  'Guillem': { color: '#9FA8DA', opacity: 0.3 }, // Light Purple/Blue
};
const defaultZoneColor = '#3388ff';
const defaultZoneOpacity = 0.3;

// Helper to create Mapbox paint properties for zones based on name
const zoneFillPaint: mapboxgl.FillPaint = {
  'fill-color': [
    'match',
    ['get', 'name'], // Get the 'name' property from the feature
    'Baptiste', zoneColorMap['Baptiste'].color,
    'julien Isère', zoneColorMap['julien Isère'].color,
    'Julien', zoneColorMap['Julien'].color,
    'Florian', zoneColorMap['Florian'].color,
    'Matthieu', zoneColorMap['Matthieu'].color,
    'Guillem', zoneColorMap['Guillem'].color,
    defaultZoneColor // Default color
  ],
  'fill-opacity': [
    'case',
    ['boolean', ['feature-state', 'hover'], false], // Check hover state
    0.5, // Opacity when hovered
    [ // Opacity based on name when not hovered
        'match',
        ['get', 'name'],
        'Baptiste', zoneColorMap['Baptiste'].opacity,
        'julien Isère', zoneColorMap['julien Isère'].opacity,
        'Julien', zoneColorMap['Julien'].opacity,
        'Florian', zoneColorMap['Florian'].opacity,
        'Matthieu', zoneColorMap['Matthieu'].opacity,
        'Guillem', zoneColorMap['Guillem'].opacity,
        defaultZoneOpacity // Default opacity
    ]
  ]
};

const zoneLinePaint: mapboxgl.LinePaint = {
    'line-color': [
        'match',
        ['get', 'name'],
        'Baptiste', zoneColorMap['Baptiste'].color,
        'julien Isère', zoneColorMap['julien Isère'].color,
        'Julien', zoneColorMap['Julien'].color,
        'Florian', zoneColorMap['Florian'].color,
        'Matthieu', zoneColorMap['Matthieu'].color,
        'Guillem', zoneColorMap['Guillem'].color,
        defaultZoneColor
    ],
    'line-width': [
        'case',
        ['boolean', ['feature-state', 'hover'], false],
        4, // Line width when hovered
        2  // Default line width
    ],
    'line-opacity': 0.8
};


// Marker color based on ticket status
const getMarkerColor = (status?: string): string => {
    if (!status) return '#808080'; // Grey as default
    const statusLower = status.toLowerCase();
    if (statusLower.includes('en cours')) return '#FFA500'; // Orange
    if (statusLower.includes('fermé')) return '#4CAF50'; // Green
    if (statusLower.includes('annulé')) return '#F44336'; // Red
    if (statusLower.includes('demande de rma')) return '#9C27B0'; // Purple
    if (statusLower.includes('nouveau')) return '#2196F3'; // Blue
    if (statusLower.includes('ouvert')) return '#FFEB3B'; // Yellow
    return '#808080'; // Default Grey
};

// Normalize address function (remains the same)
const normalizeAddress = (address: string): string => {
    return address.trim().toLowerCase().replace(/\s+/g, ' ');
};

// --- Component ---
const InteractiveMap: React.FC<InteractiveMapProps> = ({ tickets, isLoadingTickets }) => {
  // v7 typically uses individual state pieces or a single viewport object
  const [viewport, setViewport] = useState({
    longitude: 2.2137,
    latitude: 46.2276,
    zoom: 5.5,
    // pitch, bearing, padding might be handled differently or directly on Map component in v7
  });
  const [mapError, setMapError] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<SapTicket | null>(null);
  const [hoveredZoneId, setHoveredZoneId] = useState<string | number | null>(null);
  const mapRef = React.useRef<MapRef>(null);

  // --- Geocoding Logic ---
  const uniqueAddresses = useMemo(() => {
    console.log("[InteractiveMap] Recalculating unique addresses...");
    if (!Array.isArray(tickets)) return [];
    const addresses = tickets
      .map(ticket => ticket.adresse)
      .filter((addr): addr is string => typeof addr === 'string' && addr.trim() !== '');
    const uniqueSet = new Set(addresses);
    console.log(`[InteractiveMap] Found ${uniqueSet.size} unique addresses.`);
    return Array.from(uniqueSet);
  }, [tickets]);

  const { coordinates: geocodedCoordinates, isLoading: isGeocoding, error: geocodingError } = useGeoCoding(uniqueAddresses);
  // --- End Geocoding ---

  // --- Prepare Zones GeoJSON ---
  const zonesGeoJson: FeatureCollection = useMemo(() => {
    console.log("[InteractiveMap] Preparing zones GeoJSON...");
    const features = kmlZones.map((zone, index) => ({
        ...zone.feature,
        id: index // Assign a unique ID for hover state management
    }));
    return {
      type: 'FeatureCollection',
      features: features as Feature[], // Assert type after adding id
    };
  }, []);
  // --- End Zones GeoJSON ---

  // --- Map Event Handlers (Adjusted for v7/v8 compatibility) ---
  // Use onMove which is generally available, update viewport state
   const handleMove = useCallback((evt: ViewStateChangeEvent) => {
    // evt.viewState contains longitude, latitude, zoom etc.
    setViewport(evt.viewState);
  }, []);


  const handleMapLoad = useCallback(() => {
    console.log("[InteractiveMap] Map loaded.");
    // Fit bounds to zones once map and zones data are ready
    if (mapRef.current && zonesGeoJson.features.length > 0) {
        // Calculate bounds from GeoJSON (requires a helper or library like @turf/bbox)
        // For simplicity, we'll keep the initial view for now.
        // A more robust solution would calculate the bounding box of zonesGeoJson.
        console.log("[InteractiveMap] Map loaded, zones ready (bounds fitting skipped for simplicity).");
    }
  }, [zonesGeoJson]); // Re-run if zonesGeoJson changes (shouldn't often)

  const handleMouseEnterZone = useCallback((e: mapboxgl.MapLayerMouseEvent) => {
    if (e.features && e.features.length > 0) {
        const feature = e.features[0];
        if (feature.id !== undefined && feature.id !== hoveredZoneId) {
            if (hoveredZoneId !== null) {
                mapRef.current?.setFeatureState(
                    { source: 'zones-source', id: hoveredZoneId },
                    { hover: false }
                );
            }
            setHoveredZoneId(feature.id);
            mapRef.current?.setFeatureState(
                { source: 'zones-source', id: feature.id },
                { hover: true }
            );
            // Safely set cursor style
            const mapInstance = mapRef.current?.getMap();
            if (mapInstance) {
                mapInstance.getCanvas().style.cursor = 'pointer';
            }
        }
    }
  }, [hoveredZoneId]);

  const handleMouseLeaveZone = useCallback(() => {
    if (hoveredZoneId !== null) {
        mapRef.current?.setFeatureState(
            { source: 'zones-source', id: hoveredZoneId },
            { hover: false }
        );
    }
    setHoveredZoneId(null);
    // Safely reset cursor style
    const mapInstance = mapRef.current?.getMap();
    if (mapInstance) {
        mapInstance.getCanvas().style.cursor = '';
    }
  }, [hoveredZoneId]);

  // --- End Map Event Handlers ---

  // Handle geocoding errors
  useEffect(() => {
    if (geocodingError) {
      console.error("[InteractiveMap] Geocoding Error:", geocodingError);
      setMapError(prev => prev ? `${prev} | Erreur Géocodage: ${geocodingError}` : `Erreur Géocodage: ${geocodingError}`);
    } else {
      // Clear geocoding error if it resolves
      if (mapError?.includes('Géocodage')) {
         const otherErrors = mapError.replace(/\|? Erreur Géocodage:.*?($|\|)/, '').trim();
         setMapError(otherErrors || null);
      }
    }
  }, [geocodingError, mapError]);

  // --- Render Markers ---
  const ticketMarkers = useMemo(() => {
    if (!Array.isArray(tickets) || geocodedCoordinates.size === 0) {
      return null;
    }
    console.log(`[InteractiveMap] Rendering ${tickets.length} tickets, ${geocodedCoordinates.size} geocoded.`);

    return tickets.map((ticket) => {
      const originalAddress = ticket.adresse;
      if (!originalAddress || typeof originalAddress !== 'string' || originalAddress.trim() === '') return null;

      const normalizedAddr = normalizeAddress(originalAddress);
      const coordinates = geocodedCoordinates.get(normalizedAddr);

      if (coordinates) {
        const markerColor = getMarkerColor(ticket.statut);
        return (
          <Marker
            key={ticket.id}
            longitude={coordinates.lng}
            latitude={coordinates.lat}
            anchor="center"
            // Let TypeScript infer the event type, access originalEvent
            onClick={(e) => {
              // Prevent map click event when clicking marker
              if (e.originalEvent) { // Check for originalEvent
                e.originalEvent.stopPropagation();
              }
              setSelectedTicket(ticket);
            }}
          >
            {/* Custom Marker Style */}
            <div style={{
                backgroundColor: markerColor,
                width: '15px',
                height: '15px',
                borderRadius: '50%',
                border: '2px solid white',
                boxShadow: '0 0 5px rgba(0,0,0,0.5)',
                cursor: 'pointer'
            }}></div>
          </Marker>
        );
      }
      return null; // Skip tickets without coordinates
    }).filter(Boolean); // Remove null entries

  }, [tickets, geocodedCoordinates]);
  // --- End Render Markers ---


  return (
    <div className="bg-jdc-card p-4 rounded-lg shadow-lg relative min-h-[450px]">
      <h2 className="text-xl font-semibold text-white mb-3 flex items-center">
        <FontAwesomeIcon icon={faMapMarkedAlt} className="mr-2 text-jdc-yellow" />
        Carte des Tickets Récents (Mapbox)
      </h2>

      {/* Loading and Error Overlays */}
      {(isLoadingTickets || (isGeocoding && geocodedCoordinates.size === 0 && uniqueAddresses.length > 0)) && (
        <div className="absolute inset-0 z-[500] flex items-center justify-center bg-jdc-card bg-opacity-75 rounded-lg">
          <FontAwesomeIcon icon={faSpinner} spin className="text-jdc-yellow text-3xl mr-2" />
          <span className="text-white">
            {isLoadingTickets ? "Chargement des tickets..." : "Géocodage des adresses..."}
          </span>
        </div>
      )}
      {isGeocoding && !isLoadingTickets && (
        <div className="absolute top-16 right-4 z-[1000] text-jdc-yellow" title="Géocodage en cours...">
          <FontAwesomeIcon icon={faSpinner} spin />
        </div>
      )}
      {mapError && !isLoadingTickets && !isGeocoding && (
        <div className="absolute top-12 left-1/2 transform -translate-x-1/2 z-[1000] bg-red-800 text-white px-4 py-2 rounded text-sm shadow-lg flex items-center">
          <FontAwesomeIcon icon={faExclamationTriangle} className="mr-2" />
          {mapError}
        </div>
      )}

      {/* Map Container */}
      <div
        className={`w-full h-[450px] rounded-lg overflow-hidden ${ (isLoadingTickets || (isGeocoding && geocodedCoordinates.size === 0 && uniqueAddresses.length > 0)) ? 'opacity-50' : ''}`}
        style={{ backgroundColor: '#4a4a4a' }}
      >
        <Map
          ref={mapRef}
          // Pass individual viewport props for v7
          latitude={viewport.latitude}
          longitude={viewport.longitude}
          zoom={viewport.zoom}
          // Use onMove for viewport updates
          onMove={handleMove}
          onLoad={handleMapLoad}
          mapboxAccessToken={MAPBOX_ACCESS_TOKEN}
          mapStyle="mapbox://styles/mapbox/streets-v11" // Standard Mapbox street style
          style={{ width: '100%', height: '100%' }}
          onMouseEnter={handleMouseEnterZone} // Attach hover listener to map for zones layer
          onMouseLeave={handleMouseLeaveZone}
          interactiveLayerIds={['zones-fill-layer']} // Make the zones fill layer interactive for hover
        >
          {/* Zones Layer */}
          <Source id="zones-source" type="geojson" data={zonesGeoJson} generateId={true}>
            <Layer
                id="zones-fill-layer"
                type="fill"
                source="zones-source"
                paint={zoneFillPaint}
            />
            <Layer
                id="zones-line-layer"
                type="line"
                source="zones-source"
                paint={zoneLinePaint}
            />
          </Source>

          {/* Ticket Markers */}
          {ticketMarkers}

          {/* Popup for Selected Ticket */}
          {selectedTicket && geocodedCoordinates.get(normalizeAddress(selectedTicket.adresse || '')) && (
            <Popup
              longitude={geocodedCoordinates.get(normalizeAddress(selectedTicket.adresse || ''))!.lng}
              latitude={geocodedCoordinates.get(normalizeAddress(selectedTicket.adresse || ''))!.lat}
              anchor="bottom"
              onClose={() => setSelectedTicket(null)}
              closeOnClick={false} // Keep popup open when map is clicked
              offset={15} // Offset from marker center
            >
              <div>
                <b>{selectedTicket.raisonSociale || 'Client inconnu'}</b><br/>
                {selectedTicket.adresse}<br/>
                Statut: {selectedTicket.statut || 'Non défini'}<br/>
                ID: {selectedTicket.id}
              </div>
            </Popup>
          )}
        </Map>
      </div>
    </div>
  );
};

export default InteractiveMap;
