import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useFetcher } from '@remix-run/react';
import useGeminiSummary from '~/hooks/useGeminiSummary'; // Restored import
import ReactMarkdown from 'react-markdown';
import { FaSpinner, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import type { SapTicket } from '~/types/firestore.types';
import { Timestamp } from 'firebase/firestore';
import { formatFirestoreDate } from '~/utils/dateUtils';
import { AnimatedTicketSummary } from '~/components/AnimatedTicketSummary'; // Restored import
import { AnimatedSolution } from '~/components/AnimatedSolution'; // Restored import
import { AnimatedComments } from '~/components/AnimatedComments';

interface TicketSAPDetailsProps {
    ticket: SapTicket | null;
    onClose: () => void;
    sectorId: string;
    onTicketUpdated: () => void;
}

const getInitialSAPStatus = (ticket: SapTicket | null): string => {
    if (!ticket?.statutSAP) return 'Nouveau';
    return ticket.statutSAP;
};

const getSAPStatusBadgeClass = (status: string): string => {
    switch (status?.toLowerCase()) {
        case 'nouveau': return 'badge-info';
        case 'en cours': return 'badge-primary';
        case 'terminé': return 'badge-success';
        case 'annulé': return 'badge-error';
        default: return 'badge-ghost';
    }
};

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY; // Restored API key

type ActionData = { success: boolean; message?: string; error?: string };

function hasErrorProperty(data: any): data is { success: false; error: string } {
    return data && data.success === false && typeof data.error === 'string';
}
function hasMessageProperty(data: any): data is { success: true; message: string } {
    return data && data.success === true && typeof data.message === 'string';
}

const TicketSAPDetails: React.FC<TicketSAPDetailsProps> = ({ ticket, onClose, sectorId, onTicketUpdated }) => {
    const fetcher = useFetcher<ActionData>();
    const [newComment, setNewComment] = useState<string>('');
    const [currentStatus, setCurrentStatus] = useState<string>('');
    const [isDescriptionOpen, setIsDescriptionOpen] = useState<boolean>(false); // State for description visibility

    const isLoadingAction = fetcher.state !== 'idle';

    const problemDescriptionForAI = ticket?.demandeSAP || ticket?.descriptionProbleme || ticket?.description || ''; // Restored variable

    // Restored useGeminiSummary hooks
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

    // Restored save handlers
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
    }, [ticket?.id]);

    // Ref to track if generation has been attempted for the current ticket
    const generationAttempted = useRef<string | null>(null);

    // Effect to trigger AI generation when ticket changes, only once per ticket
    useEffect(() => {
        // Check if we have a ticket, a description, and haven't attempted generation for this ticket yet
        if (ticket?.id && problemDescriptionForAI && generationAttempted.current !== ticket.id) {
            console.log(`[TicketSAPDetails] Attempting AI generation for ticket ${ticket.id}`);
            generationAttempted.current = ticket.id; // Mark generation as attempted for this ticket

            // Trigger summary generation - Request shorter summary
            triggerSummaryGeneration(ticket, `Crée un résumé très concis (2-3 lignes maximum) du problème SAP suivant en français, en mettant l'accent sur les points clés pour un technicien : ${problemDescriptionForAI}`, handleSaveSummary);
            // Trigger solution generation - Request shorter solution
            triggerSolutionGeneration(ticket, `Propose une solution technique ou une piste de résolution très concise (2-3 lignes maximum) pour le problème SAP suivant en français : ${problemDescriptionForAI}`, handleSaveSolution);
        } else if (!ticket?.id) {
            // Reset state and attempted flag if no valid ticket
            console.log("[TicketSAPDetails] No valid ticket, resetting AI state.");
            resetSummaryHookState();
            resetSolutionHookState();
            generationAttempted.current = null; // Reset attempted flag
        }
        // Dependencies include ticket.id and problemDescriptionForAI to react to changes in ticket data
        // Include trigger functions and save handlers to ensure they are up-to-date, though useCallback should make them stable
    }, [ticket?.id, problemDescriptionForAI, triggerSummaryGeneration, triggerSolutionGeneration, handleSaveSummary, handleSaveSolution, resetSummaryHookState, resetSolutionHookState]);


    const handleClose = () => {
        resetSummaryHookState(); // Restored reset
        resetSolutionHookState(); // Restored reset
        onClose();
    };

    const handleAddComment = () => {
        if (newComment.trim() && sectorId && ticket?.id) {
            const formData = new FormData();
            formData.append("intent", "add_comment");
            formData.append("ticketId", ticket.id);
            formData.append("sectorId", sectorId);
            formData.append("comment", newComment.trim());
            formData.append("existingComments", JSON.stringify(ticket.commentaires || []));
            fetcher.submit(formData, { method: "POST", action: "/tickets-sap" });
            setNewComment('');
        }
    };

    const handleStatusChange = () => {
        if (sectorId && ticket?.id && currentStatus && currentStatus !== ticket?.statutSAP) {
            const formData = new FormData();
            formData.append("intent", "update_status");
            formData.append("ticketId", ticket.id);
            formData.append("sectorId", sectorId);
            formData.append("status", currentStatus);
            fetcher.submit(formData, { method: "POST", action: "/tickets-sap" });
        }
    };

    if (!ticket) return null;

    const [isClient, setIsClient] = useState(false);
    useEffect(() => { setIsClient(true); }, []);

  const formatTicketDate = (date: Date | Timestamp | string | null | undefined): string => {
    console.log('formatTicketDate: Input date value:', date, 'Type:', typeof date);
    if (!date) return 'Non spécifiée';
    
    // Si c'est déjà une string formatée, la retourner directement
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
                                {ticket.raisonSociale || 'Client Inconnu'}
                            </h3>
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                                <span className="px-2 py-1 rounded bg-jdc-gray/50 font-mono">SAP #{ticket.numeroSAP || 'N/A'}</span>
                                <span className={`badge ${getSAPStatusBadgeClass(currentStatus)}`}>{currentStatus}</span>
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
                                <span className="font-medium">{ticket.codeClient || 'N/A'}</span>
                            </p>
                            <p className="flex items-center gap-2">
                                <span className="w-24 text-gray-400">Téléphone</span>
                                <span className="font-medium">{ticket.telephone || 'N/A'}</span>
                            </p>
                            <p className="flex items-center gap-2">
                                <span className="w-24 text-gray-400">Date</span>
                                <span className="font-medium">{formatTicketDate(ticket.date)}</span>
                            </p>
                             <p className="flex items-center gap-2">
                                <span className="w-24 text-gray-400">Secteur</span>
                                <span className="badge badge-neutral">{ticket.secteur || 'N/A'}</span>
                            </p>
                            {ticket.deducedSalesperson && (
                                <p className="flex items-center gap-2">
                                    <span className="w-24 text-gray-400">Commercial</span>
                                    <span className="font-medium">{ticket.deducedSalesperson}</span>
                                </p>
                            )}
                            <p className="flex items-center gap-2">
                                <span className="w-24 text-gray-400">Adresse</span>
                                <span className="font-medium">{ticket.adresse || 'Non trouvé'}</span>
                            </p>
                            {/* Added more ticket information fields */}
                            {ticket.type && (
                                <p className="flex items-center gap-2">
                                    <span className="w-24 text-gray-400">Type</span>
                                    <span className="font-medium">{ticket.type}</span>
                                </p>
                            )}
                             {ticket.priorite && (
                                <p className="flex items-center gap-2">
                                    <span className="w-24 text-gray-400">Priorité</span>
                                    <span className="font-medium">{ticket.priorite}</span>
                                </p>
                            )}
                             {ticket.origine && (
                                <p className="flex items-center gap-2">
                                    <span className="w-24 text-gray-400">Origine</span>
                                    <span className="font-medium">{ticket.origine}</span>
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
                            {isDescriptionOpen ? <FaChevronUp /> : <FaChevronDown />}
                        </button>
                        <div className={`prose prose-invert max-w-none mt-2 ${isDescriptionOpen ? 'block' : 'hidden'}`}>
                            {ticket.descriptionProbleme || ticket.demandeSAP || ticket.description || 'Aucune description disponible'}
                        </div>
                    </div>

                    {/* AI Generated Content - Restored */}
                    <div className="space-y-6 mb-6">
                        <AnimatedTicketSummary
                            ticketContent={problemDescriptionForAI}
                            ticket={ticket}
                            summary={generatedSummary}
                            isLoading={isSummaryLoading}
                            error={summaryError}
                            // Pass save handler and trigger generation if needed by AnimatedTicketSummary
                            // Assuming AnimatedTicketSummary handles its own trigger based on props/internal state
                        />

                        <AnimatedSolution
                            ticketContent={problemDescriptionForAI}
                            ticket={ticket}
                            solution={generatedSolution}
                            isLoading={isSolutionLoading}
                            error={solutionError}
                             // Pass save handler and trigger generation if needed by AnimatedSolution
                            // Assuming AnimatedSolution handles its own trigger based on props/internal state
                        />
                    </div>


                    {/* Status Update */}
                    <div className="mb-6 p-4 bg-jdc-gray/20 rounded-lg border border-gray-700/50 backdrop-blur-sm">
                        <h4 className="font-bold text-lg mb-3 text-jdc-yellow">Mettre à jour le statut</h4>
                        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                            <select
                                value={currentStatus}
                                onChange={(e) => setCurrentStatus(e.target.value)}
                                className="select select-bordered w-full sm:w-auto bg-gray-700 text-white border-gray-600 focus:border-jdc-yellow focus:ring-jdc-yellow" // Adjusted styles
                            >
                                <option value="Nouveau">Nouveau</option>
                                <option value="En cours">En cours</option>
                                <option value="Terminé">Terminé</option>
                                <option value="Annulé">Annulé</option>
                            </select>
                            <button
                                onClick={handleStatusChange}
                                disabled={isLoadingAction || currentStatus === ticket.statutSAP}
                                className={`btn rounded-md ${isLoadingAction ? 'loading' : ''}`} // Added rounded-md class
                            >
                                {isLoadingAction ? 'Enregistrement...' : 'Mettre à jour'}
                            </button>
                        </div>
                    </div>

                    {/* Comments Section */}
                    <AnimatedComments
                        comments={ticket.commentaires || []}
                        onAddComment={(comment) => {
                            setNewComment(comment); // Keep this to update local state if needed elsewhere
                            handleAddComment();
                        }}
                        isLoading={isLoadingAction}
                    />

                    {/* Removed duplicate Add Comment Input section */}

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
