import React from 'react';
import { FaUtensils, FaShieldAlt, FaHamburger, FaSmoking, FaCheckCircle, FaEdit, FaEye } from 'react-icons/fa';

interface Installation {
  id: string;
  date: string; // format: JJ/MM/AAAA ou ISO
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
  { id: '1', date: '2024-06-10', client: 'Boulangerie Dupont', secteur: 'CHR', ville: 'Lyon', statut: 'à venir' },
  { id: '2', date: '2024-06-11', client: 'Tabac Central', secteur: 'Tabac', ville: 'Grenoble', statut: 'planifiée' },
  { id: '3', date: '2024-06-12', client: 'Hôtel Riviera', secteur: 'HACCP', ville: 'Nice', statut: 'en cours' },
  { id: '4', date: '2024-06-13', client: 'Kezia Café', secteur: 'Kezia', ville: 'Paris', statut: 'terminée' },
];

export const UpcomingInstallationsTimeline: React.FC<{ installations?: Installation[] }> = ({ installations = demoInstallations }) => (
  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 shadow-xl border border-white/20 mb-8 animate-fade-in-up">
    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
      <FaCheckCircle className="text-jdc-yellow" /> Prochaines installations
    </h3>
    <ol className="relative border-l-2 border-jdc-yellow/30 ml-4">
      {installations.map((inst, idx) => {
        const IconComponent = secteurIcons[inst.secteur] || FaCheckCircle; // Utiliser FaCheckCircle comme icône par défaut
        return (
          <li key={inst.id} className="mb-8 ml-6 animate-fade-in-up" style={{ animationDelay: `${0.1 + idx * 0.1}s` }}>
            <span className="absolute -left-5 flex items-center justify-center w-10 h-10 bg-gradient-to-br from-jdc-yellow/80 to-jdc-yellow/40 rounded-full border-2 border-jdc-yellow/60 shadow-lg">
              <IconComponent className="text-2xl text-white drop-shadow" />
            </span>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap">
              <span className="text-sm text-jdc-yellow-200 font-bold min-w-0 truncate">{new Date(inst.date).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' })}</span>
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
