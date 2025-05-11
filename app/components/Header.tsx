import React from 'react';
import { Link, NavLink, Form } from '@remix-run/react';
import type { UserSessionData } from '~/services/session.server';
import type { UserProfile } from '~/types/firestore.types';
import { MagnifyingGlassIcon, BellIcon, UserCircleIcon, Bars3Icon } from '@heroicons/react/24/outline';
import { NotificationsDropdown } from '~/components/NotificationsDropdown'; // Importer NotificationsDropdown

interface HeaderProps {
  user: UserSessionData | null;
  profile: UserProfile | null;
  onMobileMenuToggle: () => void; // Corrigé pour correspondre à app/root.tsx
  onLoginClick: () => void;
  // loadingAuth n'est plus explicitement utilisé ici, mais pourrait être utile pour le profil
}

// La variable mainNavLinks n'est plus utilisée car la navigation est dans la Sidebar.
// const mainNavLinks = [
//   { name: 'Dashboard', to: '/dashboard' },
//   { name: 'Tickets', to: '/tickets-sap' },
//   { name: 'Installations', to: '/installations' },
//   { name: 'Admin', to: '/admin', adminOnly: true },
// ];

export function Header({ user, profile, onMobileMenuToggle, onLoginClick }: HeaderProps) {
  const activeLinkClass = "border-b-2 border-brand-blue text-text-primary";
  const inactiveLinkClass = "border-b-2 border-transparent text-text-secondary hover:text-text-primary hover:border-brand-blue/70";

  return (
    <header 
      className="text-text-primary sticky top-0 z-30 backdrop-blur-md bg-white/10 border-b border-white/20 shadow-2xl" 
      style={{
        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)'
      }}
    >
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Left Section: Logo & Mobile Menu Toggle */}
        <div className="flex items-center">
          <button
            onClick={onMobileMenuToggle}
            className="md:hidden mr-3 p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-white/10"
            aria-label="Ouvrir le menu"
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
          <Link to="/" className="flex-shrink-0">
            <img 
              src="https://www.jdc.fr/images/logo_jdc_blanc.svg" 
              alt="JDC Logo" 
              className="h-8 sm:h-9 w-auto" // Hauteur ajustée pour le header
            />
          </Link>
        </div>

        {/* Center Section: Desktop Navigation Tabs - CETTE SECTION EST RETIRÉE */}
        {/* <nav className="hidden md:flex items-center space-x-1 h-full"> ... </nav> */}

        {/* Right Section: Search, Notifications, User - Doit prendre plus de place ou être centré si la nav disparaît */}
        <div className="flex flex-1 justify-end items-center space-x-3 md:space-x-4"> {/* Ajout de flex-1 justify-end */}
          <div className="relative hidden sm:block">
            <input
              type="search"
              placeholder="Rechercher..."
              className="backdrop-blur-sm bg-white/10 border border-white/20 text-text-secondary text-sm rounded-md pl-8 pr-2 py-1.5 focus:ring-1 focus:ring-brand-blue focus:border-brand-blue focus:outline-none"
            />
            <MagnifyingGlassIcon className="h-4 w-4 text-text-tertiary absolute left-2.5 top-1/2 transform -translate-y-1/2" />
          </div>
          {/* Remplacer le bouton BellIcon simple par le composant NotificationsDropdown */}
          {user && <NotificationsDropdown userId={user.userId} />}
          
          {user ? (
            <Link to="/user-profile" className="p-1.5 rounded-full hover:bg-white/10">
              <UserCircleIcon className="h-7 w-7 text-text-secondary group-hover:text-text-primary" />
            </Link>
          ) : (
            <button
              onClick={onLoginClick}
              className="text-sm px-3 py-1.5 rounded-md bg-gradient-to-br from-brand-blue/70 to-brand-blue-dark/70 text-white transition-colors backdrop-blur-sm hover:from-brand-blue/90 hover:to-brand-blue-dark/90"
            >
              Connexion
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
