/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        lavender: {
          50:  "#f0f1fa",
          100: "#e3e5f5",
          200: "#c5cae9",
          300: "#9fa8da",
          400: "#7986cb",
          500: "#5c6bc0",
          600: "#3d5afe",
          700: "#3949ab",
          800: "#283593",
        },
        navy: "#1a1f4e",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        display: ["Sora", "sans-serif"],
      },
    },
  },
  plugins: [],
};