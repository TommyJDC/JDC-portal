import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/{**,.client,.server}/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        'jdc-yellow': '#FFD700', // Jaune JDC
        'jdc-black': '#000000', // Noir JDC
        'jdc-card': '#1F1F1F',   // Fond de carte sombre
        'jdc-gray': {
          300: '#CCCCCC', // Gris clair pour texte/bordures
          400: '#A0A0A0', // Gris moyen
          800: '#333333', // Gris foncé pour fond alternatif/texte
        },
        'jdc-blue-dark': '#0a0f1f', // Très foncé, pour le fond principal
        'jdc-white': '#FFFFFF', // Blanc standard pour texte sur fond sombre
      },
      fontFamily: {
        sans: [
          '"Roboto"', // Nouvelle police principale
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
          '"Apple Color Emoji"',
          '"Segoe UI Emoji"',
          '"Segoe UI Symbol"',
          '"Noto Color Emoji"',
        ],
      },
    },
  },
  plugins: [], // Remove DaisyUI plugin
} satisfies Config;
