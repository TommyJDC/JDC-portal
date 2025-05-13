import React, { useState, useEffect, useMemo, useCallback, useRef, Fragment } from 'react'; // Ajout de Fragment
import ReactDOM from 'react-dom';
import { useFetcher } from '@remix-run/react'; // Form n'est plus utilisé directement ici, fetcher.Form l'est
import useGeminiSummary from '~/hooks/useGeminiSummary';
import ReactMarkdown from 'react-markdown';
import { FaSpinner, FaChevronDown, FaChevronUp, FaTimes, FaInfoCircle, FaCalendarAlt, FaSave, FaCommentDots } from 'react-icons/fa';
import type { SapTicket } from '~/types/firestore.types';
import { Timestamp } from 'firebase/firestore';
import { convertFirestoreDate, formatFirestoreDate } from '~/utils/dateUtils';
import { AnimatedTicketSummary } from '~/components/AnimatedTicketSummary';
import { AnimatedSolution } from '~/components/AnimatedSolution';
import { getStringValue } from '~/utils/firestoreUtils';
import { getTicketStatusStyle } from '~/utils/styleUtils';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Textarea } from './ui/Textarea';
import { 
    Select, 
    SelectTrigger, 
    SelectContent, 
    SelectGroup, 
    SelectItem, 
    SelectValue 
} from './ui/Select'; // Importer tous les sous-composants nécessaires

interface TicketSAPDetailsProps {
    ticket: SapTicket | null;
    onClose: () => void;
    sectorId: string; // sectorId est nécessaire pour les actions du fetcher
    onTicketUpdated: () => void;
}

type SapTicketStatus = 'open' | 'pending' | 'closed' | 'rma_request' | 'material_sent' | 'archived';

const getInitialSAPStatus = (ticket: SapTicket | null): SapTicketStatus => {
    const statusVal = ticket?.status;
    if (!statusVal) return 'open';
    const statusString = getStringValue(statusVal, 'open');
    const validStatuses: SapTicketStatus[] = ['open', 'pending', 'closed', 'rma_request', 'material_sent', 'archived'];
    if (validStatuses.includes(statusString as SapTicketStatus)) {
        return statusString as SapTicketStatus;
    }
    switch (statusString.toLowerCase()) {
        case 'nouveau': case 'ouvert': return 'open';
        case 'en attente (pas de réponse)': case 'en attente': return 'pending';
        case 'clôturé': case 'fermé': return 'closed';
        case 'demande de rma': return 'rma_request';
        case 'demande d\'envoi materiel': return 'material_sent';
        default: return 'open';
    }
};

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
type ActionData = { success: boolean; message?: string; error?: string };

