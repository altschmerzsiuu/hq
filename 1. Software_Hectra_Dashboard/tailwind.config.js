/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ['"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['"DM Sans"', 'system-ui', 'sans-serif'],
        body:    ['"Inter"', 'system-ui', 'sans-serif'],
        sans:    ['"Inter"', 'system-ui', 'sans-serif'],
      },
      colors: {
        // MP-3 design tokens
        bg: {
          base:    'var(--bg-base)',
          surface: 'var(--bg-surface)',
          card:    'var(--bg-card)',
          hover:   'var(--bg-hover)',
        },
        // Backwards compatibility
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover:   'var(--color-primary-hover)',
        },
        forest: {
          DEFAULT: 'var(--color-forest)',
          light:   'var(--color-forest-light)',
        },
        sage: {
          DEFAULT: 'var(--color-sage)',
          light:   'var(--color-sage-light)',
        },
        gold: {
          DEFAULT: 'var(--color-gold)',
          light:   'var(--color-gold-light)',
        },
        cream: {
          DEFAULT: 'var(--color-cream)',
          dark:    'var(--color-cream-dark)',
        },
        success: {
          DEFAULT: 'var(--color-success)',
          bg:      'var(--color-success-bg)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          bg:      'var(--color-warning-bg)',
        },
        danger: {
          DEFAULT: 'var(--color-danger)',
          bg:      'var(--color-danger-bg)',
        },
        info: {
          DEFAULT: 'var(--color-info)',
          bg:      'var(--color-info-bg)',
        },
        text: {
          primary:   'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted:     'var(--color-text-muted)',
          inverse:   'var(--color-text-inverse)',
        },
        // Smart override of Tailwind greens based on #2f7d31
        green: {
          50: '#f2f8f2',
          100: '#e0efe1',
          200: '#c2dfc4',
          300: '#94c698',
          400: '#60a566',
          500: '#2f7d31', // User's precise color
          600: '#236125',
          700: '#1d4d1f',
          800: '#183c1a',
          900: '#143116',
          950: '#0a1a0b',
        },
        emerald: {
          50: '#f2f8f2',
          100: '#e0efe1',
          200: '#c2dfc4',
          300: '#94c698',
          400: '#60a566',
          500: '#2f7d31', // User's precise color
          600: '#236125',
          700: '#1d4d1f',
          800: '#183c1a',
          900: '#143116',
          950: '#0a1a0b',
        },
        // Smart override of Tailwind amber and orange based on #f7771b
        amber: {
          50:  '#fff4e6',
          100: '#fee5ce',
          200: '#fdcc9f',
          300: '#fba973',
          400: '#f99547',
          500: '#f7771b', // User's precise orange accent
          600: '#da5f10',
          700: '#b44a0e',
          800: '#8e3a0d',
          900: '#75320d',
          950: '#401805',
        },
        orange: {
          50:  '#fff4e6',
          100: '#fee5ce',
          200: '#fdcc9f',
          300: '#fba973',
          400: '#f99547',
          500: '#f7771b', // User's precise orange accent
          600: '#da5f10',
          700: '#b44a0e',
          800: '#8e3a0d',
          900: '#75320d',
          950: '#401805',
        }
      },
      borderRadius: {
        sm:  '6px',
        md:  '10px',
        lg:  '12px',
        xl:  '14px',
        '2xl': '20px',
        full: '9999px',
      },
      boxShadow: {
        card:     'var(--shadow-card)',
        dropdown: 'var(--shadow-dropdown)',
        modal:    'var(--shadow-modal)',
      },
    },
  },
  plugins: [],
}
