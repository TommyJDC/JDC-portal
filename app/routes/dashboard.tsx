import type { MetaFunction } from "@remix-run/node";
import { useOutletContext, useLoaderData } from "@remix-run/react";
import React, { lazy, Suspense, useState } from "react";
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
import {
  FaTicketAlt, // Assuming faTicket maps to FaTicketAlt based on other files
  FaUsers, // Assuming faUsers maps to FaUsers
  FaMapMarkedAlt,
  FaSpinner,
  FaExclamationTriangle,
  FaCalendarAlt, // Changed from FaCalendarDays
  FaUtensils,
  FaShieldAlt,
  FaHamburger, // Changed from FaBurger
  FaSmoking
} from 'react-icons/fa';

import type { SapTicket, Shipment, Installation } from "~/types/firestore.types";
import type { UserSession } from "~/services/session.server";
import { Drawer } from "~/components/ui/Drawer";

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
  <div className="bg-jdc-card p-2 rounded-lg shadow-lg flex flex-col items-center justify-center min-h-[150px] w-full">
    <FaSpinner className="text-jdc-yellow text-xl mb-2 animate-spin" />
    <p className="text-jdc-gray-400 text-center text-xs">Chargement de la carte...</p>
  </div>
);

const MapLoginPrompt = () => (
  <div className="bg-jdc-card p-2 rounded-lg shadow-lg flex flex-col items-center justify-center min-h-[150px] w-full">
    <FaMapMarkedAlt className="text-jdc-gray-500 text-2xl mb-2" />
    <p className="text-jdc-gray-400 text-center text-xs">Connectez-vous pour voir la carte des tickets.</p>
  </div>
);

const WeeklyAgendaFallback = () => (
  <div className="bg-jdc-card p-2 rounded-lg shadow-lg min-h-[80px]">
    <h3 className="text-sm font-semibold text-white mb-1 flex items-center">
      <FaCalendarAlt className="mr-1 text-jdc-blue" style={{ width: '13px', height: '13px' }} />
      Agenda de la semaine
    </h3>
    <div className="flex items-center justify-center h-[100px]">
      <FaSpinner className="text-jdc-yellow text-xl mr-2 animate-spin" />
      <span className="text-jdc-gray-400 text-sm">Chargement de l'agenda...</span>
    </div>
  </div>
);


