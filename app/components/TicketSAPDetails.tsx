import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useFetcher, Form } from '@remix-run/react'; // Import Form
import useGeminiSummary from '~/hooks/useGeminiSummary';
import ReactMarkdown from 'react-markdown';
import { FaSpinner, FaChevronDown, FaChevronUp, FaTimes, FaBuilding, FaInfoCircle, FaCalendarAlt, FaUserTie, FaPhone, FaMapMarkerAlt, FaCommentDots, FaSave } from 'react-icons/fa'; // Ajouter les icônes nécessaires
import type { SapTicket } from '~/types/firestore.types'; // Importer SapTicket
import { Timestamp } from 'firebase/firestore';
import { convertFirestoreDate, formatFirestoreDate } from '~/utils/dateUtils';
import { AnimatedTicketSummary } from '~/components/AnimatedTicketSummary';
import { AnimatedSolution } from '~/components/AnimatedSolution';
// AnimatedComments n'est plus utilisé ici si la section commentaires est retirée ou gérée différemment
import { getStringValue } from '~/utils/firestoreUtils';
import { getTicketStatusStyle } from '~/utils/styleUtils'; // Importer pour les styles de statut
import { Button } from './ui/Button'; // Importer Button si nécessaire pour les actions
import { Input } from './ui/Input'; // Importer Input
import { Textarea } from './ui/Textarea'; // Importer Textarea
import { Select } from './ui/Select'; // Importer Select si utilisé (sinon select HTML standard)

interface TicketSAPDetailsProps {
    ticket: SapTicket | null;
    onClose: () => void;
    sectorId: string;
    onTicketUpdated: () => void;
}

// Type guard for Firestore string value
const isFirestoreStringValue = (val: any): val is { stringValue: string } =>
    typeof val === 'object' && val !== null && 'stringValue' in val;

// Ajout du type local SapTicketStatus (non exporté globalement)
type SapTicketStatus = 'open' | 'pending' | 'closed' | 'rma_request' | 'material_sent' | 'archived';

// Utiliser SapTicketStatus pour le type de retour
const getInitialSAPStatus = (ticket: SapTicket | null): SapTicketStatus => {
    const statusVal = ticket?.status; // Utiliser le champ 'status' interne
    if (!statusVal) return 'open'; // Défaut à 'open' si non défini
    const statusString = getStringValue(statusVal, 'open'); // Obtenir la chaîne de caractères
    // Assurer que la valeur retournée est une des valeurs valides de SapTicketStatus
    const validStatuses: SapTicketStatus[] = ['open', 'pending', 'closed', 'rma_request', 'material_sent', 'archived'];
    if (validStatuses.includes(statusString as SapTicketStatus)) {
        return statusString as SapTicketStatus;
    }
    // Mapper les anciens statuts si nécessaire ou retourner un défaut
    switch (statusString.toLowerCase()) {
        case 'nouveau':
        case 'ouvert':
            return 'open';
        case 'en attente (pas de réponse)':
        case 'en attente':
            return 'pending';
        case 'clôturé':
        case 'fermé':
            return 'closed';
        case 'demande de rma':
            return 'rma_request';
        case 'demande d\'envoi materiel':
            return 'material_sent';
        default:
            return 'open'; // Retourner 'open' par défaut si inconnu
    }
};


const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

type ActionData = { success: boolean; message?: string; error?: string };

function hasErrorProperty(data: any): data is { success: false; error: string } {
    return data && data.success === false && typeof data.error === 'string';
}
function hasMessageProperty(data: any): data is { success: true; message: string } {
    return data && data.success === true && typeof data.message === 'string';
}

// Helper to always get a string from Firestore field or string, with fallback
const getStringValueWithFallback = (val: any, fallback: string = ''): string => {
    if (typeof val === 'string') return val;
    if (val && typeof val === 'object' && 'stringValue' in val) return val.stringValue;
    return fallback;
};

