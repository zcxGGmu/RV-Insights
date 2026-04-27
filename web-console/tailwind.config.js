/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: '#1d4ed8'
      },
      borderRadius: {
        lg: '0.75rem'
      }
    }
  },
  plugins: []
}
