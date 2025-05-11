import React, { useState, useEffect } from "react";
import { useFetcher } from "@remix-run/react";
import type { TransactionEvent } from "~/services/blockchain.service.server";
import { Button } from "./ui/Button"; // Assurez-vous que le chemin est correct

interface TransactionPanelProps {
  transactions: TransactionEvent[];
}

export function TransactionPanel({ transactions: initialTransactions }: TransactionPanelProps) {
  const fetcher = useFetcher< { transactions: TransactionEvent[] } >();
  const [transactions, setTransactions] = useState(initialTransactions);

  useEffect(() => {
    if (fetcher.data && fetcher.data.transactions) {
      setTransactions(fetcher.data.transactions);
    }
  }, [fetcher.data]);

  const handleRefresh = () => {
    // Recharge les données du loader de la route parente (admin.tsx)
    // ou d'une route spécifique si on en créait une pour les transactions.
    // Pour l'instant, cela va recharger toutes les données du loader de admin.tsx.
    fetcher.load("/admin?index"); // Assurez-vous que la route est correcte, ?index si c'est la page principale de l'onglet
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Transactions Blockchain Récentes</h2>
        <Button onClick={handleRefresh} disabled={fetcher.state === "loading"}>
          {fetcher.state === "loading" ? "Chargement..." : "Rafraîchir"}
        </Button>
      </div>

      {fetcher.state === "loading" && transactions.length === 0 && <p>Chargement des transactions...</p>}
      {fetcher.data?.transactions === null && <p>Erreur lors du chargement des transactions.</p>}
      
      {transactions.length === 0 && fetcher.state !== "loading" && (
        <div className="text-jdc-gray-400">Aucune transaction récente trouvée dans les derniers blocs scannés.</div>
      )}

      {transactions.length > 0 && (
        <table className="min-w-full divide-y divide-jdc-gray-200">
          <thead className="bg-jdc-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-jdc-gray-500 uppercase tracking-wider">Contrat</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-jdc-gray-500 uppercase tracking-wider">Événement</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-jdc-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-jdc-gray-500 uppercase tracking-wider">Données</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-jdc-gray-500 uppercase tracking-wider">Hash Tx</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-jdc-gray-200">
            {transactions.map((tx, index) => (
              <tr key={index}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-jdc-gray-800">{tx.contractName}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-jdc-gray-800">{tx.eventName}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-jdc-gray-800">
                  {new Date(tx.timestamp * 1000).toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-jdc-gray-800">
                  <pre className="text-xs overflow-x-auto">{JSON.stringify(tx.data, null, 2)}</pre>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-jdc-blue-500 hover:underline">
                  <a href={`https://explorer.non.confirme.encore/${tx.transactionHash}`} target="_blank" rel="noopener noreferrer">
                    {`${tx.transactionHash.substring(0, 6)}...${tx.transactionHash.substring(tx.transactionHash.length - 4)}`}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
} 