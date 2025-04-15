import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from '@remix-run/react';
import leafletStylesHref from 'leaflet/dist/leaflet.css'; // Import Leaflet CSS without ?url
import type { LinksFunction } from '@remix-run/node'; // Import LinksFunction type
import type { Map as LeafletMap, Marker as LeafletMarker, Layer } from 'leaflet'; // Import Leaflet types

// Add a links function to export the stylesheet
export const links: LinksFunction = () => [
  { rel: "stylesheet", href: leafletStylesHref }, // Use the new import variable
];

// Dynamically import Leaflet only on the client-side
let L: typeof import('leaflet') | null = null; // Keep dynamic import logic
if (typeof window !== 'undefined') {
  import('leaflet').then(leaflet => { // Keep dynamic import logic
    L = leaflet;
  });
}

interface MapDisplayProps {
  position: [number, number]; // Latitude, Longitude
  zoom?: number;
  className?: string;
  markers?: Array<{ position: [number, number]; popupContent?: string }>;
}

export const MapDisplay: React.FC<MapDisplayProps> = ({
  position,
  zoom = 13,
  className = '',
  markers = [],
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null); // Use imported LeafletMap type
  const [isLeafletLoaded, setIsLeafletLoaded] = useState(L !== null);
  const location = useLocation(); // Use location to trigger re-render on navigation

  useEffect(() => {
    // Ensure Leaflet is loaded before trying to initialize the map
    if (!isLeafletLoaded && typeof window !== 'undefined') {
      import('leaflet').then(leaflet => {
        L = leaflet;
        setIsLeafletLoaded(true);
      });
    }
  }, [isLeafletLoaded]);

  useEffect(() => {
    // Initialize map only if Leaflet is loaded, ref exists, and map isn't already initialized
    if (isLeafletLoaded && L && mapRef.current && !mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current).setView(position, zoom);

      // Add Tile Layer (Using OpenStreetMap)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapInstanceRef.current);

      // Add initial markers
      markers.forEach(markerInfo => {
        const marker = L!.marker(markerInfo.position).addTo(mapInstanceRef.current!);
        if (markerInfo.popupContent) {
          marker.bindPopup(markerInfo.popupContent);
        }
      });

       // Optional: Invalidate size after a slightly longer delay
       setTimeout(() => {
         console.log("MapDisplay: Initial invalidateSize triggered");
         mapInstanceRef.current?.invalidateSize();
       }, 300); // Increased delay
    }

    // Cleanup function to remove map instance when component unmounts or location changes
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
    // Re-run effect only when Leaflet loading state changes
  }, [isLeafletLoaded]); // Corrected dependency array

  // Update map view and markers if props change after initial render
  useEffect(() => {
     if (mapInstanceRef.current && L) {
       mapInstanceRef.current.setView(position, zoom);

       // Clear existing markers (simple approach, might need optimization for many markers)
       mapInstanceRef.current.eachLayer((layer: Layer) => { // Explicitly type layer
         if (layer instanceof L!.Marker) { // L! asserts L is not null here
           mapInstanceRef.current?.removeLayer(layer);
         }
       });

       // Add new markers
       markers.forEach(markerInfo => {
         const marker = L!.marker(markerInfo.position).addTo(mapInstanceRef.current!);
         if (markerInfo.popupContent) {
           marker.bindPopup(markerInfo.popupContent);
         }
       });

       // Also invalidate size when props change, after view/markers are updated
       setTimeout(() => {
          console.log("MapDisplay: Prop change invalidateSize triggered");
          mapInstanceRef.current?.invalidateSize();
       }, 50); // Shorter delay here might be okay
     }
  }, [position, zoom, markers, isLeafletLoaded]);


  return (
    <div
      ref={mapRef}
      className={`leaflet-container ${className}`} // Ensure leaflet-container class is present
      style={{ height: '400px', width: '100%', backgroundColor: '#333' }} // Default size and bg
    >
      {!isLeafletLoaded && <p className="p-4 text-center text-jdc-gray-400">Chargement de la carte...</p>}
    </div>
  );
};
