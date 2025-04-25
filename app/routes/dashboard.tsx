import type { MetaFunction } from "@remix-run/node";
import { useOutletContext, useLoaderData } from "@remix-run/react";
import React, { lazy, Suspense, useState } from "react";
import { isMobile } from 'react-device-detect';
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
    <FontAwesomeIcon icon={faSpinner} spin className="text-jdc-yellow text-xl mb-2" />
    <p className="text-jdc-gray-400 text-center text-xs">Chargement de la carte...</p>
  </div>
);

const MapLoginPrompt = () => (
  <div className="bg-jdc-card p-2 rounded-lg shadow-lg flex flex-col items-center justify-center min-h-[150px] w-full">
    <FontAwesomeIcon icon={faMapMarkedAlt} className="text-jdc-gray-500 text-2xl mb-2" />
    <p className="text-jdc-gray-400 text-center text-xs">Connectez-vous pour voir la carte des tickets.</p>
  </div>
);

const WeeklyAgendaFallback = () => (
  <div className="bg-jdc-card p-2 rounded-lg shadow-lg min-h-[80px]">
    <h3 className="text-sm font-semibold text-white mb-1 flex items-center">
      <FontAwesomeIcon icon={faCalendarDays} className="mr-1 text-jdc-blue text-xs" />
      Agenda de la semaine
    </h3>
    <div className="flex items-center justify-center h-[100px]">
      <FontAwesomeIcon icon={faSpinner} spin className="text-jdc-yellow text-xl mr-2" />
      <span className="text-jdc-gray-400 text-sm">Chargement de l'agenda...</span>
    </div>
  </div>
);

interface MobileDashboardProps {
  statsData: Array<{
    title: string;
    valueState: number | string | null;
    icon: any;
    evolutionKey: string;
    sector: string;
  }>;
  formatStatValue: (value: number | string | null) => string;
  stats: {
    evolution: Record<string, number | null>;
  };
  recentTickets: SapTicket[];
  recentShipments: Shipment[];
  installations: Installation[];
  calendarEvents?: CalendarEvent[] | null;
  calendarError?: string | null;
  user: UserSession | null;
  clientError?: string | null;
}