const TicketSAPDetails: React.FC<TicketSAPDetailsProps> = ({ ticket, onClose, sectorId, onTicketUpdated }) => {
    const fetcher = useFetcher<ActionData>();
    const [technicianNotes, setTechnicianNotes] = useState<string>('');
    const [materialType, setMaterialType] = useState<string>('');
    const [currentStatus, setCurrentStatus] = useState<SapTicketStatus>('open'); // Utiliser SapTicketStatus
    const [isDescriptionOpen, setIsDescriptionOpen] = useState<boolean>(false);
    const [materialDetails, setMaterialDetails] = useState<string>(''); // State for material details

    const isLoadingAction = fetcher.state !== 'idle';

    const problemDescriptionForAI = useMemo(() => [
        ticket?.demandeSAP,
        ticket?.descriptionProbleme,
        ticket?.description
    ].reduce((acc: string, field) => {
        if (!field) return acc;
        const value = getStringValue(field, '');
        if (value && !acc) return value; // Prendre la première description non vide
        return acc;
    }, ''), [ticket]);

    const {
        summary: generatedSummary,
        isLoading: isSummaryLoading,
        error: summaryError,
        generateSummary: triggerSummaryGeneration,
        isCached: isSummaryCached,
        resetSummaryState: resetSummaryHookState
    } = useGeminiSummary(GEMINI_API_KEY);

    const {
        summary: generatedSolution,
        isLoading: isSolutionLoading,
        error: solutionError,
        generateSummary: triggerSolutionGeneration,
        isCached: isSolutionCached,
        resetSummaryState: resetSolutionHookState
    } = useGeminiSummary(GEMINI_API_KEY);

    const handleSaveSummary = useCallback(async (summaryToSave: string): Promise<void> => {
        if (!ticket || !sectorId) return;
        const formData = new FormData();
        formData.append("intent", "save_summary");
        formData.append("ticketId", ticket.id);
        formData.append("sectorId", sectorId);
        formData.append("summary", summaryToSave);
        fetcher.submit(formData, { method: "POST", action: "/tickets-sap" });
    }, [ticket, sectorId, fetcher]);

    const handleSaveSolution = useCallback(async (solutionToSave: string): Promise<void> => {
        if (!ticket || !sectorId) return;
        const formData = new FormData();
        formData.append("intent", "save_solution");
        formData.append("ticketId", ticket.id);
        formData.append("sectorId", sectorId);
        formData.append("solution", solutionToSave);
        fetcher.submit(formData, { method: "POST", action: "/tickets-sap" });
    }, [ticket, sectorId, fetcher]);

    useEffect(() => {
        if (!ticket?.id) return;
        setCurrentStatus(getInitialSAPStatus(ticket));
        setTechnicianNotes((ticket as any).technicianNotes ?? '');
        setMaterialType((ticket as any).materialType ?? '');
        setMaterialDetails((ticket as any).materialDetails ?? ''); // Initialize material details
    }, [ticket]); // Simplifier les dépendances

    const generationAttempted = useRef<string | null>(null);

    useEffect(() => {
        if (ticket?.id && problemDescriptionForAI && generationAttempted.current !== ticket.id) {
            generationAttempted.current = ticket.id;
            triggerSummaryGeneration(
                ticket,
                `Crée un résumé très concis (2-3 lignes maximum) du problème SAP suivant en français, en mettant l'accent sur les points clés pour un technicien : ${problemDescriptionForAI}`,
                handleSaveSummary
            );
            triggerSolutionGeneration(
                ticket,
                `Propose une solution technique ou une piste de résolution très concise (2-3 lignes maximum) pour le problème SAP suivant en français : ${problemDescriptionForAI}`,
                handleSaveSolution
            );
        } else if (!ticket?.id) {
            resetSummaryHookState();
            resetSolutionHookState();
            generationAttempted.current = null;
        }
    }, [
        ticket?.id,
        problemDescriptionForAI,
        triggerSummaryGeneration,
        triggerSolutionGeneration,
        handleSaveSummary,
        handleSaveSolution,
        resetSummaryHookState,
        resetSolutionHookState
    ]);

    const handleClose = () => {
        resetSummaryHookState();
        resetSolutionHookState();
        onClose();
    };

    if (!ticket) return null;

    const [isClient, setIsClient] = useState(false);
    useEffect(() => { setIsClient(true); }, []);

    const formatTicketDate = (date: Date | Timestamp | string | null | undefined): string => {
        const convertedDate = convertFirestoreDate(date);
        if (!convertedDate) return 'Non spécifiée';
        return formatFirestoreDate(convertedDate);
    };

    // Déplacer la logique de soumission dans une fonction séparée pour plus de clarté
    const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        formData.set("intent", "update_status"); // L'intention est toujours de mettre à jour
        formData.set("ticketId", ticket?.id || '');
        formData.set("sectorId", sectorId);

        // Valider les notes si fermeture
        if (formData.get('status') === 'closed' && !technicianNotes.trim()) {
            alert("Les notes du technicien sont requises pour clôturer le ticket.");
            return;
        }
        // Ajouter les notes si elles existent
        if (technicianNotes.trim()) {
            formData.set("technicianNotes", technicianNotes.trim());
        }

        // Ajouter le type et les détails du matériel si pertinents
        const statusValue = formData.get('status') as SapTicketStatus;
        if ((statusValue === 'rma_request' || statusValue === 'material_sent') && !materialType) {
            alert("Veuillez sélectionner un type de matériel pour cette action.");
            return;
        }
        if (materialType) {
            formData.set("materialType", materialType);
            if (materialDetails.trim()) {
                formData.set("materialDetails", materialDetails.trim());
            }
        } else {
            // S'assurer que ces champs ne sont pas envoyés s'ils ne sont pas pertinents
            formData.delete("materialType");
            formData.delete("materialDetails");
        }


        fetcher.submit(formData, { method: "POST", action: "/tickets-sap" });
    };

    // Statuts pour le select
    const ticketStatuses: { value: SapTicketStatus; label: string }[] = [
        { value: 'open', label: 'Ouvert' },
        { value: 'pending', label: 'En attente (Pas de réponse)' },
        { value: 'closed', label: 'Clôturé' },
        { value: 'rma_request', label: 'Demande de RMA' },
        { value: 'material_sent', label: 'Demande d\'envoi matériel' },
    ];

    const statusStyle = getTicketStatusStyle(currentStatus); // Obtenir le style du statut actuel

    const modalContent = (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gradient-to-br from-[#0a1120] via-[#1a2250] to-[#1e2746] animate-gradient-x backdrop-blur-2xl font-bold font-jetbrains">
            <fetcher.Form method="post" onSubmit={handleFormSubmit} onClick={e => e.stopPropagation()} className="relative w-full max-w-3xl max-h-[95vh] overflow-y-auto rounded-3xl shadow-2xl border-2 border-jdc-blue/80 bg-jdc-blue/10 backdrop-blur-xl before:absolute before:inset-0 before:rounded-3xl before:bg-gradient-to-br before:from-jdc-blue/20 before:via-[#1a2250]/40 before:to-[#10182a]/30 before:blur-2xl before:opacity-80 before:-z-10">
                {/* Header avant-gardiste */}
                <div className="flex items-center justify-between px-8 py-6 border-b-2 border-jdc-yellow/60 bg-gradient-to-r from-[#10182a]/95 via-[#1a2250]/95 to-[#1e2746]/95 rounded-t-3xl shadow-lg font-bold">
                    <h2 className="text-3xl font-extrabold text-jdc-yellow drop-shadow-neon tracking-wide select-text font-mono">
                        {getStringValue(ticket.raisonSociale, 'N/A')}
                    </h2>
                    <div className="flex items-center gap-4">
                        <span className={`px-4 py-1 rounded-full text-base font-bold border-2 border-jdc-yellow/80 bg-gradient-to-r from-jdc-yellow/90 to-jdc-blue/80 text-[#10182a] animate-pulse shadow-neon`}>{(() => {const label = ticketStatuses.find(s => s.value === currentStatus)?.label;return label || currentStatus;})()}</span>
                        <button type="button" onClick={handleClose} className="text-jdc-yellow hover:text-jdc-blue text-3xl p-2 rounded-full bg-jdc-blue/10 hover:bg-jdc-yellow/20 shadow-glassy transition-all duration-200 backdrop-blur-md">
                            <FaTimes />
                        </button>
                    </div>
                </div>

                {/* Infos client en chips */}
                <div className="flex flex-wrap gap-3 px-8 py-4 border-b border-jdc-yellow/30 bg-gradient-to-r from-[#10182a]/90 to-[#1a2250]/90 rounded-b-xl font-bold">
                    <div className="flex items-center gap-2 chip-glow group cursor-pointer transition-all">
                        <FaUserTie className="text-jdc-yellow group-hover:scale-110 group-hover:text-jdc-blue transition-all" />
                        <span className="px-3 py-1 rounded-full bg-jdc-blue/30 text-jdc-yellow font-semibold shadow-chip">{getStringValue(ticket.client, 'N/A')}</span>
                    </div>
                    {ticket.codeClient && (
                        <div className="flex items-center gap-2 chip-glow group cursor-pointer transition-all">
                            <span className="px-3 py-1 rounded-full bg-jdc-yellow/30 text-jdc-blue font-semibold shadow-chip">{getStringValue(ticket.codeClient)}</span>
                        </div>
                    )}
                    {ticket.deducedSalesperson && (
                        <div className="flex items-center gap-2 chip-glow group cursor-pointer transition-all">
                            <FaUserTie className="text-jdc-yellow group-hover:scale-110 group-hover:text-jdc-blue transition-all" />
                            <span className="px-3 py-1 rounded-full bg-purple-900/40 text-jdc-yellow font-semibold shadow-chip">{getStringValue(ticket.deducedSalesperson)}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-2 chip-glow group cursor-pointer transition-all">
                        <FaMapMarkerAlt className="text-jdc-yellow group-hover:scale-110 group-hover:text-jdc-blue transition-all" />
                        <span className="px-3 py-1 rounded-full bg-jdc-blue/30 text-jdc-yellow font-semibold shadow-chip">{getStringValue(ticket.adresse, 'N/A')}</span>
                    </div>
                    {ticket.telephone && (
                        <div className="flex items-center gap-2 chip-glow group cursor-pointer transition-all">
                            <FaPhone className="text-jdc-yellow group-hover:scale-110 group-hover:text-jdc-blue transition-all" />
                            <span className="px-3 py-1 rounded-full bg-jdc-yellow/30 text-jdc-blue font-semibold shadow-chip">{getStringValue(ticket.telephone)}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-2 chip-glow group cursor-pointer transition-all">
                        <span className="px-3 py-1 rounded-full bg-gradient-to-r from-jdc-blue/40 to-purple-900/40 text-jdc-yellow font-semibold shadow-chip">Secteur : {ticket.secteur || 'N/A'}</span>
                    </div>
                </div>

                {/* Description effet terminal dans un tiroir */}
                <div className="px-8 pt-6">
                    <button
                        type="button"
                        className="flex items-center gap-2 text-jdc-yellow font-bold text-lg mb-2 focus:outline-none focus:ring-2 focus:ring-jdc-yellow/60"
                        onClick={() => setIsDescriptionOpen(v => !v)}
                    >
                        <FaInfoCircle className="text-jdc-yellow animate-pulse" />
                        <span>Description du problème</span>
                        {isDescriptionOpen ? (
                            <FaChevronUp className="ml-2" />
                        ) : (
                            <FaChevronDown className="ml-2" />
                        )}
                    </button>
                    {isDescriptionOpen && (
                        <div className="border-b-2 border-jdc-yellow/30 bg-gradient-to-br from-[#10182a]/95 via-[#1a2250]/95 to-[#1e2746]/95 rounded-xl mt-2 shadow-inner-terminal font-mono text-base text-jdc-yellow relative overflow-hidden font-bold p-6 animate-fade-in-up">
                            <div className="relative">
                                <span className="absolute right-0 top-0 animate-terminal-cursor text-jdc-yellow text-lg">▍</span>
                                <span className="whitespace-pre-line text-jdc-yellow/90">
                                    {getStringValue(ticket.demandeSAP, '') || getStringValue(ticket.descriptionProbleme, '') || getStringValue(ticket.description, '') || 'Aucune description.'}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Résumé/Solution IA avant-gardiste */}
                {(generatedSummary || generatedSolution) && (
                    <div className="px-8 py-6 border-b-2 border-jdc-yellow/30 bg-gradient-to-br from-[#0e1a2b]/95 via-[#1a2250]/95 to-[#1e2746]/95 rounded-xl mt-4 shadow-xl relative overflow-hidden font-bold">
                        <div className="absolute inset-0 pointer-events-none z-0">
                            {/* Micro-icônes circuit ou effet scan en SVG ou divs animées ici si besoin */}
                        </div>
                        {generatedSummary && (
                            <div className="mb-6 p-5 rounded-2xl border-2 border-jdc-blue/80 bg-gradient-to-br from-[#10182a]/90 to-[#1a2250]/90 shadow-xl flex items-start gap-4 relative z-10 animate-fade-in-up">
                                <span className="bg-jdc-yellow/90 text-jdc-blue font-bold px-3 py-1 rounded-full text-base mr-2 animate-pulse-glow shadow-chip">AI</span>
                                <div className="flex-1 text-white text-lg font-mono">
                                    <AnimatedTicketSummary
                                        ticket={ticket}
                                        summary={generatedSummary}
                                        isLoading={isSummaryLoading}
                                        error={summaryError}
                                    />
                                </div>
                            </div>
                        )}
                        {generatedSolution && (
                            <div className="p-5 rounded-2xl border-2 border-green-400/80 bg-gradient-to-br from-green-900/90 to-blue-900/90 shadow-xl flex items-start gap-4 relative z-10 animate-fade-in-up">
                                <span className="bg-green-400/90 text-green-900 font-bold px-3 py-1 rounded-full text-base mr-2 animate-pulse-glow shadow-chip">AI</span>
                                <div className="flex-1 text-green-200 text-lg font-mono">
                                    <AnimatedSolution
                                        ticket={ticket}
                                        solution={generatedSolution}
                                        isLoading={isSolutionLoading}
                                        error={solutionError}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Actions avant-gardistes */}
                <div className="px-8 py-10 border-b-2 border-jdc-yellow/30 bg-gradient-to-br from-[#10182a]/95 via-[#1a2250]/95 to-[#1e2746]/95 rounded-xl mt-6 flex flex-col gap-8 shadow-xl font-bold text-lg min-h-[180px]">
                    <div className="w-full">
                        <label className="block text-xl font-bold text-jdc-yellow mb-2 tracking-wider">Statut du ticket</label>
                        <select
                            name="status"
                            value={currentStatus}
                            onChange={e => setCurrentStatus(e.target.value as SapTicketStatus)}
                            className="block w-full rounded-2xl bg-gradient-to-r from-jdc-blue/80 to-gray-900/80 border-2 border-jdc-yellow/40 focus:border-jdc-yellow focus:ring focus:ring-jdc-yellow/40 text-jdc-yellow py-5 pl-6 pr-12 text-2xl shadow focus:shadow-neon transition-all duration-200 font-mono font-bold min-h-[60px] appearance-none custom-select-menu"
                            disabled={isLoadingAction}
                        >
                            {ticketStatuses.map(s => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="w-full">
                        <label className="block text-xl font-bold text-jdc-yellow mb-2 tracking-wider">Notes technicien</label>
                        <Textarea
                            name="technicianNotes"
                            value={technicianNotes}
                            onChange={e => setTechnicianNotes(e.target.value)}
                            className="bg-gradient-to-r from-[#10182a] via-[#1a2250] to-[#0a1120] text-jdc-yellow border-4 border-jdc-yellow/70 rounded-2xl w-full text-2xl font-mono font-bold focus:shadow-neon focus:border-jdc-yellow transition-all duration-200 min-h-[160px] py-6 px-7 text-[1.35rem] outline-none ring-2 ring-jdc-yellow/30 focus:ring-jdc-yellow/60"
                            disabled={isLoadingAction}
                            placeholder="Ajouter une note technique..."
                        />
                    </div>
                </div>
                {(currentStatus === 'rma_request' || currentStatus === 'material_sent') && (
                    <div className="px-8 py-6 border-b-2 border-jdc-yellow/30 bg-gradient-to-br from-[#10182a]/95 via-[#1a2250]/95 to-[#1e2746]/95 rounded-xl mt-4 flex flex-col md:flex-row md:gap-8 gap-4 shadow-xl font-bold">
                        <div className="flex-1">
                            <label className="block text-base font-bold text-jdc-yellow mb-1 tracking-wider">Type de matériel</label>
                            <Input
                                name="materialType"
                                value={materialType}
                                onChange={e => setMaterialType(e.target.value)}
                                className="bg-gradient-to-r from-gray-900/80 to-jdc-blue/80 text-jdc-yellow border-2 border-jdc-yellow/40 rounded-xl w-full text-lg font-mono focus:shadow-neon focus:border-jdc-yellow transition-all duration-200"
                                disabled={isLoadingAction}
                                placeholder="Ex : Box, TPE, etc."
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-base font-bold text-jdc-yellow mb-1 tracking-wider">Détails matériel</label>
                            <Input
                                name="materialDetails"
                                value={materialDetails}
                                onChange={e => setMaterialDetails(e.target.value)}
                                className="bg-gradient-to-r from-gray-900/80 to-jdc-blue/80 text-jdc-yellow border-2 border-jdc-yellow/40 rounded-xl w-full text-lg font-mono focus:shadow-neon focus:border-jdc-yellow transition-all duration-200"
                                disabled={isLoadingAction}
                                placeholder="Numéro de série, accessoires, etc."
                            />
                        </div>
                    </div>
                )}
                <div className="px-8 py-6 flex justify-end bg-transparent font-bold">
                    <Button
                        type="submit"
                        variant="glass"
                        size="lg"
                        isLoading={isLoadingAction}
                        className="text-jdc-yellow border-jdc-yellow hover:bg-jdc-yellow hover:text-gray-900 neon-btn shadow-neon px-8 py-3 text-xl font-bold font-mono tracking-widest rounded-2xl transition-all duration-200"
                    >
                        <FaSave className="mr-3 animate-pulse-glow" />Enregistrer
                    </Button>
                </div>

                {/* Timeline/historique avant-gardiste */}
                {ticket.contactAttempts && ticket.contactAttempts.length > 0 && (
                    <div className="px-8 py-6 bg-gradient-to-br from-[#10182a]/95 via-[#1a2250]/95 to-[#1e2746]/95 rounded-b-3xl mt-4 shadow-xl font-bold">
                        <div className="font-bold text-jdc-yellow mb-4 flex items-center gap-3 text-lg tracking-wider"><FaCommentDots className="text-jdc-yellow animate-pulse" /> Historique des contacts</div>
                        <div className="relative pl-6">
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-jdc-yellow/60 to-jdc-blue/60 rounded-full animate-gradient-y" />
                            <ul className="space-y-6">
                                {ticket.contactAttempts.map((attempt, idx) => (
                                    <li key={idx} className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-2 py-2 group">
                                        <span className="absolute -left-6 top-2 w-4 h-4 rounded-full bg-gradient-to-br from-jdc-yellow/80 to-jdc-blue/80 border-2 border-white shadow-neon animate-pulse-glow" />
                                        <div className="flex items-center gap-2 text-xs text-jdc-yellow min-w-[110px] font-mono">
                                            <FaCalendarAlt className="text-jdc-yellow" />
                                            <span>{formatTicketDate(attempt.date)}</span>
                                        </div>
                                        <div className="flex-1 text-sm text-white font-mono bg-gradient-to-r from-jdc-blue/40 to-gray-900/40 rounded-xl px-4 py-2 shadow-inner-terminal group-hover:scale-[1.02] transition-transform duration-200">
                                            {attempt.notes}
                                        </div>
                                        <div className="text-xs font-bold px-3 py-1 rounded-full border-2 border-jdc-yellow/40 bg-jdc-yellow/20 text-jdc-yellow-200 min-w-[80px] text-center shadow-chip group-hover:scale-110 transition-transform duration-200">
                                            {attempt.outcome}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}
            </fetcher.Form>
        </div>
    );

    if (!isClient) return null;
    const portalRoot = document.getElementById('modal-root');
    if (!portalRoot) { console.error("Modal root element #modal-root not found."); return null; }
    return ReactDOM.createPortal(
        <>
            {modalContent}
            <style>{`
                select.custom-select-menu option {
                    background: #000 !important;
                    color: #ffe600 !important;
                    font-weight: bold;
                }
            `}</style>
        </>,
        portalRoot
    );
};

export default TicketSAPDetails;
