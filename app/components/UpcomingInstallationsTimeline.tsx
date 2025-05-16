import React from 'react';
import { FaUtensils, FaShieldAlt, FaHamburger, FaSmoking, FaCheckCircle, FaEdit, FaEye } from 'react-icons/fa';

interface Installation {
  id: string;
  date: string; // format: JJ/MM/AAAA ou ISO string
  client: string;
  secteur: 'CHR' | 'HACCP' | 'Kezia' | 'Tabac';
  ville: string;
  statut: 'à venir' | 'planifiée' | 'en cours' | 'terminée';
}

const secteurIcons = {
  CHR: FaUtensils,
  HACCP: FaShieldAlt,
  Kezia: FaHamburger,
  Tabac: FaSmoking,
};
const statutColors = {
  'à venir': 'bg-blue-500/20 text-blue-400',
  'planifiée': 'bg-yellow-500/20 text-yellow-400',
  'en cours': 'bg-green-500/20 text-green-400',
  'terminée': 'bg-gray-500/20 text-gray-400',
};

// Données factices pour la démo
const demoInstallations: Installation[] = [
  { id: '1', date: '10/06/2024', client: 'Boulangerie Dupont', secteur: 'CHR', ville: 'Lyon', statut: 'à venir' },
  { id: '2', date: '11/06/2024', client: 'Tabac Central', secteur: 'Tabac', ville: 'Grenoble', statut: 'planifiée' },
  { id: '3', date: '12/06/2024', client: 'Hôtel Riviera', secteur: 'HACCP', ville: 'Nice', statut: 'en cours' },
  { id: '4', date: '13/06/2024', client: 'Kezia Café', secteur: 'Kezia', ville: 'Paris', statut: 'terminée' },
];

// Helper function to parse date string (JJ/MM/AAAA, DD-MM-YYYY, or ISO)
const parseDate = (dateString: string): Date | null => {
  if (!dateString) return null;

  let day, month, year, parts;

  // 1. Try DD/MM/YYYY
  parts = dateString.split('/');
  if (parts.length === 3 && parts[0].length <= 2 && parts[1].length <= 2 && parts[2].length === 4) {
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
    year = parseInt(parts[2], 10);
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      const d = new Date(Date.UTC(year, month, day)); // Use UTC to avoid timezone issues from local interpretation
      // Check if the constructed date is valid and matches the input components
      if (d.getUTCFullYear() === year && d.getUTCMonth() === month && d.getUTCDate() === day) {
        return d;
      }
    }
  }

  // 2. Try DD-MM-YYYY
  parts = dateString.split('-');
  if (parts.length === 3 && parts[0].length <= 2 && parts[1].length <= 2 && parts[2].length === 4) {
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
    year = parseInt(parts[2], 10);
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      const d = new Date(Date.UTC(year, month, day)); // Use UTC
      if (d.getUTCFullYear() === year && d.getUTCMonth() === month && d.getUTCDate() === day) {
        return d;
      }
    }
  }

  // 3. Try YYYY-MM-DD (common ISO date part) or full ISO8601 string
  // new Date() is generally reliable for true ISO8601 formats (YYYY-MM-DDTHH:mm:ss.sssZ)
  // and YYYY-MM-DD (which it interprets as UTC midnight).
  if (dateString.includes('-')) { // A characteristic of ISO-like dates
      const d = new Date(dateString);
      if (!isNaN(d.getTime())) {
          // If only YYYY-MM-DD was provided, new Date() makes it UTC midnight.
          // To ensure consistency with toLocaleDateString later, which uses local timezone,
          // it's often better to parse YYYY-MM-DD explicitly to local midnight or handle timezone carefully.
          // However, for display purposes with toLocaleDateString, direct use might be acceptable if source is truly ISO.
          return d;
      }
  }
  
  // 4. Handle DD/MM (current year) - ensure parts is from '/' split for this case
  parts = dateString.split('/'); 
  if (parts.length === 2 && !dateString.includes('-')) { 
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      const currentYear = new Date().getFullYear();
      if(!isNaN(day) && !isNaN(month)) {
          const d = new Date(Date.UTC(currentYear, month, day)); // Use UTC
          if (d.getUTCFullYear() === currentYear && d.getUTCMonth() === month && d.getUTCDate() === day) {
            return d;
          }
      }
  }

  // Fallback for any other format that new Date() might understand
  console.warn(`[UpcomingInstallationsTimeline] Date string "${dateString}" did not match specific formats. Attempting direct parse with new Date(). This may be locale-sensitive.`);
  const d = new Date(dateString);
  if (!isNaN(d.getTime())) return d;

  console.error(`[UpcomingInstallationsTimeline] Failed to parse date: ${dateString}`);
  return null;
};

export const UpcomingInstallationsTimeline: React.FC<{ installations?: Installation[] }> = ({ installations = demoInstallations }) => (
  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 shadow-xl border border-white/20 mb-8 animate-fade-in-up">
    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
      <FaCheckCircle className="text-jdc-yellow" /> Prochaines installations
    </h3>
    <ol className="relative border-l-2 border-jdc-yellow/30 ml-4">
      {installations.map((inst, idx) => {
        const IconComponent = secteurIcons[inst.secteur] || FaCheckCircle; // Utiliser FaCheckCircle comme icône par défaut
        
        const parsed = parseDate(inst.date);
        let displayDateString = 'Date invalide';
        if (parsed) {
          const day = parsed.getUTCDate().toString().padStart(2, '0');
          const month = (parsed.getUTCMonth() + 1).toString().padStart(2, '0'); // Les mois sont de 0 à 11
          displayDateString = `${day}/${month}`;
        }

        return (
          <li key={inst.id} className="mb-8 ml-6 animate-fade-in-up" style={{ animationDelay: `${0.1 + idx * 0.1}s` }}>
            <span className="absolute -left-5 flex items-center justify-center w-10 h-10 bg-gradient-to-br from-jdc-yellow/80 to-jdc-yellow/40 rounded-full border-2 border-jdc-yellow/60 shadow-lg">
              <IconComponent className="text-2xl text-white drop-shadow" />
            </span>
            <div className="timeline-item-content bg-gray-800/30 p-4 rounded-lg shadow-lg border border-gray-700/50 hover:border-jdc-yellow/50 transition-all duration-300 ease-in-out transform hover:scale-[1.02] flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="text-sm text-jdc-yellow-200 font-bold min-w-0 truncate">
                {displayDateString}
              </span>
              <span className="text-white font-semibold min-w-0 truncate">{inst.client}</span>
              <span className="text-jdc-gray-300 text-xs min-w-0 truncate">{inst.ville}</span>
              <span className={`px-2 py-1 rounded text-xs font-bold ${statutColors[inst.statut]}`}>{inst.statut}</span>
              <span className="text-jdc-yellow-200 text-xs font-mono min-w-0 truncate">{inst.secteur}</span>
              <div className="flex gap-2 ml-auto">
                <button className="p-2 rounded-full bg-jdc-blue/80 hover:bg-jdc-blue text-white shadow transition" title="Voir"><FaEye /></button>
                <button className="p-2 rounded-full bg-jdc-yellow/80 hover:bg-jdc-yellow text-yellow-900 shadow transition" title="Modifier"><FaEdit /></button>
                <button className="p-2 rounded-full bg-green-500/80 hover:bg-green-400 text-white shadow transition" title="Marquer comme terminée"><FaCheckCircle /></button>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  </div>
);
