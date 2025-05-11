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
    <div className={`backdrop-blur-md bg-white/10 border border-white/20 shadow-2xl p-5 rounded-2xl flex flex-col items-center justify-center text-center space-y-3 transition-all duration-300 hover:scale-105 hover:shadow-yellow-400/30 hover:bg-white/20 ${height} animate-fade-in`}> 
      <div className="p-4 rounded-full bg-gradient-to-br from-jdc-yellow/30 to-jdc-yellow/10 text-jdc-yellow border-2 border-jdc-yellow/30 flex-shrink-0 shadow-lg">
        {React.createElement(icon, { className: "h-8 w-8" })}
      </div>
      <p className="text-lg text-white font-semibold drop-shadow-lg">{getStringValue(title)}</p>
      <p className="text-4xl font-extrabold text-jdc-yellow drop-shadow-xl">{value}</p>
      {!isLoading && showEvolution && (
        <p className={`text-base font-semibold ${evolutionColor} animate-bounce`}> 
          évolution {statType} (24h) : {evolutionArrow} {isPositive ? '+' : ''}{evolutionValue}
        </p>
      )}
      {!isLoading && !showEvolution && (
        <p className="text-base font-medium text-transparent h-[1em]">&nbsp;</p>
      )}
    </div>
  );
};
