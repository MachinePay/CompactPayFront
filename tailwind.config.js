/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bgmain: "var(--color-bg-main)",
        bgcard: "var(--color-bg-card)",
        primary: "var(--color-primary)",
        success: "var(--color-success)",
        error: "var(--color-error)",
      },
    },
  },
  plugins: [],
};
