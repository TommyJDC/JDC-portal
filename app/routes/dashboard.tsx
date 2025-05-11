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
  FaUtensils, FaShieldAlt, FaHamburger, FaSmoking, FaCalendarAlt, FaTruck, FaClipboardCheck, FaStore
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
      <section className="bg-ui-surface shadow-lg rounded-lg p-4 sm:p-6">
        <h2 className="text-xl font-semibold text-text-primary mb-4">Tickets SAP</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard title="CHR" value={sapTicketCountsBySector?.['CHR'] ?? 0} icon={FaUtensils} isLoading={false} />
          <StatsCard title="HACCP" value={sapTicketCountsBySector?.['HACCP'] ?? 0} icon={FaShieldAlt} isLoading={false} />
          <StatsCard title="Kezia" value={sapTicketCountsBySector?.['Kezia'] ?? 0} icon={FaHamburger} isLoading={false} />
          <StatsCard title="Tabac" value={sapTicketCountsBySector?.['Tabac'] ?? 0} icon={FaSmoking} isLoading={false} />
        </div>
      </section>

      {/* Section Statistiques Installations */}
      <section className="bg-ui-surface shadow-lg rounded-lg p-4 sm:p-6">
        <h2 className="text-xl font-semibold text-text-primary mb-4">Installations</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {installCards.map(cardData => (
            <Card key={cardData.label} className="bg-ui-background shadow-md rounded-lg"> {/* Fond légèrement différent pour les cartes internes */}
              <div className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <cardData.icon className="text-2xl text-brand-blue" />
                  <span className="font-semibold text-md text-text-primary">{cardData.label}</span>
                </div>
                <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
                  <div>
                    <div className="font-bold text-lg text-text-primary">{cardData.stats.total}</div>
                    <div className="text-text-secondary">Total</div>
                  </div>
                  <div>
                    <div className="font-bold text-lg text-text-primary">{cardData.stats.enAttente}</div>
                    <div className="text-text-secondary">En attente</div>
                  </div>
                  <div>
                    <div className="font-bold text-lg text-text-primary">{cardData.stats.planifiees}</div>
                    <div className="text-text-secondary">Planifiées</div>
                  </div>
                  <div>
                    <div className="font-bold text-lg text-text-primary">{cardData.stats.terminees}</div>
                    <div className="text-text-secondary">Terminées</div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>
      
      {/* Section Prochaines Installations */}
      <section className="bg-ui-surface shadow-lg rounded-lg p-4 sm:p-6">
        <h2 className="text-xl font-semibold text-text-primary mb-4">Prochaines Installations</h2>
        <Card className="bg-ui-background shadow-md rounded-lg p-4"> {/* Fond légèrement différent */}
          <UpcomingInstallationsTimeline installations={timelineInstallations} />
        </Card>
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
