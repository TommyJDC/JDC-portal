import React, { useState, useEffect } from "react";
import { useFetcher } from "@remix-run/react";
import { Button } from "./ui/Button";
import { FaCopy, FaExternalLinkAlt, FaCheck, FaExclamationTriangle, FaSync, FaCode, FaListUl } from "react-icons/fa";

interface ContractInfo {
  name: string;
  address: string;
  status: "ok" | "warning" | "error";
  message: string;
  lastTransaction?: string;
  deployDate?: string;
  abi?: any[];
  functions?: string[];
  events?: string[];
}

export function ContractPanel() {
  const [contracts, setContracts] = useState<Record<string, ContractInfo>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedContract, setSelectedContract] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<"functions" | "events" | null>(null);
  
  // Fetcher pour récupérer les données des contrats
  const contractsFetcher = useFetcher<{contracts: Record<string, ContractInfo>, error?: string}>();
  
  // Charger les données au premier rendu
  useEffect(() => {
    fetchContractsData();
  }, []);
  
  // Fonction pour charger les données des contrats
  const fetchContractsData = () => {
    setLoading(true);
    // Ajouter le paramètre dev_bypass en développement
    const devParam = import.meta.env.DEV ? "?dev_bypass=true" : "";
    contractsFetcher.load(`/api/admin/contracts${devParam}`);
  };
  
  // Mettre à jour les contrats quand la requête est terminée
  useEffect(() => {
    if (contractsFetcher.data) {
      setContracts(contractsFetcher.data.contracts || {});
      setLoading(false);
    }
  }, [contractsFetcher.data]);

  // Copier l'adresse d'un contrat
  const handleCopyAddress = (contractName: string, address: string) => {
    navigator.clipboard.writeText(address);
    setCopied(contractName);
    setTimeout(() => setCopied(null), 2000);
  };

  // Sélectionner un contrat pour voir plus de détails
  const handleContractSelect = (contract: string) => {
    if (selectedContract === contract) {
      // Si on clique sur le même contrat, on ferme le détail
      setSelectedContract(null);
      setDisplayMode(null);
    } else {
      // Sinon on ouvre le détail du contrat
      setSelectedContract(contract);
      setDisplayMode(null); // Réinitialiser le mode d'affichage
    }
  };
  
  // Changer le mode d'affichage (fonctions ou événements)
  const toggleDisplayMode = (mode: "functions" | "events", event: React.MouseEvent) => {
    event.stopPropagation();
    setDisplayMode(displayMode === mode ? null : mode);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Gestion des Smart Contracts</h2>
        <Button 
          onClick={fetchContractsData} 
          variant="outline" 
          disabled={loading}
        >
          {loading ? <FaSync className="mr-2 animate-spin" /> : null}
          {loading ? "Chargement..." : "Rafraîchir"}
        </Button>
      </div>

      {/* Message d'erreur */}
      {contractsFetcher.data?.error && (
        <div className="p-4 rounded-lg bg-red-900/20 border border-red-800 text-white mb-4">
          <p className="font-bold">Erreur:</p>
          <p>{contractsFetcher.data.error}</p>
          <Button onClick={fetchContractsData} className="mt-2" variant="secondary" size="sm">
            Réessayer
          </Button>
        </div>
      )}

      {loading && Object.keys(contracts).length === 0 ? (
        <div className="flex justify-center items-center h-40">
          <FaSync className="text-jdc-gray-400 animate-spin text-2xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {Object.entries(contracts).map(([name, contract]) => (
            <div 
              key={name}
              className={`p-4 rounded-lg ${
                contract.status === "ok" ? "bg-jdc-gray-800/70 border border-jdc-gray-700" : 
                contract.status === "warning" ? "bg-yellow-900/30 border border-yellow-700/50" :
                "bg-red-900/30 border border-red-700/50"
              } hover:border-jdc-blue/50 transition-all cursor-pointer`}
              onClick={() => handleContractSelect(name)}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  {name}
                  {contract.status === "ok" && <FaCheck className="text-green-500" />}
                  {contract.status === "warning" && <FaExclamationTriangle className="text-yellow-500" />}
                  {contract.status === "error" && <FaExclamationTriangle className="text-red-500" />}
                </h3>
                <div className="flex gap-2">
                  <button 
                    className="text-jdc-gray-400 hover:text-jdc-blue transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyAddress(name, contract.address);
                    }}
                    title="Copier l'adresse"
                  >
                    {copied === name ? <FaCheck className="text-green-500" /> : <FaCopy />}
                  </button>
                  <a 
                    href={`https://explorer.besu.example.com/address/${contract.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-jdc-gray-400 hover:text-jdc-blue transition-colors"
                    onClick={(e) => e.stopPropagation()}
                    title="Voir dans l'explorateur Besu"
                  >
                    <FaExternalLinkAlt />
                  </a>
                </div>
              </div>
              
              <div className="font-mono text-sm text-jdc-gray-400 truncate mb-2" title={contract.address}>
                {contract.address.substring(0, 18)}...{contract.address.substring(contract.address.length - 4)}
              </div>
              
              <div className={`text-xs mt-2 ${
                contract.status === "ok" ? "text-green-500" : 
                contract.status === "warning" ? "text-yellow-500" : "text-red-500"
              }`}>
                {contract.message}
              </div>
              
              {selectedContract === name && (
                <div className="mt-4 pt-4 border-t border-jdc-gray-700">
                  <div className="flex justify-between mb-3">
                    <Button 
                      size="sm" 
                      variant={displayMode === "functions" ? "primary" : "outline"}
                      onClick={(e) => toggleDisplayMode("functions", e)}
                      className="flex items-center gap-1"
                    >
                      <FaCode size={12} /> Fonctions ({contract.functions?.length || 0})
                    </Button>
                    <Button 
                      size="sm" 
                      variant={displayMode === "events" ? "primary" : "outline"}
                      onClick={(e) => toggleDisplayMode("events", e)}
                      className="flex items-center gap-1"
                    >
                      <FaListUl size={12} /> Événements ({contract.events?.length || 0})
                    </Button>
                  </div>
                  
                  {displayMode === "functions" && contract.functions && contract.functions.length > 0 && (
                    <div className="max-h-[200px] overflow-y-auto p-2 bg-jdc-gray-900/70 rounded border border-jdc-gray-800">
                      <ul className="text-xs font-mono">
                        {contract.functions.map((fn, i) => (
                          <li key={i} className="py-1 px-2 hover:bg-jdc-gray-800 rounded">
                            {fn}()
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {displayMode === "events" && contract.events && contract.events.length > 0 && (
                    <div className="max-h-[200px] overflow-y-auto p-2 bg-jdc-gray-900/70 rounded border border-jdc-gray-800">
                      <ul className="text-xs font-mono">
                        {contract.events.map((event, i) => (
                          <li key={i} className="py-1 px-2 hover:bg-jdc-gray-800 rounded">
                            event {event}()
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {(displayMode === "functions" && (!contract.functions || contract.functions.length === 0)) && (
                    <div className="text-center text-jdc-gray-500 text-sm py-2">
                      Aucune fonction trouvée
                    </div>
                  )}
                  
                  {(displayMode === "events" && (!contract.events || contract.events.length === 0)) && (
                    <div className="text-center text-jdc-gray-500 text-sm py-2">
                      Aucun événement trouvé
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      <div className="mt-8 p-4 rounded-lg bg-jdc-blue/10 border border-jdc-blue/30">
        <h3 className="text-lg font-semibold mb-2">Administration des contrats</h3>
        <p className="text-sm text-jdc-gray-300 mb-4">
          Ce panneau permet de gérer les interactions avec les smart contracts déployés sur la blockchain privée Besu. 
          Les administrateurs peuvent vérifier l'état des contrats, appeler des fonctions et surveillez les événements.
        </p>
        
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
          <Button variant="primary" disabled>Mettre à jour un contrat</Button>
          <Button variant="primary" disabled>Déployer un nouveau contrat</Button>
          <Button variant="secondary" disabled>Vérifier la cohérence</Button>
          <Button 
            variant="outline" 
            onClick={() => window.open('/admin/test-blockchain', '_blank')}
          >
            Test de connexion
          </Button>
        </div>
      </div>
    </div>
  );
} 