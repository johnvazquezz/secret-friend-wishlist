import defaultTheme from 'tailwindcss/defaultTheme';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Escala de marca derivada de #a13370 (600). DEFAULT/dark/light se mantienen como alias.
        primary: {
          50: '#fcf3f8',
          100: '#fae8f2',
          200: '#f6d0e5',
          300: '#eeaacf',
          400: '#e077b0',
          500: '#c14a8e',
          600: '#a13370',
          700: '#8a2b60',
          800: '#7a2656',
          900: '#5f1f43',
          DEFAULT: '#a13370',
          dark: '#7a2656',
          light: '#c14a8e',
        },
      },
      fontFamily: {
        sans: ['"Inter Variable"', ...defaultTheme.fontFamily.sans],
        display: [
          '"Bricolage Grotesque Variable"',
          '"Inter Variable"',
          ...defaultTheme.fontFamily.sans,
        ],
      },
      boxShadow: {
        soft: '0 1px 2px 0 rgb(28 25 23 / 0.04), 0 1px 3px 0 rgb(28 25 23 / 0.06)',
        lift: '0 4px 6px -2px rgb(28 25 23 / 0.05), 0 12px 24px -6px rgb(28 25 23 / 0.12)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'pop-in': {
          from: { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'pop-in': 'pop-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
    },
  },
  plugins: [],
};
