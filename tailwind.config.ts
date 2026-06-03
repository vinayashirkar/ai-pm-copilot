import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#EBF3FA',
          100: '#D0E4F5',
          500: '#2E75B6',
          700: '#1F497D',
          900: '#0F2D52',
        },
      },
    },
  },
  plugins: [],
}
export default config
