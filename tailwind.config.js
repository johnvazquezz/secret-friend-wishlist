/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#a13370',
          dark: '#7a2656',
          light: '#c14a8e',
        },
      },
    },
  },
  plugins: [],
};
