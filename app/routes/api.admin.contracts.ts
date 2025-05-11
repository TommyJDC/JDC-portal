import { json } from '@remix-run/node';
import type { LoaderFunctionArgs } from '@remix-run/node';
// import { authenticator } from '~/services/auth.server'; // Plus utilisé directement
import { sessionStorage, type UserSessionData } from "~/services/session.server"; // Importer sessionStorage et UserSessionData
// Les importations suivantes ne sont plus nécessaires car la blockchain n'est plus utilisée pour ces informations.
// import { 
//   getUserProfileFromBlockchain,
//   getAllUserProfilesFromBlockchain
// } from '~/services/blockchain.service.server';
// import { CONTRACT_ADDRESSES } from '../../scripts/contractAddresses.mjs';
// import { ethers } from 'ethers';
// import fs from 'fs';
// import path from 'path';

interface ContractInfo { // Cette interface peut être supprimée si l'UI n'attend plus cette structure
  name: string;
  address: string;
  status: "ok" | "warning" | "error";
  message: string;
  lastTransaction?: string;
  deployDate?: string;
  abi?: any[];
  functions?: string[];
  events?: string[];
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Mode développement - vérifions s'il y a un paramètre de bypass
    const url = new URL(request.url);
    const devBypass = url.searchParams.get("dev_bypass") === "true";

    // Vérifier l'authentification
    const session = await sessionStorage.getSession(request.headers.get("Cookie"));
    const userSession: UserSessionData | null = session.get("user") ?? null;
    
    if (!userSession && !devBypass) {
      console.log("[api.admin.contracts] Authentification échouée (session manuelle)");
      return json({ error: "Non authentifié" }, { status: 401 });
    }

    // En mode bypass ou avec un utilisateur authentifié
    // let userProfile = null; // userProfile n'est pas utilisé dans la logique actuelle de cette route
    
    if (userSession) {
      // La vérification des permissions admin devrait se faire ici si nécessaire
      // Par exemple, en utilisant requireAdminUser ou en vérifiant userSession.role
      // Pour l'instant, cette route ne semble pas restreinte aux admins si authentifié.
      console.log("[api.admin.contracts] Utilisateur authentifié:", userSession.userId);
    } else if (devBypass) {
      console.log("[api.admin.contracts] Mode bypass développement activé");
    }

    // La logique de collecte d'informations sur les contrats blockchain est supprimée.
    console.log("[api.admin.contracts] Les informations sur les contrats blockchain ne sont plus pertinentes.");

    return json({ 
        message: "Les informations sur les contrats blockchain ne sont plus affichées car l'application utilise maintenant Firestore pour la gestion des données.",
        contracts: {} // Retourner un objet vide pour maintenir la structure si l'UI l'attend encore.
    });

  } catch (error) {
    console.error("[api.admin.contracts] Erreur critique:", error);
    return json({ 
      error: "Erreur lors de la récupération des informations sur les contrats",
      contracts: {} 
    }, { status: 500 });
  }
}
