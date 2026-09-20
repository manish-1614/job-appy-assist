/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'neon-cyan': '#10B981',
        'neon-mint': '#34D399',
        'neon-magenta': '#059669',
        'neon-purple': '#047857',
        'neon-emerald': '#00F59B',
        'forest-950': '#060B08',
        'forest-900': '#0A130E',
        'forest-800': '#0F1E16',
      },
      boxShadow: {
        'glow-cyan': '0 0 25px rgba(16, 185, 129, 0.35)',
        'glow-emerald': '0 0 25px rgba(0, 245, 155, 0.4)',
        'glow-mint': '0 0 25px rgba(52, 211, 153, 0.35)',
        'glow-magenta': '0 0 25px rgba(5, 150, 105, 0.35)',
        'glow-amber': '0 0 25px rgba(245, 158, 11, 0.35)',
      },
    },
  },
  plugins: [],
};
