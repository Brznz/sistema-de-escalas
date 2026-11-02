/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        militar: {
          50: '#f4f6f0',
          100: '#e5e9dc',
          200: '#ccd4bd',
          300: '#adbca0',
          400: '#899f7d',
          500: '#69815c',
          600: '#516646',
          700: '#405037',
          800: '#34412e',
          900: '#2c3727',
          950: '#161c13',
        },
        navy: {
          850: '#0f172a',
          900: '#0b1120',
          950: '#070b14',
        },
        gold: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
