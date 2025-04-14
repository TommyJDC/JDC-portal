import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { FcGoogle } from 'react-icons/fc';
import { Button } from './ui/Button';
import { signInWithGoogle } from '~/services/auth.service';
import { useToast } from '~/context/ToastContext'; // Use our toast hook

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false); // Separate loading for Google
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast(); // Get addToast function

  if (!isOpen) return null;

  const handleClose = () => {
    setError(null);
    setIsLoading(false);
    setIsGoogleLoading(false);
    onClose();
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setError(null);
    try {
        const user = await signInWithGoogle();
        addToast({ type: 'success', message: `Connecté avec Google: ${user.displayName || user.email}` });
        handleClose(); // Close modal on success
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur de connexion Google.';
        setError(message);
        addToast({ type: 'error', message: message });
    } finally {
        setIsGoogleLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div
        className="bg-jdc-card p-6 md:p-8 rounded-lg shadow-xl relative w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 text-jdc-gray-400 hover:text-white focus:outline-none"
          aria-label="Fermer la modal"
        >
          <FontAwesomeIcon icon={faTimes} size="lg" />
        </button>

        <h2 id="auth-modal-title" className="text-2xl font-semibold text-white mb-6 text-center">
          Connexion
        </h2>

        {/* Google Sign-In Button - Seule méthode autorisée */}
        <Button
            variant="secondary"
            className="w-full mb-4 flex items-center justify-center gap-2 border border-jdc-gray-600 hover:bg-jdc-gray-700"
            onClick={handleGoogleSignIn}
            isLoading={isGoogleLoading}
            disabled={isLoading || isGoogleLoading}
        >
            {isGoogleLoading ? (
                <FontAwesomeIcon icon={faSpinner} spin />
            ) : (
                <FcGoogle size={20} />
            )}
            <span>Se connecter avec Google</span>
        </Button>

      </div>
    </div>
  );
};
