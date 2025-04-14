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
  const isPositive = evolutionValue && evolutionValue > 0;
  const evolutionColor = isPositive ? 'text-green-500' : 'text-red-500';
  const evolutionArrow = isPositive ? '↑' : '↓';
  const statType = getStatTypeFromTitle(title); // Get the specific type for the label

  return (
    <div className="bg-jdc-card p-4 rounded-lg shadow-lg flex items-start space-x-4 transition-colors duration-200 hover:bg-jdc-gray-800">
      {/* Icon */}
      <div className="p-3 rounded-full bg-jdc-yellow text-black flex-shrink-0 mt-1">
        <FontAwesomeIcon icon={icon} className="h-6 w-6" />
      </div>

      {/* Title, Value, and Evolution */}
      <div className="flex-grow">
        {/* Title */}
        <p className="text-sm text-jdc-gray-400">{title}</p>

        {/* Main Value */}
        <p className={`text-2xl font-semibold text-white mt-1 ${isLoading ? 'animate-pulse' : ''}`}>
          {isLoading ? <FontAwesomeIcon icon={faSpinner} spin /> : value}
        </p>

        {/* Evolution Display (Text format, below value, smaller) */}
        {!isLoading && showEvolution && (
          <p className={`text-xs font-medium ${evolutionColor} mt-1`}>
            évolution {statType} (24h) : {evolutionArrow} {isPositive ? '+' : ''}{evolutionValue}
          </p>
        )}
         {/* Placeholder for alignment when evolution is not shown */}
         {!isLoading && !showEvolution && (
            <p className="text-xs font-medium text-transparent mt-1 h-[1em]"> {/* Invisible placeholder */}
                &nbsp; {/* Non-breaking space to maintain height */}
            </p>
         )}
      </div>
    </div>
  );
};
