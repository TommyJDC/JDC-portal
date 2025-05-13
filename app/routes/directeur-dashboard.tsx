import React from 'react';
import { useLoaderData } from '@remix-run/react';
import { json } from '@remix-run/node';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { sessionStorage } from '~/services/session.server';
import {
  FaChartLine,
  FaUsers,
  FaTicketAlt,
  FaStore,
  FaTruck,
  FaCalendarAlt,
  FaChartPie,
  FaChartBar,
  FaMoneyBillWave,
  FaExclamationTriangle,
  FaCheckCircle,
  FaArrowUp,
  FaArrowDown,
  FaBell,
  FaClock,
  FaSmile,
  FaBuilding
} from 'react-icons/fa';
import {
  getUserProfileSdk,
  getSapTicketCountBySectorSdk,
  getDistinctClientCountFromEnvoiSdk,
  getInstallationsSnapshot,
  getAllShipments,
  getRecentTicketsForSectors,
  getLatestStatsSnapshotsSdk,
  getTechniciansInstallationsSdk
} from '~/services/firestore.service.server';
import type { StatsSnapshot } from '~/types/firestore.types';

// Types
interface Ticket {
  id: string;
  client: string;
  secteur: string;
  statut: string;
  date: Date;
}

interface Shipment {
  id: string;
  client: string;
  secteur: string;
  statut: string;
  date: Date;
}

interface TechnicianInstallations {
  technicianId: string;
  firstName: string;
  lastName: string;
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
}

interface DashboardData {
  tickets: {
    total: number;
    bySector: Record<string, number>;
    recent: Ticket[];
    evolution: number;
  };
  clients: {
    total: number;
    evolution: number;
  };
  installations: {
    total: number;
    byStatus: Record<string, number>;
    bySector: Record<string, { total: number; byStatus: Record<string, number> }>;
    byTechnician: TechnicianInstallations[];
  };
  shipments: {
    total: number;
    recent: Shipment[];
    evolution: number;
  };
  performance: {
    ticketResolutionTime: number;
    installationCompletionRate: number;
    clientSatisfaction: number;
  };
  alerts: {
    criticalTickets: number;
    delayedInstallations: number;
    pendingShipments: number;
  };
}

type LoaderData = DashboardData | { error: string };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const session = await sessionStorage.getSession(request.headers.get('Cookie'));
  const user = session.get('user');

  if (!user) {
    return json<{ error: string }>({ error: 'Non autorisé' }, { status: 401 });
  }

  const userProfile = await getUserProfileSdk(user.userId);
  const isAdmin = userProfile?.role?.toLowerCase() === 'admin';
  const isAlexis = user.email === 'alexis.lhersonneau@jdc.fr';

  if (!userProfile || (!isAdmin && !isAlexis)) {
    return json<{ error: string }>({ error: 'Accès non autorisé' }, { status: 403 });
  }

  // Récupération des données
  const [ticketCounts, clientCount, installationsData, recentTickets, shipments, statsSnapshot, techniciansData] = await Promise.all([
    getSapTicketCountBySectorSdk(['HACCP', 'CHR', 'Tabac', 'Kezia']),
    getDistinctClientCountFromEnvoiSdk(userProfile),
    getInstallationsSnapshot(userProfile),
    getRecentTicketsForSectors(['HACCP', 'CHR', 'Tabac', 'Kezia'], 5),
    getAllShipments(['HACCP', 'CHR', 'Tabac', 'Kezia']),
    getLatestStatsSnapshotsSdk(2),
    getTechniciansInstallationsSdk()
  ]);

  // Calcul des évolutions
  const previousSnapshot = statsSnapshot[1];
  const currentSnapshot = statsSnapshot[0];
  
  const calculateEvolution = (current: number, previous: number) => {
    if (!previous) return 0;
    return ((current - previous) / previous) * 100;
  };

  const data: DashboardData = {
    tickets: {
      total: Object.values(ticketCounts).reduce((sum, count) => sum + count, 0),
      bySector: ticketCounts,
      recent: recentTickets.map(ticket => ({
        ...ticket,
        date: ticket.date || new Date()
      })) as Ticket[],
      evolution: calculateEvolution(
        Object.values(ticketCounts).reduce((sum, count) => sum + count, 0),
        previousSnapshot?.ticketCounts ? Object.values(previousSnapshot.ticketCounts).reduce((sum, count) => sum + count, 0) : 0
      )
    },
    clients: {
      total: clientCount,
      evolution: calculateEvolution(clientCount, previousSnapshot?.clientCount || 0)
    },
    installations: {
      total: installationsData.total || 0,
      byStatus: installationsData.byStatus || {},
      bySector: installationsData.bySector || {},
      byTechnician: techniciansData || []
    },
    shipments: {
      total: shipments.length,
      recent: shipments.slice(0, 5).map(shipment => ({
        ...shipment,
        date: shipment.date || new Date()
      })) as Shipment[],
      evolution: calculateEvolution(shipments.length, 0)
    },
    performance: {
      ticketResolutionTime: calculateAverageResolutionTime(recentTickets),
      installationCompletionRate: calculateInstallationCompletionRate(installationsData),
      clientSatisfaction: calculateClientSatisfaction(recentTickets)
    },
    alerts: {
      criticalTickets: countCriticalTickets(recentTickets),
      delayedInstallations: countDelayedInstallations(installationsData),
      pendingShipments: countPendingShipments(shipments)
    }
  };

  return json<DashboardData>(data);
};

