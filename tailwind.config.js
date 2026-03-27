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
          bg: '#F9FAFB',
          card: '#FFFFFF',
          card2: '#F3F4F6',
          accent: '#7B2FBE',
          'accent-hover': '#9B4FDE',
          text: '#1F2937',
          muted: '#6B7280',
        },
        clase: {
          funcional: '#3B82F6', // Blue
          basics: '#F59E0B',    // Amber
          fit: '#10B981',       // Emerald
          fuerza: '#EF4444',    // Red
          gimnasticos: '#EC4899', // Pink
          hybrix: '#8B5CF6',    // Violet
        },
      },
      fontFamily: {
        display: ['Outfit', 'Space Grotesk', 'sans-serif'],
        body: ['Inter', 'DM Sans', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
