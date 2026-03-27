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
          bg: '#0A0A0A',
          card: '#111111',
          card2: '#1A1A1A',
          accent: '#7B2FBE',
          'accent-hover': '#9B4FDE',
          text: '#FFFFFF',
          muted: '#A0A0A0',
        },
        clase: {
          funcional: '#2F7BBE',
          basics: '#E07B39',
          fit: '#2FBE7B',
          fuerza: '#BE2F2F',
          gimnasticos: '#D93F8E',
          hybrix: '#E0C12F',
        },
      },
      fontFamily: {
        display: ['Space Grotesk', 'DM Mono', 'monospace'],
        body: ['DM Sans', 'Inter', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
