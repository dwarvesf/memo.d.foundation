import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
const config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Using CSS variables for all colors to match with Hugo
        primary: {
          DEFAULT: 'var(--primary)',
          hover: 'var(--primary-hover)',
          foreground: 'var(--primary-foreground)',
          light: 'var(--primary-light)',
        },
        background: {
          DEFAULT: 'var(--background)',
          light: 'var(--primary-background-color-light)',
          dark: 'var(--primary-background-color)',
          secondary: 'var(--secondary-background-color)',
          secondary_light: 'var(--secondary-background-color-light)',
          tertiary: 'var(--tertiary-background-color)',
          tertiary_light: 'var(--tertiary-background-color-light)',
        },
        foreground: {
          DEFAULT: 'var(--foreground)',
          light: 'var(--primary-font-color-light)',
          dark: 'var(--primary-font-color)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
          light: 'var(--secondary-font-color-light)',
          dark: 'var(--secondary-font-color)',
        },
        border: {
          DEFAULT: 'var(--border)',
          hover: 'var(--border-hover)',
          light: 'var(--border-light)',
          dark: 'var(--primary-border-color)',
        },
        input: {
          DEFAULT: 'var(--input)',
          hover: 'var(--input-hover)',
        },
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
          hover: 'var(--card-hover)',
        },
        tag: {
          light: 'var(--secondary-tag-color-light)',
          dark: 'var(--secondary-tag-color)',
        },
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.75rem' }],
      },
      spacing: {
        sidebar: 'var(--nav-sidebar-width)',
        'sidebar-offset': 'var(--nav-sidebar-offset)',
        'container-max': 'var(--container-max-width)',
        'element-margin': 'var(--element-margin)',
        'heading-margin': 'var(--heading-margin)',
        'header-height': 'var(--header-height)',
      },
      fontFamily: {
        sans: ['Public Sans', 'sans-serif'],
        serif: ['charter, Georgia, Cambria, serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      typography: (theme) => ({
        DEFAULT: {
          css: {
            '--tw-prose-body': 'var(--foreground)',
            '--tw-prose-headings': 'var(--foreground)',
            '--tw-prose-lead': 'var(--muted-foreground)',
            '--tw-prose-links': 'var(--primary)',
            '--tw-prose-bold': 'var(--foreground)',
            '--tw-prose-counters': 'var(--muted-foreground)',
            '--tw-prose-bullets': 'var(--muted-foreground)',
            '--tw-prose-hr': 'var(--border)',
            '--tw-prose-quotes': 'var(--foreground)',
            '--tw-prose-quote-borders': 'var(--border)',
            '--tw-prose-captions': 'var(--muted-foreground)',
            '--tw-prose-code': 'var(--foreground)',
            '--tw-prose-pre-code': 'var(--foreground)',
            '--tw-prose-pre-bg': 'var(--muted)',
            '--tw-prose-th-borders': 'var(--border)',
            '--tw-prose-td-borders': 'var(--border)',
            maxWidth: 'none',
            'code::before': {
              content: '""',
            },
            'code::after': {
              content: '""',
            },
            code: {
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: '0.8125rem !important',
              color: '#5c5c5c !important',
              padding: '1px 3px !important',
              background: 'var(--muted) !important',
            },
            'a:hover': {
              textDecoration: 'underline',
            },
            a: {
              textDecoration: 'none',
              fontWeight: '500',
              color: 'var(--primary)',
            },
            'h1, h2, h3, h4, h5, h6': {
              color: 'var(--foreground)',
              fontWeight: '500',
              lineHeight: '1.24',
            },
            h1: {
              fontSize: '35px !important',
              margin: '1.5rem 0px 0px !important',
            },
            h2: {
              fontSize: '26px !important',
              margin: '1.5rem 0px 0px !important',
            },
            h3: {
              fontSize: '21px !important',
              margin: '1.5rem 0px 0px !important',
            },
            h4: {
              fontSize: '20px !important',
              margin: '1rem 0px 0px !important',
            },
            h5: {
              fontSize: '16px !important',
              margin: '1rem 0px 0px !important',
            },
            p: {
              marginBottom: '0',
              marginTop: '1rem',
            },
            hr: {
              all: 'initial',
              height: '1px',
              display: 'block',
              margin: '1rem 0px !important',
              width: '100%',
              maxWidth: 'inherit',
              backgroundColor: 'var(--border)',
            },
            ul: {
              listStyleType: 'disc',
            },
            ol: {
              listStyleType: 'decimal',
            },
            'ul, ol': {
              lineHeight: '27px',
              margin: '0',
              padding: '0',
              paddingLeft: '2rem',
              display: 'flex',
              flexDirection: 'column',
              rowGap: '8px',
              marginTop: '1rem',
            },
            'ul ul, ul ol, ol ul, ol ol': {
              marginTop: '0.5rem',
            },
            blockquote: {
              padding: '0',
              margin: '1rem 0 0 0',
              boxSizing: 'border-box',
            },
            'blockquote > *:first-child': {
              marginTop: '0 !important',
            },
            img: {
              maxWidth: '100%',
              borderRadius: '5px',
            },
            table: {
              width: '100%',
              borderCollapse: 'collapse',
              borderSpacing: '0',
              marginTop: '1rem',
            },
            'thead th': {
              fontWeight: '500',
              backgroundColor: 'var(--muted)',
            },
            'tr, th, td': {
              borderCollapse: 'collapse',
              borderSpacing: '0',
              border: '1px solid var(--border)',
            },
            'th, td': {
              padding: '10px 12px',
              textAlign: 'left',
              verticalAlign: 'top',
              wordWrap: 'break-word',
              minWidth: '100px',
            }
          },
        },
        dark: {
          css: {
            '--tw-prose-body': 'var(--foreground)',
            '--tw-prose-headings': 'var(--foreground)',
            '--tw-prose-lead': 'var(--muted-foreground)',
            '--tw-prose-links': 'var(--primary)',
            '--tw-prose-bold': 'var(--foreground)',
            '--tw-prose-counters': 'var(--muted-foreground)',
            '--tw-prose-bullets': 'var(--muted-foreground)',
            '--tw-prose-hr': 'var(--border)',
            '--tw-prose-quotes': 'var(--foreground)',
            '--tw-prose-quote-borders': 'var(--border)',
            '--tw-prose-captions': 'var(--muted-foreground)',
            '--tw-prose-code': 'var(--foreground)',
            '--tw-prose-pre-code': 'var(--foreground)',
            '--tw-prose-pre-bg': 'var(--muted)',
            '--tw-prose-th-borders': 'var(--border)',
            '--tw-prose-td-borders': 'var(--border)',
            code: {
              color: '#b3b3b3 !important',
              background: 'var(--muted) !important',
            },
            pre: {
              background: 'var(--muted) !important',
            },
            'pre > code': {
              backgroundColor: 'transparent !important',
            },
          },
        },
      }),
      // Animation keyframes
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px) scale(0.95)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.1s ease-in-out forwards',
        slideUp: 'slideUp 0.15s ease-out',
      },
      zIndex: {
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
      },
    },
  },
  plugins: [
    typography,
  ],
};

export default config;