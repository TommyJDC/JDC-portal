import { useEffect, useState, useCallback } from 'react'; // Added useCallback
import { Button } from '~/components/ui/Button';
import { useFetcher } from '@remix-run/react'; // Pour appeler une action/loader pour obtenir le token

interface DriveFilePickerProps {
  onSelect: (fileId: string) => void;
}

// Déclarer les variables globales pour les API Google (définies par le script externe)
declare global {
  const gapi: any; // Utilisation de 'any' car le type précis de gapi est complexe et défini globalement
  const google: any; // Utilisation de 'any' car le type précis de google est complexe et défini globalement
}

export function DriveFilePicker({ onSelect }: DriveFilePickerProps) {
  const [pickerApiLoaded, setPickerApiLoaded] = useState(false);
  const fetcher = useFetcher<{ accessToken?: string; error?: string }>(); // Pour obtenir le token d'accès

  // Charger les bibliothèques Google API
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => {
      gapi.load('picker', () => setPickerApiLoaded(true));
      // Charger la bibliothèque cliente pour l'authentification
      gapi.load('client:auth2', () => {
        // Initialiser le client API Google
        // Vous aurez besoin de votre GOOGLE_CLIENT_ID ici
        gapi.client.init({
          apiKey: process.env.VITE_GOOGLE_API_KEY, // Assurez-vous d'avoir une clé API pour le Picker
          clientId: process.env.VITE_GOOGLE_CLIENT_ID,
          scope: 'https://www.googleapis.com/auth/drive.readonly', // Scope nécessaire pour lire les fichiers
          discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        }).then(() => {
           // Le client est initialisé, mais l'utilisateur n'est pas encore authentifié via ce client ici.
           // L'authentification est gérée par Remix-Auth.
           // Nous allons obtenir le token via notre loader Remix.
        });
      });
    };
    document.body.appendChild(script);

    // Nettoyage si le composant est démonté
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // Fonction de callback du Picker
  const pickerCallback = useCallback((data: any) => { // Utilisation de 'any' pour le type de data car il dépend de l'API Google Picker
    if (data.action === google.picker.Action.PICKED) {
      const fileId = data.docs[0].id;
      onSelect(fileId);
    }
  }, [onSelect]); // Added onSelect dependency

  // Ouvrir le Google Picker
  const openPicker = async () => {
    if (!pickerApiLoaded) {
      console.log("Google Picker API non chargée.");
      return;
    }

    // Obtenir le token d'accès de l'utilisateur authentifié via le loader Remix
    fetcher.submit(null, { method: 'get', action: '/api/google-token' });
  };

  // Utiliser le token d'accès une fois qu'il est chargé par le fetcher
  useEffect(() => {
    if (fetcher.data && fetcher.data.accessToken) {
      const oauthToken = fetcher.data.accessToken;

      const view = new google.picker.View(google.picker.ViewId.SPREADSHEETS); // Sélectionner uniquement les feuilles de calcul

      const picker = new google.picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(oauthToken) // Utiliser le token OAuth de l'utilisateur
        // .setDeveloperKey('YOUR_DEVELOPER_KEY') // La clé développeur n'est pas toujours nécessaire avec OAuth
        .setCallback(pickerCallback)
        .build();

      picker.setVisible(true);

    } else if (fetcher.data && fetcher.data.error) {
       alert(`Erreur lors de l'obtention du token Google: ${fetcher.data.error}`);
       // TODO: Gérer la redirection vers la page de connexion si nécessaire
    }
  }, [fetcher.data, pickerCallback]); // Added pickerCallback dependency


  return (
    <Button onClick={openPicker} disabled={!pickerApiLoaded || fetcher.state === 'loading'}>
      {fetcher.state === 'loading' ? 'Chargement...' : 'Choisir le fichier de déclaration sur Google Drive'}
    </Button>
  );
}
