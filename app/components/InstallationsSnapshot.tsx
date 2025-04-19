import React from 'react';
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

interface InstallationStats {
  total: number;
  enAttente: number;
  planifiees: number;
  terminees: number;
}

interface InstallationsSnapshotProps {
  stats: {
    haccp: InstallationStats;
    chr: InstallationStats;
    tabac: InstallationStats;
    kezia: InstallationStats;
  };
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
    className="bg-jdc-card p-4 rounded-lg shadow-lg border border-gray-700/50 hover:border-jdc-blue/50 transition-colors"
  >
    <div className="flex items-center gap-3 mb-3">
      <div className={`p-2 rounded bg-gradient-to-r from-${gradientFrom} to-${gradientTo}`}>
        <IconComponent className="text-white" />
      </div>
      <h3 className="font-bold text-lg text-white">{title}</h3>
    </div>
    
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-2">
        <p className="text-sm text-gray-400">Total</p>
        <p className="text-2xl font-bold text-white">{stats.total}</p>
      </div>
      <div className="space-y-2">
        <p className="text-sm text-gray-400">En attente</p>
        <p className="text-2xl font-bold text-yellow-400">{stats.enAttente}</p>
      </div>
      <div className="space-y-2">
        <p className="text-sm text-gray-400">Planifiées</p>
        <p className="text-2xl font-bold text-blue-400">{stats.planifiees}</p>
      </div>
      <div className="space-y-2">
        <p className="text-sm text-gray-400">Terminées</p>
        <p className="text-2xl font-bold text-green-400">{stats.terminees}</p>
      </div>
    </div>
  </Link>
);

export const InstallationsSnapshot: React.FC<InstallationsSnapshotProps> = ({ stats, isLoading = false, lastUpdate, onRefresh }) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-jdc-card p-4 rounded-lg shadow-lg animate-pulse h-[200px]" />
        ))}
      </div>
    );
  }

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
          stats={stats.haccp}
          icon={FaClipboardCheck}
          to="/installations/haccp"
          gradientFrom="green-600"
          gradientTo="green-400"
        />
        <InstallationCard
          title="CHR"
          stats={stats.chr}
          icon={FaUtensils}
          to="/installations/chr-firestore"
          gradientFrom="blue-600"
          gradientTo="blue-400"
        />
        <InstallationCard
          title="Tabac"
          stats={stats.tabac}
          icon={FaSmoking}
          to="/installations/tabac-firestore"
          gradientFrom="red-600"
          gradientTo="red-400"
        />
        <InstallationCard
          title="Kezia"
          stats={stats.kezia}
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
