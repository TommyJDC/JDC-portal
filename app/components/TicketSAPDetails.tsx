import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useFetcher, Form } from '@remix-run/react'; // Import Form
import useGeminiSummary from '~/hooks/useGeminiSummary';
import ReactMarkdown from 'react-markdown';
import { FaSpinner, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import type { SapTicket } from '~/types/firestore.types';
import { Timestamp } from 'firebase/firestore';
import { formatFirestoreDate } from '~/utils/dateUtils';
import { AnimatedTicketSummary } from '~/components/AnimatedTicketSummary';
import { AnimatedSolution } from '~/components/AnimatedSolution';
import { AnimatedComments } from '~/components/AnimatedComments';
import { getStringValue } from '~/utils/firestoreUtils';

interface TicketSAPDetailsProps {
    ticket: SapTicket | null;
    onClose: () => void;
    sectorId: string;
    onTicketUpdated: () => void;
}

// Type guard for Firestore string value
const isFirestoreStringValue = (val: any): val is { stringValue: string } =>
    typeof val === 'object' && val !== null && 'stringValue' in val;

const getInitialSAPStatus = (ticket: SapTicket | null): string => {
    if (!ticket?.statutSAP) return 'Nouveau';
    return isFirestoreStringValue(ticket.statutSAP)
        ? ticket.statutSAP.stringValue
        : String(ticket.statutSAP);
};

const getSAPStatusBadgeClass = (status: string | { stringValue: string } | undefined): string => {
    let statusString: string | undefined;
    if (typeof status === 'string') {
        statusString = status;
    } else if (isFirestoreStringValue(status)) {
        statusString = status.stringValue;
    } else {
        statusString = undefined;
    }

    switch (statusString?.toLowerCase()) {
        case 'nouveau': return 'badge-info';
        case 'en cours': return 'badge-primary';
        case 'terminé': return 'badge-success';
        case 'annulé': return 'badge-error';
        default: return 'badge-ghost';
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

const TicketSAPDetails: React.FC<any> = ({ ticket, onClose, sectorId, onTicketUpdated }) => {
    const fetcher = useFetcher<ActionData>();
    const [technicianNotes, setTechnicianNotes] = useState<string>(''); // State for technician notes
    const [materialType, setMaterialType] = useState<string>(''); // State for material type (RMA case)
    const [currentStatus, setCurrentStatus] = useState<SapTicket['status']>('open'); // Use SapTicket['status'] type
    const [isDescriptionOpen, setIsDescriptionOpen] = useState<boolean>(false);

    const isLoadingAction = fetcher.state !== 'idle';

    // Correction: Fix reduce parenthesis and logic for problemDescriptionForAI
    const problemDescriptionForAI = [
        ticket?.demandeSAP,
        ticket?.descriptionProbleme,
        ticket?.description
    ].reduce((acc: string, field) => {
        if (!field) return acc;
        if (acc) return acc;
        return getStringValue(field, '');
    }, '');

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
        resetSummaryState: resetSolutionHookState // Corrected to use resetSummaryState
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
        // Initialize currentStatus from ticket data, mapping if necessary
        // Assuming getInitialSAPStatus maps Firestore/string values to SapTicket['status']
        setCurrentStatus(getInitialSAPStatus(ticket) as SapTicket['status']);
        // Initialize technician notes and material type from ticket if they exist
        setTechnicianNotes(getStringValueWithFallback(ticket.technicianNotes, '')); // Assuming technicianNotes field exists on ticket
        setMaterialType(getStringValueWithFallback(ticket.materialType, '')); // Assuming materialType field exists on ticket
    }, [ticket?.id, ticket?.technicianNotes, ticket?.materialType]); // Add dependencies

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

    // Remove handleAddComment as comments are handled separately or integrated differently
    // const handleAddComment = () => { ... };

    const handleStatusChange = () => {
        if (sectorId && ticket?.id && currentStatus) { // Allow submitting even if status is the same to re-trigger actions if needed
            const formData = new FormData();
            formData.append("intent", "update_status");
            formData.append("ticketId", ticket.id);
            formData.append("sectorId", sectorId);
            formData.append("status", currentStatus);

            // Include technician notes if available
            if (technicianNotes.trim()) {
                formData.append("technicianNotes", technicianNotes.trim());
            }

            // Include material type if status is 'open' (assuming RMA/material case uses 'open')
            // Check if the selected status implies a material request (e.g., 'open' with materialType)
            // Or if materialType is set and status is being updated to 'open' or kept as 'open'
            if (currentStatus === 'open' && materialType) { // Adjust logic based on how RMA is triggered
                 formData.append("materialType", materialType);
            } else if (ticket.materialType && currentStatus === 'open') {
                 // If ticket already has materialType and status is updated to/kept as 'open', send existing materialType
                 formData.append("materialType", getStringValueWithFallback(ticket.materialType));
            }


            fetcher.submit(formData, { method: "POST", action: "/tickets-sap" });
        }
    };

    if (!ticket) return null;

    const [isClient, setIsClient] = useState(false);
    useEffect(() => { setIsClient(true); }, []);

    const formatTicketDate = (date: Date | Timestamp | string | null | undefined): string => {
        if (!date) return 'Non spécifiée';
        if (typeof date === 'string' && date.match(/\d{1,2}\/\d{1,2}\/\d{4}/)) {
            return date;
        }
        const formatted = formatFirestoreDate(date, {
            defaultValue: 'Non spécifiée'
        }) as string;
        return formatted;
    };

    const getTicketDateForSorting = (date: Date | Timestamp | string | null | undefined): Date => {
        if (!date) return new Date(0);
        try {
            if (date instanceof Timestamp) {
                return date.toDate();
            }
            if (date instanceof Date) {
                return date;
            }
            if (typeof date === 'string') {
                return new Date(date);
            }
            return new Date(0);
        } catch (e) {
            return new Date(0);
        }
    };

    const modalContent = (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={handleClose}>
            <div className="w-11/12 max-w-4xl relative bg-gradient-to-b from-jdc-card to-jdc-card/95 text-jdc-white rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="sticky top-0 z-20 bg-gradient-to-b from-jdc-card via-jdc-card to-transparent pb-6 pt-4 px-6">
                    <button onClick={handleClose} className="btn btn-sm btn-circle btn-ghost absolute right-4 top-4 hover:rotate-90 transition-transform duration-200" aria-label="Fermer">✕</button>
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h3 className="font-bold text-2xl mb-1 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-400">
                                {getStringValue(ticket.raisonSociale, 'Client Inconnu')}
                            </h3>
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                                <span className="px-2 py-1 rounded bg-jdc-gray/50 font-mono">SAP #{getStringValue(ticket.numeroSAP, 'N/A')}</span>
                                <span className="text-gray-500">•</span>
                                <span>{getStringValue(ticket.secteur, 'N/A')}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="px-6 pb-6">
                    {/* Ticket Information Grid */}
                    <div className="mb-6 p-4 bg-jdc-gray/20 rounded-lg border border-gray-700/50 backdrop-blur-sm">
                        <h4 className="font-bold text-lg mb-4 text-jdc-yellow">Informations du Ticket</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <p className="flex items-center gap-2">
                                <span className="w-24 text-gray-400">Code Client</span>
                                <span className="font-medium">{getStringValue(ticket.codeClient, 'N/A')}</span>
                            </p>
                            <p className="flex items-center gap-2">
                                <span className="w-24 text-gray-400">Téléphone</span>
                                <span className="font-medium">{getStringValue(ticket.telephone, 'N/A')}</span>
                            </p>
                            <p className="flex items-center gap-2">
                                <span className="w-24 text-gray-400">Date</span>
                                <span className="font-medium">{formatTicketDate(ticket.date)}</span>
                            </p>
                            <p className="flex items-center gap-2">
                                <span className="w-24 text-gray-400">Secteur</span>
                                <span className="badge badge-neutral">{getStringValue(ticket.secteur, 'N/A')}</span>
                            </p>
                            {ticket.deducedSalesperson && (
                                <p className="flex items-center gap-2">
                                    <span className="w-24 text-gray-400">Commercial</span>
                                    <span className="font-medium">{ticket.deducedSalesperson}</span>
                                </p>
                            )}
                            <p className="flex items-center gap-2">
                                <span className="w-24 text-gray-400">Adresse</span>
                                <span className="font-medium">{getStringValue(ticket.adresse, 'Non trouvé')}</span>
                            </p>
                            {ticket.type && (
                                <p className="flex items-center gap-2">
                                    <span className="w-24 text-gray-400">Type</span>
                                    <span className="font-medium">{getStringValue(ticket.type, 'N/A')}</span>
                                </p>
                            )}
                            {ticket.priorite && (
                                <p className="flex items-center gap-2">
                                    <span className="w-24 text-gray-400">Priorité</span>
                                    <span className="font-medium">{getStringValue(ticket.priorite, 'N/A')}</span>
                                </p>
                            )}
                            {ticket.origine && (
                                <p className="flex items-center gap-2">
                                    <span className="w-24 text-gray-400">Origine</span>
                                    <span className="font-medium">{getStringValue(ticket.origine, 'N/A')}</span>
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Problem Description - Collapsible */}
                    <div className="mb-6 p-4 bg-jdc-gray/20 rounded-lg border border-gray-700/50 backdrop-blur-sm">
                        <button
                            className="flex items-center justify-between w-full text-left font-bold text-lg text-jdc-yellow focus:outline-none"
                            onClick={() => setIsDescriptionOpen(!isDescriptionOpen)}
                            aria-expanded={isDescriptionOpen}
                        >
                            Description du problème
                        </button>
                        {isDescriptionOpen && (
                            <div className="mt-2 text-white">
                                { ticket?.id
                                    ? ( [
                                        ticket?.demandeSAP,
                                        ticket?.descriptionProbleme,
                                        ticket?.description
                                      ].reduce((acc: string, field) => {
                                        if (!field) return acc;
                                        if (acc) return acc;
                                        return getStringValue(field, '');
                                      }, ''))
                                    : ''
                                }
                            </div>
                        )}
                    </div>

                    {/* AI Generated Content */}
                    <div className="space-y-6 mb-6">
                        <AnimatedTicketSummary
                            ticketContent={problemDescriptionForAI}
                            ticket={ticket}
                            summary={generatedSummary}
                            isLoading={isSummaryLoading}
                            error={summaryError}
                        />
                        <AnimatedSolution
                            ticketContent={problemDescriptionForAI}
                            ticket={ticket}
                            solution={generatedSolution}
                            isLoading={isSolutionLoading}
                            error={solutionError}
                        />
                    </div>

                    {/* Status Update and Email Trigger */}
                    <div className="mb-6 p-4 bg-jdc-gray/20 rounded-xl border border-gray-700/50 backdrop-blur-sm">
                        <h4 className="font-bold text-lg mb-3 text-jdc-yellow">Actions Ticket</h4>
                        
                        {/* Form for Status Update and Email */}
                        <Form method="post" action="/tickets-sap" onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
                            // Prevent default form submission as we are using fetcher.submit
                            e.preventDefault();
                            // Determine which action was triggered by the button clicked
                            const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
                            const intent = submitter?.name === 'intent' ? submitter.value : 'update_status'; // Default to update_status

                            const formData = new FormData(e.currentTarget); // Use form data
                            formData.set("intent", intent); // Set the correct intent

                            // Ensure ticket and sector IDs are included
                            formData.set("ticketId", ticket?.id || '');
                            formData.set("sectorId", sectorId);

                            // Include technician notes if available
                            if (technicianNotes.trim()) {
                                formData.set("technicianNotes", technicianNotes.trim());
                            } else if (intent === 'update_status' && formData.get('status') === 'closed') {
                                // Require technician notes for closure status update
                                alert("Les notes du technicien sont requises pour clôturer le ticket.");
                                return; // Prevent submission
                            }


                            // Include material type if applicable (for RMA/Envoi Matériel intents or status update to 'open' with material type)
                            if (intent === 'trigger_rma' || intent === 'trigger_envoi_materiel') {
                                if (!materialType) {
                                     alert("Veuillez sélectionner un type de matériel.");
                                     return; // Prevent submission
                                }
                                formData.set("materialType", materialType);
                            } else if (formData.get('status') === 'open' && materialType) {
                                // If status is updated to 'open' and material type is selected
                                formData.set("materialType", materialType);
                            } else if (formData.get('status') === 'open' && ticket.materialType) {
                                // If status is updated to 'open' and ticket already has materialType
                                formData.set("materialType", getStringValueWithFallback(ticket.materialType));
                            } else {
                                // Ensure materialType is not sent for other status updates if not relevant
                                formData.delete("materialType");
                            }


                            fetcher.submit(formData, { method: "POST", action: "/tickets-sap" });
                        }} className="space-y-4">

                            {/* Status Select */}
                            <div>
                                <label htmlFor="status" className="block text-sm font-medium text-gray-400 mb-1">Statut</label>
                                <select
                                    id="status"
                                    name="status" // Name must match formData key in action
                                    value={currentStatus}
                                    onChange={(e) => setCurrentStatus(e.target.value as SapTicket['status'])}
                                    className="select select-bordered w-full bg-gray-700 text-white border-gray-600 focus:border-jdc-yellow focus:ring-jdc-yellow rounded-lg"
                                >
                                    {/* Map internal statuses to display values if needed, or use action statuses directly */}
                                    <option value="open">Ouvert</option>
                                    <option value="pending">En attente (Pas de réponse)</option>
                                    <option value="closed">Clôturé</option>
                                    <option value="rma_request">Demande de RMA</option> {/* Added new status */}
                                    <option value="material_sent">Demande d'envoi materiel</option> {/* Added new status */}
                                    {/* 'archived' status is likely not set via this UI */}
                                </select>
                            </div>

                            {/* Technician Notes */}
                            <div>
                                <label htmlFor="technicianNotes" className="block text-sm font-medium text-gray-400 mb-1">Notes du technicien</label>
                                <textarea
                                    id="technicianNotes"
                                    name="technicianNotes" // Name must match formData key in action
                                    value={technicianNotes}
                                    onChange={(e) => setTechnicianNotes(e.target.value)}
                                    rows={3}
                                    className="textarea textarea-bordered w-full bg-gray-700 text-white border-gray-600 focus:border-jdc-yellow focus:ring-jdc-yellow rounded-lg"
                                    placeholder="Ajouter des notes pour le résumé AI ou l'archivage..."
                                ></textarea>
                            </div>

                            {/* Material Type (Conditional for RMA/Envoi Matériel actions or 'open' status) */}
                            {/* Show if status is 'open', 'rma_request', 'material_sent' OR if materialType is already set on the ticket */}
                            {(currentStatus === 'open' || currentStatus === 'rma_request' || currentStatus === 'material_sent' || ticket.materialType) && (
                                <div className="space-y-4"> {/* Use space-y-4 for spacing within this conditional block */}
                                    <div>
                                        <label htmlFor="materialType" className="block text-sm font-medium text-gray-400 mb-1">Type de matériel (RMA/Envoi)</label>
                                        <select
                                            id="materialType"
                                            name="materialType" // Name must match formData key in action
                                            value={materialType}
                                            onChange={(e) => setMaterialType(e.target.value)}
                                            className="select select-bordered w-full bg-gray-700 text-white border-gray-600 focus:border-jdc-yellow focus:ring-jdc-yellow rounded-lg"
                                        >
                                            <option value="">-- Sélectionner --</option>
                                            <option value="RMA">RMA</option>
                                            <option value="envoi-materiel">Envoi Matériel</option>
                                            {/* Add other material types as needed */}
                                        </select>
                                    </div>

                                    {/* Material Details (Conditional on materialType being selected) */}
                                    {materialType && (
                                        <div>
                                            <label htmlFor="materialDetails" className="block text-sm font-medium text-gray-400 mb-1">Détails du matériel</label>
                                            <textarea
                                                id="materialDetails"
                                                name="materialDetails" // New field name
                                                value={getStringValueWithFallback(ticket.materialDetails, '')} // Assuming materialDetails field exists on ticket
                                                onChange={(e) => { /* Handle state update if needed, or rely on form data */ }}
                                                rows={3}
                                                className="textarea textarea-bordered w-full bg-gray-700 text-white border-gray-600 focus:border-jdc-yellow focus:ring-jdc-yellow rounded-lg"
                                                placeholder="Spécifier le matériel (référence, quantité, etc.)"
                                            ></textarea>
                                        </div>
                                    )}
                                </div>
                            )}


                            {/* Action Buttons */}
                            {/* Keep the single submit button for status update */}
                            <button
                                type="submit" // This button submits the form
                                disabled={isLoadingAction}
                                className={`btn w-full rounded-lg ${isLoadingAction ? 'opacity-50 cursor-not-allowed' : ''} bg-jdc-yellow hover:bg-jdc-yellow/90 border-none text-jdc-card font-bold`}
                            >
                                {isLoadingAction ? (
                                    <>
                                        <FaSpinner className="animate-spin mr-2" />
                                        Enregistrement...
                                    </>
                                ) : 'Mettre à jour & Envoyer Email'} {/* Modified button text */}
                            </button>

                            {/* Remove specific RMA/Envoi Materiel buttons as status selection now handles this */}
                            {/*
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button
                                    type="submit"
                                    name="intent"
                                    value="trigger_rma"
                                    disabled={isLoadingAction || !materialType || !technicianNotes.trim()}
                                    className={`btn btn-secondary w-full sm:w-1/2 rounded-md ${isLoadingAction ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                     {isLoadingAction && fetcher.formData?.get('intent') === 'trigger_rma' ? (
                                        <>
                                            <FaSpinner className="animate-spin mr-2" />
                                            Envoi RMA...
                                        </>
                                    ) : 'Déclencher Email RMA'}
                                </button>
                                <button
                                    type="submit"
                                    name="intent"
                                    value="trigger_envoi_materiel"
                                    disabled={isLoadingAction || !materialType || !technicianNotes.trim()}
                                    className={`btn btn-accent w-full sm:w-1/2 rounded-md ${isLoadingAction ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                     {isLoadingAction && fetcher.formData?.get('intent') === 'trigger_envoi_materiel' ? (
                                        <>
                                            <FaSpinner className="animate-spin mr-2" />
                                            Envoi Matériel...
                                        </>
                                    ) : 'Déclencher Email Envoi Matériel'}
                                </button>
                            </div>
                            */}
                        </Form>

                        {/* Action Result Message */}
                        {fetcher.data && (
                            <div className={`mt-4 p-3 rounded-md text-sm ${
                                hasMessageProperty(fetcher.data)
                                    ? "bg-green-100 text-green-800"
                                    : hasErrorProperty(fetcher.data)
                                        ? "bg-red-100 text-red-800"
                                        : ""
                            }`}>
                                {hasMessageProperty(fetcher.data) && fetcher.data.message}
                                {hasErrorProperty(fetcher.data) && fetcher.data.error}
                            </div>
                        )}
                    </div>



                    {/* Comments Section - Removed as per user request */}
                </div>
            </div>
        </div>
    );

    if (!isClient) return null;
    const portalRoot = document.getElementById('modal-root');
    if (!portalRoot) { console.error("Modal root element #modal-root not found."); return null; }
    return ReactDOM.createPortal(modalContent, portalRoot);
};

export default TicketSAPDetails;
