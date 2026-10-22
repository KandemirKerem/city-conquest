/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        hand: ['"Comic Neue"', '"Segoe Print"', 'cursive', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