// Fonctions utilitaires
function calculateAverageResolutionTime(tickets: any[]): number {
  const resolvedTickets = tickets.filter(t => t.status === 'Terminé');
  if (!resolvedTickets.length) return 0;
  
  const totalTime = resolvedTickets.reduce((sum, ticket) => {
    const start = new Date(ticket.createdAt).getTime();
    const end = new Date(ticket.resolvedAt).getTime();
    return sum + (end - start);
  }, 0);
  
  return Math.round(totalTime / resolvedTickets.length / (1000 * 60 * 60)); // en heures
}

function calculateInstallationCompletionRate(installationsData: any): number {
  const total = installationsData.total || 0;
  const completed = installationsData.byStatus?.['Installation terminée'] || 0;
  return total ? Math.round((completed / total) * 100) : 0;
}

function calculateClientSatisfaction(tickets: any[]): number {
  const ratedTickets = tickets.filter(t => t.satisfactionRating);
  if (!ratedTickets.length) return 0;
  
  const totalRating = ratedTickets.reduce((sum, ticket) => sum + ticket.satisfactionRating, 0);
  return Math.round((totalRating / ratedTickets.length) * 20); // Conversion sur 100
}

function countCriticalTickets(tickets: any[]): number {
  return tickets.filter(t => t.priority === 'Critique' && t.status !== 'Terminé').length;
}

function countDelayedInstallations(installationsData: any): number {
  return installationsData.byStatus?.['En retard'] || 0;
}

function countPendingShipments(shipments: any[]): number {
  return shipments.filter(s => s.status === 'En attente').length;
}

