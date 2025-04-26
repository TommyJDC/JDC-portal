import React from 'react';
import { FcGoogle } from 'react-icons/fc';
import { signInWithGoogle } from '~/services/auth.service';
import { useToast } from '~/context/ToastContext'; // Use our toast hook

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { addToast } = useToast(); // Get addToast function

  if (!isOpen) return null;

  const handleClose = () => {
    onClose();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      handleClose();
    }
  };

  const handleGoogleSignIn = async () => {
    try {
        const user = await signInWithGoogle();
        addToast({ type: 'success', message: `Connecté avec Google: ${user.displayName || user.email}` });
        handleClose(); // Close modal on success
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur de connexion Google.';
        addToast({ type: 'error', message: message });
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4"
      onClick={handleClose}
      onKeyDown={handleKeyDown} // Added onKeyDown
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div
        className="bg-gray-800 p-6 rounded-xl shadow-2xl border border-gray-700 hover:border-jdc-blue transition-all duration-300 ease-in-out w-full max-w-md transform scale-100"
        onClick={(e) => e.stopPropagation()}
        role="dialog" // Added role="dialog"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 id="auth-modal-title" className="text-xl font-semibold text-white">Se connecter</h2> {/* Added id for aria-labelledby */}
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
