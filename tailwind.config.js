/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'skier-red': '#ef4444',
        'skier-blue': '#3b82f6',
        'skier-green': '#10b981',
        'skier-yellow': '#f59e0b',
        'rock-gray': '#6b7280',
        'yeti-body': '#9ca3af',
      }
    },
  },
  plugins: [],
  // Safelist dynamic classes for player colors
  safelist: [
    'bg-skier-red',
    'bg-skier-blue',
    'bg-skier-green',
    'bg-skier-yellow',
    'text-skier-red',
    'text-skier-blue',
    'text-skier-green',
    'text-skier-yellow',
    'border-skier-red',
    'border-skier-blue',
    'border-skier-green',
    'border-skier-yellow',
  ]
}
