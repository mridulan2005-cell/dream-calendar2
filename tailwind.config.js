/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
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
        // Page chrome: the header/side-nav palette. A lighter teal than `accent`
        // — it titles the page rather than asking to be clicked.
        heading: '#1E1F24', // near-black — headings, the selected nav item
        subheading: '#57B8AB', // light teal — the page title, the active language
        idle: '#80828D', // grey — unselected nav items
        hairline: '#B9BBC6', // the selected nav item's outline
        ok: {
          DEFAULT: '#16a34a',
          soft: '#c9f0d2',
        },
      },
    },
  },
  plugins: [],
}
