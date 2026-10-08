import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 900: '#10243b', 950: '#091727' },
        brand: { 500: '#178f9b', 600: '#117681' },
      },
    },
  },
  plugins: [forms],
};
