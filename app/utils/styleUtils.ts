import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Existing styles for shipment status
const shipmentStatusStyles = {
  OUI: { bgColor: 'bg-green-700', textColor: 'text-green-100' },
  NON: { bgColor: 'bg-red-700', textColor: 'text-red-100' },
  DEFAULT: { bgColor: 'bg-jdc-gray-700', textColor: 'text-jdc-gray-200' },
};

export function getShipmentStatusStyle(status: string | undefined | null): { bgColor: string; textColor: string } {
  const upperStatus = status?.toUpperCase();
  if (upperStatus === 'OUI') {
    return shipmentStatusStyles.OUI;
  }
  if (upperStatus === 'NON') {
    return shipmentStatusStyles.NON;
  }
  return shipmentStatusStyles.DEFAULT;
}

// --- Add styles for ticket status ---
// Define styles based on potential ticket status values. Adjust these as needed.
const ticketStatusStyles = {
  // Updated styles based on user request
  OUVERT: { bgColor: 'bg-green-600', textColor: 'text-green-100' }, // Vert
  CLOTURE: { bgColor: 'bg-red-600', textColor: 'text-red-100' }, // Rouge
  EN_ATTENTE: { bgColor: 'bg-blue-600', textColor: 'text-blue-100' }, // Bleu
  DEMANDE_DE_RMA: { bgColor: 'bg-orange-600', textColor: 'text-orange-100' }, // Orange
  MATERIAL_SENT: { bgColor: 'bg-orange-600', textColor: 'text-orange-100' }, // Orange

  // Keep existing styles for other potential statuses or fallbacks
  NOUVEAU: { bgColor: 'bg-blue-600', textColor: 'text-blue-100' }, // Assuming NOUVEAU is similar to EN_ATTENTE or OUVERT, keeping blue for now or could change to green if it means 'new and open'
  EN_COURS: { bgColor: 'bg-yellow-600', textColor: 'text-yellow-100' },
  RESOLU: { bgColor: 'bg-green-600', textColor: 'text-green-100' }, // Assuming RESOLU is similar to OUVERT, keeping green
  FERME: { bgColor: 'bg-gray-600', textColor: 'text-gray-100' }, // Keeping gray for FERME if different from CLOTURE
  ANNULE: { bgColor: 'bg-red-600', textColor: 'text-red-100' }, // Keeping red for ANNULE
  A_CLOTUREE: { bgColor: 'bg-teal-600', textColor: 'text-teal-100' },
  NA: { bgColor: 'bg-jdc-gray-700', textColor: 'text-jdc-gray-200' },
  DEFAULT: { bgColor: 'bg-jdc-gray-700', textColor: 'text-jdc-gray-200' },
};

/**
 * Returns Tailwind CSS classes for styling a ticket status badge.
 * @param status The status string of the ticket.
 * @returns Object containing bgColor and textColor classes.
 */
export function getTicketStatusStyle(status: string | undefined | null): { bgColor: string; textColor: string } {
  // Add log here
  console.log(`getTicketStatusStyle received status: "${status}", Type: ${typeof status}`);
  // Use the status directly, converting to uppercase for case-insensitivity and trimming whitespace
  const upperStatus = status?.trim().toUpperCase();
  console.log(`getTicketStatusStyle processed status: "${upperStatus}"`);

  switch (upperStatus) {
    // Map common English statuses to French styles
    case 'OPEN':
      return ticketStatusStyles.OUVERT; // Vert
    case 'CLOSED':
      return ticketStatusStyles.CLOTURE; // Rouge
    case 'PENDING':
    case 'WAITING': // Added waiting as a potential synonym
      return ticketStatusStyles.EN_ATTENTE; // Bleu
    case 'IN PROGRESS':
    case 'PROCESSING': // Added processing as a potential synonym
      return ticketStatusStyles.EN_COURS; // Jaune
    case 'RESOLVED':
    case 'COMPLETED': // Added completed as a potential synonym
      return ticketStatusStyles.RESOLU; // Vert
    case 'CANCELLED':
      return ticketStatusStyles.ANNULE; // Rouge
    case 'MATERIAL SENT': // Added material sent
      return ticketStatusStyles.MATERIAL_SENT; // Orange


    // Map French display statuses from dropdown and SAP statuses to the new colors
    case 'OUVERT':
    case 'NOUVEAU':
      return ticketStatusStyles.OUVERT; // Vert

    case 'CLÔTURÉ': // Match the exact string from the dropdown (with accent)
    case 'CLOTURE':
    case 'FERME':
      return ticketStatusStyles.CLOTURE; // Rouge

    case 'EN ATTENTE (PAS DE RÉPONSE)': // Match the exact string from the dropdown
    case 'EN_ATTENTE':
    case 'ATTENTE_CLIENT':
      return ticketStatusStyles.EN_ATTENTE; // Bleu

    case 'DEMANDE DE RMA': // Match the exact string from the dropdown
    case 'DEMANDE_DE_RMA':
    case 'DEMANDE D\'ENVOI MATERIEL': // Match the exact string from the dropdown
    case 'MATERIAL_SENT':
      return ticketStatusStyles.DEMANDE_DE_RMA; // Orange (using DEMANDE_DE_RMA style as it's the first orange defined)

    // Keep existing mappings for other statuses if they exist and need specific colors
    case 'EN_COURS':
    case 'EN_TRAITEMENT':
      return ticketStatusStyles.EN_COURS; // Jaune (keeping existing)
    case 'RESOLU':
    case 'TERMINE':
      return ticketStatusStyles.RESOLU; // Vert (keeping existing, matches OUVERT now)
    case 'ANNULE':
      return ticketStatusStyles.ANNULE; // Rouge (keeping existing, matches CLOTURE now)
    case 'A_CLOTUREE':
    case 'A_CLÔTURÉE':
      return ticketStatusStyles.A_CLOTUREE; // Teal (keeping existing)
    case 'N/A':
      return ticketStatusStyles.NA; // Gris (keeping existing)


    default:
      // Log unknown statuses for potential addition
      if (status) {
        console.warn(`Unknown ticket status encountered: "${status}". Using default style.`);
      }
      return ticketStatusStyles.DEFAULT; // Gris par défaut
  }
}