export default function Dashboard() {
  const { user } = useOutletContext<OutletContextType>();
  const {
    userProfile,
    calendarEvents,
    calendarError,
    stats,
    recentTickets: serializedTickets,
    recentShipments: serializedShipments,
    installationsStats,
    allInstallations,
    clientError,
    sapTicketCountsBySector
  } = useLoaderData<typeof loader>();

  const [isTicketsDrawerOpen, setIsTicketsDrawerOpen] = useState(false);
  const [isShipmentsDrawerOpen, setIsShipmentsDrawerOpen] = useState(false);

  // Données déjà parsées côté serveur dans le loader
  const recentTickets: SapTicket[] = serializedTickets ?? [];
  const recentShipments: Shipment[] = serializedShipments ?? [];
  const installations: Installation[] = allInstallations ?? [];

  const formatStatValue = (value: number | string | null): string =>
    value?.toString() ?? "N/A";

  const allSapTicketStats = [
    {
      sector: 'CHR',
      title: "Tickets CHR", // Modified title
      valueState: sapTicketCountsBySector?.['CHR'] ?? 0,
      icon: FaUtensils, // Modified icon
      evolutionKey: 'chrTicketCount'
    },
    {
      sector: 'HACCP',
      title: "Tickets HACCP", // Modified title
      valueState: sapTicketCountsBySector?.['HACCP'] ?? 0,
      icon: FaShieldAlt, // Modified icon
      evolutionKey: 'haccpTicketCount'
    },
    {
      sector: 'Kezia',
      title: "Tickets Kezia", // Modified title
      valueState: sapTicketCountsBySector?.['Kezia'] ?? 0,
      icon: FaHamburger, // Modified icon
      evolutionKey: 'keziaTicketCount'
    },
    {
      sector: 'Tabac',
      title: "Tickets Tabac", // Modified title
      valueState: sapTicketCountsBySector?.['Tabac'] ?? 0,
      icon: FaSmoking, // Modified icon
      evolutionKey: 'tabacTicketCount'
    },
  ];

  const statsData = userProfile?.role === 'Admin'
    ? allSapTicketStats
    : allSapTicketStats.filter(stat => userProfile?.secteurs?.includes(stat.sector));


  return (
    <div className="space-y-4 px-2 sm:px-4">
      <h1 className="text-xl font-semibold text-white mb-4 px-2">Tableau de Bord</h1>

      {clientError && (
        <div className="flex items-center p-1 bg-red-800 text-white rounded-lg mb-1 text-xs">
          <FaExclamationTriangle className="mr-1" />
          {clientError}
        </div>
      )}

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 px-2 sm:px-4 pb-4">
        <div className="lg:col-span-1 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-1 gap-4">
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

        <div className="lg:col-span-2 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-800 p-4 rounded-xl shadow-2xl border border-gray-700 hover:border-jdc-blue transition-all duration-300 cursor-pointer" onClick={() => setIsTicketsDrawerOpen(true)}>
                <h3 className="font-extrabold text-xl text-yellow-400 mb-2">Tickets SAP Récents</h3>
                <p className="text-sm text-gray-400">Cliquez pour voir la liste</p>
              </div>
              <div className="bg-gray-800 p-4 rounded-xl shadow-2xl border border-gray-700 hover:border-jdc-blue transition-all duration-300 cursor-pointer" onClick={() => setIsShipmentsDrawerOpen(true)}>
                <h3 className="font-extrabold text-xl text-yellow-400 mb-2">Envois CTN Récents</h3>
                <p className="text-sm text-gray-400">Cliquez pour voir la liste</p>
              </div>
            </div>

            <div className="min-h-[300px]">
              <InstallationsSnapshot
                allInstallations={installations}
                isLoading={false}
              />
            </div>

            <div className="min-h-[175px]">
              <Suspense fallback={<WeeklyAgendaFallback />}>
                <WeeklyAgenda
                  events={calendarEvents ?? []}
                  error={calendarError}
                  isLoading={false}
                />
              </Suspense>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="min-h-[500px] lg:h-[600px] w-full">
              <Suspense fallback={<MapLoadingFallback />}>
                <ClientOnly fallback={<div className="w-full h-full bg-jdc-card animate-pulse rounded-lg" />}>
                  {user ? (
                    <InteractiveMap
                      tickets={recentTickets}
                      isLoadingTickets={false}
                    />
                  ) : (
                    <MapLoginPrompt />
                  )}
                </ClientOnly>
              </Suspense>
            </div>
          </div>

          {!user && !clientError && (
            <div className="p-1 bg-jdc-card rounded-lg text-center text-jdc-gray-300 text-xs w-full">
              Veuillez vous connecter pour voir le tableau de bord.
            </div>
          )}
        </div>

      <Drawer isOpen={isTicketsDrawerOpen} onClose={() => setIsTicketsDrawerOpen(false)} side="right">
        <h2 className="text-xl font-semibold text-white mb-4">Tickets SAP</h2>
        <RecentTickets
          tickets={recentTickets}
          isLoading={false}
        />
      </Drawer>

      <Drawer isOpen={isShipmentsDrawerOpen} onClose={() => setIsShipmentsDrawerOpen(false)} side="right">
        <h2 className="text-xl font-semibold text-white mb-4">Envois CTN</h2>
        <RecentShipments
          shipments={recentShipments}
          isLoading={false}
        />
      </Drawer>
    </div>
  );
}
