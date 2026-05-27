/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        'slide-up': {
          '0%':   { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scan-line': {
          '0%':   { transform: 'translateY(-8px)', opacity: '0' },
          '10%':  { opacity: '1' },
          '90%':  { opacity: '1' },
          '100%': { transform: 'translateY(240px)', opacity: '0' },
        },
      },
      animation: {
        'slide-up':  'slide-up 0.3s ease-out both',
        'scan-line': 'scan-line 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
