import React, { useState, useEffect } from "react";
import { useFetcher } from "@remix-run/react";
import { Button } from "./ui/Button";
import { FaExclamationTriangle, FaInfoCircle, FaCheck, FaBug, FaDownload, FaFilter, FaSearch, FaTrash, FaSync, FaLink } from "react-icons/fa";

// Types pour les logs
type LogLevel = "info" | "warning" | "error" | "success";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  source: string;
  details?: string;
  transactionHash?: string;
  blockNumber?: number;
  raw?: any;
}

export function LogsPanel() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Fetcher pour récupérer les logs blockchain
  const logsFetcher = useFetcher<{ logs: LogEntry[], error?: string }>();
  
  // Filtres
  const [levelFilters, setLevelFilters] = useState<LogLevel[]>(["error", "warning", "info", "success"]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [blocksToScan, setBlocksToScan] = useState<number>(500);
  
  // Charger les logs au premier rendu
  useEffect(() => {
    refreshLogs();
  }, []);
  
  // Récupérer les logs depuis l'API
  const refreshLogs = () => {
    setLoading(true);
    
    // Ajouter le paramètre dev_bypass en développement
    const devParam = import.meta.env.DEV ? "&dev_bypass=true" : "";
    logsFetcher.load(`/api/admin/logs?blocks=${blocksToScan}${devParam}`);
  };
  
  // Mettre à jour les logs quand la requête est terminée
  useEffect(() => {
    if (logsFetcher.data) {
      const fetchedLogs = logsFetcher.data.logs || [];
      setLogs(fetchedLogs);
      setLoading(false);
    }
  }, [logsFetcher.data]);
  
  // Sources uniques pour le filtre (à partir des données réelles)
  const uniqueSources = Array.from(new Set(logs.map(log => log.source)));
  
  // Appliquer les filtres
  useEffect(() => {
    let filtered = logs;
    
    // Filtre par niveau
    filtered = filtered.filter(log => levelFilters.includes(log.level));
    
    // Filtre par source
    if (selectedSource) {
      filtered = filtered.filter(log => log.source === selectedSource);
    }
    
    // Filtre par terme de recherche
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(term) || 
        log.details?.toLowerCase().includes(term) ||
        log.source.toLowerCase().includes(term)
      );
    }
    
    setFilteredLogs(filtered);
  }, [logs, levelFilters, selectedSource, searchTerm]);
  
  const toggleLevelFilter = (level: LogLevel) => {
    if (levelFilters.includes(level)) {
      setLevelFilters(levelFilters.filter(l => l !== level));
    } else {
      setLevelFilters([...levelFilters, level]);
    }
  };
  
  const clearLogs = () => {
    if (confirm("Êtes-vous sûr de vouloir effacer tous les logs affichés ?")) {
      setLogs([]);
      setFilteredLogs([]);
    }
  };
  
  const downloadLogs = () => {
    // Convertit les logs en texte formaté
    const logText = logs.map(log => 
      `[${new Date(log.timestamp).toLocaleString()}] [${log.level.toUpperCase()}] [${log.source}] ${log.message}${log.details ? `\nDetails: ${log.details}` : ''}${log.transactionHash ? `\nTransaction: ${log.transactionHash}` : ''}${log.blockNumber ? `\nBloc: ${log.blockNumber}` : ''}`
    ).join('\n\n');
    
    // Créer un blob et un lien de téléchargement
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `blockchain-logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  // Ouvrir la transaction dans un explorateur de blockchain
  const viewTransaction = (txHash: string) => {
    // Adapter selon votre explorateur de blockchain
    const explorerUrl = `https://explorer.besu.example.com/tx/${txHash}`;
    window.open(explorerUrl, '_blank');
  };
  
  const LogLevelIcon = ({ level }: { level: LogLevel }) => {
    switch (level) {
      case "error":
        return <FaExclamationTriangle className="text-red-500" />;
      case "warning":
        return <FaExclamationTriangle className="text-yellow-500" />;
      case "info":
        return <FaInfoCircle className="text-blue-500" />;
      case "success":
        return <FaCheck className="text-green-500" />;
      default:
        return null;
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <h2 className="text-lg font-semibold text-text-primary">Logs & Alertes Blockchain</h2>
        
        <div className="flex items-center gap-2">
          <Button 
            onClick={refreshLogs} 
            disabled={loading}
            variant="primary"
            size="sm"
            className="bg-brand-blue hover:bg-brand-blue-dark text-white"
          >
            {loading && <FaSync className="mr-2 h-3.5 w-3.5 animate-spin" />}
            {loading ? "Chargement..." : "Rafraîchir"}
          </Button>
          <Button 
            onClick={downloadLogs} 
            disabled={logs.length === 0}
            variant="outline"
            size="sm"
            className="border-ui-border text-text-secondary hover:bg-ui-border hover:text-text-primary"
          >
            <FaDownload className="mr-1.5 h-3.5 w-3.5" /> Exporter
          </Button>
          <Button 
            onClick={clearLogs} 
            disabled={logs.length === 0}
            variant="danger"
            size="sm"
          >
            <FaTrash className="mr-1.5 h-3.5 w-3.5" /> Effacer
          </Button>
        </div>
      </div>
      
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-3 bg-ui-background/50 backdrop-blur-md rounded-lg border border-ui-border">
        {/* Filtres de niveau */}
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-text-secondary mr-1.5">Niveau:</span>
          <button
            className={`p-1.5 rounded-full transition-colors ${levelFilters.includes("error") ? "bg-red-500/20 hover:bg-red-500/30" : "bg-ui-background hover:bg-ui-border opacity-60 hover:opacity-100"}`}
            onClick={() => toggleLevelFilter("error")}
            title="Erreurs"
          >
            <FaExclamationTriangle className="text-red-500 h-4 w-4" />
          </button>
          <button
            className={`p-1.5 rounded-full transition-colors ${levelFilters.includes("warning") ? "bg-yellow-500/20 hover:bg-yellow-500/30" : "bg-ui-background hover:bg-ui-border opacity-60 hover:opacity-100"}`}
            onClick={() => toggleLevelFilter("warning")}
            title="Avertissements"
          >
            <FaExclamationTriangle className="text-yellow-500 h-4 w-4" />
          </button>
          <button
            className={`p-1.5 rounded-full transition-colors ${levelFilters.includes("info") ? "bg-blue-500/20 hover:bg-blue-500/30" : "bg-ui-background hover:bg-ui-border opacity-60 hover:opacity-100"}`}
            onClick={() => toggleLevelFilter("info")}
            title="Informations"
          >
            <FaInfoCircle className="text-blue-500 h-4 w-4" />
          </button>
          <button
            className={`p-1.5 rounded-full transition-colors ${levelFilters.includes("success") ? "bg-green-500/20 hover:bg-green-500/30" : "bg-ui-background hover:bg-ui-border opacity-60 hover:opacity-100"}`}
            onClick={() => toggleLevelFilter("success")}
            title="Succès"
          >
            <FaCheck className="text-green-500 h-4 w-4" />
          </button>
        </div>
        
        {/* Filtre de source */}
        <div className="flex items-center gap-1.5">
          <label htmlFor="logSourceFilter" className="text-xs font-medium text-text-secondary">Source:</label>
          <select
            id="logSourceFilter"
            className="rounded-md bg-ui-background border-ui-border text-text-primary focus:border-brand-blue focus:ring-1 focus:ring-brand-blue py-1 px-2 text-xs shadow-sm"
            value={selectedSource || ""}
            onChange={e => setSelectedSource(e.target.value || null)}
          >
            <option value="">Toutes</option>
            {uniqueSources.map(source => (
              <option key={source} value={source}>{source}</option>
            ))}
          </select>
        </div>
        
        {/* Nombre de blocs à scanner */}
        <div className="flex items-center gap-1.5">
          <label htmlFor="logBlocksFilter" className="text-xs font-medium text-text-secondary">Blocs:</label>
          <select
            id="logBlocksFilter"
            className="rounded-md bg-ui-background border-ui-border text-text-primary focus:border-brand-blue focus:ring-1 focus:ring-brand-blue py-1 px-2 text-xs shadow-sm"
            value={blocksToScan}
            onChange={e => setBlocksToScan(Number(e.target.value))}
          >
            <option value="100">100</option>
            <option value="500">500</option>
            <option value="1000">1000</option>
            <option value="5000">5000</option>
          </select>
        </div>
        
        {/* Barre de recherche */}
        <div className="flex items-center gap-2 ml-auto relative"> {/* Ajout de relative pour positionner l'icône */}
          <FaSearch className="text-text-tertiary absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5" />
          <input
            type="text"
            placeholder="Rechercher..."
            className="w-full sm:w-auto rounded-md bg-ui-background border-ui-border text-text-primary focus:border-brand-blue focus:ring-1 focus:ring-brand-blue py-1 pl-7 pr-2 text-xs shadow-sm" // pl-7 pour l'icône
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      
      {/* Message d'erreur */}
      {logsFetcher.data?.error && (
        <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-300">
          <p className="font-semibold text-sm">Erreur de chargement des logs:</p>
          <p className="text-xs">{logsFetcher.data.error}</p>
          <Button onClick={refreshLogs} className="mt-2 border-red-500/50 text-red-300 hover:bg-red-500/20" variant="outline" size="sm">
            Réessayer
          </Button>
        </div>
      )}
      
      {/* Liste des logs */}
      <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1"> {/* pr-1 pour la scrollbar */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <FaSync className="text-brand-blue text-3xl animate-spin" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-10 text-text-secondary">
            <FaBug className="mx-auto text-4xl mb-3 opacity-40" />
            <p>Aucun log ne correspond à vos critères.</p>
          </div>
        ) : (
          filteredLogs.map((log, index) => (
            <div 
              key={index}
              className={`p-2.5 rounded-md border transition-colors cursor-pointer ${
                log.level === "error" ? "bg-red-500/10 border-red-500/30 hover:border-red-500/50" :
                log.level === "warning" ? "bg-yellow-500/10 border-yellow-500/30 hover:border-yellow-500/50" :
                log.level === "success" ? "bg-green-500/10 border-green-500/30 hover:border-green-500/50" :
                "bg-ui-background/50 border-ui-border hover:border-ui-border-hover"
              }`}
              onClick={() => setExpandedLog(expandedLog === index ? null : index)}
            >
              <div className="flex items-start gap-2.5">
                <div className="pt-0.5"> {/* Ajustement pour alignement icône */}
                  <LogLevelIcon level={log.level} />
                </div>
                <div className="flex-grow min-w-0"> {/* min-w-0 pour le truncate */}
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 mb-0.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-xs text-text-tertiary">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                      <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-ui-background border border-ui-border text-text-secondary">
                        {log.source}
                      </span>
                    </div>
                    
                    {log.transactionHash && (
                      <Button 
                        variant="link"
                        size="sm" // Les boutons link n'ont pas vraiment de taille, mais pour la cohérence
                        className="text-xs text-brand-blue-light hover:underline p-0 h-auto"
                        onClick={(e) => { e.stopPropagation(); viewTransaction(log.transactionHash || ''); }}
                        title="Voir dans l'explorateur blockchain"
                      >
                        <FaLink size={10} className="mr-1" />
                        Transaction
                      </Button>
                    )}
                  </div>
                  <p className={`text-sm ${log.level === "error" ? "text-red-300" : log.level === "warning" ? "text-yellow-300" : "text-text-primary"}`}>
                    {log.message}
                  </p>
                  
                  {expandedLog === index && (
                    <div className="mt-1.5 pt-1.5 border-t border-ui-border/50 text-xs text-text-secondary font-mono space-y-0.5">
                      {log.details && (
                        <div className="whitespace-pre-wrap break-all">{log.details}</div>
                      )}
                      {log.blockNumber && (
                        <div className="text-text-tertiary">Bloc: {log.blockNumber}</div>
                      )}
                      {log.transactionHash && (
                        <div className="text-text-tertiary truncate">TxHash: {log.transactionHash}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      <div className="mt-6 p-4 rounded-lg bg-ui-background/50 border border-ui-border">
        <h3 className="text-md font-semibold text-text-primary mb-1.5">Informations Logs</h3>
        <p className="text-xs text-text-secondary mb-3">
          Cette section affiche les logs système et les alertes de la blockchain. Vous pouvez filtrer par type, 
          source ou rechercher des termes spécifiques. Cliquez sur une entrée pour voir les détails.
        </p>
        
        <div className="flex justify-between items-center">
          <span className="text-xs text-text-tertiary">
            {filteredLogs.length} entrées sur {logs.length} au total.
          </span>
          <Button variant="outline" size="sm" onClick={refreshLogs} className="border-ui-border text-text-secondary hover:bg-ui-border hover:text-text-primary">
            Actualiser
          </Button>
        </div>
      </div>
    </div>
  );
}
