/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        civic: {
          ink: "#14213d",
          teal: "#007f7a",
          leaf: "#4f772d",
          amber: "#fca311",
          paper: "#fff8ed",
          mist: "#e5f2ef",
        },
      },
      boxShadow: {
        civic: "0 24px 70px rgba(20, 33, 61, 0.18)",
      },
      fontFamily: {
        display: ["Georgia", "Cambria", "serif"],
        body: ["Verdana", "Geneva", "sans-serif"],
      },
    },
  },
  plugins: [],
};
