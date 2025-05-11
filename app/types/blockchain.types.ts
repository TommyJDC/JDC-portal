import type { UserSession } from "~/services/session.server";

export interface BlockchainUserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  secteurs: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BlockchainSapTicket {
  id: string;
  numeroSAP: string;
  raisonSociale: string;
  client: string;
  codeClient: string;
  secteur: string;
  statut: string;
  description: string;
  date: string | null;
  telephone: string | null;
  adresse: string | null;
  deducedSalesperson: string | null;
  contactAttempts?: Array<{
    date: string | null;
    notes: string;
    outcome: string;
  }>;
}

export interface BlockchainShipment {
  id: string;
  numeroCTN: string;
  client: string;
  secteur: string;
  dateLivraison: string | null;
  statut: string;
  produits: string[];
}

export interface BlockchainInstallation {
  id: string;
  client: string;
  secteur: string;
  statut: string;
  dateInstallation: string | null;
  adresse: string;
  contacts: string[];
}

export interface BlockchainStats {
  clientCount: number | null;
  clientEvolution: number | null;
  installations: {
    [sector: string]: {
      total: number;
      enAttente: number;
      planifiees: number;
      terminees: number;
    }
  };
  ticketCounts: Record<string, number>;
}

export interface BlockchainTransaction {
  contractName: string;
  eventName: string;
  timestamp: number;
  data: Record<string, any>;
  transactionHash: string;
  blockNumber: number;
}
