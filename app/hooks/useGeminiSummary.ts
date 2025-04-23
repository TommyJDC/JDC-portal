import { useState, useCallback, useMemo, useEffect } from 'react'; // Added useEffect
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import type { SapTicket } from '~/types/firestore.types'; // Import SapTicket type

// Define the type for the save callback function
type SaveSummaryCallback = (summary: string) => Promise<void>;

const useGeminiSummary = (apiKey: string) => {
    const [summary, setSummary] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isCached, setIsCached] = useState<boolean>(false); // Track if summary came from cache

    // Instance statique de l'API pour éviter les réinitialisations multiples
    const genAI = useMemo(() => {
        // Vérifier si l'instance existe déjà
        if (!apiKey) return null;
        
        try {
            return new GoogleGenerativeAI(apiKey);
        } catch (err: any) {
            console.error("[useGeminiSummary] Error initializing GoogleGenerativeAI:", err);
            setError("Erreur d'initialisation de l'API Gemini. Vérifiez la clé API.");
            return null;
        }
    }, []); // Dépendance vide pour n'initialiser qu'une seule fois

    // Reset state when hook is potentially reused with different context
    const resetSummaryState = useCallback(() => {
        setSummary('');
        setIsLoading(false);
        setError(null);
        setIsCached(false);
    }, []);


    // Ref pour suivre les générations en cours par ticket
    const generatingTickets = useMemo(() => new Set<string>(), []);

    const generateSummary = useCallback(async (
        ticket: SapTicket | null,
        prompt: string,
        saveSummaryCallback: SaveSummaryCallback
    ) => {
        if (!ticket?.id) {
            console.warn("[useGeminiSummary] No valid ticket provided.");
            setError("Ticket non valide.");
            return;
        }

        // Vérifier si une génération est déjà en cours pour ce ticket
        if (generatingTickets.has(ticket.id)) {
            console.log(`[useGeminiSummary] Generation already in progress for ticket ${ticket.id}`);
            // Optionally, check if the existing generation is stuck in an error state (e.g., quota)
            // If it's a quota error, we might want to allow retries after a delay, but for now, just prevent immediate re-triggering.
            return;
        }

        // Vérification du cache
        const targetField = prompt.includes('solution') ? 'solution' : 'summary';
        const existingContent = ticket[targetField];
        
        if (existingContent && typeof existingContent === 'string' && existingContent.trim() !== '') {
            console.log(`[useGeminiSummary] Using cached ${targetField} for ticket ${ticket.id}`);
            setSummary(existingContent);
            setIsCached(true);
            setError(null); // Clear any previous error
            return;
        }

        // Marquer le début de la génération
        generatingTickets.add(ticket.id);
        setIsLoading(true);
        setError(null); // Clear previous error before starting
        setIsCached(false);
        setSummary(''); // Clear previous summary

        if (!prompt) {
            console.log("[useGeminiSummary] No prompt provided, skipping generation.");
            setError("Prompt vide fourni pour la génération.");
            setIsLoading(false);
            generatingTickets.delete(ticket.id); // Ensure we remove from generating set
            return;
        }

        if (!apiKey) {
             console.error("[useGeminiSummary] Missing API Key.");
             setError("Clé API Gemini manquante.");
             setIsLoading(false);
             return;
        }

        if (!genAI) {
            console.error("[useGeminiSummary] genAI client not initialized. Cannot generate.");
            setError("Client API Gemini non initialisé. Vérifiez la clé API.");
            setIsLoading(false);
        return;
    }

    console.log("[useGeminiSummary] API Key received:", apiKey ? "Present" : "Missing"); // Added log
    console.log("[useGeminiSummary] Generating with prompt:", prompt);

    try {
            // Use stable production model
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

            // Configuration remains the same
             const generationConfig = {
                 temperature: 0.9,
                 topK: 1,
                 topP: 1,
                 maxOutputTokens: 2048,
             };
             const safetySettings = [
                 { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                 { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                 { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                 { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
             ];

            const result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig,
                safetySettings,
            });

            const response = result.response;
            console.log("[useGeminiSummary] Raw API Response:", response);

            if (response?.candidates?.[0]?.content?.parts?.[0]?.text) {
                 const generatedText = response.candidates[0].content.parts[0]?.text || '';
                 console.log("[useGeminiSummary] Generated text:", generatedText);
                 
                 if (generatedText) {
                     setSummary(generatedText);
                     setIsCached(false);
                 } else {
                     console.warn("[useGeminiSummary] Empty generated text");
                     throw new Error("Réponse vide de l'API Gemini");
                 }

                 // Sauvegarder uniquement si le contenu est différent
                 if (generatedText.trim() !== existingContent?.trim()) {
                     try {
                         await saveSummaryCallback(generatedText);
                     } catch (saveError: any) {
                         console.error(`[useGeminiSummary] Save failed for ticket ${ticket.id}:`, saveError);
                         setError(`Échec de la sauvegarde: ${saveError.message || 'Erreur inconnue'}`);
                     }
                 }

            } else {
                 const blockReason = response?.promptFeedback?.blockReason;
                 const finishReason = response?.candidates?.[0]?.finishReason;
                 console.warn(`[useGeminiSummary] Gemini response issue. Block Reason: ${blockReason}, Finish Reason: ${finishReason}`);
                 setError(blockReason ? `Génération bloquée: ${blockReason}` : (finishReason ? `Génération terminée avec raison: ${finishReason}` : "Aucune réponse textuelle reçue de l'IA."));
                 setSummary(''); // Clear summary on generation failure
            }

        } catch (err: any) {
            console.error("[useGeminiSummary] Error generating summary with Gemini:", err);
             if (err.message?.includes('API key not valid')) {
                 setError("Clé API Gemini invalide ou expirée.");
             } else if (err.message?.includes('SAFETY')) {
                 setError("La génération a été bloquée pour des raisons de sécurité.");
             } else if (err.message?.includes('quota')) {
                 setError("Quota d'API Gemini dépassé.");
             } else {
                setError(`Erreur de génération: ${err.message || "Une erreur inconnue est survenue."}`);
            }
            setSummary(''); // Ensure summary is cleared on error
        } finally {
            setIsLoading(false);
            generatingTickets.delete(ticket.id);
        }
    }, [genAI, generatingTickets]);

        // Let's stick with the original dependency array for generateSummary for now.
        // The parent component needs to ensure the callback is stable if needed.
        // The extra closing brace and dependency array below were removed.


        return { summary, isLoading, error, generateSummary, isCached, resetSummaryState };
};

export default useGeminiSummary;
