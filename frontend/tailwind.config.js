/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#0b1120',
        panel: '#0f172a',
        raised: '#1e293b',
        line: 'rgb(148 163 184 / 0.14)',
        ink: '#f8fafc',
        muted: '#94a3b8',
        primary: '#d6b36a',
        graphite: '#1e293b',
        accent: '#cbd5e1',
        confirmed: { DEFAULT: '#fbbf24', surface: 'rgb(245 158 11 / 0.10)' },
        completed: { DEFAULT: '#34d399', surface: 'rgb(16 185 129 / 0.10)' },
        service: { DEFAULT: '#a5b4fc', surface: 'rgb(99 102 241 / 0.11)' },
        locked: { DEFAULT: '#94a3b8', surface: 'rgb(100 116 139 / 0.10)' },
        warning: { DEFAULT: '#fda4af', surface: 'rgb(244 63 94 / 0.10)' },
        salon: {
          50: '#0f172a', 100: '#1e293b', 500: '#d6b36a',
          600: '#c99d4f', 700: '#b8893b',
        },
      },
      fontFamily: {
        sans: ['Inter', '"Noto Sans TC"', '"PingFang TC"', '"Microsoft JhengHei"', 'system-ui', 'sans-serif'],
      },
      letterSpacing: { natural: '0.01em', tight: '-0.018em' },
      borderRadius: { panel: '16px', card: '20px' },
      boxShadow: {
        panel: '0 18px 48px rgb(2 6 23 / 0.24)',
        glow: '0 18px 50px rgb(214 179 106 / 0.16)',
      },
      backgroundImage: {
        'salon-gold': 'linear-gradient(135deg, #efd58f, #c99d4f)',
        'salon-panel': 'linear-gradient(145deg, rgb(30 41 59 / .72), rgb(15 23 42 / .78))',
      },
      transitionTimingFunction: { premium: 'cubic-bezier(.2,.8,.2,1)' },
    },
  },
  plugins: [],
};
