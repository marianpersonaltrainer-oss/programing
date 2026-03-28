/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        evo: {
          black: '#1A0D1A',
          sidebar: '#0F060F',
          card: '#2D1A2D',
          card2: '#241224',
          border: '#6A1F6D',
          accent: '#A729AD',
          'accent-hover': '#6A1F6D',
          purple: '#6A1F6D',
          yellow: '#FFFF4C',
          /** Texto sobre fondos claros (modales Excel, biblioteca, etc.) */
          text: '#1B0F1B',
          muted: '#5C4D5C',
          bg: '#1A0D1A',
          /** Texto legible sobre fondos oscuros EVO */
          'on-dark': '#F0ECF0',
          'muted-on-dark': '#C4A8C4',
        },
        clase: {
          funcional: '#3C78D8',
          basics: '#E69138',
          fit: '#6AA84F',
          fuerza: '#CC0000',
          gimnasticos: '#E91E8C',
          hybrix: '#F4C430',
        },
      },
      fontFamily: {
        'evo-display': ['Oswald', 'sans-serif'],
        'evo-body': ['Montserrat', 'sans-serif'],
        display: ['Oswald', 'Outfit', 'Space Grotesk', 'sans-serif'],
        body: ['Montserrat', 'DM Sans', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
