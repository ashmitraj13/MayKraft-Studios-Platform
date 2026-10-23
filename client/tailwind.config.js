/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0A0E14',
          950: '#06080C',
          900: '#0A0E14',
          800: '#0F151D',
          700: '#141C27',
          600: '#1B2533',
          500: '#263244',
        },
        navy: '#132C45',
        cream: { DEFAULT: '#E6E4C0', soft: '#EFEDE0', dim: '#B8B699' },
        muted: '#8E94A0',
        ok: '#6FBF8E',
        warn: '#E3A948',
        bad: '#E5604F',
        info: '#86A9D6',
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      keyframes: {
        fadeUp: { '0%': { opacity: 0, transform: 'translateY(10px)' }, '100%': { opacity: 1, transform: 'none' } },
        fadeIn: { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        slideIn: { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'none' } },
      },
      animation: {
        'fade-up': 'fadeUp .6s cubic-bezier(.2,.7,.2,1) both',
        'fade-in': 'fadeIn .4s ease both',
        'slide-in': 'slideIn .25s ease both',
        shimmer: 'shimmer 1.6s infinite',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(230,228,192,.08), 0 20px 60px -20px rgba(0,0,0,.8)',
      },
    },
  },
  plugins: [],
};
