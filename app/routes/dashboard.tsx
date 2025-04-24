import type { MetaFunction } from "@remix-run/node";
import { useOutletContext, useLoaderData } from "@remix-run/react";
import React, { lazy, Suspense } from "react";
import { Timestamp } from 'firebase/firestore';

import { loader } from "./dashboard.loader";
import type { DashboardLoaderData } from "./dashboard.loader";

import { StatsCard } from "~/components/StatsCard";
const InteractiveMap = lazy(() => import("~/components/InteractiveMap"));
import { RecentTickets } from "~/components/RecentTickets";
import { RecentShipments } from "~/components/RecentShipments";
import { ClientOnly } from "~/components/ClientOnly";
import { WeeklyAgenda } from '~/components/WeeklyAgenda';
import { InstallationsSnapshot } from "~/components/InstallationsSnapshot";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { 
  faTicket, 
  faUsers, 
  faMapMarkedAlt, 
  faSpinner, 
  faExclamationTriangle, 
  faCalendarDays 
} from "@fortawesome/free-solid-svg-icons";

import type { SapTicket, Shipment, Installation } from "~/types/firestore.types"; // Importer Installation
import type { UserSession } from "~/services/session.server";

interface CalendarEvent {
  id: string;
  summary?: string | null;
  start?: { dateTime?: string | null; date?: string | null } | null;
  end?: { dateTime?: string | null; date?: string | null } | null;
  htmlLink?: string | null;
}

export const meta: MetaFunction = () => ([{ title: "Tableau de Bord | JDC Dashboard" }]);

export { loader };

type OutletContextType = {
  user: UserSession | null;
};

const parseSerializedDateOptional = (
  serializedDate: string | { seconds: number; nanoseconds: number } | null | undefined
): Date | undefined => {
  if (!serializedDate) return undefined;
  
  if (typeof serializedDate === 'string') {
    try {
      const date = new Date(serializedDate);
      return isNaN(date.getTime()) ? undefined : date;
    } catch {
      return undefined;
    }
  }

  if ('seconds' in serializedDate && 'nanoseconds' in serializedDate) {
    try {
      return new Timestamp(serializedDate.seconds, serializedDate.nanoseconds).toDate();
    } catch {
      return undefined;
    }
  }
  
  return undefined;
};

const parseSerializedDateNullable = (
  serializedDate: string | { seconds: number; nanoseconds: number } | null | undefined
): Date | null => {
  const parsedDate = parseSerializedDateOptional(serializedDate);
  return parsedDate ?? null;
};

const MapLoadingFallback = () => (
  // Added w-full to ensure fallback takes full width
  <div className="bg-jdc-card p-4 rounded-lg shadow-lg flex flex-col items-center justify-center min-h-[450px] w-full">
    <FontAwesomeIcon icon={faSpinner} spin className="text-jdc-yellow text-3xl mb-4" />
    <p className="text-jdc-gray-400 text-center">Chargement de la carte...</p>
  </div>
);

const MapLoginPrompt = () => (
  // Added w-full to ensure login prompt takes full width
  <div className="bg-jdc-card p-4 rounded-lg shadow-lg flex flex-col items-center justify-center min-h-[450px] w-full">
    <FontAwesomeIcon icon={faMapMarkedAlt} className="text-jdc-gray-500 text-4xl mb-4" />
    <p className="text-jdc-gray-400 text-center">Connectez-vous pour voir la carte des tickets.</p>
  </div>
);

const WeeklyAgendaFallback = () => (
  <div className="bg-jdc-card p-4 rounded-lg shadow-lg min-h-[200px]">
    <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
      <FontAwesomeIcon icon={faCalendarDays} className="mr-2 text-jdc-blue text-base" />
      Agenda de la semaine
    </h3>
    <div className="flex items-center justify-center h-[450px]">
      <FontAwesomeIcon icon={faSpinner} spin className="text-jdc-yellow text-xl mr-2" />
      <span className="text-jdc-gray-400">Chargement de l'agenda...</span>
    </div>
  </div>
);

