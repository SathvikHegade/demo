/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        forge: {
          bg: '#04040a',
          surface: '#080810',
          surface2: '#0d0d1a',
          border: 'rgba(255,255,255,0.07)',
          primary: '#ff6b2b',
          accent: '#9b59f5',
          success: '#00d97e',
          warning: '#f5a623',
          critical: '#ff3b5c',
          text: '#f0f0f8',
          muted: '#5a5a7a',
          muted2: '#7a7a9a',
        }
      },
      fontFamily: {
        display: ['Syne', 'Cascadia Code'],
        mono: ['"Space Mono"', 'monospace'],
        body: ['Inter', 'Cascadia Code'],
      },
      backgroundImage: {
        'forge-gradient': 'linear-gradient(135deg, #ff6b2b, #9b59f5)',
      },
      animation: {
        'fade-up': 'fadeUp 0.5s ease both',
        'spin-slow': 'spin-slow 3s linear infinite',
        'blink': 'blink 1s step-end infinite',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      }
    },
  },
  plugins: [],
};
