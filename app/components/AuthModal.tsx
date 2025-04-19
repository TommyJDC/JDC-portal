import React, { useState } from 'react';
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
        className="bg-jdc-card rounded-lg shadow-xl p-6 w-full max-w-md transform transition-all duration-300 ease-in-out scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-white">Se connecter</h2>
          <button onClick={onClose} className="text-jdc-gray-400 hover:text-jdc-yellow">
            &times;
          </button>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-black bg-jdc-yellow hover:bg-yellow-300 rounded-md transition-colors duration-150"
          >
            <FcGoogle className="text-lg" />
            Continuer avec Google
          </button>
        </div>
      </div>
    </div>
  );
};
