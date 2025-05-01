import React, { useMemo } from 'react';
import { Link } from '@remix-run/react';
import { FaTruck, FaBuilding } from 'react-icons/fa';
import type { Shipment } from '~/types/firestore.types';
import { getStringValue } from '~/utils/firestoreUtils';

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
    <div className="bg-gray-800 p-6 rounded-xl shadow-2xl border border-gray-700 hover:border-jdc-blue transition-all duration-300 ease-in-out h-full">
      <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
        <FaTruck className="mr-2 text-jdc-yellow" />
        Envois CTN Récents
      </h2>
      {isLoading ? (
        <div className="flex items-center justify-center text-gray-400 py-4">
          {/* Consistent loading indicator */}
          <FaTruck className="mr-2 animate-spin" />
          Chargement...
        </div>
      ) : uniqueClientNames.length === 0 ? (
        <p className="text-gray-400 text-center py-4">Aucun client trouvé dans les envois récents.</p>
      ) : (
        <div className="space-y-3 max-h-[calc(100%-4rem)] overflow-y-auto pr-2"> {/* Remplacer ul par div */}
          {uniqueClientNames.map((clientName) => (
            // Appliquer le style de carte à un div conteneur pour le lien
            <div
              key={clientName}
              className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg shadow-lg hover:shadow-xl hover:from-gray-700 hover:to-gray-800 transition-all duration-200"
            >
              <Link
                to={`/envois-ctn?client=${encodeURIComponent(getStringValue(clientName))}`}
                className="flex items-center w-full p-4" // Ajouter le padding au lien pour qu'il remplisse la carte
              >
                <FaBuilding className="mr-3 text-jdc-blue flex-shrink-0 text-lg" /> {/* Icône un peu plus grande */}
                <span className="font-semibold text-white text-base truncate" title={getStringValue(clientName)}> {/* Texte blanc et plus grand */}
                  {getStringValue(clientName)}
                </span>
                {/* On pourrait ajouter une flèche ou un indicateur de lien ici si désiré */}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
