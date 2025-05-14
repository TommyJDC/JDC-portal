// DEBUG PATCH: Log all props received by InstallationsSnapshot
import React, { useEffect, useMemo, useState } from 'react'; // Importer useMemo and useState
import { Link } from '@remix-run/react';
import { Button } from '~/components/ui/Button';
import { format } from 'date-fns';
import { 
  FaStore,
  FaUtensils, 
  FaSmoking,
  FaClipboardCheck,
  FaChartPie,
  FaSync
} from 'react-icons/fa';

import type { Installation } from "~/types/firestore.types"; // Importer Installation

interface InstallationStats {
  total: number;
  enAttente: number;
  planifiees: number;
  terminees: number;
}

interface InstallationsSnapshotProps {
  stats: {
    [key: string]: {
      total: number;
      enAttente: number;
      planifiees: number;
      terminees: number;
    };
  };
  installationsCount?: number;
  isLoading?: boolean;
  lastUpdate?: Date | string;
}

const sectorConfig = {
  haccp: {
    label: 'HACCP',
    icon: FaClipboardCheck,
    to: '/installations/haccp',
    gradient: 'from-green-400/20 to-green-700/30',
    shadow: 'shadow-green-400/20',
    badge: 'bg-green-400/30',
    border: 'border-green-400/20',
    hover: 'hover:border-green-400/40',
  },
  chr: {
    label: 'CHR',
    icon: FaUtensils,
    to: '/installations/chr-firestore',
    gradient: 'from-blue-400/20 to-blue-700/30',
    shadow: 'shadow-blue-400/20',
    badge: 'bg-blue-400/30',
    border: 'border-blue-400/20',
    hover: 'hover:border-blue-400/40',
  },
  tabac: {
    label: 'Tabac',
    icon: FaSmoking,
    to: '/installations/tabac-firestore',
    gradient: 'from-red-400/20 to-red-700/30',
    shadow: 'shadow-red-400/20',
    badge: 'bg-red-400/30',
    border: 'border-red-400/20',
    hover: 'hover:border-red-400/40',
  },
  kezia: {
    label: 'Kezia',
    icon: FaStore,
    to: '/installations/kezia-firestore',
    gradient: 'from-purple-400/20 to-purple-700/30',
    shadow: 'shadow-purple-400/20',
    badge: 'bg-purple-400/30',
    border: 'border-purple-400/20',
    hover: 'hover:border-purple-400/40',
  },
};

const InstallationCard = ({ 
  title, 
  stats, 
  icon: IconComponent,
  to, 
  gradient,
  shadow,
  badge,
  border,
  hover
}: { 
  title: string;
  stats: InstallationStats;
  icon: React.ComponentType<{className?: string}>;
  to: string;
  gradient: string;
  shadow: string;
  badge: string;
  border: string;
  hover: string;
}) => {
  // eslint-disable-next-line no-console
  console.log(`[InstallationCard][DEBUG] Rendu carte ${title}:`, stats);

  return (
    <Link
      to={to}
      className={`relative glass-card group bg-gradient-to-br ${gradient} rounded-2xl p-6 min-h-[220px] flex flex-col justify-between overflow-hidden transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl ${shadow} border ${border} ${hover}`}
      style={{backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)'}}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-4 rounded-full bg-white/10 border-2 border-white/20 shadow-lg flex-shrink-0 group-hover:scale-110 transition-transform duration-200 ${badge}`}>
          <IconComponent className="text-white text-2xl drop-shadow" />
        </div>
        <h3 className="font-extrabold text-2xl text-white tracking-wide drop-shadow-lg">{title}</h3>
      </div>
      
      <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-gray-200"> {/* Ajuster l'espacement */}
        <div className="space-y-1"> {/* Ajuster l'espacement */}
          <p className="text-xs text-gray-100/70 font-medium uppercase tracking-wider">Total</p> {/* Rendre le label plus petit et medium */}
          <p className="text-2xl font-bold text-white animate-fade-in-up">{stats.total}</p> {/* Ajuster la taille et le poids de la valeur */}
        </div>
        <div className="space-y-1"> {/* Ajuster l'espacement */}
          <p className="text-xs text-gray-100/70 font-medium uppercase tracking-wider">En attente</p> {/* Rendre le label plus petit et medium */}
          <p className="text-2xl font-bold text-yellow-300 animate-pulse-slow">{stats.enAttente}</p> {/* Ajuster la taille et le poids de la valeur */}
        </div>
        <div className="space-y-1"> {/* Ajuster l'espacement */}
          <p className="text-xs text-gray-100/70 font-medium uppercase tracking-wider">Planifiées</p> {/* Rendre le label plus petit et medium */}
          <p className="text-2xl font-bold text-blue-300 animate-fade-in-up">{stats.planifiees}</p> {/* Ajuster la taille et le poids de la valeur */}
        </div>
        <div className="space-y-1"> {/* Ajuster l'espacement */}
          <p className="text-xs text-gray-100/70 font-medium uppercase tracking-wider">Terminées</p> {/* Rendre le label plus petit et medium */}
          <p className="text-2xl font-bold text-green-300 animate-fade-in-up">{stats.terminees}</p> {/* Ajuster la taille et le poids de la valeur */}
        </div>
      </div>
      <span className="absolute right-4 top-4 w-3 h-3 rounded-full bg-white/30 group-hover:scale-125 transition-transform duration-200 animate-pulse" />
    </Link>
  );
};

export function InstallationsSnapshot({ stats, installationsCount, isLoading, lastUpdate }: InstallationsSnapshotProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Formater la date de manière cohérente
  const formattedDate = useMemo(() => {
    if (!lastUpdate) return '';
    const date = new Date(lastUpdate);
    return format(date, 'dd/MM/yyyy HH:mm:ss');
  }, [lastUpdate]);

  // Ne pas afficher le contenu pendant l'hydratation
  if (!mounted) {
    return (
      <div className="bg-ui-background rounded-lg shadow-lg p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[220px] bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-ui-background rounded-lg shadow-lg p-6">
        <div className="text-text-secondary text-center py-8">
          Aucune donnée disponible
        </div>
      </div>
    );
  }

  return (
    <div className="bg-ui-background rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-text-primary">État des installations</h2>
        {formattedDate && (
          <div className="text-sm text-text-secondary">
            Dernière mise à jour : {formattedDate}
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(sectorConfig).map(([sector, config]) => (
          <InstallationCard
            key={sector}
            title={config.label}
            stats={stats[sector] || { total: 0, enAttente: 0, planifiees: 0, terminees: 0 }}
            icon={config.icon}
            to={config.to}
            gradient={config.gradient}
            shadow={config.shadow}
            badge={config.badge}
            border={config.border}
            hover={config.hover}
          />
        ))}
      </div>
    </div>
  );
}

export default InstallationsSnapshot;
