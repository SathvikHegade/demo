/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forge: {
          bg: '#0a0a0f',
          surface: '#111118',
          border: '#1e1e2e',
          primary: '#f97316',
          secondary: '#a855f7',
          success: '#22c55e',
          warning: '#eab308',
          critical: '#ef4444',
          text: '#f1f5f9',
          muted: '#64748b'
        }
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      backgroundImage: {
        'forge-gradient': 'linear-gradient(to right, #f97316, #a855f7)',
        'card-glow': 'radial-gradient(circle at 50% 0%, rgba(249, 115, 22, 0.1), transparent 50%)',
      }
    },
  },
  plugins: [],
}
