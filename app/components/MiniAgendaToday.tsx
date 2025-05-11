import React from 'react';
import { FaCalendarAlt, FaTicketAlt, FaStore } from 'react-icons/fa';

interface Event {
  id: string;
  type: 'ticket' | 'installation' | 'agenda';
  title: string;
  heure: string;
  lieu?: string;
}

// Données factices pour la démo
const todayEvents: Event[] = [
  { id: '1', type: 'ticket', title: 'Ticket SAP #12345', heure: '09:00', lieu: 'Lyon' },
  { id: '2', type: 'installation', title: 'Installation Tabac Central', heure: '11:00', lieu: 'Grenoble' },
  { id: '3', type: 'agenda', title: 'Réunion équipe', heure: '15:00', lieu: 'Teams' },
];

const typeIcons = {
  ticket: FaTicketAlt,
  installation: FaStore,
  agenda: FaCalendarAlt,
};
const typeColors = {
  ticket: 'bg-yellow-400/20 text-yellow-400',
  installation: 'bg-blue-400/20 text-blue-400',
  agenda: 'bg-green-400/20 text-green-400',
};

export const MiniAgendaToday: React.FC<{ events?: Event[] }> = ({ events = todayEvents }) => (
  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-white/20 mb-6 animate-fade-in-up flex flex-col gap-3">
    <div className="flex items-center justify-between mb-2">
      <h4 className="text-lg font-bold text-white flex items-center gap-2">
        <FaCalendarAlt className="text-jdc-yellow" /> Aujourd'hui
      </h4>
      <a href="/dashboard#agenda" className="text-jdc-yellow-200 text-sm font-semibold hover:underline">Voir l'agenda complet</a>
    </div>
    {events.length === 0 ? (
      <div className="text-jdc-gray-300 text-sm">Aucun événement aujourd'hui.</div>
    ) : (
      <ul className="flex flex-col gap-2">
        {events.map((ev, idx) => {
          const Icon = typeIcons[ev.type];
          return (
            <li key={ev.id} className={`flex items-center gap-3 p-2 rounded-xl ${typeColors[ev.type]} animate-fade-in-up`} style={{ animationDelay: `${0.1 + idx * 0.1}s` }}>
              <Icon className="text-xl drop-shadow" />
              <div className="flex flex-col flex-1">
                <span className="font-semibold text-white text-sm">{ev.title}</span>
                <span className="text-xs text-jdc-gray-200">{ev.lieu}</span>
              </div>
              <span className="text-xs font-mono text-jdc-yellow-200">{ev.heure}</span>
            </li>
          );
        })}
      </ul>
    )}
  </div>
); 