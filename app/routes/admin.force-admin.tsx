import React, { useState } from 'react';
import { Form, useActionData, useNavigation } from '@remix-run/react';
import { json, redirect, type ActionFunctionArgs } from '@remix-run/node';
// import { authenticator } from '~/services/auth.server'; // Plus utilisé directement
import { sessionStorage, type UserSessionData } from "~/services/session.server"; // Importer sessionStorage et UserSessionData
import { createUserProfileSdk } from '~/services/firestore.service.server';
import type { UserProfile } from '~/types/firestore.types';

export async function action({ request }: ActionFunctionArgs) {
  try {
    // Vérifier que l'utilisateur est authentifié
    const session = await sessionStorage.getSession(request.headers.get("Cookie"));
    const userSession: UserSessionData | null = session.get("user") ?? null;

    if (!userSession) {
      return json({ error: "Vous devez être connecté pour utiliser cette fonctionnalité (session manuelle)" }, { status: 401 });
    }
    
    const formData = await request.formData();
    const email = formData.get('email') as string;
    const securityKey = formData.get('securityKey') as string;
    
    // Clé de sécurité pour autoprotection (changer cette valeur dans un environnement de production)
    const SECURITY_KEY = "jdc_admin_security_2023";
    
    if (securityKey !== SECURITY_KEY) {
      return json({ error: "Clé de sécurité invalide" }, { status: 403 });
    }
    
    // Préparer les données du profil utilisateur pour Firestore
    const userProfileData: UserProfile = {
      uid: userSession.userId, // Utiliser userSession
      email: email || userSession.email || "", // Utiliser userSession
      displayName: userSession.displayName || "Admin", // Utiliser userSession
      role: "Admin",
      secteurs: ["CHR", "HACCP", "Kezia", "Tabac"], // Tous les secteurs
      nom: userSession.displayName || "Administrateur", // Utiliser userSession
      phone: "",
      createdAt: new Date(), // Restauré
      updatedAt: new Date(), // Restauré
      address: "",
      googleRefreshToken: userSession.googleRefreshToken || "", // Utiliser userSession
      isGmailProcessor: false,
      gmailAuthorizedScopes: [],
      gmailAuthStatus: "inactive",
      labelSapClosed: "",
      labelSapNoResponse: "",
      labelSapRma: ""
      // Les autres champs optionnels de UserProfile (blockchainAddress, encryptedWallet, etc.) seront undefined
    };
    
    // Créer un profil admin pour l'utilisateur via Firestore
    await createUserProfileSdk(userProfileData); // Modifié pour Firestore
    
    return redirect("/admin?created=true");
  } catch (error) {
    console.error("Erreur lors de la création du profil admin:", error);
    return json({ 
      error: error instanceof Error ? error.message : "Erreur inconnue lors de la création du profil" 
    }, { status: 500 });
  }
}

export default function ForceAdmin() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [securityKey, setSecurityKey] = useState("");
  
  return (
    <div className="max-w-md mx-auto p-6 bg-jdc-gray-800 rounded-lg shadow-lg mt-10">
      <h1 className="text-2xl font-bold text-white mb-6">Création d'urgence d'un profil admin</h1>
      
      {actionData?.error && (
        <div className="bg-red-900/30 p-4 mb-4 rounded border border-red-700">
          <p className="text-red-300">{actionData.error}</p>
        </div>
      )}
      
      <Form method="post" className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-jdc-gray-300 mb-1">Email (optionnel)</label>
          <input
            type="email"
            name="email"
            className="w-full p-2 bg-jdc-gray-900 text-white rounded"
            placeholder="Laisser vide pour utiliser l'email de votre compte"
          />
        </div>
        
        <div>
          <label htmlFor="securityKey" className="block text-jdc-gray-300 mb-1">Clé de sécurité</label>
          <input
            type="password"
            name="securityKey"
            value={securityKey}
            onChange={e => setSecurityKey(e.target.value)}
            className="w-full p-2 bg-jdc-gray-900 text-white rounded"
            required
          />
          <p className="text-xs text-jdc-gray-400 mt-1">Clé de sécurité requise pour créer un profil admin</p>
        </div>
        
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting || !securityKey}
            className="w-full py-2 bg-jdc-blue text-white rounded disabled:opacity-50"
          >
            {isSubmitting ? "Création en cours..." : "Créer profil admin"}
          </button>
        </div>
        
        <div className="text-center mt-4">
          <a href="/admin" className="text-jdc-yellow text-sm hover:underline">Retour à l'administration</a>
        </div>
      </Form>
      
      <div className="mt-8 p-3 bg-jdc-gray-900 rounded text-xs text-jdc-gray-400">
        <p className="font-semibold mb-1">Note:</p>
        <p>Cette page est réservée aux administrateurs système. Utiliser cette fonctionnalité uniquement en cas de problème d'accès avec votre compte. Tout accès non autorisé sera enregistré.</p>
      </div>
    </div>
  );
}
