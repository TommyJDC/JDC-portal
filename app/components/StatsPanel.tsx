import React, { useState, useEffect } from "react";
import { useFetcher } from "@remix-run/react";
import { Button } from "./ui/Button";
import { FaChartBar, FaChartLine, FaChartPie, FaUsers, FaFileAlt, FaEthereum, FaClock, FaSync } from "react-icons/fa";

// Types pour les données de statistiques
interface StatsData {
  ticketCounts: Record<string, number>;
  clientCount: number;
  clientEvolution: number;
  userCount: number;
  installations: {
    [sector: string]: {
      total: number;
      enAttente: number;
      planifiees: number;
      terminees: number;
    }
  };
  transactionsByDay: Record<string, number>;
  eventTypes: Record<string, number>;
  gasUsageAvg: number;
  confirmationTimeAvg: number;
  error?: string;
}

// Type pour la réponse de réinitialisation
interface ResetResponse {
  success?: boolean;
  message?: string;
  error?: string;
}

// Composant pour la carte des statistiques
interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  change?: string;
  isPositive?: boolean;
  color?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, change, isPositive, color = "blue" }) => {
  const colorClasses: Record<string, string> = {
    blue: "bg-blue-500/10 border-blue-500/30 text-blue-500",
    green: "bg-green-500/10 border-green-500/30 text-green-500",
    purple: "bg-purple-500/10 border-purple-500/30 text-purple-500",
    yellow: "bg-yellow-500/10 border-yellow-500/30 text-yellow-500",
    red: "bg-red-500/10 border-red-500/30 text-red-500"
  };

  return (
    <div className={`p-4 rounded-lg border ${colorClasses[color]} backdrop-blur-sm`}>
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-medium text-jdc-gray-300">{title}</h3>
        <div className={`p-2 rounded-full ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
      <div className="flex items-end gap-2">
        <p className="text-2xl font-bold text-white">{value}</p>
        {change && (
          <span className={`text-xs font-medium mb-1 ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
            {isPositive ? '↑' : '↓'} {change}
          </span>
        )}
      </div>
    </div>
  );
};

// Composant pour le graphique en barres
const BarChart: React.FC<{ 
  title: string;
  data: Record<string, number>;
  labels?: string[];
  height?: number;
}> = ({ 
  title, 
  data,
  labels,
  height = 200
}) => {
  const values = Object.values(data);
  const maxValue = Math.max(...values, 1); // Éviter la division par zéro
  
  return (
    <div className="p-4 rounded-lg bg-jdc-gray-800/70 border border-jdc-gray-700">
      <h3 className="text-lg font-medium text-white mb-4">{title}</h3>
      <div 
        className="w-full rounded-lg overflow-hidden relative flex items-end justify-around p-4"
        style={{ height: `${height}px` }}
      >
        {values.map((value, i) => (
          <div 
            key={i}
            className="w-[8%] bg-jdc-blue/80 rounded-t-sm shadow-lg"
            style={{ height: `${Math.max((value / maxValue) * 100, 5)}%` }}
            title={`${labels?.[i] || ''}: ${value}`}
          ></div>
        ))}
      </div>
      <div className="flex justify-between mt-4 text-xs text-jdc-gray-400">
        {labels && labels.map((label, i) => (
          <span key={i}>{label}</span>
        ))}
      </div>
    </div>
  );
};

