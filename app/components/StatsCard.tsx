import React from 'react';
import { FaSpinner } from 'react-icons/fa';
import { getStringValue } from '~/utils/firestoreUtils';

interface StatsCardProps {
  title: string; // Title like "Tickets SAP (Total)"
  value: string | number; // Main value (live count)
  icon: React.ElementType; // Change type to React component
  isLoading?: boolean; // Optional loading prop
  evolutionValue?: number | null; // Optional: Numeric change value (live - snapshot)
  height?: string; // Optional: Custom height (e.g. "h-32", "h-40")
}

// Helper function to get the type of stat from the title for the evolution label
const getStatTypeFromTitle = (title: string): string => {
  if (title.toLowerCase().includes('ticket')) return 'ticket SAP';
  if (title.toLowerCase().includes('envois')) return 'envois CTN';
  if (title.toLowerCase().includes('client')) return 'clients actifs';
  return 'données'; // Fallback
};

export const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon, isLoading = false, evolutionValue, height = 'h-auto' }) => {
  // Determine if the evolution display should be shown
  // It's shown only if evolutionValue is a non-zero number
  const showEvolution = typeof evolutionValue === 'number' && evolutionValue !== 0;
  const isPositive = typeof evolutionValue === 'number' && evolutionValue > 0; // Ensure evolutionValue is a number
  const evolutionColor = isPositive ? 'text-green-400' : 'text-red-400'; // Ajuster les couleurs
  const evolutionArrow = isPositive ? '↑' : '↓';
  const statType = getStatTypeFromTitle(title); // Get the specific type for the label

  return (
    <div className={`bg-gray-800 p-2 rounded-lg shadow-lg border border-transparent hover:border-jdc-blue transition-all duration-300 ease-in-out flex flex-col items-center justify-center text-center space-y-1 ${height}`}>
      {/* Icon */}
      <div className="p-3 rounded-md bg-jdc-yellow/20 text-jdc-yellow border border-jdc-yellow/30 flex-shrink-0"> {/* Icône jaune, taille et padding ajustés */}
        {React.createElement(icon, { className: "h-6 w-6" })} {/* Utiliser React.createElement pour rendre l'icône */}
      </div>

      {/* Title, Value, and Evolution */}
      <div className="flex-grow flex flex-col items-center justify-center space-y-1"> {/* Centrer le contenu texte verticalement et horizontalement, espacement légèrement augmenté */}
        <p className="text-base text-gray-400 font-medium">{getStringValue(title)}</p> {/* Taille du titre augmentée */}
        <p className="text-3xl font-bold text-white">{value}</p> {/* Taille de la valeur augmentée */}

        {/* Evolution Display (Text format, below value, smaller) */}
        {!isLoading && showEvolution && (
          <p className={`text-sm font-medium ${evolutionColor}`}> {/* Taille de l'évolution augmentée */}
            évolution {statType} (24h) : {evolutionArrow} {isPositive ? '+' : ''}{evolutionValue}
          </p>
        )}
        {/* Supprimer l'affichage de l'évolution en pourcentage si l'évolutionValue est déjà le nombre */}
         {!isLoading && !showEvolution && (
            <p className="text-sm font-medium text-transparent h-[1em]"> {/* Invisible placeholder ajusté */}
                &nbsp; {/* Non-breaking space to maintain height */}
            </p>
         )}
      </div>
    </div>
  );
};
