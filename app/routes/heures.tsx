import React, { useState, useEffect } from "react";
import { Card, CardBody } from "~/components/ui/Card"; // Chemin corrigé, CardContent -> CardBody
import { Button } from "~/components/ui/Button"; // Chemin corrigé
import { Input } from "~/components/ui/Input"; // Chemin corrigé
import { Textarea } from "~/components/ui/Textarea"; // Chemin corrigé
import { Label } from "~/components/ui/Label"; // Chemin corrigé
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/Select"; // Chemin corrigé + imports spécifiques
import { Switch } from "~/components/ui/Switch"; // Ajout du Switch
import { DriveFilePicker } from "~/components/DriveFilePicker"; // Import du composant Picker
import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node"; // Import pour les actions/loaders Remix
import { saveHeuresDraft, getHeuresDraft } from "~/services/firestore.service.server";
import { getISOWeekNumber } from "~/utils/dateUtils";
import { authenticator } from "~/services/auth.server"; // Pour obtenir l'utilisateur connecté
import { useLoaderData } from "@remix-run/react"; // Pour récupérer les données du loader
import { updateHeuresSheet } from "~/services/sheets.service.server"; // Import de la fonction de mise à jour Sheets
import { sendHeuresEmail } from "~/services/gmail.service.server"; // Import de la fonction d'envoi d'email

// TODO: Implémenter la logique de soumission (Update Sheet + Email)

// Interface pour les données horaires d'une journée
interface DailyHoraires {
  jour: string;
  departDomicile: string;
  arriveeAgence: string;
  pause: string;
  repas: string;
  departAgence: string;
  arriveeDomicile: string;
  jourType: string;
  dureeTravail: string;
}

const months = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

// Adapter les jours si nécessaire (ex: inclure Samedi/Dimanche?)
const days = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"]; // Samedi géré séparément

// Structure de données initiale pour un mois
const initializeMonthData = () => {
  return {
    nom: "",
    prenom: "",
    etablissement: "",
    horaires: days.map((day) => ({
      jour: day,
      departDomicile: "",
      arriveeAgence: "",
      pause: "01:00", // Valeur par défaut
      repas: "Titre Restaurant", // Valeur par défaut
      departAgence: "",
      arriveeDomicile: "",
      jourType: "Travail", // Valeur par défaut
      dureeTravail: "", // Sera calculé ou saisi ?
    }) as DailyHoraires), // Caster vers l'interface
    samedi: { // Section Samedi séparée
      present: false, // ou un type spécifique: "Travaillé", "Astreinte", "Repos"
      departDomicile: "",
      arriveeAgence: "",
      pause: "01:00",
      repas: "Titre Restaurant",
      departAgence: "",
      arriveeDomicile: "",
      dureeTravail: "",
    },
    astreinteTotalHeures: "", // Heures totales d'astreinte pour le mois
    commentaire: "",
    selectedFileId: null as string | null, // Pour stocker l'ID du fichier Drive sélectionné
  };
};

