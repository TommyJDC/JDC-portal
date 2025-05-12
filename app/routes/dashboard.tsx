import type { MetaFunction } from "@remix-run/node";
import { useOutletContext, useLoaderData } from "@remix-run/react";
import React from "react";
import { loader } from "./dashboard.loader";
import type { DashboardLoaderData } from "./dashboard.loader";
import { Card } from "~/components/ui/Card";
import { StatsCard } from "~/components/StatsCard";
import { RecentTickets } from "~/components/RecentTickets";
import { RecentShipments } from "~/components/RecentShipments";
import { WeeklyAgenda } from '~/components/WeeklyAgenda';
import { InstallationsSnapshot } from "~/components/InstallationsSnapshot";
import { WeatherWidget } from '~/components/WeatherWidget';
import { QuickActions } from '~/components/QuickActions';
import { TicketsChart } from '~/components/TicketsChart';
import { UpcomingInstallationsTimeline } from '~/components/UpcomingInstallationsTimeline';
import { MiniAgendaToday } from '~/components/MiniAgendaToday';
import {
  FaUtensils, FaShieldAlt, FaHamburger, FaSmoking, FaCalendarAlt, FaTruck, FaClipboardCheck, FaStore, FaClipboardList
} from 'react-icons/fa';
import type { BlockchainSapTicket, BlockchainShipment } from "~/types/blockchain.types";
import type { Installation as FirestoreInstallation } from "~/types/firestore.types";
import type { UserSessionData } from "~/services/session.server";

interface TimelineInstallation {
  id: string;
  date: string;
  client: string;
  secteur: 'CHR' | 'HACCP' | 'Kezia' | 'Tabac';
  ville: string;
  statut: 'à venir' | 'planifiée' | 'en cours' | 'terminée';
}

export const meta: MetaFunction = () => ([{ title: "Tableau de Bord | JDC Dashboard" }]);
export { loader };

type OutletContextType = {
  user: UserSessionData | null;
};

