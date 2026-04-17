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
          black: '#0C0B0C',
          sidebar: '#0C0B0C',
          card: '#1a0f1b',
          card2: '#221427',
          border: '#6A1F6D',
          accent: '#A729AD',
          'accent-hover': '#6A1F6D',
          purple: '#6A1F6D',
          yellow: '#FFFF4C',
          text: '#F6E8F9',
          muted: '#F6E8F9CC',
          bg: '#0C0B0C',
          'on-dark': '#F6E8F9',
          'muted-on-dark': '#F6E8F966',
          'yellow-soft': '#FFFFE2',
          raised: '#221427',
        },
        clase: {
          funcional: '#6A1F6D',
          basics: '#E69138',
          fit: '#6AA84F',
          fuerza: '#CC0000',
          gimnasticos: '#C9A227',
          hybrix: '#2563EB',
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
