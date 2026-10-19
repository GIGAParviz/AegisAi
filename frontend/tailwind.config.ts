import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#f3f0e3',
        text: '#293222',
        muted: '#646659',
        faint: '#77796a',
        accent: '#767c4c',
        warm: '#883250',
        line: '#d7d5c6',
        panel: '#ece9dc',
      },
      fontFamily: {
        serif: ['Georgia', 'Times New Roman', 'serif'],
        sans: ['Inter', 'Arial', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
        vazir: ['Vazirmatn', 'Tahoma', 'sans-serif'],
      },
      backgroundImage: {
        'noise': "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180' viewBox='0 0 180 180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.78' numOctaves='4' seed='19'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.055'/%3E%3C/svg%3E\")",
        'grid-lines': "repeating-linear-gradient(0deg,rgba(95,87,61,.018) 0 1px,transparent 1px 7px)",
        'radial-glow': "radial-gradient(ellipse at 20% 0%,rgba(255,255,250,.44),transparent 56%)",
      },
      backgroundSize: {
        'noise': '180px 180px, 100% 7px, 100% 100%',
      },
      backgroundBlendMode: {
        'theme': 'multiply, normal, normal',
      },
    },
  },
  plugins: [],
}
export default config