import { motion } from 'framer-motion';
import { ClientOnly } from './ClientOnly';
import type { SapTicket } from '~/types/firestore.types';
import { FaBrain, FaSpinner } from 'react-icons/fa'; // Added FaSpinner

interface AnimatedTicketSummaryProps {
  ticket?: SapTicket | null;
  summary: string;
  isLoading: boolean;
  error: string | null;
}

export function AnimatedTicketSummary({ ticket, summary, isLoading, error }: AnimatedTicketSummaryProps) {

  // Determine content to display
  const contentToDisplay = ticket?.summary || summary;

  if (isLoading && !contentToDisplay) { // Show loading only if no cached content and loading
    return (
      <motion.div
        className="p-4 bg-jdc-gray/20 rounded-lg border border-gray-700/50 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="flex items-center space-x-2">
          <FaSpinner className="animate-spin h-4 w-4 text-blue-400" /> {/* Use FaSpinner */}
          <span className="text-gray-300">Analyse en cours&hellip;</span>
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
        Une erreur est survenue pendant l&#39;analyse: {error} {/* Display error message */}
      </motion.div>
    );
  }

  if (!contentToDisplay) { // Handle case where there's no content and not loading/error
    return (
      <motion.div
        className="p-4 bg-jdc-gray/20 rounded-lg border border-gray-700/50 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="flex items-center space-x-2">
          <FaBrain className="text-green-500" />
          <span className="text-gray-300">Aucun résumé IA disponible pour ce ticket</span>
        </div>
      </motion.div>
    );
  }


  return (
    <ClientOnly>
      <motion.div
        className="p-4 bg-jdc-gray/20 rounded-lg border border-gray-700/50 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="relative">
          <div className="flex items-center gap-3 mb-4 px-3 py-2 bg-green-900/10 rounded-lg border border-green-800/30">
            <FaBrain className="flex-shrink-0 text-green-400 text-lg" />
            <h3 className="text-green-100 font-medium text-lg">Résumé IA</h3>
            {ticket?.summary && (
              <span className="ml-auto text-xs text-green-400/80 bg-green-900/20 px-2 py-1 rounded-full">
                Sauvegardé
              </span>
            )}
          </div>
          {/* Changed saved text color */}
          <motion.div
            className="prose prose-invert"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p className="text-gray-300 leading-relaxed">
              {contentToDisplay}
            </p>
          </motion.div>

          {/* Display keywords from the currently displayed content */}
          {contentToDisplay && (
            <motion.div
              className="mt-4 flex flex-wrap gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {contentToDisplay
                .split(' ')
                .filter(word => {
                  const trimmed = word.trim();
                  return trimmed.length > 0 && /[a-zA-Z0-9]/.test(trimmed);
                })
                .slice(0, 5)
                .map((word: string, index: number) => (
                  <motion.span
                    key={index}
                    className="px-2 py-1 bg-yellow-500/20 text-yellow-300 text-sm rounded-full border border-yellow-500/30"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    {word.replace(/[.,!?;:]+$/, '')}
                  </motion.span>
                ))}
            </motion.div>
          )}
        </div>
      </motion.div>
    </ClientOnly>
  );
}
