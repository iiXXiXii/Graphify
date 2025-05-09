/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2a70e0',
        secondary: '#34d399',
        accent: '#f97316',
        neutral: '#6b7280',
        'neutral-light': '#f3f4f6',
        'neutral-dark': '#374151',
        error: '#ef4444',
        success: '#10b981',
        warning: '#f59e0b',
        info: '#3b82f6',
      },
      spacing: {
        '128': '32rem',
        '144': '36rem',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        code: ['Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
