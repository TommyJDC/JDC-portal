import React, { useState, useEffect, useMemo, useCallback } from 'react';
    import ReactDOM from 'react-dom';
    import { useFetcher } from '@remix-run/react'; // Import useFetcher
    // Use ~ alias for imports relative to the app root
    import useGeminiSummary from '~/hooks/useGeminiSummary';
    // Removed direct import of updateSAPTICKET
    import ReactMarkdown from 'react-markdown';
    import { FaSpinner } from 'react-icons/fa';
    import type { SapTicket } from '~/types/firestore.types'; // Import the central type
    import { Timestamp } from 'firebase/firestore'; // Import Timestamp
    // Import the date utility functions
    import { parseFrenchDate, formatDateForDisplay } from '~/utils/dateUtils';
    // Import action type if defined in tickets-sap.action.ts
    // import type { action as ticketsSapAction } from '~/routes/tickets-sap.action';

    interface TicketSAPDetailsProps {
        ticket: SapTicket | null;
        onClose: () => void;
        sectorId: string; // Sector ID is crucial for updating the correct document
        onTicketUpdated: () => void; // Callback to refresh list after update
    }

    // Function to determine the initial status for SAP tickets
    const getInitialSAPStatus = (ticket: SapTicket | null): string => {
        if (!ticket?.statutSAP) {
            return 'Nouveau'; // Default status
        }
        return ticket.statutSAP;
    };

    // Define badge classes based on SAP status (adjust as needed)
    const getSAPStatusBadgeClass = (status: string): string => {
        switch (status?.toLowerCase()) {
            case 'nouveau': return 'badge-info';
            case 'en cours': return 'badge-primary';
            case 'terminé': return 'badge-success';
            case 'annulé': return 'badge-error';
            default: return 'badge-ghost';
        }
    };

    // Gemini API Key provided by the user
    const GEMINI_API_KEY = "AIzaSyAZqeCNWSWu1D4iFthrCW7sx9Ky2jlqoUg"; // Replace with your actual key or env variable

    // Type for the expected structure of fetcher.data from the action
    type ActionData = { success: boolean; message?: string; error?: string };

    // Type guard for fetcher data with error/message
    function hasErrorProperty(data: any): data is { success: false; error: string } {
        return data && data.success === false && typeof data.error === 'string';
    }
    function hasMessageProperty(data: any): data is { success: true; message: string } {
        return data && data.success === true && typeof data.message === 'string';
    }

    const TicketSAPDetails: React.FC<TicketSAPDetailsProps> = ({ ticket, onClose, sectorId, onTicketUpdated }) => {
        const fetcher = useFetcher<ActionData>(); // Use ActionData type hint
        const [newComment, setNewComment] = useState<string>('');
        const [currentStatus, setCurrentStatus] = useState<string>('');

        const isLoadingAction = fetcher.state !== 'idle';

        // --- AI Summary ---
        const problemDescriptionForAI = ticket?.demandeSAP || ticket?.descriptionProbleme || ticket?.description || '';
        const summaryPrompt = useMemo(() => {
            if (!problemDescriptionForAI || ticket?.summary) return '';
            return `Résume ce problème SAP en 1 ou 2 phrases maximum, en français: ${problemDescriptionForAI}`;
        }, [ticket?.id, problemDescriptionForAI, ticket?.summary]);

        const {
            summary: generatedSummary,
            isLoading: isSummaryLoading,
            error: summaryError,
            generateSummary: triggerSummaryGeneration,
            isCached: isSummaryCached,
            resetSummaryState: resetSummaryHookState
        } = useGeminiSummary(GEMINI_API_KEY);

        // --- AI Solution ---
        const solutionPrompt = useMemo(() => {
            if (!problemDescriptionForAI || ticket?.solution) return '';
            return `Propose une solution concise (1-2 phrases), en français, pour ce problème SAP: ${problemDescriptionForAI}`;
        }, [ticket?.id, problemDescriptionForAI, ticket?.solution]);

        const {
            summary: generatedSolution,
            isLoading: isSolutionLoading,
            error: solutionError,
            generateSummary: triggerSolutionGeneration,
            isCached: isSolutionCached,
            resetSummaryState: resetSolutionHookState
        } = useGeminiSummary(GEMINI_API_KEY);

        // --- Callbacks for Saving (using fetcher, marked async) ---
        const handleSaveSummary = useCallback(async (summaryToSave: string): Promise<void> => { // Mark async
            if (!ticket || !sectorId) return;
            console.log(`[TicketSAPDetails] Submitting SUMMARY save for ticket ${ticket.id}`);
            const formData = new FormData();
            formData.append("intent", "save_summary");
            formData.append("ticketId", ticket.id);
            formData.append("sectorId", sectorId);
            formData.append("summary", summaryToSave);
            fetcher.submit(formData, { method: "POST", action: "/tickets-sap" });
            // No await needed for fetcher.submit, marking async satisfies type
        }, [ticket, sectorId, fetcher]);

        const handleSaveSolution = useCallback(async (solutionToSave: string): Promise<void> => { // Mark async
            if (!ticket || !sectorId) return;
            console.log(`[TicketSAPDetails] Submitting SOLUTION save for ticket ${ticket.id}`);
             const formData = new FormData();
            formData.append("intent", "save_solution");
            formData.append("ticketId", ticket.id);
            formData.append("sectorId", sectorId);
            formData.append("solution", solutionToSave);
            fetcher.submit(formData, { method: "POST", action: "/tickets-sap" });
             // No await needed for fetcher.submit, marking async satisfies type
        }, [ticket, sectorId, fetcher]);


        // --- Effects ---
        useEffect(() => {
            console.log("[TicketSAPDetails Effect] Running for ticket:", ticket?.id);
            resetSummaryHookState();
            resetSolutionHookState();

            if (ticket) {
                setCurrentStatus(getInitialSAPStatus(ticket));
                if (summaryPrompt) {
                    console.log("[TicketSAPDetails Effect] Triggering SUMMARY generation for ticket:", ticket.id);
                    triggerSummaryGeneration(ticket, summaryPrompt, handleSaveSummary);
                } else {
                    console.log("[TicketSAPDetails Effect] Skipping SUMMARY generation.");
                }
                if (solutionPrompt) {
                    console.log("[TicketSAPDetails Effect] Triggering SOLUTION generation for ticket:", ticket.id);
                    triggerSolutionGeneration(ticket, solutionPrompt, handleSaveSolution);
                } else {
                     console.log("[TicketSAPDetails Effect] Skipping SOLUTION generation.");
                }
            } else {
                console.log("[TicketSAPDetails Effect] No ticket, resetting status.");
                setCurrentStatus('');
            }
            setNewComment('');
        }, [
            ticket, summaryPrompt, solutionPrompt, triggerSummaryGeneration,
            triggerSolutionGeneration, handleSaveSummary, handleSaveSolution,
            resetSummaryHookState, resetSolutionHookState
        ]);

         // Effect to show toast messages based on fetcher result and trigger revalidation
         useEffect(() => {
            // Check if fetcher.data is not null/undefined and has the 'success' property
            if (fetcher.state === 'idle' && fetcher.data && typeof fetcher.data === 'object' && 'success' in fetcher.data) {
                const actionData = fetcher.data as ActionData; // Cast to known type
                if (actionData.success) {
                    const message = hasMessageProperty(actionData) ? actionData.message : 'Mise à jour réussie.';
                    console.log("Action Success:", message);
                    onTicketUpdated(); // Manually trigger revalidation
                } else {
                    const errorMsg = hasErrorProperty(actionData) ? actionData.error : 'Échec de la mise à jour.';
                    console.error("Action Failed:", errorMsg);
                }
            }
         }, [fetcher.state, fetcher.data, onTicketUpdated]);


        // --- Handlers ---
        const handleClose = () => {
            resetSummaryHookState();
            resetSolutionHookState();
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

        if (!ticket) {
            return null;
        }

        const displaySummary = ticket?.summary || generatedSummary;
        const displaySolution = ticket?.solution || generatedSolution;

        // --- Portal Logic ---
        const [isClient, setIsClient] = useState(false);
        useEffect(() => { setIsClient(true); }, []);

        // Determine if the fetcher failed for specific intents
        const fetcherFailedSummarySave = fetcher.data && !fetcher.data.success && fetcher.formData?.get('intent') === 'save_summary';
        const fetcherFailedSolutionSave = fetcher.data && !fetcher.data.success && fetcher.formData?.get('intent') === 'save_solution';

        const modalContent = (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-70" onClick={handleClose}>
                <div className="w-11/12 max-w-3xl relative bg-jdc-card text-jdc-white rounded-lg shadow-xl max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
                    <button onClick={handleClose} className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 z-10" aria-label="Fermer">✕</button>
                    <h3 className="font-bold text-xl mb-1">{ticket.raisonSociale || 'Client Inconnu'}</h3>
                    <p className="text-sm text-gray-400 mb-4">Ticket SAP: {ticket.numeroSAP || 'N/A'}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 py-4 text-sm border-t border-b border-gray-700">
                        <p><b>Code Client:</b> {ticket.codeClient || 'N/A'}</p>
                        <p><b>Téléphone:</b> {ticket.telephone || 'N/A'}</p>
                        <p className="md:col-span-2"><b>Adresse:</b> {ticket.adresse || 'N/A'}</p>
                        <p><b>Date Création:</b> {formatDateForDisplay(parseFrenchDate(ticket.date))}</p>
                        <p><b>Secteur:</b> <span className="badge badge-neutral">{ticket.secteur || 'N/A'}</span></p>
                        {ticket.deducedSalesperson && (<p><b>Commercial:</b> {ticket.deducedSalesperson}</p>)}
                    </div>
                    <div className="my-4">
                        <label htmlFor="sap-ticket-status-select" className="block text-sm font-medium text-gray-300 mb-1">Statut SAP</label>
                        <div className="flex items-center gap-2">
                            <select
                                id="sap-ticket-status-select"
                                className="select select-bordered select-sm w-full max-w-xs bg-jdc-gray text-jdc-white"
                                value={currentStatus}
                                onChange={(e) => setCurrentStatus(e.target.value)}
                                disabled={isLoadingAction}
                            >
                                <option className="text-black" value="Nouveau">Nouveau</option>
                                <option className="text-black" value="En cours">En cours</option>
                                <option className="text-black" value="En attente client">En attente client</option>
                                <option className="text-black" value="Résolu">Résolu</option>
                                <option className="text-black" value="Terminé">Terminé</option>
                                <option className="text-black" value="Annulé">Annulé</option>
                            </select>
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={handleStatusChange}
                                disabled={isLoadingAction || currentStatus === ticket?.statutSAP}
                            >
                                {isLoadingAction && fetcher.formData?.get('intent') === 'update_status' ? <FaSpinner className="animate-spin" /> : 'Mettre à jour'}
                            </button>
                            <span className={`badge ${getSAPStatusBadgeClass(currentStatus)} ml-auto`}>{currentStatus}</span>
                        </div>
                    </div>
                    <hr className="my-3 border-gray-700"/>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <h4 className="text-md font-semibold mb-1 text-blue-300">Résumé IA {isSummaryCached && <span className="text-xs font-normal text-gray-400">(cache)</span>}</h4>
                            {isSummaryLoading && <span className="loading loading-dots loading-sm"></span>}
                            {(summaryError || (fetcherFailedSummarySave && hasErrorProperty(fetcher.data))) && !displaySummary && (
                                <p className="text-error text-xs">Erreur: {summaryError || (hasErrorProperty(fetcher.data) ? fetcher.data.error : 'Inconnue')}</p>
                            )}
                            {displaySummary ? (<div className="prose prose-sm max-w-none text-gray-300"><ReactMarkdown>{displaySummary}</ReactMarkdown></div>)
                            : !isSummaryLoading && !summaryError && !fetcherFailedSummarySave ? (<p className="text-xs text-gray-500 italic">Aucun résumé.</p>) : null}
                        </div>
                        <div>
                             <h4 className="text-md font-semibold mb-1 text-green-300">Solution Proposée IA {isSolutionCached && <span className="text-xs font-normal text-gray-400">(cache)</span>}</h4>
                            {isSolutionLoading && <span className="loading loading-dots loading-sm"></span>}
                            {(solutionError || (fetcherFailedSolutionSave && hasErrorProperty(fetcher.data))) && !displaySolution && (
                                <p className="text-error text-xs">Erreur: {solutionError || (hasErrorProperty(fetcher.data) ? fetcher.data.error : 'Inconnue')}</p>
                            )}
                            {displaySolution ? (<div className="prose prose-sm max-w-none text-gray-300"><ReactMarkdown>{displaySolution}</ReactMarkdown></div>)
                            : !isSolutionLoading && !solutionError && !fetcherFailedSolutionSave ? (<p className="text-xs text-gray-500 italic">Aucune solution.</p>) : null}
                        </div>
                    </div>
                    <hr className="my-3 border-gray-700"/>
                    <details className="mb-3 text-sm">
                        <summary className="cursor-pointer font-medium text-gray-400 hover:text-jdc-white">Voir la description du problème SAP</summary>
                        <div className="mt-2 p-3 border border-gray-600 rounded bg-jdc-gray text-xs max-h-32 overflow-y-auto">
                            <pre className="whitespace-pre-wrap break-words font-mono">{ticket.demandeSAP || ticket.descriptionProbleme || ticket.description || 'N/A'}</pre>
                        </div>
                    </details>
                    <hr className="my-3 border-gray-700"/>
                    <div>
                        <h4 className="text-md font-semibold mb-2">Commentaires</h4>
                        <div className="max-h-40 overflow-y-auto mb-3 border border-gray-600 rounded p-3 bg-jdc-gray text-sm space-y-2">
                            {ticket.commentaires && ticket.commentaires.length > 0 ? (
                                ticket.commentaires.map((commentaire: string, index: number) => ( <p key={index} className="border-b border-gray-700 pb-1 mb-1">{commentaire}</p> ))
                            ) : (<p className="text-sm text-gray-500 italic">Aucun commentaire.</p>)}
                        </div>
                        <textarea
                            placeholder="Ajouter un commentaire..."
                            className="textarea textarea-bordered w-full text-sm bg-jdc-gray"
                            rows={2}
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            disabled={isLoadingAction}
                        ></textarea>
                        <button
                            className="btn btn-secondary btn-sm mt-2"
                            onClick={handleAddComment}
                            disabled={isLoadingAction || !newComment.trim()}
                        >
                            {isLoadingAction && fetcher.formData?.get('intent') === 'add_comment' ? <FaSpinner className="animate-spin" /> : 'Ajouter Commentaire'}
                        </button>
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
