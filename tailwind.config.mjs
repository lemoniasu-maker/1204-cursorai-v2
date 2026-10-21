/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        pastelBlue: '#a3c7ff',
        pastelPink: '#ffb3c6',
        pastelYellow: '#ffe8a3',
        pastelGreen: '#b4f8c8',
        pastelPurple: '#d7aefb',
      },
    },
  },
  plugins: [],
};


