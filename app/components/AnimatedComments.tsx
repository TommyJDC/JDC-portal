import { motion } from 'framer-motion';
import { TypeAnimation } from 'react-type-animation';
import { useState } from 'react';
import { ClientOnly } from './ClientOnly';
import { FaSpinner } from 'react-icons/fa';

interface AnimatedCommentsProps {
  comments: string[];
  onAddComment: (comment: string) => void;
  isLoading: boolean;
}

export function AnimatedComments({ comments, onAddComment, isLoading }: AnimatedCommentsProps) {
  const [newComment, setNewComment] = useState('');

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const commentVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 }
  };

  const handleSubmit = () => {
    if (newComment.trim()) {
      onAddComment(newComment.trim());
      setNewComment('');
    }
  };

  return (
    <ClientOnly>
      <div className="space-y-4">
        <motion.h3 
          className="flex items-center space-x-2 text-lg font-semibold mb-4 text-jdc-yellow"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <FaSpinner className="h-4 w-4" />
          <span>Commentaires</span>
        </motion.h3>

        <motion.div 
          className="max-h-48 overflow-y-auto mb-4 border border-jdc-gray-700 rounded-lg p-4 bg-jdc-gray-800 text-sm space-y-3"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {comments && comments.length > 0 ? (
            comments.map((comment, index) => (
              <motion.div
                key={index}
                variants={commentVariants}
                className="border-b border-gray-700/30 pb-3 last:border-b-0 last:pb-0"
              >
                <TypeAnimation
                  sequence={[comment]}
                  wrapper="p"
                  speed={50}
                  className="text-gray-300"
                />
              </motion.div>
            ))
          ) : (
            <motion.p 
              variants={commentVariants}
              className="text-sm text-gray-400 italic"
            >
              Aucun commentaire.
            </motion.p>
          )}
        </motion.div>

        <div className="space-y-2">
          <motion.textarea
            placeholder="Ajouter un commentaire..."
            className="textarea textarea-bordered w-full text-sm bg-black border-gray-700/50 backdrop-blur-sm focus:border-yellow-500/50 transition-colors duration-200 text-white"
            rows={2}
            value={newComment}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewComment(e.target.value)}
            disabled={isLoading}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          />
          <motion.button
            className="btn btn-sm w-full bg-gradient-to-r from-yellow-400 to-amber-400 border-0 hover:from-yellow-500 hover:to-amber-500 transition-all duration-300 text-black"
            onClick={handleSubmit}
            disabled={isLoading || !newComment.trim()}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {isLoading ? (
              <FaSpinner className="animate-spin" />
            ) : (
              'Ajouter Commentaire'
            )}
          </motion.button>
        </div>
      </div>
    </ClientOnly>
  );
}
