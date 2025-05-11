import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Existing styles for shipment status
const shipmentStatusStyles = {
  OUI: { bgColor: 'bg-green-500/10', textColor: 'text-green-700', borderColor: 'border-green-500/30' }, // Adapté au nouveau thème
  NON: { bgColor: 'bg-red-500/10', textColor: 'text-red-700', borderColor: 'border-red-500/30' }, // Adapté au nouveau thème
  DEFAULT: { bgColor: 'bg-ui-background/50', textColor: 'text-text-tertiary', borderColor: 'border-ui-border/30' }, // Adapté au nouveau thème
};

export function getShipmentStatusStyle(status: string | undefined | null): { bgColor: string; textColor: string; borderColor: string } {
  const upperStatus = status?.toUpperCase();
  if (upperStatus === 'OUI' || upperStatus === 'LIVRÉ' || upperStatus === 'DELIVERED') { // Ajout de synonymes
    return shipmentStatusStyles.OUI;
  }
  if (upperStatus === 'NON' || upperStatus === 'ANNULÉ' || upperStatus === 'CANCELLED' || upperStatus === 'PROBLÈME') { // Ajout de synonymes
    return shipmentStatusStyles.NON;
  }
  // Pourrait ajouter d'autres statuts comme 'EN COURS', 'EXPÉDIÉ'
  return shipmentStatusStyles.DEFAULT;
}

// --- Add styles for ticket status ---
// Define styles based on potential ticket status values.
const ticketStatusStyles: { [key: string]: { bgColor: string; textColor: string; borderColor: string } } = {
  OUVERT: { bgColor: 'bg-brand-blue/20', textColor: 'text-brand-blue-light', borderColor: 'border-brand-blue/30' },
  CLOTURE: { bgColor: 'bg-ui-border/30', textColor: 'text-text-secondary', borderColor: 'border-ui-border/50' },
  EN_ATTENTE: { bgColor: 'bg-yellow-500/10', textColor: 'text-yellow-400', borderColor: 'border-yellow-500/30' },
  DEMANDE_DE_RMA: { bgColor: 'bg-orange-500/10', textColor: 'text-orange-400', borderColor: 'border-orange-500/30' },
  MATERIAL_SENT: { bgColor: 'bg-orange-500/10', textColor: 'text-orange-400', borderColor: 'border-orange-500/30' },
  NOUVEAU: { bgColor: 'bg-brand-blue/20', textColor: 'text-brand-blue-light', borderColor: 'border-brand-blue/30' },
  EN_COURS: { bgColor: 'bg-sky-500/10', textColor: 'text-sky-400', borderColor: 'border-sky-500/30' }, // Using sky for "en cours"
  RESOLU: { bgColor: 'bg-brand-blue/20', textColor: 'text-brand-blue-light', borderColor: 'border-brand-blue/30' },
  FERME: { bgColor: 'bg-ui-border/30', textColor: 'text-text-secondary', borderColor: 'border-ui-border/50' },
  ANNULE: { bgColor: 'bg-red-500/10', textColor: 'text-red-400', borderColor: 'border-red-500/30' },
  A_CLOTUREE: { bgColor: 'bg-teal-500/10', textColor: 'text-teal-400', borderColor: 'border-teal-500/30' },
  NA: { bgColor: 'bg-ui-background/50', textColor: 'text-text-tertiary', borderColor: 'border-ui-border/30' },
  DEFAULT: { bgColor: 'bg-ui-background/50', textColor: 'text-text-tertiary', borderColor: 'border-ui-border/30' },
};

/**
 * Returns Tailwind CSS classes for styling a ticket status badge.
 * @param status The status string of the ticket.
 * @returns Object containing bgColor, textColor, and borderColor classes.
 */
export function getTicketStatusStyle(status: string | object | undefined | null): { bgColor: string; textColor: string; borderColor: string } {
  if (typeof status === 'object' && status !== null) {
    console.warn(`getTicketStatusStyle a reçu un objet au lieu d'une chaîne. Utilisation du style par défaut.`);
    return ticketStatusStyles.DEFAULT;
  }
  
  const upperStatus = typeof status === 'string' ? status.trim().toUpperCase().replace(/\s+/g, '_') : '';

  switch (upperStatus) {
    case 'OPEN': return ticketStatusStyles.OUVERT;
    case 'CLOSED': return ticketStatusStyles.CLOTURE;
    case 'PENDING':
    case 'WAITING':
    case 'EN_ATTENTE_(PAS_DE_RÉPONSE)': // Normalisé
    case 'EN_ATTENTE':
    case 'ATTENTE_CLIENT':
      return ticketStatusStyles.EN_ATTENTE;
    case 'IN_PROGRESS':
    case 'PROCESSING':
    case 'EN_COURS':
    case 'EN_TRAITEMENT':
      return ticketStatusStyles.EN_COURS;
    case 'RESOLVED':
    case 'COMPLETED':
    case 'RESOLU':
    case 'TERMINE':
      return ticketStatusStyles.RESOLU;
    case 'CANCELLED':
    case 'ANNULE':
      return ticketStatusStyles.ANNULE;
    case 'MATERIAL_SENT':
    case 'DEMANDE_DE_RMA':
    case 'DEMANDE_D\'ENVOI_MATERIEL': // Normalisé
      return ticketStatusStyles.DEMANDE_DE_RMA;
    case 'OUVERT':
    case 'NOUVEAU':
      return ticketStatusStyles.OUVERT;
    case 'CLÔTURÉ': // Avec accent
    case 'CLOTURE':
    case 'FERME':
      return ticketStatusStyles.CLOTURE;
    case 'A_CLOTUREE':
    case 'A_CLÔTURÉE': // Avec accent
      return ticketStatusStyles.A_CLOTUREE;
    case 'N/A':
      return ticketStatusStyles.NA;
    default:
      if (status) {
        console.warn(`Unknown ticket status encountered: "${status}". Using default style.`);
      }
      return ticketStatusStyles.DEFAULT;
  }
}

// --- Add styles for installation status ---
import { FaClock, FaCheckCircle, FaCalendarCheck, FaExclamationCircle } from 'react-icons/fa';
// Définition du type InstallationStatus car il n'existe pas dans firestore.types.ts
type InstallationStatus = 'rendez-vous à prendre' | 'rendez-vous pris' | 'installation terminée';

// Define colors for installation statuses
const installationStatusColors: Record<InstallationStatus | 'DEFAULT', string> = {
  'rendez-vous à prendre': '#f59e0b', // Amber 500
  'rendez-vous pris': '#3b82f6', // Blue 500
  'installation terminée': '#10b981', // Emerald 500
  'DEFAULT': '#6b7280', // Gray 500
};

// Define icons for installation statuses
const installationStatusIcons: Record<InstallationStatus | 'DEFAULT', React.ElementType> = {
  'rendez-vous à prendre': FaClock,
  'rendez-vous pris': FaCalendarCheck,
  'installation terminée': FaCheckCircle,
  'DEFAULT': FaExclamationCircle,
};

/**
 * Returns the color associated with an installation status.
 * @param status The status string of the installation.
 * @returns A hex color string.
 */
export function getStatusColor(status: InstallationStatus | undefined | null): string {
  return installationStatusColors[status || 'DEFAULT'] || installationStatusColors['DEFAULT'];
}

/**
 * Returns the icon component associated with an installation status.
 * @param status The status string of the installation.
 * @returns A React icon component.
 */
export function getStatusIcon(status: InstallationStatus | undefined | null): React.ElementType {
  return installationStatusIcons[status || 'DEFAULT'] || installationStatusIcons['DEFAULT'];
}
