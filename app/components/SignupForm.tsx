import React, { useState } from 'react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { AtSymbolIcon, LockClosedIcon, UserIcon } from '@heroicons/react/24/outline'; // Import icons

interface SignupFormProps {
  onSignup: (email: string, password: string, displayName: string) => Promise<void>; // Return promise for async handling
  isLoading: boolean;
  error?: string | null;
}

export const SignupForm: React.FC<SignupFormProps> = ({ onSignup, isLoading, error }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [formError, setFormError] = useState<string | null>(null); // Internal form validation error

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null); // Clear previous form errors

    if (!email || !password || !displayName) {
      setFormError("Veuillez remplir tous les champs.");
      return;
    }
    // Basic password validation (example)
    if (password.length < 6) {
        setFormError("Le mot de passe doit contenir au moins 6 caractères.");
        return;
    }

    try {
      await onSignup(email, password, displayName);
      // Optionally clear form on success, handled by parent state potentially
      // setEmail('');
      // setPassword('');
      // setDisplayName('');
    } catch (err: any) {
      // Error is already handled by the parent via the 'error' prop,
      // but we could log it here if needed.
      console.error("[SignupForm] Signup failed:", err);
      // No need to setFormError here as the parent passes the 'error' prop
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
       <Input
         label="Nom d'affichage"
         id="signup-displayName"
         name="displayName"
         type="text"
         value={displayName}
         onChange={(e) => setDisplayName(e.target.value)}
         required
         icon={<UserIcon />}
         disabled={isLoading}
         autoComplete="name"
       />
       <Input
         label="Email"
         id="signup-email"
         name="email"
         type="email"
         value={email}
         onChange={(e) => setEmail(e.target.value)}
         required
         icon={<AtSymbolIcon />}
         disabled={isLoading}
         autoComplete="email"
       />
       <Input
         label="Mot de passe"
         id="signup-password"
         name="password"
         type="password"
         value={password}
         onChange={(e) => setPassword(e.target.value)}
         required
         icon={<LockClosedIcon />}
         disabled={isLoading}
         autoComplete="new-password" // Important for password managers
       />

       {/* Display internal form validation error */}
       {formError && <p className="text-sm text-red-500">{formError}</p>}
       {/* Display error from the signup process (passed via props) */}
       {error && !formError && <p className="text-sm text-red-500">{error}</p>}

       <Button type="submit" isLoading={isLoading} disabled={isLoading} className="w-full">
         Créer le compte
       </Button>
    </form>
  );
};
