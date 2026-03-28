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
          black: '#1A0A1A',
          sidebar: '#1A0D1A',
          card: '#FFFFFF',
          card2: '#F3EAF8',
          border: '#6A1F6D',
          accent: '#A729AD',
          'accent-hover': '#6A1F6D',
          purple: '#6A1F6D',
          yellow: '#FFFF4C',
          text: '#1A0A1A',
          muted: '#5C4D5C',
          bg: '#F6E8F9',
          'on-dark': '#F6E8F9',
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
