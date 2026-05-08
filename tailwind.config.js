/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'v-dark': '#414042',
        'v-purple': '#422c76',
        'v-pink': '#ff2f69',
        'v-white': '#faf9f5',
        'v-green': '#01E18E',
      },
    },
  },
  plugins: [],
};