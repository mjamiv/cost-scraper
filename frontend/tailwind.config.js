/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'midnight': {
          50: '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcccdc',
          300: '#9fb3c8',
          400: '#829ab1',
          500: '#627d98',
          600: '#486581',
          700: '#334e68',
          800: '#243b53',
          900: '#102a43',
          950: '#0a1929',
        },
        'accent': {
          DEFAULT: '#00d4aa',
          50: '#e6fff9',
          100: '#b3ffec',
          200: '#80ffdf',
          300: '#4dffd2',
          400: '#1affc5',
          500: '#00e6b8',
          600: '#00d4aa',
          700: '#00a385',
          800: '#007360',
          900: '#00423b',
        },
        'coral': {
          DEFAULT: '#ff6b6b',
          500: '#ff6b6b',
          600: '#ee5a5a',
        },
        'gold': {
          DEFAULT: '#ffd93d',
          500: '#ffd93d',
          600: '#f5c800',
        }
      },
      fontFamily: {
        'display': ['Outfit', 'system-ui', 'sans-serif'],
        'mono': ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'glow': '0 0 20px rgba(0, 212, 170, 0.3)',
        'glow-lg': '0 0 40px rgba(0, 212, 170, 0.4)',
      }
    },
  },
  plugins: [],
}

