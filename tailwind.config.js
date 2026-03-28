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
          sidebar: '#0A0808',
          card: '#160D16',
          card2: '#1D0F1D',
          border: '#3D1A3D',
          accent: '#A729AD',
          'accent-hover': '#6A1F6D',
          purple: '#6A1F6D',
          yellow: '#FFFF4C',
          text: '#E8EAF0',
          muted: '#9B80A0',
          bg: '#0C0B0C',
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
