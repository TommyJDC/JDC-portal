import React, { useState, useEffect } from "react";
import { Card, CardBody } from "~/components/ui/Card";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { Textarea } from "~/components/ui/Textarea";
import { Label } from "~/components/ui/Label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/Select";
import { Switch } from "~/components/ui/Switch";
import { DriveFilePicker } from "~/components/DriveFilePicker";
import { json, type ActionFunctionArgs, type LoaderFunctionArgs, redirect } from "@remix-run/node";
import { saveHeuresDraft, getHeuresDraft } from "~/services/firestore.service.server";
import { getISOWeekNumber } from "~/utils/dateUtils";
import { sessionStorage, type UserSessionData } from "~/services/session.server";
import { useLoaderData, useFetcher } from "@remix-run/react"; // Ajout de useFetcher
import { updateHeuresSheet } from "~/services/sheets.service.server";
import { sendHeuresEmail } from "~/services/gmail.service.server";
import { FaCalendarAlt, FaPaperPlane, FaSave, FaSpinner } from "react-icons/fa"; // Ajout d'icônes

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

const days = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];

const initializeMonthData = () => {
  return {
    nom: "",
    prenom: "",
    etablissement: "",
    horaires: days.map((day) => ({
      jour: day,
      departDomicile: "",
      arriveeAgence: "",
      pause: "01:00",
      repas: "Titre Restaurant",
      departAgence: "",
      arriveeDomicile: "",
      jourType: "Travail",
      dureeTravail: "",
    }) as DailyHoraires),
    samedi: {
      present: false,
      departDomicile: "",
      arriveeAgence: "",
      pause: "01:00",
      repas: "Titre Restaurant",
      departAgence: "",
      arriveeDomicile: "",
      dureeTravail: "",
    },
    astreinteTotalHeures: "",
    commentaire: "",
    selectedFileId: null as string | null,
  };
};

export async function action({ request }: ActionFunctionArgs) {
  const sessionCookie = request.headers.get("Cookie");
  const sessionStore = await sessionStorage.getSession(sessionCookie);
  const userSession: UserSessionData | null = sessionStore.get("user") ?? null;

  if (!userSession || !userSession.userId) {
    return json({ success: false, error: "Non authentifié." }, { status: 401 });
  }

  const body = await request.json();
  const { action: formAction, fileId, data, sendEmail } = body; // Renommer action en formAction
  const userId = userSession.userId;
  const accessToken = (userSession as any).googleAccessToken;

  if (formAction === "saveDraft") {
    if (!userId || !fileId || !data) {
      return json({ success: false, error: "Données de brouillon incomplètes." }, { status: 400 });
    }
    try {
      await saveHeuresDraft({ userId, fileId, data });
      return json({ success: true, message: "Brouillon sauvegardé." });
    } catch (error) {
      console.error("Erreur lors de la sauvegarde du brouillon Firestore:", error);
      return json({ success: false, error: "Échec de la sauvegarde du brouillon." }, { status: 500 });
    }
  }

  if (formAction === "submitForm") {
    if (!userId || !fileId || !data || accessToken === undefined) {
      return json({ success: false, error: "Données de soumission incomplètes ou token d'accès manquant." }, { status: 400 });
    }
    try {
      await updateHeuresSheet(accessToken, fileId, data);
      if (sendEmail) {
        const weekNumber = getISOWeekNumber(new Date());
        const emailSubject = `SEMAINE N°${weekNumber} - ${data.nom} ${data.prenom} - ${data.etablissement}`;
        const emailBody = `...`; // Contenu de l'email (simplifié pour l'exemple)
        await sendHeuresEmail(accessToken, 'alexis.lhersonneau@jdc.fr', emailSubject, emailBody);
      }
      return json({ success: true, message: `Formulaire ${sendEmail ? "soumis et email envoyé" : "soumis"} avec succès.` });
    } catch (error) {
      console.error("Erreur lors de la soumission du formulaire ou de la mise à jour Sheets:", error);
      return json({ success: false, error: "Échec de la soumission du formulaire." }, { status: 500 });
    }
  }
  return json({ success: false, error: "Action non reconnue." }, { status: 400 });
}

export async function loader({ request }: LoaderFunctionArgs) {
  const sessionCookie = request.headers.get("Cookie");
  const sessionStore = await sessionStorage.getSession(sessionCookie);
  const userSession: UserSessionData | null = sessionStore.get("user") ?? null;

  if (!userSession || !userSession.userId) {
    throw redirect("/login"); 
  }

  let draft = null;
  const currentMonthName = months[new Date().getMonth()];
  const draftId = `${userSession.userId}_${currentMonthName}`;
  draft = await getHeuresDraft(userSession.userId, draftId); 

  return json({ user: userSession, draft });
}

