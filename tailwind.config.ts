import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/{**,.client,.server}/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Couleurs de base pour le nouveau design "gestionnaire d'applications"
        'brand-blue': { // Bleu pour les accents et boutons
          DEFAULT: '#3B82F6', // Exemple: un bleu vif (similaire à celui des boutons dans l'image)
          light: '#60A5FA',
          dark: '#2563EB',
        },
        'brand-gradient-from': '#F472B6', // Rose pour dégradé (similaire à l'image)
        'brand-gradient-to': '#F97316',   // Orange pour dégradé (similaire à l'image)

        'ui-background': '#111827', // Fond très sombre pour le corps de la page (similaire à bg-gray-900)
        'ui-surface': '#1F2937',  // Fond pour les cartes, sidebar (similaire à bg-gray-800)
        'ui-surface-translucent': 'rgba(31, 41, 55, 0.85)', // ui-surface avec 85% opacité
        'ui-surface-header': 'rgba(31, 41, 55, 0.9)', // ui-surface avec 90% opacité pour le header
        'ui-border': '#374151',   // Couleur pour les bordures (similaire à bg-gray-700)
        'ui-border-translucent': 'rgba(55, 65, 81, 0.5)', // ui-border avec 50% opacité
        
        'text-primary': '#F3F4F6',    // Texte principal (blanc cassé, similaire à text-gray-100)
        'text-secondary': '#9CA3AF',  // Texte secondaire (gris clair, similaire à text-gray-400)
        'text-tertiary': '#6B7280',   // Texte encore plus discret (similaire à text-gray-500)

        // Conservation des anciennes couleurs JDC pour une éventuelle compatibilité partielle ou transition
        'jdc-yellow': '#FFD700',
        'jdc-black': '#000000',
        'jdc-card': '#1F1F1F',
        'jdc-gray': {
          300: '#CCCCCC',
          400: '#A0A0A0',
          800: '#333333',
        },
        'jdc-blue-dark': '#0a0f1f',
        'jdc-white': '#FFFFFF',
      },
      fontFamily: {
        sans: [
          '"Roboto"', // Conserver Roboto ou choisir une police plus proche du design si identifiée
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
          '"Apple Color Emoji"',
          '"Segoe UI Emoji"',
          '"Segoe UI Symbol"',
          '"Noto Color Emoji"',
        ],
      },
      animation: {
        'pulse-once': 'pulse-once 1.5s ease-in-out 1',
      },
      keyframes: {
        'pulse-once': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '.5' },
        }
      },
      backdropBlur: {
        xs: '2px',
        sm: '4px',
        md: '12px',
      }
    },
  },
  plugins: [],
} satisfies Config;