export default function Dashboard() {
  const { user } = useOutletContext<OutletContextType>();
  const {
    userProfile, // Déstructurer userProfile depuis les données chargées
    calendarEvents,
    calendarError,
    stats,
    recentTickets: serializedTickets,
    recentShipments: serializedShipments,
    installationsStats,
    allInstallations, // Récupérer allInstallations
    clientError,
    sapTicketCountsBySector // Inclure les comptes par secteur
  } = useLoaderData<typeof loader>();

  const recentTickets: SapTicket[] = (serializedTickets ?? []).map(ticket => ({
    ...ticket,
    date: parseSerializedDateNullable(ticket.date),
  }));

  const recentShipments: Shipment[] = (serializedShipments ?? []).map(shipment => ({
    ...shipment,
    dateCreation: parseSerializedDateOptional(shipment.dateCreation),
  }));

  // Désérialiser les dates dans allInstallations
  const installations: Installation[] = (allInstallations ?? []).map(installation => ({
    ...installation,
    dateInstall: parseSerializedDateOptional(installation.dateInstall),
    createdAt: parseSerializedDateOptional(installation.createdAt),
    updatedAt: parseSerializedDateOptional(installation.updatedAt),
    // Désérialiser uniquement les champs de date qui sont susceptibles d'exister et de causer des problèmes de type
    // Les autres champs de date spécifiques aux secteurs seront gérés si nécessaire.
  }));

  const formatStatValue = (value: number | string | null): string =>
    value?.toString() ?? "N/A";

  const allSapTicketStats = [
    {
      sector: 'CHR',
      title: "Tickets SAP CHR",
      valueState: sapTicketCountsBySector?.['CHR'] ?? 0,
      icon: faTicket,
      evolutionKey: 'chrTicketCount' // Clé d'évolution à définir si nécessaire
    },
    {
      sector: 'HACCP',
      title: "Tickets SAP HACCP",
      valueState: sapTicketCountsBySector?.['HACCP'] ?? 0,
      icon: faTicket,
      evolutionKey: 'haccpTicketCount' // Clé d'évolution à définir si nécessaire
    },
    {
      sector: 'Kezia',
      title: "Tickets SAP Kezia",
      valueState: sapTicketCountsBySector?.['Kezia'] ?? 0,
      icon: faTicket,
      evolutionKey: 'keziaTicketCount' // Clé d'évolution à définir si nécessaire
    },
    {
      sector: 'Tabac',
      title: "Tickets SAP Tabac",
      valueState: sapTicketCountsBySector?.['Tabac'] ?? 0,
      icon: faTicket,
      evolutionKey: 'tabacTicketCount' // Clé d'évolution à définir si nécessaire
    },
  ];

  // Filtrer les tuiles en fonction des secteurs de l'utilisateur
  const statsData = userProfile?.role === 'Admin'
    ? allSapTicketStats // Si admin, afficher toutes les tuiles
    : allSapTicketStats.filter(stat => userProfile?.secteurs?.includes(stat.sector)); // Sinon, filtrer par secteurs de l'utilisateur


  return (
    <div className="space-y-6">
      {/* Page Title */}
      <h1 className="text-3xl font-semibold text-white">Tableau de Bord</h1>
      
      {/* Client Error Message */}
      {clientError && (
        <div className="flex items-center p-4 bg-red-800 text-white rounded-lg mb-4">
          <FontAwesomeIcon icon={faExclamationTriangle} className="mr-2" />
          {clientError}
        </div>
      )}

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {statsData.map((stat) => (
          <StatsCard
            key={stat.title}
              title={stat.title}
              value={formatStatValue(stat.valueState)}
              icon={stat.icon}
              isLoading={false}
              evolutionValue={stats.evolution[stat.evolutionKey as keyof typeof stats.evolution]}
            />
          ))}
      </div>

      {/* Installations Snapshot Section */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">État des Installations</h2>
        <InstallationsSnapshot
          allInstallations={installations} // Passer la liste désérialisée des installations
          isLoading={false}
          // Vous pouvez supprimer la prop stats ici si vous utilisez allInstallations
          // ou la laisser pour une compatibilité descendante si nécessaire.
          // stats={installationsStats}
        />
      </div>

      {/* Weekly Agenda Section */}
      <ClientOnly fallback={<WeeklyAgendaFallback />}>
        <WeeklyAgenda
          events={calendarEvents ?? []}
          error={calendarError} 
          isLoading={false}
        />
      </ClientOnly>

      {/* Map, Recent Tickets, and Recent Shipments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
        {/* Interactive Map Section */}
        <div className="w-full">
          <ClientOnly fallback={<div className="w-full h-[600px] bg-jdc-card animate-pulse rounded-lg" />}>
            <div className="w-full h-[600px]" key={user?.userId}>
              {user ? (
                <Suspense fallback={<MapLoadingFallback />}>
                  <InteractiveMap
                    tickets={recentTickets}
                    isLoadingTickets={false}
                  />
                </Suspense>
              ) : (
                <MapLoginPrompt />
              )}
            </div>
          </ClientOnly>
        </div>

        {/* Recent Tickets and Shipments Stack */}
        <div className="flex flex-col gap-6 w-full min-h-[600px]">
          <div className="flex-1">
            <RecentTickets
              tickets={recentTickets.slice(0, 5)}
              isLoading={false}
            />
          </div>
          <div className="flex-1">
            <RecentShipments
              shipments={recentShipments}
              isLoading={false}
            />
          </div>
        </div>
      </div>

      {/* Login Prompt */}
      {!user && !clientError && (
        <div className="p-4 bg-jdc-card rounded-lg text-center text-jdc-gray-300 mt-6">
          Veuillez vous connecter pour voir le tableau de bord.
        </div>
      )}
    </div>
  );
}