// Action Remix pour gérer les requêtes POST (sauvegarde brouillon, soumission)
export async function action({ request }: ActionFunctionArgs) {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login", // Rediriger si non authentifié
  });

  const body = await request.json();
  const { action, fileId, data, sendEmail } = body; // Récupérer sendEmail du body

  // Utiliser l'ID utilisateur de la session authentifiée
  const userId = user.userId;
  const accessToken = user.googleAccessToken; // Récupérer le token d'accès

  if (action === "saveDraft") {
    if (!userId || !fileId || !data) {
      return json({ success: false, error: "Données de brouillon incomplètes." }, { status: 400 });
    }
    try {
      await saveHeuresDraft({ userId, fileId, data });
      return json({ success: true });
    } catch (error) {
      console.error("Erreur lors de la sauvegarde du brouillon Firestore:", error);
      return json({ success: false, error: "Échec de la sauvegarde du brouillon." }, { status: 500 });
    }
  }

  // TODO: Gérer l'action de soumission (update sheet + email)

  if (action === "submitForm") {
    if (!userId || !fileId || !data || accessToken === undefined) { // Vérifier la présence du token
      return json({ success: false, error: "Données de soumission incomplètes ou token d'accès manquant." }, { status: 400 });
    }
    try {
      // Appeler la fonction de mise à jour de la Google Sheet
      await updateHeuresSheet(accessToken, fileId, data);
      console.log(`Feuille ${fileId} mise à jour avec succès.`);

      if (sendEmail) {
        // TODO: Formater le contenu de l'email (par exemple, en HTML)
      const weekNumber = getISOWeekNumber(new Date());
      const emailSubject = `SEMAINE N°${weekNumber} - ${data.nom} ${data.prenom} - ${data.etablissement}`;
      const emailBody = `
        <h1>SEMAINE N°${weekNumber}</h1>
        <h2>Déclaration d'heures</h2>
        <p>Nom: ${data.nom}</p>
        <p>Prénom: ${data.prenom}</p>
        <p>Établissement: ${data.etablissement}</p>
        <h3>Horaires:</h3>
        <ul>
          ${data.horaires.map((h: any) => `
            <li>
              <strong>${h.jour}:</strong><br/>
              Départ: ${h.departDomicile} - Arrivée: ${h.arriveeAgence}<br/>
              Pause: ${h.pause} - Repas: ${h.repas}<br/>
              Total: ${h.dureeTravail}h
            </li>
          `).join('')}
        </ul>
        <p><strong>Astreinte totale:</strong> ${data.astreinteTotalHeures}h</p>
        <p><strong>Commentaire:</strong> ${data.commentaire}</p>
        <p>Fichier Google Sheet: <a href="https://docs.google.com/spreadsheets/d/${fileId}/edit">Accéder au fichier</a></p>
        `; // Exemple de corps HTML

        // Appeler la fonction d'envoi d'email
        await sendHeuresEmail(accessToken, 'alexis.lhersonneau@jdc.fr', emailSubject, emailBody); // Utiliser le accessToken
        console.log(`Email de déclaration d'heures envoyé à alexis.lhersonneau@jdc.fr`);
      }

      return json({ success: true });
    } catch (error) {
      console.error("Erreur lors de la soumission du formulaire ou de la mise à jour Sheets:", error);
      return json({ success: false, error: "Échec de la soumission du formulaire." }, { status: 500 });
    }
  }

  return json({ success: false, error: "Action non reconnue." }, { status: 400 });
}


// Loader Remix pour charger les données initiales (utilisateur, brouillon existant)
export async function loader({ request }: LoaderFunctionArgs) {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login", // Rediriger si non authentifié
  });

  let draft = null;
  // Tenter de charger un brouillon existant pour cet utilisateur et le mois actuel
  if (user.userId) {
    // Pour l'instant, on utilise le mois actuel comme partie de l'ID du brouillon
    // Cela suppose que chaque utilisateur a un brouillon par mois.
    const currentMonthName = months[new Date().getMonth()];
    const draftId = `${user.userId}_${currentMonthName}`; // Exemple d'ID de brouillon
    draft = await getHeuresDraft(user.userId, draftId); // Utiliser la fonction getHeuresDraft
    console.log(`Tentative de chargement du brouillon pour ${user.userId} et ${currentMonthName}:`, draft);
  }


  return json({ user, draft });
}


