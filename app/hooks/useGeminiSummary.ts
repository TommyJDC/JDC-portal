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

    // Initialize the Generative AI client
    const genAI = useMemo(() => {
        console.log("[useGeminiSummary] Initializing with API Key:", apiKey ? 'Provided' : 'Missing');
        if (!apiKey) {
            // No need to set error here, initialization check happens before generation
            return null;
        }
        try {
            return new GoogleGenerativeAI(apiKey);
        } catch (err: any) {
            console.error("[useGeminiSummary] Error initializing GoogleGenerativeAI:", err);
            // Set error state here if initialization itself fails critically
            setError("Erreur d'initialisation de l'API Gemini. Vérifiez la clé API.");
            return null; // Return null if initialization failed
        }
    }, [apiKey]);

    // Reset state when hook is potentially reused with different context
    const resetSummaryState = useCallback(() => {
        setSummary('');
        setIsLoading(false);
        setError(null);
        setIsCached(false);
    }, []);


    const generateSummary = useCallback(async (
        ticket: SapTicket | null,
        prompt: string,
        saveSummaryCallback: SaveSummaryCallback
    ) => {
        console.log("[useGeminiSummary] generateSummary called for ticket:", ticket?.id);
        setIsLoading(true); // Set loading true initially
        setError(null);
        // DO NOT clear summary here yet. Clear it only if cache check fails.
        setIsCached(false); // Reset cache flag initially

        if (!ticket) {
            console.warn("[useGeminiSummary] No ticket provided.");
            setError("Ticket non fourni.");
            setIsLoading(false);
            return;
        }

        // --- Cache Check ---
        if (ticket.summary && typeof ticket.summary === 'string' && ticket.summary.trim() !== '') {
            console.log(`[useGeminiSummary] Cache hit for ticket ${ticket.id}. Using existing summary.`);
            setSummary(ticket.summary);
            setIsCached(true);
            setIsLoading(false);
            setError(null);
            console.log(`[useGeminiSummary] Cache check successful for ticket ${ticket.id}. State set from cache.`);
            return; // Stop here, use cached summary
        }
        // --- End Cache Check ---

        // If we reach here, cache check failed (or summary was empty/invalid)
        console.log("[useGeminiSummary] Cache miss or summary empty. Proceeding towards API call.");
        setSummary(''); // NOW clear the summary state before potential generation

        if (!prompt) {
            console.log("[useGeminiSummary] No prompt provided, skipping generation.");
            // setSummary(''); // Already cleared
            setError("Prompt vide fourni pour la génération."); // Set specific error
            setIsLoading(false);
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

        console.log("[useGeminiSummary] Generating with prompt:", prompt);

        try {
            // Use the specified experimental model
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-thinking-exp-01-21" });

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
                 const generatedText = response.candidates[0].content.parts[0].text;
                 console.log("[useGeminiSummary] Generated text:", generatedText);
                 setSummary(generatedText);
                 setIsCached(false); // Explicitly mark as not cached

                 // --- Save the generated summary ---
                 try {
                     console.log(`[useGeminiSummary] Attempting to save generated summary for ticket ${ticket.id}...`);
                     await saveSummaryCallback(generatedText);
                     console.log(`[useGeminiSummary] Successfully saved summary for ticket ${ticket.id}.`);
                 } catch (saveError: any) {
                     console.error(`[useGeminiSummary] Failed to save summary for ticket ${ticket.id}:`, saveError);
                     // Set a specific error related to saving, but keep the generated summary displayed
                     setError(`Résumé généré mais échec de la sauvegarde: ${saveError.message || 'Erreur inconnue'}`);
                 }
                 // --- End Save ---

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
        }
    // Removed saveSummaryCallback from the dependency array as it's a parameter, not a dependency from the outer scope.
    // The stability of the callback is the responsibility of the calling component.
    }, [genAI, apiKey]);

        // Let's stick with the original dependency array for generateSummary for now.
        // The parent component needs to ensure the callback is stable if needed.
        // The extra closing brace and dependency array below were removed.


        return { summary, isLoading, error, generateSummary, isCached, resetSummaryState };
};

export default useGeminiSummary;