const TicketSAPDetails: React.FC<TicketSAPDetailsProps> = ({ ticket, onClose, sectorId, onTicketUpdated }) => {
    const fetcher = useFetcher<ActionData>();
    const [technicianNotes, setTechnicianNotes] = useState<string>('');
    const [materialType, setMaterialType] = useState<string>('');
    const [currentStatus, setCurrentStatus] = useState<SapTicketStatus>('open');
    const [isDescriptionOpen, setIsDescriptionOpen] = useState<boolean>(false);
    const [materialDetails, setMaterialDetails] = useState<string>('');

    const isLoadingAction = fetcher.state !== 'idle';

    const problemDescriptionForAI = useMemo(() => 
        [ticket?.demandeSAP, ticket?.descriptionProbleme, ticket?.description]
        .reduce((acc: string, field) => {
            if (!field) return acc;
            const value = getStringValue(field, '');
            return value && !acc ? value : acc;
        }, ''), 
    [ticket]);

    const { summary: generatedSummary, isLoading: isSummaryLoading, error: summaryError, generateSummary: triggerSummaryGeneration, resetSummaryState: resetSummaryHookState } = useGeminiSummary(GEMINI_API_KEY);
    const { summary: generatedSolution, isLoading: isSolutionLoading, error: solutionError, generateSummary: triggerSolutionGeneration, resetSummaryState: resetSolutionHookState } = useGeminiSummary(GEMINI_API_KEY);

    const handleSaveSummary = useCallback(async (summaryToSave: string) => { /* ... */ }, [ticket, sectorId, fetcher]);
    const handleSaveSolution = useCallback(async (solutionToSave: string) => { /* ... */ }, [ticket, sectorId, fetcher]);

    useEffect(() => {
        if (!ticket?.id) return;
        setCurrentStatus(getInitialSAPStatus(ticket));
        setTechnicianNotes(getStringValue((ticket as any).technicianNotes, ''));
        setMaterialType(getStringValue((ticket as any).materialType, ''));
        setMaterialDetails(getStringValue((ticket as any).materialDetails, ''));
    }, [ticket]);

    const generationAttempted = useRef<string | null>(null);
    useEffect(() => {
        if (ticket?.id && problemDescriptionForAI && generationAttempted.current !== ticket.id) {
            generationAttempted.current = ticket.id;
            triggerSummaryGeneration(ticket, `Crée un résumé concis (2-3 lignes) du problème SAP: ${problemDescriptionForAI}`, handleSaveSummary);
            triggerSolutionGeneration(ticket, `Propose une solution/piste concise (2-3 lignes) pour le problème SAP: ${problemDescriptionForAI}`, handleSaveSolution);
        } else if (!ticket?.id) {
            resetSummaryHookState(); resetSolutionHookState(); generationAttempted.current = null;
        }
    }, [ticket?.id, problemDescriptionForAI, triggerSummaryGeneration, triggerSolutionGeneration, handleSaveSummary, handleSaveSolution, resetSummaryHookState, resetSolutionHookState]);

    const handleClose = () => { resetSummaryHookState(); resetSolutionHookState(); onClose(); };

    if (!ticket) return null;
    const [isClient, setIsClient] = useState(false);
    useEffect(() => { setIsClient(true); }, []);

    const formatTicketDate = (date: Date | Timestamp | string | null | undefined): string => {
        const convertedDate = convertFirestoreDate(date);
        return convertedDate ? formatFirestoreDate(convertedDate) : 'Non spécifiée';
    };

    const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        formData.set("intent", "update_status");
        formData.set("ticketId", ticket?.id || '');
        formData.set("sectorId", sectorId);
        if (formData.get('status') === 'closed' && !technicianNotes.trim()) { alert("Notes requises pour clôturer."); return; }
        if (technicianNotes.trim()) formData.set("technicianNotes", technicianNotes.trim());
        const statusValue = formData.get('status') as SapTicketStatus;
        if ((statusValue === 'rma_request' || statusValue === 'material_sent') && !materialType) { alert("Type de matériel requis."); return; }
        if (materialType) {
            formData.set("materialType", materialType);
            if (materialDetails.trim()) formData.set("materialDetails", materialDetails.trim());
        } else {
            formData.delete("materialType"); formData.delete("materialDetails");
        }
        
        // Vérifier si l'action est en cours
        if (fetcher.state === "submitting") {
            return;
        }

        // Soumettre le formulaire
        fetcher.submit(formData, { method: "POST", action: "/tickets-sap" });
    };

    // Ajouter un effet pour gérer la réponse de l'action
    useEffect(() => {
        if (fetcher.data && fetcher.state === "idle") {
            if (fetcher.data.success) {
                onTicketUpdated();
                onClose();
            } else {
                const errorMessage = fetcher.data.error || "Une erreur est survenue lors de la mise à jour du ticket.";
                console.error('[TicketSAPDetails] Erreur lors de la mise à jour:', errorMessage);
                
                // Gérer spécifiquement les erreurs d'authentification
                if (errorMessage.includes("Session expirée") || errorMessage.includes("Authentification Google expirée")) {
                    alert("Votre session a expiré. Vous allez être redirigé vers la page de connexion.");
                    window.location.href = "/login"; // Rediriger vers la page de connexion
                } else {
                    alert(errorMessage);
                }
            }
        }
    }, [fetcher.data, fetcher.state, onTicketUpdated, onClose]);

    const ticketStatuses: { value: SapTicketStatus; label: string }[] = [
        { value: 'open', label: 'Ouvert' }, { value: 'pending', label: 'En attente' },
        { value: 'closed', label: 'Clôturé' }, { value: 'rma_request', label: 'Demande RMA' },
        { value: 'material_sent', label: 'Envoi Matériel' },
    ];
    const statusStyle = getTicketStatusStyle(currentStatus);

    const modalContent = (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <fetcher.Form method="post" onSubmit={handleFormSubmit} onClick={e => e.stopPropagation()} className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg shadow-xl bg-ui-surface/90 backdrop-blur-lg border border-ui-border/70 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-ui-border/50 sticky top-0 bg-ui-surface/80 backdrop-blur-lg z-10">
                    <h2 className="text-lg font-semibold text-text-primary truncate pr-4">
                        Ticket: {getStringValue(ticket.raisonSociale, 'N/A')}
                    </h2>
                    <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusStyle.bgColor} ${statusStyle.textColor} border ${statusStyle.borderColor}`}>
                            {ticketStatuses.find(s => s.value === currentStatus)?.label || currentStatus}
                        </span>
                        <button type="button" onClick={handleClose} className="text-text-secondary hover:text-text-primary p-1 rounded-md hover:bg-white/10">
                            <FaTimes className="h-5 w-5"/>
                        </button>
                    </div>
                </div>

                {/* Contenu Scrollable */}
                <div className="p-6 space-y-5 overflow-y-auto flex-1">
                    {/* Infos client */}
                    <section>
                        <h3 className="text-sm font-semibold text-text-secondary mb-2">Informations Client</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm bg-ui-background/50 p-3 rounded-md border border-ui-border/50">
                            {[
                                { label: "Client", value: getStringValue(ticket.client, 'N/A') },
                                { label: "Code Client", value: getStringValue(ticket.codeClient) },
                                { label: "Commercial", value: getStringValue(ticket.deducedSalesperson) },
                                { label: "Adresse", value: getStringValue(ticket.adresse, 'N/A') },
                                { label: "Téléphone", value: getStringValue(ticket.telephone) },
                                { label: "Secteur", value: ticket.secteur || 'N/A' },
                                { label: "Date Ticket", value: formatTicketDate(ticket.date) },
                                { label: "N° SAP", value: getStringValue(ticket.numeroSAP) },
                            ].map(item => item.value ? (
                                <div key={item.label}>
                                    <strong className="block text-xs text-text-tertiary">{item.label}:</strong>
                                    <span className="text-text-primary">{item.value}</span>
                                </div>
                            ) : null)}
                        </div>
                    </section>

                    {/* Description */}
                    <section>
                        <button type="button" className="flex items-center justify-between w-full text-text-primary font-semibold text-sm mb-1.5 focus:outline-none" onClick={() => setIsDescriptionOpen(v => !v)}>
                            <span>Description du problème</span> {isDescriptionOpen ? <FaChevronUp /> : <FaChevronDown />}
                        </button>
                        {isDescriptionOpen && (
                            <div className="prose prose-sm prose-invert max-w-none bg-ui-background/50 p-3 rounded-md text-text-secondary border border-ui-border/50">
                                <ReactMarkdown>{getStringValue(ticket.demandeSAP, '') || getStringValue(ticket.descriptionProbleme, '') || getStringValue(ticket.description, '') || 'Aucune description.'}</ReactMarkdown>
                            </div>
                        )}
                    </section>

                    {/* Résumé/Solution IA */}
                    {(generatedSummary || generatedSolution || isSummaryLoading || isSolutionLoading) && (
                        <section className="space-y-3">
                            {(generatedSummary || isSummaryLoading) && (
                                <div>
                                    <h4 className="text-sm font-semibold text-text-primary mb-1">Résumé IA :</h4>
                                    <div className="bg-ui-background/50 p-3 rounded-md text-text-secondary border border-ui-border/50 min-h-[40px]">
                                        <AnimatedTicketSummary ticket={ticket} summary={generatedSummary} isLoading={isSummaryLoading} error={summaryError} />
                                    </div>
                                </div>
                            )}
                            {(generatedSolution || isSolutionLoading) && (
                                <div>
                                    <h4 className="text-sm font-semibold text-text-primary mb-1">Suggestion IA :</h4>
                                    <div className="bg-ui-background/50 p-3 rounded-md text-text-secondary border border-ui-border/50 min-h-[40px]">
                                        <AnimatedSolution ticket={ticket} solution={generatedSolution} isLoading={isSolutionLoading} error={solutionError} />
                                    </div>
                                </div>
                            )}
                        </section>
                    )}

                    {/* Actions */}
                    <section className="space-y-4">
                        <div>
                            <label htmlFor="modal-status" className="block text-sm font-medium text-text-secondary mb-1">Statut du ticket</label>
                            <select 
                                id="modal-status"
                                name="status"
                                value={currentStatus}
                                onChange={(e) => setCurrentStatus(e.target.value as SapTicketStatus)}
                                disabled={isLoadingAction}
                                className="w-full bg-ui-background/70 border border-ui-border text-text-primary focus:border-brand-blue focus:ring-1 focus:ring-brand-blue rounded-md px-3 py-2 appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{
                                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236B7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                                    backgroundRepeat: 'no-repeat',
                                    backgroundPosition: 'right 0.5rem center',
                                    backgroundSize: '1.5em 1.5em',
                                    paddingRight: '2.5rem'
                                }}
                            >
                                {ticketStatuses.map(s => (
                                    <option 
                                        key={s.value} 
                                        value={s.value}
                                        className="bg-ui-surface text-text-primary"
                                    >
                                        {s.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="modal-technicianNotes" className="block text-sm font-medium text-text-secondary mb-1">Notes technicien</label>
                            <Textarea id="modal-technicianNotes" name="technicianNotes" value={technicianNotes} onChange={e => setTechnicianNotes(e.target.value)}
                                className="w-full min-h-[70px] bg-ui-background/70 border-ui-border text-text-primary focus:border-brand-blue focus:ring-1 focus:ring-brand-blue"
                                disabled={isLoadingAction} placeholder="Ajouter une note technique..." />
                        </div>
                        {(currentStatus === 'rma_request' || currentStatus === 'material_sent') && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="modal-materialType" className="block text-sm font-medium text-text-secondary mb-1">Type de matériel</label>
                                    <Input id="modal-materialType" name="materialType" value={materialType} onChange={e => setMaterialType(e.target.value)}
                                        className="w-full bg-ui-background/70 border-ui-border text-text-primary focus:border-brand-blue focus:ring-1 focus:ring-brand-blue"
                                        disabled={isLoadingAction} placeholder="Ex : Box, TPE..." />
                                </div>
                                <div>
                                    <label htmlFor="modal-materialDetails" className="block text-sm font-medium text-text-secondary mb-1">Détails matériel</label>
                                    <Input id="modal-materialDetails" name="materialDetails" value={materialDetails} onChange={e => setMaterialDetails(e.target.value)}
                                        className="w-full bg-ui-background/70 border-ui-border text-text-primary focus:border-brand-blue focus:ring-1 focus:ring-brand-blue"
                                        disabled={isLoadingAction} placeholder="N° série, accessoires..." />
                                </div>
                            </div>
                        )}
                    </section>

                    {/* Historique */}
                    {ticket.contactAttempts && ticket.contactAttempts.length > 0 && (
                        <section>
                            <h4 className="text-sm font-semibold text-text-primary mb-2">Historique des contacts</h4>
                            <ul className="space-y-1.5 max-h-32 overflow-y-auto text-xs pr-1">
                                {ticket.contactAttempts.map((attempt, idx) => (
                                    <li key={idx} className="p-2 bg-ui-background/50 rounded-md border border-ui-border/50">
                                        <div className="flex justify-between items-center mb-0.5">
                                            <span className="font-medium text-text-secondary">{attempt.outcome}</span>
                                            <span className="text-text-tertiary">{formatTicketDate(attempt.date)}</span>
                                        </div>
                                        <p className="text-text-secondary whitespace-pre-line text-xs">{attempt.notes}</p>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                </div>
                
                {/* Footer */}
                <div className="px-6 py-4 border-t border-ui-border/50 flex justify-end sticky bottom-0 bg-ui-surface/80 backdrop-blur-lg z-10">
                    <Button type="submit" variant="primary" size="md" isLoading={isLoadingAction} className="bg-brand-blue hover:bg-brand-blue-dark text-white">
                        <FaSave className="mr-2" />Enregistrer
                    </Button>
                </div>
            </fetcher.Form>
        </div>
    );

    if (!isClient) return null;
    const portalRoot = document.getElementById('modal-root');
    if (!portalRoot) { console.error("Modal root element #modal-root not found."); return null; }
    return ReactDOM.createPortal(modalContent, portalRoot);
};

export default TicketSAPDetails;
