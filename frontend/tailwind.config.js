/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#1c1b1a',
        panel: '#282725',
        raised: '#33312e',
        line: '#3b3936',
        ink: '#f2f0eb',
        muted: '#9e9a93',
        primary: '#8c3b30',
        graphite: '#3d3b38',
        accent: '#c5a46d',
        confirmed: { DEFAULT: '#d0b98a', surface: '#3a3325' },
        completed: { DEFAULT: '#a8c7b0', surface: '#2a382e' },
        service: { DEFAULT: '#9bbcd4', surface: '#26333d' },
        locked: { DEFAULT: '#827e77', surface: '#33312e' },
        warning: { DEFAULT: '#d99b94', surface: '#3d2624' },
        salon: { 50: '#282725', 100: '#33312e', 600: '#8c3b30', 700: '#8c3b30' },
      },
      fontFamily: {
        sans: ['Inter', '"Noto Sans TC"', '"PingFang TC"', '"Microsoft JhengHei"', 'system-ui', 'sans-serif'],
      },
      letterSpacing: { natural: '0.02em' },
      borderRadius: { panel: '7px' },
      boxShadow: { panel: '0 1px 2px rgb(0 0 0 / 0.12)' },
    },
  },
  plugins: [],
};
