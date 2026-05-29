/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'eu-blue': '#173d83',
        'eu-gold': '#d9b45f',
      }
    },
  },
  plugins: [],
}