export default function HeureDeclarationRoute() {
  // Récupération des données du loader
  const { user, draft } = useLoaderData<typeof loader>();

  const currentMonthIndex = new Date().getMonth();
  const [selectedMonth, setSelectedMonth] = useState(months[currentMonthIndex]);
  // Utiliser un seul état pour le formulaire du mois sélectionné
  const [form, setForm] = useState(draft?.data || initializeMonthData()); // Initialiser avec le brouillon si présent
  const [sendEmail, setSendEmail] = useState(false);

  // Mettre à jour le formulaire quand le mois change
  React.useEffect(() => {
    // Ici, on pourrait charger les données existantes si un fichier est sélectionné ET que ce n'est pas un brouillon
    // Pour l'instant, on réinitialise si pas de brouillon
    if (!draft) {
       setForm(initializeMonthData());
    }
  }, [selectedMonth, draft]); // Dépendance ajoutée pour réagir au chargement du brouillon

  const handleInputChange = (field: keyof ReturnType<typeof initializeMonthData>, value: string | null) => {
    setForm((prev: ReturnType<typeof initializeMonthData>) => ({ ...prev, [field]: value }));
  };

  const handleDayChange = (index: number, field: keyof DailyHoraires, value: string) => {
    const newHoraires = [...form.horaires];
    newHoraires[index] = { ...newHoraires[index], [field]: value };
    // TODO: Calculer dureeTravail automatiquement ?
    setForm((prev: ReturnType<typeof initializeMonthData>) => ({ ...prev, horaires: newHoraires }));
  };

  const handleSamediChange = (field: keyof typeof form.samedi, value: string | boolean) => {
    setForm((prev: ReturnType<typeof initializeMonthData>) => ({
      ...prev,
      samedi: { ...prev.samedi, [field]: value }
    }));
     // TODO: Calculer dureeTravail automatiquement ?
  };

  const handleSelectFile = (fileId: string) => {
    // Met à jour l'état avec l'ID du fichier sélectionné
    handleInputChange("selectedFileId", fileId);
    console.log("Fichier Drive sélectionné:", fileId);
    // TODO: Charger les données existantes du brouillon ou de la feuille sélectionnée si nécessaire
  };

  const handleSaveDraft = async () => {
    if (!form.selectedFileId) {
      alert("Veuillez sélectionner un fichier Google Sheet d'abord.");
      return;
    }
    const userId = user.userId; // Utiliser l'ID utilisateur réel du loader

    try {
      // Appeler l'action Remix pour sauvegarder le brouillon
      const response = await fetch("/heures", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "saveDraft",
          userId: userId,
          fileId: form.selectedFileId,
          data: form,
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert("Brouillon sauvegardé avec succès !");
      } else {
        alert(`Erreur lors de la sauvegarde du brouillon : ${result.error}`);
      }

    } catch (error) {
      console.error("Erreur lors de la sauvegarde du brouillon:", error);
      alert("Une erreur est survenue lors de la sauvegarde du brouillon.");
    }
  };

  const handleSubmit = async () => {
     if (!form.selectedFileId) {
      alert("Veuillez sélectionner un fichier Google Sheet d'abord.");
      return;
    }
    const userId = user.userId; // Utiliser l'ID utilisateur réel du loader

    try {
      // Appeler l'action Remix pour soumettre le formulaire
      const response = await fetch("/heures", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "submitForm", // Nouvelle action pour la soumission
          userId: userId,
          fileId: form.selectedFileId,
          data: form,
          sendEmail: sendEmail, // Inclure le flag d'envoi d'email
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert(`Formulaire ${sendEmail ? "soumis et email envoyé" : "soumis"} avec succès !`);
        // TODO: Réinitialiser le formulaire ou rediriger si nécessaire
      } else {
        alert(`Erreur lors de la soumission du formulaire : ${result.error}`);
      }

    } catch (error) {
      console.error("Erreur lors de la soumission du formulaire:", error);
      alert("Une erreur est survenue lors de la soumission du formulaire.");
    }
  };


  return (
    <div className="p-4 grid gap-6 max-w-6xl mx-auto">
      {/* Section Sélection Fichier Drive */}
      <Card>
        <CardBody className="p-6 grid gap-4"> {/* CardContent -> CardBody */}
           <h2 className="text-lg font-semibold">Fichier Google Sheet Cible</h2>
           {form.selectedFileId ? (
             <p>Fichier sélectionné : {form.selectedFileId} <Button variant="link" onClick={() => handleInputChange("selectedFileId", null)}>(Changer)</Button></p> // Permettre de changer de fichier
           ) : (
             <DriveFilePicker onSelect={handleSelectFile} /> // Utiliser le composant Picker
           )}
        </CardBody> {/* CardContent -> CardBody */}
      </Card>

      {/* Section Informations Générales */}
      <Card>
        <CardBody className="grid gap-4 p-6"> {/* CardContent -> CardBody */}
          <h1 className="text-2xl font-bold">Déclaration Mensuelle des Heures</h1>
          <div>
            <Label htmlFor="month-select">Mois</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger id="month-select">
                <SelectValue placeholder="Sélectionner un mois" />
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem key={month} value={month}>{month}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            <div>
              <Label htmlFor="nom">Nom</Label>
              <Input id="nom" value={form.nom} onChange={(e) => handleInputChange('nom', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="prenom">Prénom</Label>
              <Input id="prenom" value={form.prenom} onChange={(e) => handleInputChange('prenom', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="etablissement">Établissement</Label>
              <Input id="etablissement" value={form.etablissement} onChange={(e) => handleInputChange('etablissement', e.target.value)} />
            </div>
          </div>
        </CardBody> {/* CardContent -> CardBody */}
      </Card>

      {/* Section Jours de la semaine */}
      {form.horaires.map((h: DailyHoraires, index: number) => (
        <Card key={index}>
          <CardBody className="grid gap-4 p-6"> {/* CardContent -> CardBody */}
            <h2 className="text-lg font-semibold">{h.jour}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <Label htmlFor={`departDomicile-${index}`}>Départ Domicile</Label>
                <Input id={`departDomicile-${index}`} type="time" value={h.departDomicile} onChange={(e) => handleDayChange(index, "departDomicile", e.target.value)} />
              </div>
              <div>
                <Label htmlFor={`arriveeAgence-${index}`}>Arrivée Agence</Label>
                <Input id={`arriveeAgence-${index}`} type="time" value={h.arriveeAgence} onChange={(e) => handleDayChange(index, "arriveeAgence", e.target.value)} />
              </div>
              <div>
                <Label htmlFor={`pause-${index}`}>Pause Repas</Label>
                <Input id={`pause-${index}`} type="time" value={h.pause} onChange={(e) => handleDayChange(index, "pause", e.target.value)} />
              </div>
              <div>
                <Label htmlFor={`repas-${index}`}>Indemnisation Repas</Label>
                 {/* Peut-être un Select ici ? Ex: Ticket Resto, Note de frais, Rien */}
                <Input id={`repas-${index}`} value={h.repas} onChange={(e) => handleDayChange(index, "repas", e.target.value)} />
              </div>
              <div>
                <Label htmlFor={`departAgence-${index}`}>Départ Agence</Label>
                <Input id={`departAgence-${index}`} type="time" value={h.departAgence} onChange={(e) => handleDayChange(index, "departAgence", e.target.value)} />
              </div>
              <div>
                <Label htmlFor={`arriveeDomicile-${index}`}>Arrivée Domicile</Label>
                <Input id={`arriveeDomicile-${index}`} type="time" value={h.arriveeDomicile} onChange={(e) => handleDayChange(index, "arriveeDomicile", e.target.value)} />
              </div>
              <div>
                <Label htmlFor={`jourType-${index}`}>Type de Jour</Label>
                 {/* Peut-être un Select ici ? Ex: Travail, CP, RTT, Maladie, Férié */}
                <Input id={`jourType-${index}`} value={h.jourType} onChange={(e) => handleDayChange(index, "jourType", e.target.value)} />
              </div>
              <div>
                <Label htmlFor={`dureeTravail-${index}`}>Durée de Travail</Label>
                <Input id={`dureeTravail-${index}`} type="time" value={h.dureeTravail} onChange={(e) => handleDayChange(index, "dureeTravail", e.target.value)} placeholder="Calculé?" readOnly />
              </div>
            </div>
          </CardBody> {/* CardContent -> CardBody */}
        </Card>
      ))}

       {/* Section Samedi */}
       <Card>
          <CardBody className="grid gap-4 p-6"> {/* CardContent -> CardBody */}
            <h2 className="text-lg font-semibold">Samedi</h2>
             {/* Ajouter un switch ou select pour indiquer si le samedi est travaillé/astreinte/repos */}
             {/* Afficher les champs seulement si nécessaire */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="samedi-departDomicile">Départ Domicile</Label>
                <Input id="samedi-departDomicile" type="time" value={form.samedi.departDomicile} onChange={(e) => handleSamediChange("departDomicile", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="samedi-arriveeAgence">Arrivée Agence</Label>
                <Input id="samedi-arriveeAgence" type="time" value={form.samedi.arriveeAgence} onChange={(e) => handleSamediChange("arriveeAgence", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="samedi-pause">Pause Repas</Label>
                <Input id="samedi-pause" type="time" value={form.samedi.pause} onChange={(e) => handleSamediChange("pause", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="samedi-repas">Indemnisation Repas</Label>
                <Input id="samedi-repas" value={form.samedi.repas} onChange={(e) => handleSamediChange("repas", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="samedi-departAgence">Départ Agence</Label>
                <Input id="samedi-departAgence" type="time" value={form.samedi.departAgence} onChange={(e) => handleSamediChange("departAgence", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="samedi-arriveeDomicile">Arrivée Domicile</Label>
                <Input id="samedi-arriveeDomicile" type="time" value={form.samedi.arriveeDomicile} onChange={(e) => handleSamediChange("arriveeDomicile", e.target.value)} />
              </div>
               <div>
                <Label htmlFor="samedi-dureeTravail">Durée de Travail</Label>
                <Input id={`samedi-dureeTravail`} type="time" value={form.samedi.dureeTravail} onChange={(e) => handleSamediChange("dureeTravail", e.target.value)} placeholder="Calculé?" readOnly />
              </div>
            </div>
          </CardBody> {/* CardContent -> CardBody */}
        </Card>

      {/* Section Astreinte / Commentaire / Actions */}
      <Card>
        <CardBody className="grid gap-4 p-6"> {/* CardContent -> CardBody */}
          <h2 className="text-lg font-semibold">Astreinte & Commentaire</h2>
           <div>
              <Label htmlFor="heuresAstreinte">Heures Astreinte (Total Mois)</Label>
              <Input id="heuresAstreinte" type="number" step="0.5" value={form.astreinteTotalHeures} onChange={(e) => handleInputChange('astreinteTotalHeures', e.target.value)} placeholder="ex: 7.5" />
            </div>
          <div>
            <Label htmlFor="commentaire">Commentaire</Label>
            <Textarea id="commentaire" value={form.commentaire} onChange={(e) => handleInputChange('commentaire', e.target.value)} />
          </div>

          <div className="flex items-center gap-2 mt-4">
            <Switch
              id="send-email"
              checked={sendEmail}
              onCheckedChange={setSendEmail}
            />
            <Label htmlFor="send-email">Envoyer par email à alexis.lhersonneau@jdc.fr après sauvegarde</Label>
          </div>

          <div className="flex justify-end gap-4 mt-6">
             <Button
                variant="outline"
                onClick={handleSaveDraft}
                disabled={!form.selectedFileId} // Désactiver si aucun fichier sélectionné
              >
                Enregistrer le brouillon
             </Button>
             <Button
                onClick={handleSubmit}
                disabled={!form.selectedFileId} // Désactiver si aucun fichier sélectionné
              >
               {sendEmail ? "Sauvegarder et Envoyer" : "Sauvegarder sur Google Sheet"}
             </Button>
          </div>
        </CardBody> {/* CardContent -> CardBody */}
      </Card>
    </div>
  );
}
