import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary:      { DEFAULT: '#001e40', container: '#003366' },
        secondary:    { DEFAULT: '#006d37', container: '#6bfe9c' },
        surface:      {
          DEFAULT: '#f7f9fb',
          dim: '#d8dadc',
          low: '#f2f4f6',
          lowest: '#ffffff',
          container: '#eceef0',
          high: '#e6e8ea',
          highest: '#e0e3e5',
        },
        outline:      { DEFAULT: '#737780', variant: '#c3c6d1' },
        'on-surface': { DEFAULT: '#191c1e', variant: '#43474f' },
        error:        { DEFAULT: '#ba1a1a', container: '#ffdad6' },
      },
      fontFamily: {
        sans:  ['var(--font-inter)', 'Inter', 'sans-serif'],
        mono:  ['var(--font-geist-mono)', 'Geist Mono', 'monospace'],
      },
      fontSize: {
        'display-lg':  ['48px', { lineHeight: '56px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-lg': ['32px', { lineHeight: '40px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'title-md':    ['20px', { lineHeight: '28px', fontWeight: '600' }],
        'body-lg':     ['16px', { lineHeight: '24px' }],
        'body-sm':     ['14px', { lineHeight: '20px' }],
        'label-caps':  ['12px', { lineHeight: '16px', letterSpacing: '0.05em', fontWeight: '700' }],
        'code-mono':   ['14px', { lineHeight: '20px', letterSpacing: '0.1em', fontWeight: '600' }],
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        sm: '0.125rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
        full: '9999px',
      },
      spacing: {
        xs: '8px', sm: '16px', md: '24px', lg: '40px', xl: '64px',
        gutter: '20px', margin: '32px',
      },
    },
  },
  plugins: [],
}

export default config
