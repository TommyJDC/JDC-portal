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

import type { Installation, InstallationStatus } from "~/types/firestore.types"; // Importer Installation et InstallationStatus

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

const InstallationCard = ({ 
  title, 
  stats, 
  icon: IconComponent,
  to, 
  gradientFrom, 
  gradientTo 
}: { 
  title: string;
  stats: InstallationStats;
  icon: React.ComponentType<{className?: string}>;
  to: string;
  gradientFrom: string;
  gradientTo: string;
}) => (
  <Link
    to={to}
    className="bg-gray-800 p-6 rounded-xl shadow-2xl border border-gray-700 hover:border-jdc-blue transition-all duration-300 ease-in-out block" // Utiliser block pour que le lien remplisse la carte
  >
    <div className="flex items-center gap-3 mb-4">
      <div className={`p-3 rounded-full bg-gradient-to-r from-${gradientFrom} to-${gradientTo}`}> {/* Rendre l'icône plus grande et ronde */}
        <IconComponent className="text-white text-xl" /> {/* Ajuster la taille de l'icône */}
      </div>
      <h3 className="font-extrabold text-xl text-white">{title}</h3> {/* Ajuster la taille et le poids du titre */}
    </div>
    
    <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-gray-300"> {/* Ajuster l'espacement */}
      <div className="space-y-1"> {/* Ajuster l'espacement */}
        <p className="text-sm text-gray-400 font-medium">Total</p> {/* Rendre le label plus petit et medium */}
        <p className="text-2xl font-bold text-white">{stats.total}</p> {/* Ajuster la taille et le poids de la valeur */}
      </div>
      <div className="space-y-1"> {/* Ajuster l'espacement */}
        <p className="text-sm text-gray-400 font-medium">En attente</p> {/* Rendre le label plus petit et medium */}
        <p className="text-2xl font-bold text-yellow-400">{stats.enAttente}</p> {/* Ajuster la taille et le poids de la valeur */}
      </div>
      <div className="space-y-1"> {/* Ajuster l'espacement */}
        <p className="text-sm text-gray-400 font-medium">Planifiées</p> {/* Rendre le label plus petit et medium */}
        <p className="text-2xl font-bold text-blue-400">{stats.planifiees}</p> {/* Ajuster la taille et le poids de la valeur */}
      </div>
      <div className="space-y-1"> {/* Ajuster l'espacement */}
        <p className="text-sm text-gray-400 font-medium">Terminées</p> {/* Rendre le label plus petit et medium */}
        <p className="text-2xl font-bold text-green-400">{stats.terminees}</p> {/* Ajuster la taille et le poids de la valeur */}
      </div>
    </div>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-jdc-card p-4 rounded-lg shadow-lg animate-pulse h-[200px]" />
        ))}
      </div>
    );
  }

  // Utiliser calculatedStats pour l'affichage
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white flex items-center">
          <FaChartPie className="mr-2 text-jdc-yellow" />
          État des Installations
        </h2>
        <div className="flex items-center gap-4">
          <span className="text-sm text-jdc-gray-400">
            Dernière mise à jour: {lastUpdate ? format(lastUpdate, 'HH:mm:ss') : 'N/A'}
          </span>
          <Button
            onClick={onRefresh}
            disabled={isLoading}
            variant="secondary"
            size="sm"
            className="text-jdc-yellow hover:text-black hover:bg-jdc-yellow transition-colors"
            leftIcon={<FaSync className={isLoading ? "animate-spin" : ""} />}
          >
            Actualiser
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <InstallationCard
          title="HACCP"
          stats={calculatedStats.haccp} // Utiliser calculatedStats
          icon={FaClipboardCheck}
          to="/installations/haccp"
          gradientFrom="green-600"
          gradientTo="green-400"
        />
        <InstallationCard
          title="CHR"
          stats={calculatedStats.chr} // Utiliser calculatedStats
          icon={FaUtensils}
          to="/installations/chr-firestore"
          gradientFrom="blue-600"
          gradientTo="blue-400"
        />
        <InstallationCard
          title="Tabac"
          stats={calculatedStats.tabac} // Utiliser calculatedStats
          icon={FaSmoking}
          to="/installations/tabac-firestore"
          gradientFrom="red-600"
          gradientTo="red-400"
        />
        <InstallationCard
          title="Kezia"
          stats={calculatedStats.kezia} // Utiliser calculatedStats
          icon={FaStore}
          to="/installations/kezia-firestore"
          gradientFrom="purple-600"
          gradientTo="purple-400"
        />
      </div>
    </div>
  );
};

export default InstallationsSnapshot;
