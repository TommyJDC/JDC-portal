import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

interface StatsCardProps {
  title: string; // Title like "Tickets SAP (Total)"
  value: string | number; // Main value (live count)
  icon: IconDefinition;
  isLoading?: boolean; // Optional loading prop
  evolutionValue?: number | null; // Optional: Numeric change value (live - snapshot)
}

// Helper function to get the type of stat from the title for the evolution label
const getStatTypeFromTitle = (title: string): string => {
  if (title.toLowerCase().includes('ticket')) return 'ticket SAP';
  if (title.toLowerCase().includes('envois')) return 'envois CTN';
  if (title.toLowerCase().includes('client')) return 'clients actifs';
  return 'données'; // Fallback
};

export const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon, isLoading = false, evolutionValue }) => {
  // Determine if the evolution display should be shown
  // It's shown only if evolutionValue is a non-zero number
  const showEvolution = typeof evolutionValue === 'number' && evolutionValue !== 0;
  const isPositive = typeof evolutionValue === 'number' && evolutionValue > 0; // Ensure evolutionValue is a number
  const evolutionColor = isPositive ? 'text-green-400' : 'text-red-400'; // Ajuster les couleurs
  const evolutionArrow = isPositive ? '↑' : '↓';
  const statType = getStatTypeFromTitle(title); // Get the specific type for the label

  return (
    <div className="bg-gray-800 p-6 rounded-xl shadow-2xl border border-gray-700 hover:border-jdc-blue transition-all duration-300 ease-in-out flex items-start space-x-4"> {/* Ajuster le style de la carte */}
      {/* Icon */}
      <div className="p-3 rounded-full bg-jdc-yellow/20 text-jdc-yellow border border-jdc-yellow/30 flex-shrink-0 mt-1"> {/* Ajuster le style de l'icône */}
        <FontAwesomeIcon icon={icon} className="h-6 w-6" />
      </div>

      {/* Title, Value, and Evolution */}
      <div className="flex-grow">
        {/* Title */}
        <p className="text-sm text-gray-400 font-medium">{title}</p> {/* Ajuster le style du titre */}

        {/* Main Value */}
        <p className={`text-3xl font-extrabold text-white mt-1 ${isLoading ? 'animate-pulse' : ''}`}> {/* Ajuster le style de la valeur principale */}
          {isLoading ? <FontAwesomeIcon icon={faSpinner} spin /> : value}
        </p>

        {/* Evolution Display (Text format, below value, smaller) */}
        {!isLoading && showEvolution && (
          <p className={`text-xs font-medium ${evolutionColor} mt-1`}>
            évolution {statType} (24h) : {evolutionArrow} {isPositive ? '+' : ''}{evolutionValue}
          </p>
        )}
        {/* Supprimer l'affichage de l'évolution en pourcentage si l'évolutionValue est déjà le nombre */}
         {!isLoading && !showEvolution && (
            <p className="text-xs font-medium text-transparent mt-1 h-[1em]"> {/* Invisible placeholder */}
                &nbsp; {/* Non-breaking space to maintain height */}
            </p>
         )}
      </div>
    </div>
  );
};