const inputBaseClasses = "w-full bg-ui-input border-ui-border text-text-primary focus:border-brand-blue focus:ring-brand-blue rounded-md text-sm";
const selectTriggerClasses = "w-full bg-ui-input border-ui-border text-text-primary focus:border-brand-blue focus:ring-brand-blue";
const selectContentClasses = "bg-ui-surface border-ui-border text-text-primary";
const selectItemClasses = "hover:bg-ui-hover focus:bg-ui-hover";

export default function HeureDeclarationRoute() {
  const { user, draft } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const isSubmitting = fetcher.state !== "idle";

  const currentMonthIndex = new Date().getMonth();
  const [selectedMonth, setSelectedMonth] = useState(months[currentMonthIndex]);
  const [form, setForm] = useState(() => draft?.data || initializeMonthData());
  const [sendEmail, setSendEmail] = useState(false);

  useEffect(() => {
    if (draft?.data) {
      setForm(draft.data);
    } else {
      setForm(initializeMonthData());
    }
  }, [draft, selectedMonth]);

  const handleInputChange = (field: keyof ReturnType<typeof initializeMonthData>, value: string | null) => {
    setForm((prev: ReturnType<typeof initializeMonthData>) => ({ ...prev, [field]: value }));
  };

  const handleDayChange = (index: number, field: keyof DailyHoraires, value: string) => {
    const newHoraires = [...form.horaires];
    newHoraires[index] = { ...newHoraires[index], [field]: value };
    setForm((prev: ReturnType<typeof initializeMonthData>) => ({ ...prev, horaires: newHoraires }));
  };

  const handleSamediChange = (field: keyof typeof form.samedi, value: string | boolean) => {
    setForm((prev: ReturnType<typeof initializeMonthData>) => ({
      ...prev,
      samedi: { ...prev.samedi, [field]: value }
    }));
  };

  const handleSelectFile = (fileId: string) => {
    handleInputChange("selectedFileId", fileId);
  };

  const commonSubmit = async (actionType: "saveDraft" | "submitForm") => {
    if (!form.selectedFileId) {
      alert("Veuillez sélectionner un fichier Google Sheet d'abord."); // TODO: Remplacer par un toast
      return;
    }
    // Pour application/json, le premier argument est l'objet à envoyer
    const payload: any = { 
      action: actionType, 
      userId: user.userId, 
      fileId: form.selectedFileId, 
      data: form, 
    };
    if (actionType === "submitForm") {
      payload.sendEmail = sendEmail; // sendEmail est déjà un boolean (true/false)
    }
    fetcher.submit(payload, { method: "POST", encType: "application/json" });
  };
  
  // Type guards pour la réponse du fetcher
  function hasSuccessMessage(data: any): data is { success: true; message: string } {
    return data && data.success === true && typeof data.message === 'string';
  }
  function hasErrorMessage(data: any): data is { success: false; error: string } {
    return data && data.success === false && typeof data.error === 'string';
  }

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      if (hasSuccessMessage(fetcher.data)) {
        alert(fetcher.data.message); // TODO: Remplacer par un toast
      } else if (hasErrorMessage(fetcher.data)) {
        alert(`Erreur: ${fetcher.data.error}`); // TODO: Remplacer par un toast
      } else {
        // Cas où la structure de fetcher.data n'est pas celle attendue
        alert("Réponse inattendue du serveur.");
      }
    }
  }, [fetcher.state, fetcher.data]);


  return (
    <div className="p-4 md:p-6 grid gap-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold text-text-primary flex items-center">
        <FaCalendarAlt className="mr-3 text-brand-blue" />
        Déclaration Mensuelle des Heures
      </h1>

      <Card>
        <CardBody className="p-4 sm:p-6 grid gap-4">
           <h2 className="text-lg font-semibold text-text-primary">Fichier Google Sheet Cible</h2>
           {form.selectedFileId ? (
             <div className="flex items-center justify-between">
                <p className="text-sm text-text-secondary">Fichier sélectionné : <span className="font-medium text-text-primary">{form.selectedFileId}</span></p>
                <Button variant="link" onClick={() => handleInputChange("selectedFileId", null)} className="text-xs text-brand-blue hover:text-brand-blue-light p-0">Changer</Button>
             </div>
           ) : (
             <DriveFilePicker onSelect={handleSelectFile} />
           )}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="grid gap-4 p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-2">Informations Générales</h2>
          <div>
            <Label htmlFor="month-select" className="text-xs font-medium text-text-secondary mb-1">Mois</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger id="month-select" className={selectTriggerClasses}><SelectValue placeholder="Sélectionner un mois" /></SelectTrigger>
              <SelectContent className={selectContentClasses}>
                {months.map((month) => ( <SelectItem key={month} value={month} className={selectItemClasses}>{month}</SelectItem> ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="Nom" id="nom" value={form.nom} onChange={(e) => handleInputChange('nom', e.target.value)} className={inputBaseClasses} labelClassName="text-xs font-medium text-text-secondary mb-1" />
            <Input label="Prénom" id="prenom" value={form.prenom} onChange={(e) => handleInputChange('prenom', e.target.value)} className={inputBaseClasses} labelClassName="text-xs font-medium text-text-secondary mb-1" />
            <Input label="Établissement" id="etablissement" value={form.etablissement} onChange={(e) => handleInputChange('etablissement', e.target.value)} className={inputBaseClasses} labelClassName="text-xs font-medium text-text-secondary mb-1" />
          </div>
        </CardBody>
      </Card>

      {form.horaires.map((h: DailyHoraires, index: number) => (
        <Card key={index}>
          <CardBody className="grid gap-4 p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-text-primary">{h.jour}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Input label="Départ Domicile" id={`departDomicile-${index}`} type="time" value={h.departDomicile} onChange={(e) => handleDayChange(index, "departDomicile", e.target.value)} className={inputBaseClasses} labelClassName="text-xs font-medium text-text-secondary mb-1" />
              <Input label="Arrivée Agence" id={`arriveeAgence-${index}`} type="time" value={h.arriveeAgence} onChange={(e) => handleDayChange(index, "arriveeAgence", e.target.value)} className={inputBaseClasses} labelClassName="text-xs font-medium text-text-secondary mb-1" />
              <Input label="Pause Repas" id={`pause-${index}`} type="time" value={h.pause} onChange={(e) => handleDayChange(index, "pause", e.target.value)} className={inputBaseClasses} labelClassName="text-xs font-medium text-text-secondary mb-1" />
              <div>
                <Label htmlFor={`repas-${index}`} className="text-xs font-medium text-text-secondary mb-1">Indemnisation Repas</Label>
                <Select name={`repas-${index}`} value={h.repas} onValueChange={(value) => handleDayChange(index, "repas", value)}>
                    <SelectTrigger className={selectTriggerClasses}><SelectValue placeholder="Type de repas" /></SelectTrigger>
                    <SelectContent className={selectContentClasses}>
                        <SelectItem value="Titre Restaurant" className={selectItemClasses}>Titre Restaurant</SelectItem>
                        <SelectItem value="Note de Frais" className={selectItemClasses}>Note de Frais</SelectItem>
                        <SelectItem value="Rien" className={selectItemClasses}>Rien</SelectItem>
                    </SelectContent>
                </Select>
              </div>
              <Input label="Départ Agence" id={`departAgence-${index}`} type="time" value={h.departAgence} onChange={(e) => handleDayChange(index, "departAgence", e.target.value)} className={inputBaseClasses} labelClassName="text-xs font-medium text-text-secondary mb-1" />
              <Input label="Arrivée Domicile" id={`arriveeDomicile-${index}`} type="time" value={h.arriveeDomicile} onChange={(e) => handleDayChange(index, "arriveeDomicile", e.target.value)} className={inputBaseClasses} labelClassName="text-xs font-medium text-text-secondary mb-1" />
              <div>
                <Label htmlFor={`jourType-${index}`} className="text-xs font-medium text-text-secondary mb-1">Type de Jour</Label>
                <Select name={`jourType-${index}`} value={h.jourType} onValueChange={(value) => handleDayChange(index, "jourType", value)}>
                    <SelectTrigger className={selectTriggerClasses}><SelectValue placeholder="Type de jour" /></SelectTrigger>
                    <SelectContent className={selectContentClasses}>
                        <SelectItem value="Travail" className={selectItemClasses}>Travail</SelectItem>
                        <SelectItem value="CP" className={selectItemClasses}>CP</SelectItem>
                        <SelectItem value="RTT" className={selectItemClasses}>RTT</SelectItem>
                        <SelectItem value="Maladie" className={selectItemClasses}>Maladie</SelectItem>
                        <SelectItem value="Férié" className={selectItemClasses}>Férié</SelectItem>
                        <SelectItem value="Formation" className={selectItemClasses}>Formation</SelectItem>
                    </SelectContent>
                </Select>
              </div>
              <Input label="Durée Travail" id={`dureeTravail-${index}`} type="time" value={h.dureeTravail} onChange={(e) => handleDayChange(index, "dureeTravail", e.target.value)} placeholder="Calculé?" readOnly className={`${inputBaseClasses} bg-ui-background/50`} labelClassName="text-xs font-medium text-text-secondary mb-1" />
            </div>
          </CardBody>
        </Card>
      ))}

       <Card>
          <CardBody className="grid gap-4 p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-text-primary">Samedi</h2>
            <div className="flex items-center space-x-2 mb-2">
                <Switch id="samedi-present" checked={form.samedi.present} onCheckedChange={(checked) => handleSamediChange("present", checked)} />
                <Label htmlFor="samedi-present" className="text-sm text-text-secondary">Samedi travaillé / astreinte ?</Label>
            </div>
            {form.samedi.present && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Input label="Départ Domicile" id="samedi-departDomicile" type="time" value={form.samedi.departDomicile} onChange={(e) => handleSamediChange("departDomicile", e.target.value)} className={inputBaseClasses} labelClassName="text-xs font-medium text-text-secondary mb-1" />
                <Input label="Arrivée Agence" id="samedi-arriveeAgence" type="time" value={form.samedi.arriveeAgence} onChange={(e) => handleSamediChange("arriveeAgence", e.target.value)} className={inputBaseClasses} labelClassName="text-xs font-medium text-text-secondary mb-1" />
                <Input label="Pause Repas" id="samedi-pause" type="time" value={form.samedi.pause} onChange={(e) => handleSamediChange("pause", e.target.value)} className={inputBaseClasses} labelClassName="text-xs font-medium text-text-secondary mb-1" />
                <div>
                    <Label htmlFor="samedi-repas" className="text-xs font-medium text-text-secondary mb-1">Indemnisation Repas</Label>
                    <Select name="samedi-repas" value={form.samedi.repas} onValueChange={(value) => handleSamediChange("repas", value)}>
                        <SelectTrigger className={selectTriggerClasses}><SelectValue placeholder="Type de repas" /></SelectTrigger>
                        <SelectContent className={selectContentClasses}>
                            <SelectItem value="Titre Restaurant" className={selectItemClasses}>Titre Restaurant</SelectItem>
                            <SelectItem value="Note de Frais" className={selectItemClasses}>Note de Frais</SelectItem>
                            <SelectItem value="Rien" className={selectItemClasses}>Rien</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <Input label="Départ Agence" id="samedi-departAgence" type="time" value={form.samedi.departAgence} onChange={(e) => handleSamediChange("departAgence", e.target.value)} className={inputBaseClasses} labelClassName="text-xs font-medium text-text-secondary mb-1" />
                <Input label="Arrivée Domicile" id="samedi-arriveeDomicile" type="time" value={form.samedi.arriveeDomicile} onChange={(e) => handleSamediChange("arriveeDomicile", e.target.value)} className={inputBaseClasses} labelClassName="text-xs font-medium text-text-secondary mb-1" />
                <Input label="Durée Travail" id="samedi-dureeTravail" type="time" value={form.samedi.dureeTravail} onChange={(e) => handleSamediChange("dureeTravail", e.target.value)} placeholder="Calculé?" readOnly className={`${inputBaseClasses} bg-ui-background/50`} labelClassName="text-xs font-medium text-text-secondary mb-1" />
              </div>
            )}
          </CardBody>
        </Card>

      <Card>
        <CardBody className="grid gap-4 p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-text-primary">Astreinte & Commentaire</h2>
           <Input label="Heures Astreinte (Total Mois)" id="heuresAstreinte" type="number" step="0.5" value={form.astreinteTotalHeures} onChange={(e) => handleInputChange('astreinteTotalHeures', e.target.value)} placeholder="ex: 7.5" className={inputBaseClasses} labelClassName="text-xs font-medium text-text-secondary mb-1" />
          <div>
            <Label htmlFor="commentaire" className="text-xs font-medium text-text-secondary mb-1">Commentaire</Label>
            <Textarea id="commentaire" value={form.commentaire} onChange={(e) => handleInputChange('commentaire', e.target.value)} className={`${inputBaseClasses} min-h-[80px]`} />
          </div>

          <div className="flex items-center gap-2 pt-4 border-t border-ui-border/50">
            <Switch id="send-email" checked={sendEmail} onCheckedChange={setSendEmail} />
            <Label htmlFor="send-email" className="text-sm text-text-secondary">Envoyer par email à alexis.lhersonneau@jdc.fr après sauvegarde</Label>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-ui-border/50">
             <Button variant="outline" onClick={() => commonSubmit("saveDraft")} disabled={!form.selectedFileId || isSubmitting} className="border-ui-border text-text-secondary hover:bg-ui-border">
                {isSubmitting && fetcher.formData?.get("action") === "saveDraft" ? <FaSpinner className="animate-spin mr-2"/> : <FaSave className="mr-2" />}
                Enregistrer Brouillon
             </Button>
             <Button variant="primary" onClick={() => commonSubmit("submitForm")} disabled={!form.selectedFileId || isSubmitting} className="bg-brand-blue hover:bg-brand-blue-dark">
               {isSubmitting && fetcher.formData?.get("action") === "submitForm" ? <FaSpinner className="animate-spin mr-2"/> : <FaPaperPlane className="mr-2" />}
               {sendEmail ? "Sauvegarder et Envoyer" : "Sauvegarder sur Google Sheet"}
             </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
