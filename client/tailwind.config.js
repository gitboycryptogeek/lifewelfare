/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          gold: '#F5A623',
          'gold-dark': '#D4891A',
          navy: '#1A2B4A',
          'navy-light': '#243A63',
          green: '#27AE60',
        },
      },
      fontFamily: {
        heading: ['Merriweather', 'Georgia', 'serif'],
        body: ['Source Sans 3', 'sans-serif'],
      },
      screens: {
        xs: '375px',
      },
    },
  },
  plugins: [],
};
