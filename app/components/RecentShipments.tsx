import React, { useMemo } from 'react';
import { Link } from '@remix-run/react'; // Import Link from Remix
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTruckFast, faBuilding } from '@fortawesome/free-solid-svg-icons';
import type { Shipment } from '~/types/firestore.types';
// Removed unused imports: faExternalLinkAlt, faChevronDown, faChevronRight, getShipmentStatusStyle, Button

interface RecentShipmentsProps {
  shipments: Shipment[];
  isLoading: boolean;
}

// Helper function to get unique client names from shipments
const getUniqueClientNames = (shipments: Shipment[]): string[] => {
  if (!Array.isArray(shipments)) {
    return []; // Return empty array if shipments is not an array
  }
  const names = new Set<string>();
  shipments.forEach(shipment => {
    if (shipment.nomClient) {
      names.add(shipment.nomClient);
    }
  });
  // Sort names alphabetically for consistent display
  return Array.from(names).sort((a, b) => a.localeCompare(b));
};

export const RecentShipments: React.FC<RecentShipmentsProps> = ({ shipments, isLoading }) => {

  // Get unique client names using useMemo for performance
  const uniqueClientNames = useMemo(() => getUniqueClientNames(shipments), [shipments]);

  return (
    <div className="bg-jdc-card p-4 rounded-lg shadow-lg">
      <h2 className="text-xl font-semibold text-white mb-3 flex items-center">
        <FontAwesomeIcon icon={faTruckFast} className="mr-2 text-jdc-yellow" />
        Clients CTN Récents (via Envois)
      </h2>
      {isLoading ? (
        <div className="flex items-center justify-center text-jdc-gray-300 py-4">
          {/* Consistent loading indicator */}
          <FontAwesomeIcon icon={faTruckFast} spin className="mr-2" />
          Chargement...
        </div>
      ) : uniqueClientNames.length === 0 ? (
        <p className="text-jdc-gray-400 text-center py-4">Aucun client trouvé dans les envois récents.</p> // Use <p> like RecentTickets
      ) : (
        // Use similar list styling as RecentTickets
        <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">
          {uniqueClientNames.map((clientName) => (
            // Apply tile styling to the list item itself
            <li key={clientName} className="text-sm p-2 bg-jdc-gray-800 rounded hover:bg-jdc-gray-700 transition-colors duration-150">
              <Link
                to={`/envois-ctn?client=${encodeURIComponent(clientName)}`}
                className="flex items-center w-full" // Link fills the li, flex aligns icon and text
              >
                <FontAwesomeIcon icon={faBuilding} className="mr-2 text-jdc-gray-300 flex-shrink-0" /> {/* Adjusted margin */}
                {/* Apply similar text styling */}
                <span className="font-medium text-white truncate" title={clientName}>{clientName}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
