module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        critical: '#DC2626',
        high: '#F97316',
        medium: '#EAB308',
        low: '#22C55E',
        neutral: '#6B7280',
      },
      backgroundColor: {
        critical: '#FEE2E2',
        high: '#FFEDD5',
        medium: '#FEFCE8',
        low: '#DCFCE7',
      }
    },
  },
  plugins: [],
}
