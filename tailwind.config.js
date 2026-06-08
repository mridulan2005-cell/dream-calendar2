/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#4f6ef7', // strong periwinkle (readable with white text)
          soft: '#dce4ff', // the requested soft accent — selected states, fills, chips
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
