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
        <h2 className="text-xl font-bold">Logs & Alertes</h2>
        
        <div className="flex items-center gap-2">
          <Button 
            onClick={refreshLogs} 
            disabled={loading}
            variant="primary"
          >
            {loading ? <FaSync className="mr-2 animate-spin" /> : null}
            {loading ? "Chargement..." : "Rafraîchir"}
          </Button>
          <Button 
            onClick={downloadLogs} 
            disabled={logs.length === 0}
            variant="secondary"
          >
            <FaDownload className="mr-2" /> Exporter
          </Button>
          <Button 
            onClick={clearLogs} 
            disabled={logs.length === 0}
            variant="danger"
          >
            <FaTrash className="mr-2" /> Effacer
          </Button>
        </div>
      </div>
      
      <div className="flex flex-wrap items-center gap-4 p-4 bg-jdc-gray-800/70 rounded-lg border border-jdc-gray-700">
        {/* Filtres de niveau */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-jdc-gray-400 mr-2">Niveau:</span>
          <button
            className={`p-2 rounded-full ${levelFilters.includes("error") ? "bg-red-500/20" : "bg-jdc-gray-700 opacity-50"}`}
            onClick={() => toggleLevelFilter("error")}
            title="Erreurs"
          >
            <FaExclamationTriangle className="text-red-500" />
          </button>
          <button
            className={`p-2 rounded-full ${levelFilters.includes("warning") ? "bg-yellow-500/20" : "bg-jdc-gray-700 opacity-50"}`}
            onClick={() => toggleLevelFilter("warning")}
            title="Avertissements"
          >
            <FaExclamationTriangle className="text-yellow-500" />
          </button>
          <button
            className={`p-2 rounded-full ${levelFilters.includes("info") ? "bg-blue-500/20" : "bg-jdc-gray-700 opacity-50"}`}
            onClick={() => toggleLevelFilter("info")}
            title="Informations"
          >
            <FaInfoCircle className="text-blue-500" />
          </button>
          <button
            className={`p-2 rounded-full ${levelFilters.includes("success") ? "bg-green-500/20" : "bg-jdc-gray-700 opacity-50"}`}
            onClick={() => toggleLevelFilter("success")}
            title="Succès"
          >
            <FaCheck className="text-green-500" />
          </button>
        </div>
        
        {/* Filtre de source */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-jdc-gray-400">Source:</span>
          <select
            className="bg-jdc-gray-900 text-jdc-gray-300 border border-jdc-gray-700 rounded px-2 py-1 text-sm"
            value={selectedSource || ""}
            onChange={e => setSelectedSource(e.target.value || null)}
          >
            <option value="">Toutes les sources</option>
            {uniqueSources.map(source => (
              <option key={source} value={source}>{source}</option>
            ))}
          </select>
        </div>
        
        {/* Nombre de blocs à scanner */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-jdc-gray-400">Blocs:</span>
          <select
            className="bg-jdc-gray-900 text-jdc-gray-300 border border-jdc-gray-700 rounded px-2 py-1 text-sm"
            value={blocksToScan}
            onChange={e => setBlocksToScan(Number(e.target.value))}
          >
            <option value="100">100 derniers</option>
            <option value="500">500 derniers</option>
            <option value="1000">1000 derniers</option>
            <option value="5000">5000 derniers</option>
          </select>
        </div>
        
        {/* Barre de recherche */}
        <div className="flex items-center gap-2 ml-auto">
          <FaSearch className="text-jdc-gray-400" />
          <input
            type="text"
            placeholder="Rechercher dans les logs..."
            className="bg-jdc-gray-900 text-jdc-gray-300 border border-jdc-gray-700 rounded px-2 py-1 text-sm"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      
      {/* Message d'erreur */}
      {logsFetcher.data?.error && (
        <div className="p-4 rounded-lg bg-red-900/20 border border-red-800 text-white">
          <p className="font-semibold">Erreur:</p>
          <p>{logsFetcher.data.error}</p>
          <Button onClick={refreshLogs} className="mt-2" variant="secondary" size="sm">
            Réessayer
          </Button>
        </div>
      )}
      
      {/* Liste des logs */}
      <div className="space-y-2 mt-4 max-h-[600px] overflow-y-auto pr-2">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <FaSync className="text-jdc-blue text-2xl animate-spin" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-8 text-jdc-gray-400">
            <FaBug className="mx-auto text-4xl mb-2 opacity-30" />
            <p>Aucun log ne correspond à vos critères</p>
          </div>
        ) : (
          filteredLogs.map((log, index) => (
            <div 
              key={index}
              className={`p-3 rounded-lg border ${
                log.level === "error" ? "bg-red-950/20 border-red-800/30" :
                log.level === "warning" ? "bg-yellow-950/20 border-yellow-800/30" :
                log.level === "success" ? "bg-green-950/20 border-green-800/30" :
                "bg-jdc-gray-800/70 border-jdc-gray-700"
              } hover:border-jdc-gray-500 transition-colors cursor-pointer`}
              onClick={() => setExpandedLog(expandedLog === index ? null : index)}
            >
              <div className="flex items-start gap-3">
                <div className="pt-1">
                  <LogLevelIcon level={log.level} />
                </div>
                <div className="flex-grow">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-jdc-gray-400">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-jdc-gray-700">
                        {log.source}
                      </span>
                    </div>
                    
                    {log.transactionHash && (
                      <button 
                        className="text-xs px-2 py-0.5 rounded-full bg-jdc-blue/20 text-jdc-blue flex items-center gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          viewTransaction(log.transactionHash || '');
                        }}
                        title="Voir dans l'explorateur blockchain"
                      >
                        <FaLink size={10} />
                        Transaction
                      </button>
                    )}
                  </div>
                  <p className="text-jdc-gray-100">{log.message}</p>
                  
                  {/* Détails du log */}
                  {expandedLog === index && (
                    <div className="mt-2 pt-2 border-t border-jdc-gray-700 text-sm text-jdc-gray-400 font-mono">
                      {log.details && (
                        <div className="mb-2">{log.details}</div>
                      )}
                      {log.blockNumber && (
                        <div className="text-xs text-jdc-gray-500">
                          Bloc: {log.blockNumber}
                        </div>
                      )}
                      {log.transactionHash && (
                        <div className="text-xs text-jdc-gray-500 truncate">
                          TxHash: {log.transactionHash}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      <div className="mt-4 p-4 rounded-lg bg-jdc-blue/10 border border-jdc-blue/30">
        <h3 className="text-lg font-semibold mb-2">Alertes Système</h3>
        <p className="text-sm text-jdc-gray-300 mb-4">
          Cette section affiche les logs système et les alertes de la blockchain. Vous pouvez filtrer par type, 
          source ou rechercher des termes spécifiques. Cliquez sur une entrée pour voir les détails.
        </p>
        
        <div className="flex justify-between items-center">
          <span className="text-xs text-jdc-gray-400">
            {filteredLogs.length} entrées sur {logs.length} au total
          </span>
          <Button variant="outline" size="sm" onClick={refreshLogs}>
            Actualiser les données
          </Button>
        </div>
      </div>
    </div>
  );
} 