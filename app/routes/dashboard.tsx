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
import type { BlockchainSapTicket, BlockchainShipment } from "~/types/blockchain.types"; // Retrait de BlockchainInstallation
import type { Installation as FirestoreInstallation } from "~/types/firestore.types"; // Importer le type Installation de Firestore
import type { UserSessionData } from "~/services/session.server";

// Définition du type Installation attendu par UpcomingInstallationsTimeline
// (peut être déplacé dans un fichier de types partagé si utilisé ailleurs)
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

// Données factices pour le graphique des tickets (à remplacer par la vraie logique plus tard)
const chartData = [
  { date: "2024-06-01", count: 5 },
  { date: "2024-06-02", count: 8 },
  { date: "2024-06-03", count: 3 },
  { date: "2024-06-04", count: 7 },
  { date: "2024-06-05", count: 2 },
  { date: "2024-06-06", count: 6 },
  { date: "2024-06-07", count: 4 },
];

export default function Dashboard() {
  const { user } = useOutletContext<OutletContextType>();
  const {
    calendarEvents,
    recentTickets: serializedTickets,
    sapTicketCountsBySector,
    allInstallations
  } = useLoaderData<typeof loader>();

  const recentTickets: BlockchainSapTicket[] = serializedTickets ?? [];
  // Utiliser le type FirestoreInstallation pour les données du loader
  const firestoreInstallationsData: FirestoreInstallation[] = allInstallations ?? [];

  // Fonction pour mapper FirestoreInstallation vers TimelineInstallation
  const mapInstallationsForTimeline = (installationsFromFirestore: FirestoreInstallation[]): TimelineInstallation[] => {
    return installationsFromFirestore
      .filter(inst => inst.dateInstall) // Rétablir le filtre pour ne garder que celles avec une date
      .map((inst) => {
        let statutTimeline: 'à venir' | 'planifiée' | 'en cours' | 'terminée';
        // Utiliser inst.status de FirestoreInstallation
        switch (inst.status?.toLowerCase()) {
          case 'rendez-vous à prendre':
            statutTimeline = 'à venir';
            break;
          case 'rendez-vous pris':
            statutTimeline = 'planifiée';
            break;
          case 'installation terminée':
            statutTimeline = 'terminée';
            break;
          // Cas pour 'en cours' ou autres statuts à définir si nécessaire
          default:
            statutTimeline = 'à venir'; // Statut par défaut pour les statuts non mappés
        }

        // S'assurer que le secteur est l'un des types attendus
        let secteurTimeline: 'CHR' | 'HACCP' | 'Kezia' | 'Tabac';
        const secteurUpper = inst.secteur?.toUpperCase();
        if (secteurUpper === 'CHR' || secteurUpper === 'HACCP' || secteurUpper === 'KEZIA' || secteurUpper === 'TABAC') {
          secteurTimeline = secteurUpper as 'CHR' | 'HACCP' | 'Kezia' | 'Tabac';
        } else {
          // Assigner une valeur par défaut pour satisfaire le type TimelineInstallation.
          // Le composant enfant UpcomingInstallationsTimeline utilisera son icône par défaut si cette clé n'est pas dans secteurIcons.
          // Pour que l'icône par défaut de UpcomingInstallationsTimeline soit explicitement utilisée,
          // il faudrait que UpcomingInstallationsTimeline.tsx gère une clé comme 'UNKNOWN' ou que son type secteur accepte undefined.
          // Pour l'instant, on assigne 'CHR' pour satisfaire le type.
          secteurTimeline = 'CHR'; // Ou une autre valeur par défaut valide, ou filtrer ces éléments.
        }
        
        // Utiliser inst.ville ou inst.adresse si inst.ville est vide
        const villeTimeline = inst.ville || inst.adresse || 'Ville inconnue';
        
        // Convertir dateInstall (Date | string) en string
        // Le filtre ci-dessus garantit que inst.dateInstall n'est pas null/undefined ici.
        let dateString: string;
        if (inst.dateInstall instanceof Date) {
          dateString = inst.dateInstall.toISOString();
        } else {
          // Si ce n'est pas une instance de Date, c'est déjà une string (ou devrait l'être selon le type)
          dateString = inst.dateInstall as string; 
        }

        return {
          id: inst.id,
          date: dateString, 
          client: inst.nom, // Utiliser inst.nom de FirestoreInstallation
          secteur: secteurTimeline,
          ville: villeTimeline,
          statut: statutTimeline,
        };
      })
      // Optionnel: trier par date (les plus anciennes dates d'abord / prochaines à venir)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      // Afficher les 5 prochaines installations avec une date
      .slice(0, 5);
  };
  
  const timelineInstallations = mapInstallationsForTimeline(firestoreInstallationsData);

  // Calcul des stats installations par secteur (repris de InstallationsSnapshot)
  // Doit utiliser firestoreInstallationsData pour être cohérent
  const initialStats = { total: 0, enAttente: 0, planifiees: 0, terminees: 0 };
  const sectorStats: { [key: string]: typeof initialStats } = {
    haccp: { ...initialStats },
    chr: { ...initialStats },
    tabac: { ...initialStats },
    kezia: { ...initialStats },
  };
  firestoreInstallationsData.forEach((installation: FirestoreInstallation) => {
    const sectorKey = installation.secteur?.toLowerCase();
    if (sectorKey && sectorStats[sectorKey]) {
      sectorStats[sectorKey].total++;
      // Utiliser installation.status de FirestoreInstallation
      switch (installation.status?.toLowerCase()) {
        case 'rendez-vous à prendre':
          sectorStats[sectorKey].enAttente++;
          break;
        case 'rendez-vous pris':
          sectorStats[sectorKey].planifiees++;
          break;
        case 'installation terminée':
          sectorStats[sectorKey].terminees++;
          break;
        default:
          break;
      }
    }
  });

  // Config pour les cards installations
  const installCards = [
    { label: 'HACCP', icon: FaClipboardCheck, color: 'from-green-400/60 to-green-700/80', stats: sectorStats.haccp },
    { label: 'CHR', icon: FaUtensils, color: 'from-blue-400/60 to-blue-700/80', stats: sectorStats.chr },
    { label: 'Tabac', icon: FaSmoking, color: 'from-red-400/60 to-red-700/80', stats: sectorStats.tabac },
    { label: 'Kezia', icon: FaStore, color: 'from-purple-400/60 to-purple-700/80', stats: sectorStats.kezia },
  ];

  return (
    <div className="w-full max-w-screen-lg mx-auto flex flex-col gap-8 animate-fade-in-up">
      {/* Header Tickets SAP */}
      <h2 className="text-xl font-extrabold text-jdc-yellow tracking-wide uppercase mb-2 drop-shadow-glow">Tickets SAP</h2>
      {/* Statistiques principales tickets */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatsCard title="CHR" value={sapTicketCountsBySector?.['CHR'] ?? 0} icon={FaUtensils} isLoading={false} />
        <StatsCard title="HACCP" value={sapTicketCountsBySector?.['HACCP'] ?? 0} icon={FaShieldAlt} isLoading={false} />
        <StatsCard title="Kezia" value={sapTicketCountsBySector?.['Kezia'] ?? 0} icon={FaHamburger} isLoading={false} />
        <StatsCard title="Tabac" value={sapTicketCountsBySector?.['Tabac'] ?? 0} icon={FaSmoking} isLoading={false} />
      </div>
      {/* Header Installations */}
      <h2 className="text-xl font-extrabold text-jdc-yellow tracking-wide uppercase mb-2 drop-shadow-glow">Installations</h2>
      {/* Statistiques principales installations */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {installCards.map(card => (
          <Card key={card.label} header={<span className="font-bold text-white">{card.label}</span>} className={`bg-gradient-to-br ${card.color}`}>
            <div className="flex items-center gap-3 mb-2">
              <card.icon className="text-2xl text-white" />
              <span className="font-bold text-lg text-white">{card.label}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-white">
              <div>
                <div className="font-bold text-xl">{card.stats.total}</div>
                <div>Total</div>
              </div>
              <div>
                <div className="font-bold text-xl">{card.stats.enAttente}</div>
                <div>En attente</div>
              </div>
              <div>
                <div className="font-bold text-xl">{card.stats.planifiees}</div>
                <div>Planifiées</div>
              </div>
              <div>
                <div className="font-bold text-xl">{card.stats.terminees}</div>
                <div>Terminées</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
      {/* Prochaines installations (pleine largeur) */}
      <div className="w-full">
        <Card header={<span className="font-bold text-jdc-green">Prochaines installations</span>}>
          <UpcomingInstallationsTimeline installations={timelineInstallations} />
        </Card>
      </div>
      {/* Message de connexion */}
      {!user && (
        <div className="p-2 bg-jdc-card rounded-lg text-center text-jdc-gray-300 text-xs w-full animate-fade-in-up delay-500">
          Veuillez vous connecter pour voir le tableau de bord.
        </div>
      )}
    </div>
  );
}