export default function DirecteurDashboard() {
  const data = useLoaderData<typeof loader>();

  console.log('[DIRECTEUR-DASHBOARD] Données reçues:', data);

  if ('error' in data) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-red-500">{data.error}</h1>
      </div>
    );
  }

  console.log('[DIRECTEUR-DASHBOARD] Installations par technicien:', data.installations.byTechnician);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-text-primary">Dashboard Directeur</h1>
        <div className="text-sm text-text-tertiary">
          Dernière mise à jour : {new Date().toLocaleString('fr-FR')}
        </div>
      </div>

      {/* Alertes */}
      {(data.alerts.criticalTickets > 0 || data.alerts.delayedInstallations > 0 || data.alerts.pendingShipments > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.alerts.criticalTickets > 0 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-red-500 font-medium">Tickets Critiques</h3>
                  <p className="text-2xl font-bold text-red-500">{data.alerts.criticalTickets}</p>
                </div>
                <FaExclamationTriangle className="h-8 w-8 text-red-500" />
              </div>
            </div>
          )}
          {data.alerts.delayedInstallations > 0 && (
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-orange-500 font-medium">Installations Retardées</h3>
                  <p className="text-2xl font-bold text-orange-500">{data.alerts.delayedInstallations}</p>
                </div>
                <FaClock className="h-8 w-8 text-orange-500" />
              </div>
            </div>
          )}
          {data.alerts.pendingShipments > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-yellow-500 font-medium">Livraisons en Attente</h3>
                  <p className="text-2xl font-bold text-yellow-500">{data.alerts.pendingShipments}</p>
                </div>
                <FaTruck className="h-8 w-8 text-yellow-500" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-text-tertiary text-sm">Total Tickets</h3>
              <p className="text-2xl font-bold text-text-primary">{data.tickets.total}</p>
              <p className={`text-sm ${data.tickets.evolution >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {data.tickets.evolution >= 0 ? '+' : ''}{data.tickets.evolution.toFixed(1)}%
              </p>
            </div>
            <FaTicketAlt className="h-8 w-8 text-brand-blue" />
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-text-tertiary text-sm">Clients Actifs</h3>
              <p className="text-2xl font-bold text-text-primary">{data.clients.total}</p>
              <p className={`text-sm ${data.clients.evolution >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {data.clients.evolution >= 0 ? '+' : ''}{data.clients.evolution.toFixed(1)}%
              </p>
            </div>
            <FaUsers className="h-8 w-8 text-brand-blue" />
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-text-tertiary text-sm">Installations</h3>
              <p className="text-2xl font-bold text-text-primary">{data.installations.total}</p>
            </div>
            <FaBuilding className="h-8 w-8 text-brand-blue" />
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-text-tertiary text-sm">Livraisons</h3>
              <p className="text-2xl font-bold text-text-primary">{data.shipments.total}</p>
              <p className={`text-sm ${data.shipments.evolution >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {data.shipments.evolution >= 0 ? '+' : ''}{data.shipments.evolution.toFixed(1)}%
              </p>
            </div>
            <FaTruck className="h-8 w-8 text-brand-blue" />
          </div>
        </div>
      </div>

      {/* Performance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4">
          <h3 className="text-text-tertiary text-sm mb-2">Temps de Résolution</h3>
          <div className="flex items-center justify-between">
            <p className="text-2xl font-bold text-text-primary">{data.performance.ticketResolutionTime.toFixed(1)}h</p>
            <FaClock className="h-6 w-6 text-brand-blue" />
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4">
          <h3 className="text-text-tertiary text-sm mb-2">Taux d'Installation</h3>
          <div className="flex items-center justify-between">
            <p className="text-2xl font-bold text-text-primary">{data.performance.installationCompletionRate.toFixed(1)}%</p>
            <FaCheckCircle className="h-6 w-6 text-brand-blue" />
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4">
          <h3 className="text-text-tertiary text-sm mb-2">Satisfaction Client</h3>
          <div className="flex items-center justify-between">
            <p className="text-2xl font-bold text-text-primary">{data.performance.clientSatisfaction.toFixed(1)}%</p>
            <FaSmile className="h-6 w-6 text-brand-blue" />
          </div>
        </div>
      </div>

      {/* Tickets Récents */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Tickets Récents</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-text-tertiary text-sm">
                <th className="p-2">ID</th>
                <th className="p-2">Client</th>
                <th className="p-2">Secteur</th>
                <th className="p-2">Statut</th>
                <th className="p-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {data.tickets.recent.map((ticket) => (
                <tr key={ticket.id} className="border-t border-white/10">
                  <td className="p-2">{ticket.id}</td>
                  <td className="p-2">{ticket.client}</td>
                  <td className="p-2">{ticket.secteur}</td>
                  <td className="p-2">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      ticket.statut === 'Résolu' ? 'bg-green-500/20 text-green-500' :
                      ticket.statut === 'En cours' ? 'bg-blue-500/20 text-blue-500' :
                      'bg-yellow-500/20 text-yellow-500'
                    }`}>
                      {ticket.statut}
                    </span>
                  </td>
                  <td className="p-2">{new Date(ticket.date).toLocaleDateString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Livraisons Récentes */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Livraisons Récentes</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-text-tertiary text-sm">
                <th className="p-2">ID</th>
                <th className="p-2">Client</th>
                <th className="p-2">Secteur</th>
                <th className="p-2">Statut</th>
                <th className="p-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {data.shipments.recent.map((shipment) => (
                <tr key={shipment.id} className="border-t border-white/10">
                  <td className="p-2">{shipment.id}</td>
                  <td className="p-2">{shipment.client}</td>
                  <td className="p-2">{shipment.secteur}</td>
                  <td className="p-2">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      shipment.statut === 'Livré' ? 'bg-green-500/20 text-green-500' :
                      shipment.statut === 'En transit' ? 'bg-blue-500/20 text-blue-500' :
                      'bg-yellow-500/20 text-yellow-500'
                    }`}>
                      {shipment.statut}
                    </span>
                  </td>
                  <td className="p-2">{new Date(shipment.date).toLocaleDateString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Installations par Technicien */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Installations par Technicien</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-text-tertiary text-sm">
                <th className="p-2">Technicien</th>
                <th className="p-2">Total</th>
                <th className="p-2">Terminées</th>
                <th className="p-2">En cours</th>
                <th className="p-2">En attente</th>
                <th className="p-2">Taux de complétion</th>
              </tr>
            </thead>
            <tbody>
              {data.installations.byTechnician && data.installations.byTechnician.length > 0 ? (
                data.installations.byTechnician.map((tech) => (
                  <tr key={tech.technicianId} className="border-t border-white/10">
                    <td className="p-2">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-brand-blue/20 flex items-center justify-center text-brand-blue font-semibold mr-2">
                          {tech.firstName[0]}{tech.lastName[0]}
                        </div>
                        <span>{tech.firstName} {tech.lastName}</span>
                      </div>
                    </td>
                    <td className="p-2">{tech.total}</td>
                    <td className="p-2">
                      <span className="px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-500">
                        {tech.completed}
                      </span>
                    </td>
                    <td className="p-2">
                      <span className="px-2 py-1 rounded-full text-xs bg-blue-500/20 text-blue-500">
                        {tech.inProgress}
                      </span>
                    </td>
                    <td className="p-2">
                      <span className="px-2 py-1 rounded-full text-xs bg-yellow-500/20 text-yellow-500">
                        {tech.pending}
                      </span>
                    </td>
                    <td className="p-2">
                      <div className="flex items-center">
                        <div className="w-24 bg-gray-700 rounded-full h-2 mr-2">
                          <div 
                            className="bg-brand-blue h-2 rounded-full" 
                            style={{ width: `${(tech.completed / tech.total) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm">
                          {Math.round((tech.completed / tech.total) * 100)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-text-tertiary">
                    Aucune donnée disponible
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
} 