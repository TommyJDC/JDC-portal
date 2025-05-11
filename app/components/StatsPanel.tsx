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
  color?: string; // Ex: 'brand-blue', 'green', 'purple', 'yellow', 'red'
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, change, isPositive, color = "brand-blue" }) => {
  // Map de couleurs sémantiques vers des classes Tailwind
  // Assurez-vous que ces couleurs (ex: text-brand-blue, bg-brand-blue/10) sont définies dans votre tailwind.config.ts
  const colorConfig: Record<string, { bg: string; border: string; textIcon: string }> = {
    'brand-blue': { bg: 'bg-brand-blue/10', border: 'border-brand-blue/30', textIcon: 'text-brand-blue' },
    green: { bg: 'bg-green-500/10', border: 'border-green-500/30', textIcon: 'text-green-500' },
    purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', textIcon: 'text-purple-500' },
    yellow: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', textIcon: 'text-yellow-500' },
    red: { bg: 'bg-red-500/10', border: 'border-red-500/30', textIcon: 'text-red-500' },
    default: { bg: 'bg-ui-border/20', border: 'border-ui-border/30', textIcon: 'text-text-secondary' },
  };
  const currentColors = colorConfig[color] || colorConfig.default;

  return (
    <div className={`p-4 rounded-lg border ${currentColors.bg} ${currentColors.border} backdrop-blur-sm`}>
      <div className="flex justify-between items-start mb-1"> {/* items-start pour aligner l'icône avec le titre */}
        <h3 className="text-sm font-medium text-text-secondary">{title}</h3>
        <div className={`p-1.5 rounded-full ${currentColors.bg}`}> {/* Icone plus petite et fond assorti */}
          <span className={`${currentColors.textIcon} h-5 w-5 block`}>{icon}</span>
        </div>
      </div>
      <div className="flex items-baseline gap-2"> {/* baseline pour aligner texte et flèche */}
        <p className="text-2xl font-semibold text-text-primary">{value}</p>
        {change && (
          <span className={`text-xs font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
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
  const chartColors = ['bg-brand-blue', 'bg-green-500', 'bg-purple-500', 'bg-yellow-500', 'bg-red-500', 'bg-sky-500'];

  return (
    <div className="p-4 rounded-lg bg-ui-background/50 border border-ui-border">
      <h3 className="text-md font-semibold text-text-primary mb-3">{title}</h3>
      <div 
        className="w-full rounded-md overflow-hidden relative flex items-end justify-around p-2" // p-2 pour un peu d'espace
        style={{ height: `${height}px` }}
      >
        {values.map((value, i) => (
          <div 
            key={i}
            className={`w-[10%] ${chartColors[i % chartColors.length]} rounded-t-sm shadow-sm hover:opacity-80 transition-opacity`}
            style={{ height: `${Math.max((value / maxValue) * 100, 5)}%` }} // min 5% height
            title={`${labels?.[i] || `Data ${i+1}`}: ${value}`}
          ></div>
        ))}
      </div>
      {labels && labels.length > 0 && (
        <div className="flex justify-between mt-2 text-xs text-text-secondary px-1">
          {labels.map((label, i) => (
            <span key={i} className="truncate w-1/${labels.length} text-center">{label}</span>
          ))}
        </div>
      )}
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
  const total = Object.values(data).reduce((sum, value) => sum + value, 0) || 1;
  const entries = Object.entries(data);
  const chartColors = ['#3B82F6', '#10B981', '#A855F7', '#F59E0B', '#EF4444', '#0EA5E9']; // brand-blue, green, purple, yellow, red, sky

  return (
    <div className="p-4 rounded-lg bg-ui-background/50 border border-ui-border">
      <h3 className="text-md font-semibold text-text-primary mb-3">{title}</h3>
      <div 
        className="w-full flex justify-center items-center"
        style={{ height: `${height - 80}px` }} // Ajuster la hauteur pour la légende
      >
        <div className="w-[120px] h-[120px] sm:w-[140px] sm:h-[140px] rounded-full relative"> {/* Taille du pie chart */}
          {entries.length > 0 ? (
            <div className="absolute inset-0 rounded-full" style={{ 
              background: `conic-gradient(${entries.map((entry, i) => {
                  const [, value] = entry;
                  const percent = (value / total) * 100;
                  const color = chartColors[i % chartColors.length];
                  return `${color} 0% ${percent}%${i < entries.length - 1 ? ',' : ''}`;
                }).join(' ')})` 
            }}></div>
          ) : (
            <div className="absolute inset-0 rounded-full bg-ui-border"></div> // Fond si pas de données
          )}
          <div className="absolute inset-[33%] rounded-full bg-ui-background/80 backdrop-blur-sm"></div> {/* Trou central */}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 w-full mt-4 text-xs">
        {entries.map(([key, value], i) => (
          <div key={i} className="flex items-center gap-1.5 truncate">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: chartColors[i % chartColors.length] }}></span>
            <span className="text-text-secondary truncate" title={key}>{key}:</span>
            <span className="text-text-primary font-medium">{Math.round((value / total) * 100)}%</span>
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
        <h2 className="text-lg font-semibold text-text-primary">Statistiques Blockchain</h2>
        
        <div className="flex items-center gap-3">
          <div className="flex rounded-md overflow-hidden border border-ui-border">
            {(["day", "week", "month", "year"] as const).map((range) => (
              <button
                key={range}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  timeRange === range 
                    ? "bg-brand-blue text-white" 
                    : "bg-ui-background hover:bg-ui-border text-text-secondary"
                } ${range !== "year" ? "border-r border-ui-border" : ""}`}
                onClick={() => setTimeRange(range)}
              >
                {range === "day" && "Jour"}
                {range === "week" && "Sem."}
                {range === "month" && "Mois"}
                {range === "year" && "Année"}
              </button>
            ))}
          </div>
          
          <div className="flex gap-2">
            <Button onClick={refreshStats} disabled={loading} variant="outline" size="sm" className="border-ui-border text-text-secondary hover:bg-ui-border hover:text-text-primary">
              {loading && <FaSync className="animate-spin mr-2 h-3.5 w-3.5" />}
              {loading ? "Chargement..." : "Rafraîchir"}
            </Button>
            
            <Button 
              onClick={resetStats} 
              disabled={resetInProgress || loading}
              variant="danger"
              size="sm"
            >
              {resetInProgress && <FaSync className="animate-spin mr-2 h-3.5 w-3.5" />}
              {resetInProgress ? "Réinit..." : "Réinitialiser"}
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
                <div className="p-4 rounded-lg bg-ui-background/50 border border-ui-border">
                  <h3 className="text-md font-semibold text-text-primary mb-3">Installations par statut</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="text-text-secondary">
                        <tr className="border-b border-ui-border">
                          <th className="py-2 px-3 text-left font-medium">Secteur</th>
                          <th className="py-2 px-3 text-right font-medium">Total</th>
                          <th className="py-2 px-3 text-right font-medium">En attente</th>
                          <th className="py-2 px-3 text-right font-medium">Planifiées</th>
                          <th className="py-2 px-3 text-right font-medium">Terminées</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ui-border/50">
                        {Object.entries(statsData?.installations || {}).map(([sector, data]) => (
                          <tr key={sector} className="hover:bg-ui-background/30">
                            <td className="py-2 px-3 text-text-primary font-medium">{sector}</td>
                            <td className="py-2 px-3 text-right text-text-secondary">{data.total}</td>
                            <td className="py-2 px-3 text-right text-yellow-400">{data.enAttente}</td>
                            <td className="py-2 px-3 text-right text-blue-400">{data.planifiees}</td>
                            <td className="py-2 px-3 text-right text-green-400">{data.terminees}</td>
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
      
      <div className="mt-4 p-4 rounded-lg bg-ui-background/50 border border-ui-border">
        <h3 className="text-md font-semibold text-text-primary mb-2">À propos des statistiques</h3>
        <p className="text-sm text-text-secondary">
          Les données présentées sont générées à partir des événements et transactions sur la blockchain privée Besu. 
          Ces statistiques aident à surveiller la santé et l'utilisation de la plateforme blockchain JDC.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="border-ui-border text-text-secondary hover:bg-ui-border hover:text-text-primary">Exporter les données</Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => window.open('/admin/test-blockchain', '_blank')}
            className="border-ui-border text-text-secondary hover:bg-ui-border hover:text-text-primary"
          >
            Tester la connexion blockchain
          </Button>
        </div>
      </div>
    </div>
  );
}
