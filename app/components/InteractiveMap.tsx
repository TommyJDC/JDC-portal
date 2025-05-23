import React, { useState, useMemo, useEffect, useCallback } from 'react';
// Import MarkerEvent and ViewStateChangeEvent for v7/v8 compatibility if needed
import Map, { Marker, Popup, Source, Layer, MapRef, MarkerEvent, ViewStateChangeEvent } from 'react-map-gl';
import mapboxgl from 'mapbox-gl'; // Import mapboxgl types/namespace
import type { Feature, FeatureCollection, Point } from 'geojson';
import useGeoCoding from '~/hooks/useGeoCoding';
import { kmlZones } from '~/utils/kmlZones';
import type { SapTicket } from '~/types/firestore.types';
import { FaSpinner, FaExclamationTriangle, FaMapMarkedAlt } from 'react-icons/fa';

// Mapbox Access Token (Ensure this is securely managed, e.g., via environment variables)
const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1Ijoic2ltcGVyZnk0MDQiLCJhIjoiY201ZnFuNG5wMDBoejJpczZkNXMxNTBveCJ9.BM3MvMHuUkhQj91tQTChoQ';

// Interface for props
interface InteractiveMapProps {
  tickets: SapTicket[];
  isLoadingTickets: boolean;
}

// Zone colors mapping (adjust structure for Mapbox layer paint properties)
const zoneColorMap: { [key: string]: { color: string; opacity: number } } = {
  'Baptiste': { color: '#FFEB3B', opacity: 0.3 }, // Yellow
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
    if (statusLower.includes('en cours')) return '#FFEB3B'; // Yellow
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
  // Limiter davantage le nombre de tickets sur mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const displayedTickets = useMemo(() => 
    isMobile ? tickets.slice(0, 15) : tickets.slice(0, 50),
  [tickets, isMobile]);
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
  // Helper function to get string value from field
  const getStringValue = (field: { stringValue: string } | string | undefined): string => {
    if (!field) return '';
    if (typeof field === 'string') return field;
    return field.stringValue || '';
  };

  // --- Prepare Markers ---
  const uniqueAddresses = useMemo(() => {
    console.log("[InteractiveMap] Recalculating unique addresses...");
    if (!Array.isArray(tickets)) return [];
    
    // Limiter à 50 tickets maximum pour éviter les problèmes de performance
    const limitedTickets = tickets.slice(0, 50);
    
    const addresses = limitedTickets
      .map(ticket => getStringValue(ticket.adresse))
      .filter(addr => addr !== '');
    const uniqueSet = new Set(addresses);
    console.log(`[InteractiveMap] Found ${uniqueSet.size} unique addresses (from ${limitedTickets.length} tickets).`);
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
      try {
        const bounds = new mapboxgl.LngLatBounds();
        zonesGeoJson.features.forEach(feature => {
          if (feature.geometry.type === 'Polygon') {
            feature.geometry.coordinates[0].forEach(coord => {
              bounds.extend([coord[0], coord[1]]);
            });
          }
        });
        
        if (!bounds.isEmpty()) {
          mapRef.current.fitBounds(bounds, {
            padding: 50,
            maxZoom: 12,
            duration: 1000
          });
        }
      } catch (error) {
        console.error("Error fitting bounds:", error);
      }
    }
  }, [zonesGeoJson]);

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
      const address = getStringValue(ticket.adresse);
      if (!address) return null;

      const normalizedAddr = normalizeAddress(address);
      const coordinates = geocodedCoordinates.get(normalizedAddr);

      if (coordinates) {
        const markerColor = getMarkerColor(getStringValue(ticket.statut));
        return (
          <Marker
            key={ticket.id}
            longitude={coordinates.lng}
            latitude={coordinates.lat}
            anchor="center"
            onClick={(e) => {
              if (e.originalEvent) {
                e.originalEvent.stopPropagation();
              }
              setSelectedTicket(ticket);
            }}
          >
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
      return null;
    }).filter(Boolean); // Remove null entries

  }, [tickets, geocodedCoordinates]);
  // --- End Render Markers ---

  // --- Popup Content ---
  const renderPopupContent = (ticket: SapTicket) => (
    <div>
      <b>{getStringValue(ticket.raisonSociale) || 'Client inconnu'}</b><br/>
      {getStringValue(ticket.adresse)}<br/>
      Statut: {getStringValue(ticket.statut) || 'Non défini'}<br/>
      ID: {ticket.id}
    </div>
  );



  if (isLoadingTickets || isGeocoding) {
    return (
      <div className="bg-jdc-card rounded-xl shadow-lg h-full w-full overflow-hidden flex items-center justify-center">
        <div className="text-center">
          <FaSpinner className="text-jdc-yellow text-2xl mb-2 animate-spin" />
          <p className="text-jdc-gray-400">Chargement de la carte...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-jdc-card rounded-xl shadow-lg h-full w-full overflow-hidden">
        <div className="h-full w-full rounded-xl overflow-hidden">
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
            {selectedTicket && geocodedCoordinates.get(normalizeAddress(getStringValue(selectedTicket.adresse))) && (
              <Popup
                longitude={geocodedCoordinates.get(normalizeAddress(getStringValue(selectedTicket.adresse)))!.lng}
                latitude={geocodedCoordinates.get(normalizeAddress(getStringValue(selectedTicket.adresse)))!.lat}
                anchor="bottom"
                onClose={() => setSelectedTicket(null)}
                closeOnClick={false}
                offset={15}
              >
                renderPopupContent(selectedTicket)
              </Popup>
            )}
          </Map>
        </div>
      </div>
  );
};

export default InteractiveMap;
