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
  MATERIAL_SENT: { bgColor: 'bg-orange-600', textColor: 'text-orange-100' }, // Added style for Material Sent
  NA: { bgColor: 'bg-jdc-gray-700', textColor: 'text-jdc-gray-200' }, // Added style for N/A
  DEFAULT: { bgColor: 'bg-jdc-gray-700', textColor: 'text-jdc-gray-200' },
};

/**
 * Returns Tailwind CSS classes for styling a ticket status badge.
 * @param status The status string of the ticket.
 * @returns Object containing bgColor and textColor classes.
 */
export function getTicketStatusStyle(status: string | undefined | null): { bgColor: string; textColor: string } {
  // Use the status directly, converting to uppercase for case-insensitivity
  const upperStatus = status?.toUpperCase();

  switch (upperStatus) {
    // Map French display statuses from dropdown
    case 'OUVERT':
      return ticketStatusStyles.NOUVEAU;
    case 'EN ATTENTE (PAS DE RÉPONSE)': // Match the exact string from the dropdown
      return ticketStatusStyles.EN_ATTENTE;
    case 'CLÔTURÉ': // Match the exact string from the dropdown (with accent)
      return ticketStatusStyles.FERME;
    case 'DEMANDE DE RMA': // Match the exact string from the dropdown
      return ticketStatusStyles.DEMANDE_DE_RMA;
    case 'DEMANDE D\'ENVOI MATERIEL': // Match the exact string from the dropdown
      return ticketStatusStyles.MATERIAL_SENT;

    // Keep existing SAP statuses as fallbacks/synonyms if they might still appear
    case 'NOUVEAU':
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
    case 'DEMANDE_DE_RMA':
      return ticketStatusStyles.DEMANDE_DE_RMA;
    case 'A_CLOTUREE':
    case 'A_CLÔTURÉE':
      return ticketStatusStyles.A_CLOTUREE;
    case 'N/A':
      return ticketStatusStyles.NA;
    default:
      // Log unknown statuses for potential addition
      if (status) {
        console.warn(`Unknown ticket status encountered: "${status}". Using default style.`);
      }
      return ticketStatusStyles.DEFAULT;
  }
}
