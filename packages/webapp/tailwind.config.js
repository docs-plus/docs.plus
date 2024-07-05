/** @type {import('tailwindcss').Config} */

const colors = require('tailwindcss/colors')

module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}', // Note the addition of the `app` directory.
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',

    // Or if using `src` directory:
    './src/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  'tailwindCSS.experimental.classRegex': [
    'twc\\.[^`]+`([^`]*)`',
    'twc\\(.*?\\).*?`([^)]*)',
    ['twc\\.[^`]+\\(([^)]*)\\)', "(?:'|\"|`)([^']*)(?:'|\"|`)"],
    ['twc\\(.*?\\).*?\\(([^)]*)\\)', "(?:'|\"|`)([^']*)(?:'|\"|`)"]
  ],
  plugins: [require('@tailwindcss/typography'), require('daisyui')],
  darkMode: 'class',
  daisyui: {
    themes: [
      {
        docsyLight: {
          ...require('daisyui/src/theming/themes')['light'],
          primary: '#2778ff',
          '--rounded-box': '0.4rem',
          '--rounded-btn': '0.4rem'
        }
      }
      // 'light',
      // 'lemonade'
    ]
  },
  theme: {
    fontFamily: {
      sans: 'Helvetica, Arial, sans-serif'
    },
    colors: {
      docsy: '#2778ff',
      'bg-chatBubble-owner': '#A6C5FA',
      ...colors
    },
    extend: {
      spacing: {},
      boxShadow: {
        'top-only': '0 -2px 2px -1px rgba(0, 0, 0, 0.04), 0 -2px 2px -1px rgba(0, 0, 0, 0.06)'
      },
      animation: {
        fadeIn: 'fadeIn 0.3s ease-out',
        fadeOut: 'fadeOut 0.1s ease-in forwards'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: 0, transform: 'translateY(20px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' }
        },
        fadeOut: {
          '0%': { opacity: 1, transform: 'translateY(0)' },
          '100%': { opacity: 0, transform: 'translateY(20px)' }
        }
      },
      backgroundColor: {
        primary: 'var(--color-bg-primary)',
        secondary: 'var(--color-bg-secondary)'
      },
      textColor: {
        accent: 'var(--color-text-accent)',
        primary: 'var(--color-text-primary)',
        secondary: 'var(--color-text-secondary)'
      }
    }
  }
}