export default function Dashboard() {
  const { user } = useOutletContext<OutletContextType>();
  const {
    calendarEvents,
    recentTickets: serializedTickets,
    sapTicketCountsBySector,
    allInstallations
  } = useLoaderData<typeof loader>();

  const recentTickets: BlockchainSapTicket[] = serializedTickets ?? [];
  const firestoreInstallationsData: FirestoreInstallation[] = allInstallations ?? [];

  const mapInstallationsForTimeline = (installationsFromFirestore: FirestoreInstallation[]): TimelineInstallation[] => {
    return installationsFromFirestore
      .filter(inst => inst.dateInstall)
      .map((inst) => {
        let statutTimeline: 'à venir' | 'planifiée' | 'en cours' | 'terminée';
        switch (inst.status?.toLowerCase()) {
          case 'rendez-vous à prendre': statutTimeline = 'à venir'; break;
          case 'rendez-vous pris': statutTimeline = 'planifiée'; break;
          case 'installation terminée': statutTimeline = 'terminée'; break;
          default: statutTimeline = 'à venir';
        }
        let secteurTimeline: 'CHR' | 'HACCP' | 'Kezia' | 'Tabac';
        const secteurUpper = inst.secteur?.toUpperCase();
        if (secteurUpper === 'CHR' || secteurUpper === 'HACCP' || secteurUpper === 'KEZIA' || secteurUpper === 'TABAC') {
          secteurTimeline = secteurUpper as 'CHR' | 'HACCP' | 'Kezia' | 'Tabac';
        } else {
          secteurTimeline = 'CHR'; // Default
        }
        const villeTimeline = inst.ville || inst.adresse || 'Ville inconnue';
        let dateString: string;
        if (inst.dateInstall instanceof Date) {
          dateString = inst.dateInstall.toISOString();
        } else {
          dateString = inst.dateInstall as string; 
        }
        return { id: inst.id, date: dateString, client: inst.nom, secteur: secteurTimeline, ville: villeTimeline, statut: statutTimeline };
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5);
  };
  
  const timelineInstallations = mapInstallationsForTimeline(firestoreInstallationsData);

  const initialStats = { total: 0, enAttente: 0, planifiees: 0, terminees: 0 };
  const sectorStats: { [key: string]: typeof initialStats } = {
    haccp: { ...initialStats }, chr: { ...initialStats }, tabac: { ...initialStats }, kezia: { ...initialStats },
  };
  firestoreInstallationsData.forEach((installation: FirestoreInstallation) => {
    const sectorKey = installation.secteur?.toLowerCase();
    if (sectorKey && sectorStats[sectorKey]) {
      sectorStats[sectorKey].total++;
      switch (installation.status?.toLowerCase()) {
        case 'rendez-vous à prendre': sectorStats[sectorKey].enAttente++; break;
        case 'rendez-vous pris': sectorStats[sectorKey].planifiees++; break;
        case 'installation terminée': sectorStats[sectorKey].terminees++; break;
      }
    }
  });

  const installCards = [
    { label: 'HACCP', icon: FaClipboardCheck, stats: sectorStats.haccp },
    { label: 'CHR', icon: FaUtensils, stats: sectorStats.chr },
    { label: 'Tabac', icon: FaSmoking, stats: sectorStats.tabac },
    { label: 'Kezia', icon: FaStore, stats: sectorStats.kezia },
  ];

  return (
    <div className="space-y-6">

      {/* Section Statistiques Tickets SAP */}
      <section className="glass-card bg-gradient-to-br from-gray-900/80 to-gray-800/80 rounded-2xl p-8 shadow-2xl border border-white/10 backdrop-blur-xl">
        <h2 className="text-2xl font-extrabold text-white flex items-center drop-shadow-lg mb-6">
          <FaClipboardList className="mr-3 text-jdc-yellow text-2xl" />
          Tickets SAP
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-card bg-gradient-to-br from-green-400/20 to-green-700/30 rounded-xl p-6 border border-green-400/20 hover:border-green-400/40 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl shadow-green-400/20">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 rounded-full bg-green-400/30 border-2 border-white/20 shadow-lg">
                <FaShieldAlt className="text-white text-xl drop-shadow" />
              </div>
              <h3 className="font-bold text-lg text-white">HACCP</h3>
            </div>
            <div className="text-3xl font-bold text-white mt-2">{sapTicketCountsBySector?.['HACCP'] ?? 0}</div>
          </div>
          
          <div className="glass-card bg-gradient-to-br from-blue-400/20 to-blue-700/30 rounded-xl p-6 border border-blue-400/20 hover:border-blue-400/40 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl shadow-blue-400/20">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 rounded-full bg-blue-400/30 border-2 border-white/20 shadow-lg">
                <FaUtensils className="text-white text-xl drop-shadow" />
              </div>
              <h3 className="font-bold text-lg text-white">CHR</h3>
            </div>
            <div className="text-3xl font-bold text-white mt-2">{sapTicketCountsBySector?.['CHR'] ?? 0}</div>
          </div>
          
          <div className="glass-card bg-gradient-to-br from-red-400/20 to-red-700/30 rounded-xl p-6 border border-red-400/20 hover:border-red-400/40 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl shadow-red-400/20">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 rounded-full bg-red-400/30 border-2 border-white/20 shadow-lg">
                <FaSmoking className="text-white text-xl drop-shadow" />
              </div>
              <h3 className="font-bold text-lg text-white">Tabac</h3>
            </div>
            <div className="text-3xl font-bold text-white mt-2">{sapTicketCountsBySector?.['Tabac'] ?? 0}</div>
          </div>
          
          <div className="glass-card bg-gradient-to-br from-purple-400/20 to-purple-700/30 rounded-xl p-6 border border-purple-400/20 hover:border-purple-400/40 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl shadow-purple-400/20">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 rounded-full bg-purple-400/30 border-2 border-white/20 shadow-lg">
                <FaHamburger className="text-white text-xl drop-shadow" />
              </div>
              <h3 className="font-bold text-lg text-white">Kezia</h3>
            </div>
            <div className="text-3xl font-bold text-white mt-2">{sapTicketCountsBySector?.['Kezia'] ?? 0}</div>
          </div>
        </div>
      </section>

      {/* Section Statistiques Installations */}
      <section className="glass-card bg-gradient-to-br from-gray-900/80 to-gray-800/80 rounded-2xl p-8 shadow-2xl border border-white/10 backdrop-blur-xl">
        <h2 className="text-2xl font-extrabold text-white flex items-center drop-shadow-lg mb-6">
          <FaStore className="mr-3 text-jdc-yellow text-2xl" />
          Installations
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'HACCP', icon: FaClipboardCheck, stats: sectorStats.haccp },
            { label: 'CHR', icon: FaUtensils, stats: sectorStats.chr },
            { label: 'Tabac', icon: FaSmoking, stats: sectorStats.tabac },
            { label: 'Kezia', icon: FaStore, stats: sectorStats.kezia }
          ].map(cardData => {
            const gradient = cardData.label === 'HACCP' ? 'from-green-400/20 to-green-700/30' :
                           cardData.label === 'CHR' ? 'from-blue-400/20 to-blue-700/30' :
                           cardData.label === 'Tabac' ? 'from-red-400/20 to-red-700/30' :
                           'from-purple-400/20 to-purple-700/30';
            const border = cardData.label === 'HACCP' ? 'border-green-400/20 hover:border-green-400/40' :
                         cardData.label === 'CHR' ? 'border-blue-400/20 hover:border-blue-400/40' :
                         cardData.label === 'Tabac' ? 'border-red-400/20 hover:border-red-400/40' :
                         'border-purple-400/20 hover:border-purple-400/40';
            const shadow = cardData.label === 'HACCP' ? 'shadow-green-400/20' :
                         cardData.label === 'CHR' ? 'shadow-blue-400/20' :
                         cardData.label === 'Tabac' ? 'shadow-red-400/20' :
                         'shadow-purple-400/20';
            const badge = cardData.label === 'HACCP' ? 'bg-green-400/30' :
                        cardData.label === 'CHR' ? 'bg-blue-400/30' :
                        cardData.label === 'Tabac' ? 'bg-red-400/30' :
                        'bg-purple-400/30';

            return (
              <div key={cardData.label} 
                className={`glass-card bg-gradient-to-br ${gradient} rounded-xl p-6 border ${border} transition-all duration-300 hover:scale-[1.02] hover:shadow-xl ${shadow}`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-3 rounded-full ${badge} border-2 border-white/20 shadow-lg`}>
                    <cardData.icon className="text-white text-xl drop-shadow" />
                  </div>
                  <h3 className="font-bold text-lg text-white">{cardData.label}</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-gray-100/70 font-medium uppercase tracking-wider">Total</p>
                    <p className="text-2xl font-bold text-white">{cardData.stats.total}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-100/70 font-medium uppercase tracking-wider">En attente</p>
                    <p className="text-2xl font-bold text-yellow-300">{cardData.stats.enAttente}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-100/70 font-medium uppercase tracking-wider">Planifiées</p>
                    <p className="text-2xl font-bold text-blue-300">{cardData.stats.planifiees}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-100/70 font-medium uppercase tracking-wider">Terminées</p>
                    <p className="text-2xl font-bold text-green-300">{cardData.stats.terminees}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      
      {/* Section Prochaines Installations */}
      <section className="glass-card bg-gradient-to-br from-gray-900/80 to-gray-800/80 rounded-2xl p-8 shadow-2xl border border-white/10 backdrop-blur-xl">
        <h2 className="text-2xl font-extrabold text-white flex items-center drop-shadow-lg mb-6">
          <FaCalendarAlt className="mr-3 text-jdc-yellow text-2xl" />
          Prochaines Installations
        </h2>
        <div className="glass-card bg-gradient-to-br from-gray-800/40 to-gray-900/60 rounded-xl p-6 border border-white/5 hover:border-white/10 transition-all duration-300">
          <UpcomingInstallationsTimeline installations={timelineInstallations} />
        </div>
      </section>

      {/* D'autres sections pourraient être ajoutées ici, par exemple : */}
      {/* <RecentTickets tickets={recentTickets} /> */}
      {/* <QuickActions /> */}

      {!user && (
        <div className="p-4 bg-ui-surface rounded-lg text-center text-text-secondary text-sm shadow-lg">
          Veuillez vous connecter pour voir le tableau de bord.
        </div>
      )}
    </div>
  );
}
