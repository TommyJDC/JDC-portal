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
  NOUVEAU: { bgColor: 'bg-blue-600', textColor: 'text-blue-100' },
  EN_COURS: { bgColor: 'bg-yellow-600', textColor: 'text-yellow-100' },
  RESOLU: { bgColor: 'bg-green-600', textColor: 'text-green-100' },
  FERME: { bgColor: 'bg-gray-600', textColor: 'text-gray-100' },
  ANNULE: { bgColor: 'bg-red-600', textColor: 'text-red-100' },
  EN_ATTENTE: { bgColor: 'bg-purple-600', textColor: 'text-purple-100' },
  DEMANDE_DE_RMA: { bgColor: 'bg-purple-700', textColor: 'text-purple-100' }, // Added style for RMA
  A_CLOTUREE: { bgColor: 'bg-teal-600', textColor: 'text-teal-100' }, // Added style for A Cloturee
  DEFAULT: { bgColor: 'bg-jdc-gray-700', textColor: 'text-jdc-gray-200' },
};

/**
 * Returns Tailwind CSS classes for styling a ticket status badge.
 * @param status The status string of the ticket.
 * @returns Object containing bgColor and textColor classes.
 */
export function getTicketStatusStyle(status: string | undefined | null): { bgColor: string; textColor: string } {
  const upperStatus = status?.toUpperCase().replace(/\s+/g, '_'); // Normalize status (e.g., "En Cours" -> "EN_COURS")

  switch (upperStatus) {
    case 'NOUVEAU':
    case 'OUVERT': // Add synonyms if needed
      return ticketStatusStyles.NOUVEAU;
    case 'EN_COURS':
    case 'EN_TRAITEMENT':
      return ticketStatusStyles.EN_COURS;
    case 'RESOLU':
    case 'TERMINE':
      return ticketStatusStyles.RESOLU;
    case 'FERME':
    case 'CLOTURE':
      return ticketStatusStyles.FERME;
    case 'ANNULE':
      return ticketStatusStyles.ANNULE;
    case 'EN_ATTENTE':
    case 'ATTENTE_CLIENT':
      return ticketStatusStyles.EN_ATTENTE;
    case 'DEMANDE_DE_RMA': // Added case
      return ticketStatusStyles.DEMANDE_DE_RMA;
    case 'A_CLOTUREE': // Added case
      return ticketStatusStyles.A_CLOTUREE;
    default:
      // Log unknown statuses for potential addition
      if (status) {
        console.warn(`Unknown ticket status encountered: "${status}". Using default style.`);
      }
      return ticketStatusStyles.DEFAULT;
  }
}
