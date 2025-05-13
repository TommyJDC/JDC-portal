import React from 'react';
import { Link } from '@remix-run/react';
import { FaPlusCircle, FaMapMarkedAlt, FaCalendarAlt, FaStore, FaClipboardList, FaTruck, FaFileDownload, FaLifeRing, FaQuestionCircle, FaTicketAlt } from 'react-icons/fa';

const actions = [
  {
    label: 'Tickets ouverts',
    to: '/tickets-sap?statut=ouvert',
    icon: FaTicketAlt,
    color: 'text-red-500',
    ring: 'focus:ring-yellow-400',
  },
  {
    label: 'Installations à planifier',
    to: '/installations?statut=a-planifier',
    icon: FaStore,
    color: 'from-blue-400 to-blue-600 text-white',
    ring: 'focus:ring-blue-400',
  },
  {
    label: 'Expédition',
    to: '/envois-ctn',
    icon: FaTruck,
    color: 'from-orange-400 to-orange-600 text-white',
    ring: 'focus:ring-orange-400',
  },
  {
    label: 'Voir la carte',
    to: '/dashboard#map',
    icon: FaMapMarkedAlt,
    color: 'from-pink-400 to-pink-600 text-white',
    ring: 'focus:ring-pink-400',
  },
  {
    label: 'Agenda',
    to: '/dashboard#agenda',
    icon: FaCalendarAlt,
    color: 'from-green-400 to-green-600 text-white',
    ring: 'focus:ring-green-400',
  },
  {
    label: 'Installations',
    to: '/installations',
    icon: FaStore,
    color: 'from-purple-400 to-purple-600 text-white',
    ring: 'focus:ring-purple-400',
  },
];

export const QuickActions: React.FC = () => (
  <div className="flex flex-col gap-6 items-center animate-fade-in-up">
    {actions.map((action, idx) => (
      <div className="relative" key={action.label}>
        <Link
          to={action.to}
          className={`group flex flex-col items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br ${action.color} shadow-xl border-2 border-white/20 hover:scale-110 hover:shadow-2xl transition-all duration-300 ${action.ring} focus:outline-none animate-fade-in-up`}
          style={{ animationDelay: `${0.1 + idx * 0.1}s` }}
          tabIndex={0}
        >
          <action.icon className="text-4xl mb-2 drop-shadow group-hover:animate-bounce" />
          <span className="text-base font-bold text-center drop-shadow group-hover:text-white transition-colors">{action.label}</span>
        </Link>
      </div>
    ))}
  </div>
); 