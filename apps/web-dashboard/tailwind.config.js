/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}", "./app/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        gruvbox: {
          bg: "#282828",
          fg: "#ebdbb2",
          border: "#fabd2f",
          orange: "#fe8019",
          green: "#b8bb26",
          blue: "#83a598",
          gray: "#928374",
        },
      },
      borderColor: {
        gruvbox: "#fabd2f",
      },
    },
  },
  plugins: [],
};
