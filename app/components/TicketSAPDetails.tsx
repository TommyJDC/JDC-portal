import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useFetcher, Form } from '@remix-run/react'; // Import Form
import useGeminiSummary from '~/hooks/useGeminiSummary';
import ReactMarkdown from 'react-markdown';
import { FaSpinner, FaChevronDown, FaChevronUp, FaTimes, FaBuilding, FaInfoCircle, FaCalendarAlt, FaUserTie, FaPhone, FaMapMarkerAlt, FaCommentDots, FaSave } from 'react-icons/fa'; // Ajouter les icônes nécessaires
import type { SapTicket, SapTicketStatus } from '~/types/firestore.types'; // Importer SapTicketStatus
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
        setTechnicianNotes(getStringValueWithFallback(ticket.technicianNotes, ''));
        setMaterialType(getStringValueWithFallback(ticket.materialType, ''));
        setMaterialDetails(getStringValueWithFallback(ticket.materialDetails, '')); // Initialize material details
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
        // Appliquer le style de la modale InstallationDetails
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={handleClose}>
            {/* Utiliser fetcher.Form pour la soumission */}
            <fetcher.Form method="post" onSubmit={handleFormSubmit} className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto relative text-white flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-gray-700 sticky top-0 bg-gradient-to-r from-gray-800 to-gray-850 z-10">
                    <h2 className="text-xl font-semibold text-jdc-blue flex items-center">
                        <FaBuilding className="mr-2" /> Détails Ticket SAP - {getStringValue(ticket.raisonSociale, 'N/A')} (SAP #{getStringValue(ticket.numeroSAP, 'N/A')})
                        {isLoadingAction && <FaSpinner className="ml-3 text-jdc-yellow animate-spin" title="Sauvegarde en cours..." />}
                    </h2>
                    <button type="button" onClick={handleClose} className="text-gray-400 hover:text-white transition-colors">
                        <FaTimes size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6 flex-grow">
                    {/* Section Informations Ticket */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-start space-x-3">
                            <FaInfoCircle className="text-jdc-blue mt-1 flex-shrink-0" />
                            <div>
                                <p className="font-semibold text-gray-300">Client / Code</p>
                                <p>{getStringValue(ticket.raisonSociale, 'N/A')} / {getStringValue(ticket.codeClient, 'N/A')}</p>
                            </div>
                        </div>
                         <div className="flex items-start space-x-3">
                            <FaMapMarkerAlt className="text-jdc-blue mt-1 flex-shrink-0" />
                            <div>
                                <p className="font-semibold text-gray-300">Adresse</p>
                                <p>{getStringValue(ticket.adresse, 'Non trouvé')}</p>
                            </div>
                        </div>
                        <div className="flex items-start space-x-3">
                            <FaPhone className="text-jdc-blue mt-1 flex-shrink-0" />
                            <div>
                                <p className="font-semibold text-gray-300">Téléphone</p>
                                <p>{getStringValue(ticket.telephone, 'N/A')}</p>
                            </div>
                        </div>
                        <div className="flex items-start space-x-3">
                            <FaCalendarAlt className="text-jdc-blue mt-1 flex-shrink-0" />
                            <div>
                                <p className="font-semibold text-gray-300">Date Ticket</p>
                                <p>{formatTicketDate(ticket.date)}</p>
                            </div>
                        </div>
                        {ticket.deducedSalesperson && (
                            <div className="flex items-start space-x-3">
                                <FaUserTie className="text-jdc-blue mt-1 flex-shrink-0" />
                                <div>
                                    <p className="font-semibold text-gray-300">Commercial</p>
                                    <p>{ticket.deducedSalesperson}</p>
                                </div>
                            </div>
                        )}
                         <div className="flex items-start space-x-3">
                            <FaInfoCircle className="text-jdc-blue mt-1 flex-shrink-0" />
                            <div>
                                <p className="font-semibold text-gray-300">Secteur</p>
                                <p>{getStringValue(ticket.secteur, 'N/A')}</p>
                            </div>
                        </div>
                        {/* Ajouter Type, Priorité, Origine si nécessaire */}
                    </div>

                    <hr className="border-gray-700" />

                    {/* Section Description & AI */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Description */}
                        <div className="p-4 bg-gray-700/30 rounded-lg border border-gray-700">
                            <button
                                type="button"
                                className="flex items-center justify-between w-full text-left font-bold text-lg text-jdc-yellow focus:outline-none mb-2"
                                onClick={() => setIsDescriptionOpen(!isDescriptionOpen)}
                                aria-expanded={isDescriptionOpen}
                            >
                                Description du problème
                                {isDescriptionOpen ? <FaChevronUp /> : <FaChevronDown />}
                            </button>
                            {isDescriptionOpen && (
                                <div className="mt-2 text-white text-sm prose prose-invert max-w-none">
                                    <ReactMarkdown>{problemDescriptionForAI || '*Aucune description fournie*'}</ReactMarkdown>
                                </div>
                            )}
                        </div>

                        {/* AI Content */}
                        <div className="space-y-4">
                            <AnimatedTicketSummary
                                ticket={ticket}
                                summary={generatedSummary}
                                isLoading={isSummaryLoading}
                                error={summaryError}
                            />
                            <AnimatedSolution
                                ticket={ticket}
                                solution={generatedSolution}
                                isLoading={isSolutionLoading}
                                error={solutionError}
                            />
                        </div>
                    </div>

                    <hr className="border-gray-700" />

                    {/* Section Actions */}
                    <div className="p-4 bg-gray-700/30 rounded-lg border border-gray-700 space-y-4">
                        <h4 className="font-bold text-lg text-jdc-yellow">Actions Ticket</h4>

                        {/* Statut Select */}
                        <div className="flex items-center space-x-2">
                             {/* Utiliser une icône dynamique basée sur le statut */}
                             {/* <StatusIcon className="w-5 h-5 flex-shrink-0" style={{ color: statusStyle.textColor }} /> */}
                             <label htmlFor="status" className="font-semibold text-gray-300 w-20">Statut:</label>
                             <select
                                id="status"
                                name="status"
                                value={currentStatus}
                                onChange={(e) => setCurrentStatus(e.target.value as SapTicketStatus)}
                                // Combiner les classes statiques et dynamiques
                                className={`block w-full rounded-md bg-gray-700 border-gray-600 focus:border-jdc-blue focus:ring focus:ring-jdc-blue focus:ring-opacity-50 py-1 pl-2 pr-8 text-sm ${statusStyle.textColor}`}
                                // Appliquer la couleur via style uniquement si ce n'est pas une classe Tailwind (au cas où)
                                style={{ color: statusStyle.textColor.startsWith('text-') ? undefined : statusStyle.textColor }}
                             >
                                {ticketStatuses.map(statusInfo => (
                                    <option key={statusInfo.value} value={statusInfo.value}> {/* Enlever l'espace superflu avant > */}
                                        {statusInfo.label}
                                    </option>
                                ))}
                             </select>
                        </div>

                        {/* Notes Technicien */}
                        <div>
                            <label htmlFor="technicianNotes" className="block text-sm font-medium text-gray-300 mb-1 flex items-center">
                                <FaCommentDots className="mr-2 text-jdc-blue" /> Notes Technicien
                            </label>
                            <Textarea
                                id="technicianNotes"
                                name="technicianNotes"
                                value={technicianNotes}
                                onChange={(e) => setTechnicianNotes(e.target.value)}
                                className="bg-gray-700 text-white border-gray-600 focus:border-jdc-blue focus:ring-jdc-blue w-full"
                                rows={3}
                                placeholder="Notes pour résumé AI, clôture, ou suivi..."
                            />
                        </div>

                        {/* Matériel (conditionnel) */}
                        {(currentStatus === 'rma_request' || currentStatus === 'material_sent' || (currentStatus === 'open' && materialType)) && (
                            <div className="space-y-4 p-3 border border-dashed border-gray-600 rounded-md">
                                <h5 className="text-sm font-semibold text-gray-400">Détails Matériel</h5>
                                <div>
                                    <label htmlFor="materialType" className="block text-sm font-medium text-gray-400 mb-1">Type</label>
                                    <select
                                        id="materialType"
                                        name="materialType"
                                        value={materialType}
                                        onChange={(e) => setMaterialType(e.target.value)}
                                        className="select select-bordered w-full bg-gray-700 text-white border-gray-600 focus:border-jdc-blue focus:ring-jdc-blue rounded-lg text-sm"
                                    >
                                        <option value="">-- Sélectionner --</option>
                                        <option value="RMA">RMA</option>
                                        <option value="envoi-materiel">Envoi Matériel</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="materialDetails" className="block text-sm font-medium text-gray-400 mb-1">Détails (Réf, Qté...)</label>
                                    <Textarea
                                        id="materialDetails"
                                        name="materialDetails"
                                        value={materialDetails}
                                        onChange={(e) => setMaterialDetails(e.target.value)}
                                        rows={2}
                                        className="textarea textarea-bordered w-full bg-gray-700 text-white border-gray-600 focus:border-jdc-blue focus:ring-jdc-blue rounded-lg text-sm"
                                        placeholder="Spécifier le matériel..."
                                    />
                                </div>
                            </div>
                        )}

                        {/* Bouton de soumission unique */}
                         <Button
                            type="submit"
                            disabled={isLoadingAction}
                            className="w-full bg-jdc-blue hover:bg-blue-600"
                         >
                            {isLoadingAction ? <FaSpinner className="animate-spin mr-2" /> : <FaSave className="mr-2" />}
                            Mettre à jour le Statut
                         </Button>

                        {/* Affichage des erreurs/succès */}
                        {fetcher.data && (
                            <div className={`mt-4 p-3 rounded-md text-sm ${
                                hasMessageProperty(fetcher.data)
                                    ? "bg-green-900 bg-opacity-50 text-green-300 border border-green-700"
                                    : hasErrorProperty(fetcher.data)
                                        ? "bg-red-900 bg-opacity-50 text-red-300 border border-red-700"
                                        : ""
                            }`}>
                                {hasMessageProperty(fetcher.data) && fetcher.data.message}
                                {hasErrorProperty(fetcher.data) && fetcher.data.error}
                            </div>
                        )}
                    </div>

                    {/* Tentatives de Contact */}
                    {ticket.contactAttempts && ticket.contactAttempts.length > 0 && (
                        <div className="p-4 bg-gray-700/30 rounded-lg border border-gray-700">
                            <h4 className="font-bold text-lg mb-3 text-jdc-yellow">Tentatives de Contact</h4>
                            <ul className="space-y-2 text-sm text-gray-300">
                                {(ticket.contactAttempts || []).map((attempt: { date: Date | null; method: 'email' | 'phone'; success: boolean; }, index: number) => (
                                    <li key={index} className="flex items-center gap-2">
                                        <span className="font-medium">{attempt.date ? formatFirestoreDate(attempt.date) : 'N/A'}</span>
                                        <span>•</span>
                                        <span>{attempt.method}</span>
                                        <span>•</span>
                                        <span className={`font-bold ${attempt.success ? 'text-green-400' : 'text-red-400'}`}>
                                            {attempt.success ? 'Succès' : 'Échec'}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Footer (peut rester simple ou être retiré si le bouton est dans le body) */}
                 <div className="p-4 border-t border-gray-700 flex justify-end space-x-3 sticky bottom-0 bg-gradient-to-r from-gray-800 to-gray-850">
                    {/* Le bouton de sauvegarde est maintenant dans le formulaire */}
                    <Button type="button" onClick={handleClose} variant="secondary" disabled={isLoadingAction}>Fermer</Button>
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