// Composant pour le graphique en secteurs
const PieChart: React.FC<{
  title: string;
  data: Record<string, number>;
  height?: number;
}> = ({
  title,
  data,
  height = 250
}) => {
  // Calculer les pourcentages pour chaque secteur
  const total = Object.values(data).reduce((sum, value) => sum + value, 0) || 1;
  const entries = Object.entries(data);
  
  // Couleurs pour les secteurs
  const colors = ["#8b5cf6", "#3b82f6", "#22c55e", "#eab308"];
  
  return (
    <div className="p-4 rounded-lg bg-jdc-gray-800/70 border border-jdc-gray-700">
      <h3 className="text-lg font-medium text-white mb-4">{title}</h3>
      <div 
        className="w-full rounded-lg overflow-hidden relative flex justify-center items-center"
        style={{ height: `${height}px` }}
      >
        <div className="w-[150px] h-[150px] mx-auto rounded-full overflow-hidden relative">
          <div className="absolute inset-0" style={{ 
            background: entries.length > 0 
              ? `conic-gradient(${entries.map((entry, i) => {
                  const [key, value] = entry;
                  const percent = (value / total) * 100;
                  const color = colors[i % colors.length];
                  return `${color} 0% ${percent}%${i < entries.length - 1 ? ',' : ''}`;
                }).join(' ')})` 
              : '#3b82f6'
          }}></div>
          <div className="absolute inset-[30%] rounded-full bg-jdc-gray-800"></div>
        </div>
      </div>
      <div className="flex flex-col space-y-1 w-full mt-4">
        {entries.map(([key, value], i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[i % colors.length] }}></span>
            <span className="text-xs text-jdc-gray-400">{key} ({Math.round((value / total) * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export function StatsPanel() {
  const [timeRange, setTimeRange] = useState<"day" | "week" | "month" | "year">("month");
  const fetcher = useFetcher<StatsData>();
  const resetFetcher = useFetcher<ResetResponse>();
  
  // État pour stocker les données
  const [statsData, setStatsData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetInProgress, setResetInProgress] = useState(false);
  
  // Charger les données au montage et quand on change de plage de temps
  useEffect(() => {
    refreshStats();
  }, [timeRange]);
  
  const refreshStats = () => {
    setLoading(true);
    // Ajouter le paramètre dev_bypass en développement
    const devParam = import.meta.env.DEV ? "&dev_bypass=true" : "";
    fetcher.load(`/api/admin/stats?timeRange=${timeRange}${devParam}`);
  };

  const resetStats = () => {
    if (resetInProgress) return;
    
    setResetInProgress(true);
    // Ajouter le paramètre dev_bypass en développement
    const devParam = import.meta.env.DEV ? "?dev_bypass=true" : "";
    resetFetcher.submit({}, { 
      method: "post", 
      action: `/api/admin/stats/reset${devParam}`
    });
  };
  
  // Gérer le résultat du reset
  useEffect(() => {
    if (resetFetcher.state === "idle" && resetFetcher.data) {
      setResetInProgress(false);
      if (resetFetcher.data.success) {
        // Si réinitialisation réussie, rafraîchir les données
        refreshStats();
      }
    }
  }, [resetFetcher.state, resetFetcher.data]);
  
  // Mettre à jour l'état quand les données arrivent
  useEffect(() => {
    if (fetcher.data) {
      setStatsData(fetcher.data);
      setLoading(false);
    }
  }, [fetcher.data]);
  
  // Formatage des jours pour le graphique de transactions
  const formatDayLabels = (days: string[] = []) => {
    return days.map(day => {
      const date = new Date(day);
      return date.getDate().toString().padStart(2, '0') + '/' + 
             (date.getMonth() + 1).toString().padStart(2, '0');
    });
  };
  
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <h2 className="text-xl font-bold">Statistiques Blockchain</h2>
        
        <div className="flex items-center gap-4">
          <div className="flex rounded-lg overflow-hidden border border-jdc-gray-700">
            {(["day", "week", "month", "year"] as const).map((range) => (
              <button
                key={range}
                className={`px-3 py-1 text-sm ${
                  timeRange === range 
                    ? "bg-jdc-blue text-white" 
                    : "bg-jdc-gray-800 text-jdc-gray-300 hover:bg-jdc-gray-700"
                }`}
                onClick={() => setTimeRange(range)}
              >
                {range === "day" && "Jour"}
                {range === "week" && "Semaine"}
                {range === "month" && "Mois"}
                {range === "year" && "Année"}
              </button>
            ))}
          </div>
          
          <div className="flex gap-2">
            <Button onClick={refreshStats} disabled={loading}>
              {loading ? <FaSync className="animate-spin mr-2" /> : null}
              {loading ? "Chargement..." : "Rafraîchir"}
            </Button>
            
            <Button 
              onClick={resetStats} 
              disabled={resetInProgress || loading}
              variant="danger"
            >
              {resetInProgress ? <FaSync className="animate-spin mr-2" /> : null}
              {resetInProgress ? "Réinitialisation..." : "Réinitialiser"}
            </Button>
          </div>
        </div>
      </div>
      
      {fetcher.data?.error ? (
        <div className="p-4 rounded-lg bg-red-900/20 border border-red-800 text-white">
          <p className="font-bold mb-2">Erreur: {fetcher.data.error}</p>
          <p className="text-sm text-gray-300">Vous pouvez essayer de rafraîchir les données ou contacter l'administrateur système.</p>
          <Button 
            className="mt-3" 
            variant="secondary" 
            onClick={refreshStats}
          >
            Réessayer
          </Button>
        </div>
      ) : resetFetcher.data?.error ? (
        <div className="p-4 rounded-lg bg-red-900/20 border border-red-800 text-white mb-4">
          <p>Erreur lors de la réinitialisation: {resetFetcher.data.error}</p>
        </div>
      ) : null}
      
      {loading && !statsData ? (
        <div className="flex justify-center items-center h-64">
          <FaSync className="animate-spin text-jdc-blue text-4xl" />
        </div>
      ) : (
        <>
          {/* Cartes KPI */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard 
              title="Utilisateurs Actifs" 
              value={statsData?.userCount || 0} 
              icon={<FaUsers />} 
              change={statsData?.clientEvolution ? `${statsData.clientEvolution}%` : undefined} 
              isPositive={statsData?.clientEvolution ? statsData.clientEvolution > 0 : undefined}
              color="blue"
            />
            <StatCard 
              title="Transactions" 
              value={statsData?.transactionsByDay ? Object.values(statsData.transactionsByDay).reduce((sum, v) => sum + v, 0) : 0} 
              icon={<FaFileAlt />} 
              color="green"
            />
            <StatCard 
              title="Coût Moyen (Gas)" 
              value={statsData?.gasUsageAvg || 0} 
              icon={<FaEthereum />} 
              color="purple"
            />
            <StatCard 
              title="Temps de Confirmation" 
              value={`${statsData?.confirmationTimeAvg || 0}s`} 
              icon={<FaClock />} 
              color="yellow"
            />
          </div>
          
          {/* Graphiques */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {statsData?.transactionsByDay && (
              <BarChart 
                title="Transactions par jour" 
                data={statsData.transactionsByDay} 
                labels={formatDayLabels(Object.keys(statsData.transactionsByDay))}
              />
            )}
            
            {statsData?.ticketCounts && (
              <BarChart 
                title="Tickets par secteur" 
                data={statsData.ticketCounts}
                labels={Object.keys(statsData.ticketCounts)}
              />
            )}
          </div>
          
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {statsData?.eventTypes && Object.keys(statsData.eventTypes).length > 0 && (
              <PieChart 
                title="Types d'événements blockchain" 
                data={statsData.eventTypes} 
                height={250}
              />
            )}
            
            {statsData?.installations && (
              <div className="lg:col-span-2">
                <div className="p-4 rounded-lg bg-jdc-gray-800/70 border border-jdc-gray-700">
                  <h3 className="text-lg font-medium text-white mb-4">Installations par statut</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-jdc-gray-700">
                          <th className="py-2 text-left text-jdc-gray-400">Secteur</th>
                          <th className="py-2 text-right text-jdc-gray-400">Total</th>
                          <th className="py-2 text-right text-jdc-gray-400">En attente</th>
                          <th className="py-2 text-right text-jdc-gray-400">Planifiées</th>
                          <th className="py-2 text-right text-jdc-gray-400">Terminées</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(statsData?.installations || {}).map(([sector, data]) => (
                          <tr key={sector} className="border-b border-jdc-gray-800">
                            <td className="py-2 text-white">{sector}</td>
                            <td className="py-2 text-right text-jdc-gray-300">{data.total}</td>
                            <td className="py-2 text-right text-yellow-400">{data.enAttente}</td>
                            <td className="py-2 text-right text-blue-400">{data.planifiees}</td>
                            <td className="py-2 text-right text-green-400">{data.terminees}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
      
      <div className="mt-4 p-4 rounded-lg bg-jdc-blue/10 border border-jdc-blue/30">
        <h3 className="text-lg font-semibold mb-2">À propos des statistiques</h3>
        <p className="text-sm text-jdc-gray-300">
          Les données présentées sont générées à partir des événements et transactions sur la blockchain privée Besu. 
          Ces statistiques aident à surveiller la santé et l'utilisation de la plateforme blockchain JDC.
          Pour un rapport détaillé, utilisez le bouton "Exporter" ci-dessous.
        </p>
        <div className="mt-4 flex gap-2">
          <Button variant="outline">Exporter les données</Button>
          <Button 
            variant="secondary" 
            onClick={() => window.open('/admin/test-blockchain', '_blank')}
          >
            Tester la connexion blockchain
          </Button>
        </div>
      </div>
    </div>
  );
} 