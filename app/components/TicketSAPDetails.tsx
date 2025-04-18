 import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
    import { AnimatedTicketSummary } from '~/components/AnimatedTicketSummary';
    import { AnimatedSolution } from '~/components/AnimatedSolution';
    import { AnimatedComments } from '~/components/AnimatedComments';
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

    // Gemini API Key from environment variables
    const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

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
        const isProcessingRef = useRef<boolean>(false);
        const processedTicketsRef = useRef<Set<string>>(new Set());

        useEffect(() => {
            if (!ticket?.id || isProcessingRef.current || processedTicketsRef.current.has(ticket.id)) {
                return;
            }

            // Initialiser le statut
            setCurrentStatus(getInitialSAPStatus(ticket));

            // Si le ticket a déjà un résumé et une solution dans Firestore, on le marque comme traité
            if (ticket.summary || ticket.solution) {
                console.log(`[TicketSAPDetails] Using cached data for ticket ${ticket.id}`);
                processedTicketsRef.current.add(ticket.id);
                return;
            }

            // Si une sauvegarde ou une génération est en cours, on sort
            if (fetcher.state === 'submitting' || isSummaryLoading || isSolutionLoading) {
                return;
            }

            isProcessingRef.current = true;

            const needsSummary = !ticket.summary && summaryPrompt;
            const needsSolution = !ticket.solution && solutionPrompt;

            // Ne générer que si nécessaire (pas de données en cache)
            if (needsSummary || needsSolution) {
                console.log(`[TicketSAPDetails] Generating new content for ticket ${ticket.id}`);
                const processGenerations = async () => {
                    try {
                        if (needsSummary) {
                            await triggerSummaryGeneration(ticket, summaryPrompt, handleSaveSummary);
                        }
                        if (needsSolution) {
                            await triggerSolutionGeneration(ticket, solutionPrompt, handleSaveSolution);
                        }
                        processedTicketsRef.current.add(ticket.id);
                    } finally {
                        isProcessingRef.current = false;
                    }
                };

                processGenerations();
            } else {
                isProcessingRef.current = false;
            }
            
            return () => {
                isProcessingRef.current = false;
            };
        }, [ticket?.id]);

        // Ref pour suivre les mises à jour en cours
        const updatesInProgressRef = useRef<Set<string>>(new Set());

        // Effect to handle fetcher results
        useEffect(() => {
            if (fetcher.state === 'idle' && fetcher.data && 'success' in fetcher.data) {
                const actionData = fetcher.data as ActionData;
                const formData = fetcher.formData as FormData | undefined;
                const intent = formData?.get('intent')?.toString() || '';
                const ticketId = ticket?.id || '';
                const updateKey = `${ticketId}-${intent}`;

                if (actionData.success) {
                    const message = hasMessageProperty(actionData) ? actionData.message : 'Mise à jour réussie.';
                    console.log("Action Success:", message);
                    
                    // Ne traiter que si nous avons un ID de ticket valide
                    if (ticketId && !updatesInProgressRef.current.has(updateKey)) {
                        updatesInProgressRef.current.add(updateKey);
                        // Utiliser un timeout pour regrouper les mises à jour
                        const timeoutId = setTimeout(() => {
                            onTicketUpdated();
                            updatesInProgressRef.current.delete(updateKey);
                        }, 1000);

                        // Nettoyer le timeout si le composant est démonté
                        return () => clearTimeout(timeoutId);
                    }
                } else {
                    const errorMsg = hasErrorProperty(actionData) ? actionData.error : 'Échec de la mise à jour.';
                    console.error("Action Failed:", errorMsg);
                    updatesInProgressRef.current.delete(updateKey);
                }
            }
        }, [fetcher.state, fetcher.data, ticket?.id]);


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
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={handleClose}>
                <div className="w-11/12 max-w-4xl relative bg-gradient-to-b from-jdc-card to-jdc-card/95 text-jdc-white rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                    {/* Header Section */}
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

                    {/* Content Section */}
                    <div className="px-6 pb-6">
                        {/* Client Info Card */}
                        <div className="mb-6 p-4 bg-jdc-gray/20 rounded-lg border border-gray-700/50 backdrop-blur-sm">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
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
                                        <span className="font-medium">{formatDateForDisplay(parseFrenchDate(ticket.date))}</span>
                                    </p>
                                </div>
                                <div className="space-y-2">
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
                                        <span className="font-medium">{ticket.adresse || 'N/A'}</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                        {/* Status Update Section */}
                        <div className="mb-6 p-4 bg-jdc-gray/20 rounded-lg border border-gray-700/50">
                            <label htmlFor="sap-ticket-status-select" className="block text-sm font-medium text-gray-300 mb-2">
                                Mise à jour du statut
                            </label>
                            <div className="flex items-center gap-3">
                                <select
                                    id="sap-ticket-status-select"
                                    className="select select-bordered select-sm flex-1 bg-black text-jdc-white border-gray-700"
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
                                    className={`btn btn-sm ${currentStatus === ticket?.statutSAP ? 'opacity-50' : 'hover:scale-105'} transition-all duration-200 bg-yellow-400 text-black hover:bg-yellow-500`}
                                    onClick={handleStatusChange}
                                    disabled={isLoadingAction || currentStatus === ticket?.statutSAP}
                                >
                                    {isLoadingAction && fetcher.formData?.get('intent') === 'update_status' ? (
                                        <FaSpinner className="animate-spin" />
                                    ) : (
                                        'Mettre à jour'
                                    )}
                                </button>
                            </div>
                        </div>
                        {/* AI Summary and Solution Section */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <AnimatedTicketSummary 
                                ticketContent={problemDescriptionForAI}
                                ticket={ticket}
                                summary={ticket?.summary || generatedSummary}
                                isLoading={isSummaryLoading}
                                error={summaryError}
                            />
                            <AnimatedSolution 
                                ticketContent={problemDescriptionForAI}
                                ticket={ticket}
                                solution={ticket?.solution || generatedSolution}
                                isLoading={isSolutionLoading}
                                error={solutionError}
                            />
                        </div>

                        {/* Problem Description Section */}
                        <div className="mb-6">
                            <details className="group">
                                <summary className="cursor-pointer font-medium text-gray-400 hover:text-jdc-white flex items-center gap-2 select-none">
                                    <svg className="w-4 h-4 transition-transform group-open:rotate-90" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                    Description du problème SAP
                                </summary>
                                <div className="mt-3 p-4 border border-gray-600 rounded-lg bg-jdc-gray/30 text-sm max-h-48 overflow-y-auto">
                                    <pre className="whitespace-pre-wrap break-words font-mono">{ticket.demandeSAP || ticket.descriptionProbleme || ticket.description || 'N/A'}</pre>
                                </div>
                            </details>
                        </div>

                        {/* Comments Section */}
                        <div className="rounded-lg overflow-hidden">
                            <AnimatedComments 
                                comments={ticket.commentaires || []}
                                onAddComment={handleAddComment}
                                isLoading={isLoadingAction && fetcher.formData?.get('intent') === 'add_comment'}
                            />
                        </div>
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
