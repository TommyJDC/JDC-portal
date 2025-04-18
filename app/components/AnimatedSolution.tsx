import { motion } from 'framer-motion';
import { TypeAnimation } from 'react-type-animation';
import type { SapTicket } from '~/types/firestore.types';
import { ClientOnly } from './ClientOnly';

interface AnimatedSolutionProps {
  ticketContent: string;
  ticket?: SapTicket | null;
  solution: string;
  isLoading: boolean;
  error: string | null;
}

export function AnimatedSolution({ ticketContent, ticket, solution, isLoading: loading, error }: AnimatedSolutionProps) {
  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.5,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 }
  };

  if (loading || !solution) {
    return (
      <motion.div
        className="p-4 bg-jdc-gray/20 rounded-lg border border-gray-700/50 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="flex items-center space-x-2">
          <div className="animate-pulse h-4 w-4 bg-emerald-400 rounded-full" />
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
        Une erreur est survenue lors de la génération
      </motion.div>
    );
  }

  return (
    <ClientOnly>
      <motion.div
        className="p-4 bg-jdc-gray/20 rounded-lg border border-gray-700/50 backdrop-blur-sm"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.h3 
          className="text-lg font-semibold mb-3 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-400"
          variants={itemVariants}
        >
          Solution IA
        </motion.h3>

        <motion.div 
          className="prose prose-invert"
          variants={itemVariants}
        >
          <TypeAnimation
            sequence={[ticket?.solution || solution || '']}
            wrapper="p"
            speed={50}
            className="text-gray-300 leading-relaxed"
          />
        </motion.div>

        <motion.div 
          className="mt-4 flex flex-wrap gap-2"
          variants={itemVariants}
        >
          {(ticket?.solution || solution)?.split(' ').slice(0, 5).map((word: string, index: number) => (
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
      </motion.div>
    </ClientOnly>
  );
}
