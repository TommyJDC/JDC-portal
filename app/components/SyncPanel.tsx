import React, { useState } from 'react';
import { useFetcher } from '@remix-run/react';
import { Card, CardHeader, CardBody } from '~/components/ui/Card';
import { Button } from '~/components/ui/Button';
import { FaSync } from 'react-icons/fa';

interface SyncResult {
  added: number;
  updated: number;
  deleted: number;
}

interface SyncResponse {
  success: boolean;
  message: string;
  results?: Record<string, SyncResult>;
}

export function SyncPanel() {
  const [isSyncing, setIsSyncing] = useState(false);
  const fetcher = useFetcher<SyncResponse>();

  const handleSync = () => {
    setIsSyncing(true);
    fetcher.submit(null, { method: 'post', action: '/api/sync-installations' });
  };

  React.useEffect(() => {
    if (fetcher.data) {
      setIsSyncing(false);
    }
  }, [fetcher.data]);

  return (
    <Card className="bg-ui-surface">
      <CardHeader>
        <div className="flex items-center text-text-primary">
          <FaSync className="mr-3 h-5 w-5 text-brand-blue" />
          <span className="font-semibold text-lg">Synchronisation des installations</span>
        </div>
      </CardHeader>
      <CardBody>
        <div className="space-y-4">
          <p className="text-text-secondary">
            Synchronise les installations depuis les feuilles Google Sheets vers Firestore.
          </p>
          <Button
            variant="primary"
            onClick={handleSync}
            disabled={isSyncing}
            className="w-full"
          >
            {isSyncing ? 'Synchronisation en cours...' : 'Lancer la synchronisation'}
          </Button>
          {fetcher.data && (
            <div className={`p-4 rounded-lg ${
              fetcher.data.success ? 'bg-green-900/30 border border-green-800' : 'bg-red-900/30 border border-red-800'
            }`}>
              <p className="text-text-primary">{fetcher.data.message}</p>
              {fetcher.data.results && (
                <div className="mt-2 text-sm">
                  {Object.entries(fetcher.data.results).map(([sector, stats]) => (
                    <div key={sector} className="text-text-secondary">
                      {sector}: {stats.added} ajoutés, {stats.updated} mis à jour, {stats.deleted} supprimés
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
} 