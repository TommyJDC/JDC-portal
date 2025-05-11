// DEBUG PATCH: Log all props received by InstallationsSnapshot
import React, { useEffect, useMemo } from 'react'; // Importer useMemo
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
  stats?: { // Rendre stats optionnel
    haccp: InstallationStats;
    chr: InstallationStats;
    tabac: InstallationStats;
    kezia: InstallationStats;
  };
  allInstallations?: Installation[]; // Ajouter la prop pour la liste complète
  isLoading?: boolean;
  lastUpdate?: Date;
  onRefresh?: () => void;
}

const sectorConfig = {
  haccp: {
    label: 'HACCP',
    icon: FaClipboardCheck,
    to: '/installations/haccp',
    gradient: 'from-green-400/60 to-green-700/80',
    shadow: 'shadow-green-400/40',
    badge: 'bg-green-400',
  },
  chr: {
    label: 'CHR',
    icon: FaUtensils,
    to: '/installations/chr-firestore',
    gradient: 'from-blue-400/60 to-blue-700/80',
    shadow: 'shadow-blue-400/40',
    badge: 'bg-blue-400',
  },
  tabac: {
    label: 'Tabac',
    icon: FaSmoking,
    to: '/installations/tabac-firestore',
    gradient: 'from-red-400/60 to-red-700/80',
    shadow: 'shadow-red-400/40',
    badge: 'bg-red-400',
  },
  kezia: {
    label: 'Kezia',
    icon: FaStore,
    to: '/installations/kezia-firestore',
    gradient: 'from-purple-400/60 to-purple-700/80',
    shadow: 'shadow-purple-400/40',
    badge: 'bg-purple-400',
  },
};

const InstallationCard = ({ 
  title, 
  stats, 
  icon: IconComponent,
  to, 
  gradient,
  shadow,
  badge
}: { 
  title: string;
  stats: InstallationStats;
  icon: React.ComponentType<{className?: string}>;
  to: string;
  gradient: string;
  shadow: string;
  badge: string;
}) => (
  <Link
    to={to}
    className={`relative glass-card group bg-gradient-to-br ${gradient} rounded-2xl p-6 min-h-[220px] flex flex-col justify-between overflow-hidden transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl ${shadow}`}
    style={{backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)'}}
  >
    <div className="flex items-center gap-3 mb-2">
      <div className={`p-4 rounded-full bg-white/20 border-2 border-white/30 shadow-lg flex-shrink-0 group-hover:scale-110 transition-transform duration-200 ${badge}`}>
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

export const InstallationsSnapshot: React.FC<InstallationsSnapshotProps> = (props) => {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[InstallationsSnapshot][DEBUG] props:', JSON.stringify(props));
  }, [props]);

  const { stats, allInstallations, isLoading = false, lastUpdate, onRefresh } = props;

  const calculatedStats = useMemo(() => {
    if (!allInstallations) {
      return stats || { // Utiliser les stats passées si allInstallations n'est pas défini
        haccp: { total: 0, enAttente: 0, planifiees: 0, terminees: 0 },
        chr: { total: 0, enAttente: 0, planifiees: 0, terminees: 0 },
        tabac: { total: 0, enAttente: 0, planifiees: 0, terminees: 0 },
        kezia: { total: 0, enAttente: 0, planifiees: 0, terminees: 0 }
      };
    }

    const initialStats = {
      total: 0,
      enAttente: 0,
      planifiees: 0,
      terminees: 0,
    };

    const sectorStats: { [key: string]: InstallationStats } = {
      haccp: { ...initialStats },
      chr: { ...initialStats },
      tabac: { ...initialStats },
      kezia: { ...initialStats },
    };

    allInstallations.forEach((installation: Installation) => {
      const sectorKey = installation.secteur?.toLowerCase() as keyof typeof sectorStats;
      if (sectorKey && sectorStats[sectorKey]) {
        sectorStats[sectorKey].total++;
        switch (installation.status) {
          case 'rendez-vous à prendre':
            sectorStats[sectorKey].enAttente++;
            break;
          case 'rendez-vous pris':
            sectorStats[sectorKey].planifiees++;
            break;
          case 'installation terminée':
            sectorStats[sectorKey].terminees++;
            break;
          default:
            // Gérer d'autres statuts si nécessaire
            break;
        }
      }
    });

    return sectorStats;

  }, [allInstallations, stats]); // Recalculer si allInstallations ou stats changent


  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass-card bg-gradient-to-br from-gray-700/40 to-gray-900/60 rounded-2xl shadow-xl h-[220px] animate-pulse" />
        ))}
      </div>
    );
  }

  // Utiliser calculatedStats pour l'affichage
  return (
    <div className="glass-card bg-gradient-to-br from-gray-900/80 to-gray-800/80 rounded-2xl p-8 shadow-2xl border border-white/10 backdrop-blur-xl">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-extrabold text-white flex items-center drop-shadow-lg">
          <FaChartPie className="mr-3 text-jdc-yellow text-2xl" />
          Suivi des Installations
        </h2>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-200/70">
            Dernière mise à jour : {lastUpdate ? format(lastUpdate, 'HH:mm:ss') : 'N/A'}
          </span>
          <Button
            onClick={onRefresh}
            disabled={isLoading}
            variant="secondary"
            size="sm"
            className="text-jdc-yellow hover:text-black hover:bg-jdc-yellow transition-colors shadow-md"
            leftIcon={<FaSync className={isLoading ? "animate-spin" : ""} />}
          >
            Actualiser
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Object.entries(sectorConfig).map(([key, conf]) => (
          <InstallationCard
            key={key}
            title={conf.label}
            stats={calculatedStats[key as keyof typeof calculatedStats]}
            icon={conf.icon}
            to={conf.to}
            gradient={conf.gradient}
            shadow={conf.shadow}
            badge={conf.badge}
          />
        ))}
      </div>
    </div>
  );
};

export default InstallationsSnapshot;
