import { motion } from 'framer-motion';
import { TypeAnimation } from 'react-type-animation'; // Import TypeAnimation
import { useEffect } from 'react'; // Keep useEffect for logging if needed later
import ReactMarkdown from 'react-markdown'; // Import ReactMarkdown
import { ClientOnly } from './ClientOnly';
import type { SapTicket } from '~/types/firestore.types';
import { FaBrain, FaSpinner } from 'react-icons/fa'; // Added FaSpinner

interface AnimatedTicketSummaryProps {
  ticketContent: string;
  ticket?: SapTicket | null;
  summary: string;
  isLoading: boolean;
  error: string | null;
}

export function AnimatedTicketSummary({ ticketContent, ticket, summary, isLoading, error }: AnimatedTicketSummaryProps) {

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
          <span className="text-gray-300">Analyse en cours...</span>
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
        Une erreur est survenue lors de l'analyse: {error} {/* Display error message */}
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
          <span className="text-gray-300">Aucun résumé IA disponible pour ce ticket.</span>
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
          <div className="flex items-center text-green-500 mb-2">
            <FaBrain className="mr-2 text-green-500" />
            <h3 className="font-semibold">Résumé IA</h3>
            {ticket?.summary && (
              <span className="ml-auto text-green-500/50">(Sauvegardé)</span>
            )}
          </div>
          {/* Changed saved text color */}
          <motion.div
            className="prose prose-invert"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {/* Use TypeAnimation for the typing effect */}
            <TypeAnimation
              sequence={[contentToDisplay]} // Animate the content
              wrapper="p"
              speed={95} // Accelerated speed
              className="text-gray-300 leading-relaxed"
              key={contentToDisplay} // Add key to force re-render on content change
            />
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
