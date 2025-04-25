import type { MetaFunction } from "@remix-run/node";
import { useOutletContext, useLoaderData } from "@remix-run/react";
import React, { lazy, Suspense, useState } from "react"; // Importer useState
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
import { Drawer } from "~/components/ui/Drawer"; // Importer le composant Drawer

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
  <div className="bg-jdc-card p-2 rounded-lg shadow-lg flex flex-col items-center justify-center min-h-[150px] w-full"> {/* Adjusted height and padding */}
    <FontAwesomeIcon icon={faSpinner} spin className="text-jdc-yellow text-xl mb-2" /> {/* Adjusted icon size and margin */}
    <p className="text-jdc-gray-400 text-center text-xs">Chargement de la carte...</p> {/* Adjusted text size */}
  </div>
);

const MapLoginPrompt = () => (
  // Added w-full to ensure login prompt takes full width
  <div className="bg-jdc-card p-2 rounded-lg shadow-lg flex flex-col items-center justify-center min-h-[150px] w-full"> {/* Adjusted height and padding */}
    <FontAwesomeIcon icon={faMapMarkedAlt} className="text-jdc-gray-500 text-2xl mb-2" /> {/* Adjusted icon size and margin */}
    <p className="text-jdc-gray-400 text-center text-xs">Connectez-vous pour voir la carte des tickets.</p> {/* Adjusted text size */}
  </div>
);

const WeeklyAgendaFallback = () => (
  <div className="bg-jdc-card p-2 rounded-lg shadow-lg min-h-[80px]"> {/* Adjusted height and padding */}
    <h3 className="text-sm font-semibold text-white mb-1 flex items-center"> {/* Adjusted text size and margin */}
      <FontAwesomeIcon icon={faCalendarDays} className="mr-1 text-jdc-blue text-xs" /> {/* Adjusted icon size and margin */}
      Agenda de la semaine
    </h3>
    <div className="flex items-center justify-center h-[100px]"> {/* Adjusted height */}
      <FontAwesomeIcon icon={faSpinner} spin className="text-jdc-yellow text-xl mr-2" />
      <span className="text-jdc-gray-400 text-sm">Chargement de l'agenda...</span> {/* Adjusted text size */}
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

  const [isTicketsDrawerOpen, setIsTicketsDrawerOpen] = useState(false); // État pour le tiroir des tickets
  const [isShipmentsDrawerOpen, setIsShipmentsDrawerOpen] = useState(false); // État pour le tiroir des envois

  const recentTickets: SapTicket[] = (serializedTickets ?? []).map(ticket => ({
    ...ticket,
    date: parseSerializedDateNullable(ticket.date),
    mailDate: parseSerializedDateOptional(ticket.mailDate), // Explicitly parse mailDate
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
    <div className="space-y-1"> {/* Further reduced space-y */}
      {/* Page Title */}
      <h1 className="text-xl font-semibold text-white mb-2">Tableau de Bord</h1> {/* Reduced title size and margin */}

      {/* Client Error Message */}
      {clientError && (
        <div className="flex items-center p-1 bg-red-800 text-white rounded-lg mb-1 text-xs"> {/* Reduced padding and margin, smaller text */}
          <FontAwesomeIcon icon={faExclamationTriangle} className="mr-1" /> {/* Reduced icon margin */}
          {clientError}
        </div>
      )}

      {/* Main Dashboard Grid - Compact layout */}
      <div className="flex gap-2"> {/* Flex container with gap */}
        {/* Left Column: Stats Cards - More compact */}
        <div className="w-[10%] grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-1 auto-rows-min min-h-[234px]"> {/* Colonne 1 - 25% fixe avec hauteur augmentée */}
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

        {/* Middle Column (Recent Activity & Installations) */}
        <div className="w-[65%] space-y-1"> {/* Colonne 2 - 45% */}
            {/* Recent Activity - More compact */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2"> {/* Gap remains 2 */}
              {/* Recent Tickets - Clickable to open drawer */}
              <div
                className="h-[80px] cursor-pointer" // Added cursor-pointer
                onClick={() => setIsTicketsDrawerOpen(true)} // Added onClick handler
              >
                <RecentTickets
                  tickets={recentTickets.slice(0, 5)}
                  isLoading={false}
                />
              </div>
              {/* Recent Shipments - Clickable to open drawer */}
              <div
                className="h-[80px] cursor-pointer" // Added cursor-pointer
                onClick={() => setIsShipmentsDrawerOpen(true)} // Added onClick handler
              >
                <RecentShipments
                  shipments={recentShipments}
                  isLoading={false}
                />
              </div>
            </div>

            {/* Installations Snapshot */}
            <div className="h-[300px] mb-4">
              <InstallationsSnapshot
                allInstallations={installations}
                isLoading={false}
              />
            </div>

            {/* Weekly Agenda */}
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

          {/* Right Column (Map only) */}
          <div className="w-[45%]"> {/* Colonne 3 - 45% */}
            {/* Map Section */}
            <div className="h-[850px]"> {/* Increased height to fill space */}
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

          {/* Login Prompt (outside the grid for consistent placement) */}
          {!user && !clientError && (
            <div className="p-1 bg-jdc-card rounded-lg text-center text-jdc-gray-300 text-xs w-full"> {/* Modified to span full width */}
              Veuillez vous connecter pour voir le tableau de bord.
            </div>
          )}
        </div>

      {/* Tickets Drawer */}
      <Drawer isOpen={isTicketsDrawerOpen} onClose={() => setIsTicketsDrawerOpen(false)} side="right">
        <h2 className="text-xl font-semibold text-white mb-4">Tickets SAP</h2>
        {/* Full list of tickets will go here */}
        {/* For now, just show the RecentTickets component */}
        <RecentTickets
          tickets={recentTickets} // Pass all tickets
          isLoading={false}
        />
      </Drawer>

      {/* Shipments Drawer */}
      <Drawer isOpen={isShipmentsDrawerOpen} onClose={() => setIsShipmentsDrawerOpen(false)} side="right">
        <h2 className="text-xl font-semibold text-white mb-4">Envois CTN</h2>
        {/* Full list of shipments will go here */}
        {/* For now, just show the RecentShipments component */}
        <RecentShipments
          shipments={recentShipments} // Pass all shipments
          isLoading={false}
        />
      </Drawer>
    </div>
  );
}