const MobileDashboard = ({ 
  statsData,
  formatStatValue,
  stats,
  recentTickets,
  recentShipments,
  installations,
  calendarEvents,
  calendarError,
  user,
  clientError
}: MobileDashboardProps) => (
  <div className="space-y-2 p-2">
    <h1 className="text-lg font-semibold text-white">Tableau de Bord</h1>

    {clientError && (
      <div className="p-2 bg-red-800 text-white rounded-lg mb-2 text-xs">
        <FontAwesomeIcon icon={faExclamationTriangle} className="mr-1" />
        {clientError}
      </div>
    )}

    <div className="flex overflow-x-auto gap-2 pb-2">
          {statsData.map((stat: {
            title: string;
            valueState: number | string | null;
            icon: any;
            evolutionKey: string;
          }) => (
        <div key={stat.title} className="min-w-[120px]">
          <StatsCard
            title={stat.title}
            value={formatStatValue(stat.valueState)}
            icon={stat.icon}
            isLoading={false}
            evolutionValue={stats.evolution[stat.evolutionKey as keyof typeof stats.evolution]}
          />
        </div>
      ))}
    </div>

    <div className="bg-jdc-card p-2 rounded-lg">
      <h3 className="text-sm font-semibold text-white mb-2">Derniers Tickets</h3>
      <RecentTickets
        tickets={recentTickets.slice(0, 3)}
        isLoading={false}
      />
    </div>

    <div className="bg-jdc-card p-2 rounded-lg">
      <h3 className="text-sm font-semibold text-white mb-2">Derniers Envois</h3>
      <RecentShipments
        shipments={recentShipments.slice(0, 3)}
        isLoading={false}
      />
    </div>

    <div className="bg-jdc-card p-2 rounded-lg">
      <h3 className="text-sm font-semibold text-white mb-2">Installations</h3>
      <InstallationsSnapshot
        allInstallations={installations}
        isLoading={false}
      />
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

  const recentTickets: SapTicket[] = (serializedTickets ?? []).map(ticket => ({
    ...ticket,
    date: parseSerializedDateNullable(ticket.date),
    mailDate: parseSerializedDateOptional(ticket.mailDate),
  }));

  const recentShipments: Shipment[] = (serializedShipments ?? []).map(shipment => ({
    ...shipment,
    dateCreation: parseSerializedDateOptional(shipment.dateCreation),
  }));

  const installations: Installation[] = (allInstallations ?? []).map(installation => ({
    ...installation,
    dateInstall: parseSerializedDateOptional(installation.dateInstall),
    createdAt: parseSerializedDateOptional(installation.createdAt),
    updatedAt: parseSerializedDateOptional(installation.updatedAt),
  }));

  const formatStatValue = (value: number | string | null): string =>
    value?.toString() ?? "N/A";

  const allSapTicketStats = [
    {
      sector: 'CHR',
      title: "Tickets SAP CHR",
      valueState: sapTicketCountsBySector?.['CHR'] ?? 0,
      icon: faTicket,
      evolutionKey: 'chrTicketCount'
    },
    {
      sector: 'HACCP',
      title: "Tickets SAP HACCP",
      valueState: sapTicketCountsBySector?.['HACCP'] ?? 0,
      icon: faTicket,
      evolutionKey: 'haccpTicketCount'
    },
    {
      sector: 'Kezia',
      title: "Tickets SAP Kezia",
      valueState: sapTicketCountsBySector?.['Kezia'] ?? 0,
      icon: faTicket,
      evolutionKey: 'keziaTicketCount'
    },
    {
      sector: 'Tabac',
      title: "Tickets SAP Tabac",
      valueState: sapTicketCountsBySector?.['Tabac'] ?? 0,
      icon: faTicket,
      evolutionKey: 'tabacTicketCount'
    },
  ];

  const statsData = userProfile?.role === 'Admin'
    ? allSapTicketStats
    : allSapTicketStats.filter(stat => userProfile?.secteurs?.includes(stat.sector));

  if (isMobile) {
    return (
      <MobileDashboard
        statsData={statsData}
        formatStatValue={formatStatValue}
        stats={stats}
        recentTickets={recentTickets}
        recentShipments={recentShipments}
        installations={installations}
        calendarEvents={calendarEvents}
        calendarError={calendarError}
        user={user}
        clientError={clientError}
      />
    );
  }

  return (
    <div className="space-y-1">
      <h1 className="text-xl font-semibold text-white mb-2">Tableau de Bord</h1>

      {clientError && (
        <div className="flex items-center p-1 bg-red-800 text-white rounded-lg mb-1 text-xs">
          <FontAwesomeIcon icon={faExclamationTriangle} className="mr-1" />
          {clientError}
        </div>
      )}

      <div className="flex gap-2">
        <div className="w-[10%] grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-1 auto-rows-min min-h-[234px]">
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

        <div className="w-[65%] space-y-1">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
              <div
                className="h-[80px] cursor-pointer"
                onClick={() => setIsTicketsDrawerOpen(true)}
              >
                <RecentTickets
                  tickets={recentTickets.slice(0, 5)}
                  isLoading={false}
                />
              </div>
              <div
                className="h-[80px] cursor-pointer"
                onClick={() => setIsShipmentsDrawerOpen(true)}
              >
                <RecentShipments
                  shipments={recentShipments}
                  isLoading={false}
                />
              </div>
            </div>

            <div className="h-[300px] mb-4">
              <InstallationsSnapshot
                allInstallations={installations}
                isLoading={false}
              />
            </div>

            <div className="h-[175px]">
              <ClientOnly fallback={<WeeklyAgendaFallback />}>
                <WeeklyAgenda
                  events={calendarEvents ?? []}
                  error={calendarError}
                  isLoading={false}
                />
              </ClientOnly>
            </div>
          </div>

          <div className="w-[45%]">
            <div className="h-[850px]">
              <ClientOnly fallback={<div className="w-full h-full bg-jdc-card animate-pulse rounded-lg" />}>
                <div className="w-full h-full" key={user?.userId}>
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
