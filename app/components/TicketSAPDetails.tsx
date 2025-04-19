import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
    import ReactDOM from 'react-dom';
    import { useFetcher } from '@remix-run/react';
    import useGeminiSummary from '~/hooks/useGeminiSummary';
    import ReactMarkdown from 'react-markdown';
    import { FaSpinner } from 'react-icons/fa';
    import type { SapTicket } from '~/types/firestore.types';
    import { Timestamp } from 'firebase/firestore';
    import { formatFirestoreDate } from '~/utils/dateUtils';
    import { AnimatedTicketSummary } from '~/components/AnimatedTicketSummary';
    import { AnimatedSolution } from '~/components/AnimatedSolution';
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

    const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

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

        const isLoadingAction = fetcher.state !== 'idle';

        const problemDescriptionForAI = ticket?.demandeSAP || ticket?.descriptionProbleme || ticket?.description || '';
        
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
        }, [ticket?.id]);

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

        if (!ticket) return null;

        const [isClient, setIsClient] = useState(false);
        useEffect(() => { setIsClient(true); }, []);

        const formatTicketDate = (date: Date | Timestamp | string | null | undefined): string => {
            return formatFirestoreDate(date);
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
                                        <span className="font-medium">{formatTicketDate(ticket.date)}</span>
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

                        {/* Rest of the component content... */}
                        {/* (Le reste du contenu du composant serait ici) */}

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
