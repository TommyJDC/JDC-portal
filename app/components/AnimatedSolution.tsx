import { motion } from 'framer-motion';
import { TypeAnimation } from 'react-type-animation'; // Import TypeAnimation
import { useEffect } from 'react'; // Keep useEffect for logging if needed later
import { createRoot } from 'react-dom/client'; // Import createRoot
import ReactMarkdown from 'react-markdown'; // Import ReactMarkdown
import type { SapTicket } from '~/types/firestore.types';
import { ClientOnly } from './ClientOnly';
import { FaLightbulb, FaSpinner } from 'react-icons/fa'; // Added FaSpinner

interface AnimatedSolutionProps {
  ticket?: SapTicket | null;
  solution: string;
  isLoading: boolean;
  error: string | null;
}

export function AnimatedSolution({ ticket, solution, isLoading, error }: AnimatedSolutionProps) {

  useEffect(() => {
    console.log("[AnimatedSolution] Props updated:", { solution, isLoading, error });
  }, [solution, isLoading, error]);

  // Determine content to display
  const contentToDisplay = ticket?.solution || solution;

  if (isLoading && !contentToDisplay) { // Show loading only if no cached content and loading
    return (
      <motion.div
        className="p-4 bg-jdc-gray/20 rounded-lg border border-gray-700/50 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="flex items-center space-x-2">
          <FaSpinner className="animate-spin h-4 w-4 text-emerald-400" /> {/* Use FaSpinner */}
          <span className="text-gray-300">Génération de la solution...</span>
        </div>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        className="p-4 bg-red-900/20 rounded-lg text-red-400 border border-red-900/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        Une erreur est survenue lors de la génération: {error} {/* Display error message */}
      </motion.div>
    );
  }

  if (!contentToDisplay) { // Handle case where there's no content and not loading/error
      return null; // Or a placeholder message
  }


  return (
    <ClientOnly>
      <motion.div
        className="p-4 bg-jdc-gray/20 rounded-lg border border-gray-700/50 backdrop-blur-sm"
        initial={{ opacity: 0 }} // Simple initial animation
        animate={{ opacity: 1 }} // Simple animate animation
      >
        <div className="relative">
          <div className="flex items-center text-blue-400 mb-2">
            <FaLightbulb className="mr-2 text-blue-400" />
            <h3 className="font-semibold">Solution proposée</h3>
            {ticket?.solution && (
              <span className="ml-auto text-xs text-jdc-yellow/50">(Sauvegardé)</span>
            )}
          </div>
          <motion.div 
            className="prose prose-invert"
            initial={{ opacity: 0 }} // Simple initial animation
            animate={{ opacity: 1 }} // Simple animate animation
          >
            {/* Affichage markdown avec effet de frappe */}
            <TypeAnimation
              sequence={[
                // Utilise une fonction pour effet de frappe markdown
                (el: HTMLElement | null) => {
                  if (!el) return; // Add null check
                  el.innerHTML = "";
                  let i = 0;
                  const text = contentToDisplay;
                  // Nettoie tout rendu ReactDOM précédent pour éviter les erreurs
                  if (el._root) { // Unmount previous root if it exists
                    el._root.unmount();
                    delete el._root; // Clean up the stored root reference
                  }
                  // Create root
                  const root = createRoot(el);
                  el._root = root; // Store root instance
                  function typeChar() {
                    if (i <= text.length) {
                      root.render( // Use the created root instance
                        <ReactMarkdown>{text.slice(0, i)}</ReactMarkdown>
                      );
                      i++;
                      setTimeout(typeChar, 10);
                    }
                  }
                  typeChar();
                  // Note: Proper cleanup on component unmount might still be needed
                  // depending on TypeAnimation's lifecycle handling.
                }
              ]}
              // Pour éviter les erreurs, il faut que wrapper soit "div" (pas "p") et que le composant soit bien typé
              wrapper="div"
              speed={95}
              className="text-gray-300 leading-relaxed"
              key={contentToDisplay}
            />
          </motion.div>

          {/* Display keywords from the currently displayed content */}
          {contentToDisplay && (
            <motion.div 
              className="mt-4 flex flex-wrap gap-2"
              initial={{ opacity: 0 }} // Simple initial animation
              animate={{ opacity: 1 }} // Simple animate animation
            >
              {contentToDisplay.split(' ').slice(0, 5).map((word: string, index: number) => (
                <motion.span
                  key={index}
                  className="px-2 py-1 bg-yellow-500/20 text-yellow-300 text-sm rounded-full border border-yellow-500/30"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                >
                  {word}
                </motion.span>
              ))}
            </motion.div>
          )}
        </div>
      </motion.div>
    </ClientOnly>
  );
}
