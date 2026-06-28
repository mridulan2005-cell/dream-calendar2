/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Satoshi', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      colors: {
        // Design-system surfaces: a soft mint canvas behind everything, with
        // pure-white headers and side panels sitting on top.
        canvas: '#F5F9F8', // primary background — the whole app behind content
        surface: '#ffffff', // secondary background — headers, side panels, cards
        accent: {
          DEFAULT: '#019487', // teal — the action colour (readable with white text)
          soft: '#d4efeb', // a soft teal tint — selected states, fills, chips
        },
        ok: {
          DEFAULT: '#16a34a',
          soft: '#c9f0d2',
        },
      },
    },
  },
  plugins: [],
}
