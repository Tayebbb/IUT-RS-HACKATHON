/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#05070d',
          900: '#0a0d17',
          800: '#111524',
          700: '#1a2036'
        },
        accent: {
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7'
        },
        good: '#22c55e',
        warn: '#f59e0b',
        bad: '#ef4444'
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        glow: '0 0 30px -8px rgba(56,189,248,0.35)',
        card: '0 20px 40px -20px rgba(0,0,0,0.6)'
      },
      backgroundImage: {
        'radial-fade':
          'radial-gradient(circle at 20% 10%, rgba(56,189,248,0.15), transparent 40%), radial-gradient(circle at 80% 90%, rgba(168,85,247,0.15), transparent 40%)'
      }
    }
  },
  plugins: []
};
