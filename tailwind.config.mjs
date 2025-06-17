import typography from '@tailwindcss/typography';
import plugin from 'tailwindcss/plugin';

/** @type {import('tailwindcss').Config} */
const config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    screens: {
      xs: '475px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1500px', // New custom breakpoint at 1500px
      '3xl': '1600px',
    },
    extend: {
      colors: {
        neutral: {
          100: '#dededf',
        },
        link: {
          decoration: 'var(--color-link-decoration)',
        },
        black: {
          secondary: '#23252c',
        },
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

          secondary: {
            DEFAULT: 'var(--secondary-background)',
            light: 'var(--secondary-background-color-light)',
          },
          tertiary: {
            DEFAULT: 'var(--tertiary-background-color)',
            light: 'var(--tertiary-background-color-light)',
          },
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
          DEFAULT: 'var(--tag)',
          light: 'var(--secondary-tag-color-light)',
          dark: 'var(--secondary-tag-color)',
        },
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.75rem' }],
      },
      spacing: {
        sidebar: 'var(--nav-sidebar-width)',
        'sidebar-mobile': 'var(--nav-sidebar-width-mobile)',
        'sidebar-offset': 'var(--nav-sidebar-offset)',
        'container-max': 'var(--container-max-width)',
        'element-margin': 'var(--element-margin)',
        'heading-margin': 'var(--heading-margin)',
        'header-height': 'var(--header-height)',
        'right-sidebar-width': 'var(--right-sidebar-width)',
        'directory-width': 'var(--directory-width)',
      },
      fontFamily: {
        sans: ['"Public Sans"', 'sans-serif'],
        'ibm-sans': ['"IBM Plex Sans"', 'sans-serif'],
        serif: ['charter', 'Georgia', 'Cambria', 'serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      typography: () => ({
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
            fontFamily: 'charter, Georgia, Cambria, serif',
            fontSize: 'inherit',
            letterSpacing: '-0.0125rem',
            lineHeight: 'inherit',
            'code::before': {
              content: '""',
            },
            'code::after': {
              content: '""',
            },
            code: {
              fontFamily: 'var(--font-monospace), monospace',
              fontSize: 'inherit !important',
              padding: '1px 3px !important',
              background: 'transparent !important',
            },
            'a:hover': {
              textDecoration: 'underline',
            },
            a: {
              textDecoration: 'none',
              color: 'var(--primary)',
              position: 'relative',
              fontWeight: 'inherit',
              '&::before': {
                content: '""',
                position: 'absolute',
                bottom: '0%',
                left: '0',
                width: '100%',
                height: '15%',
                backgroundColor: 'var(--primary-color-lighten)',
                opacity: '0',
                transition: 'opacity 0.1s ease-in-out',
                zIndex: '-1',
              },
              '&:hover::before': {
                opacity: '1',
              },
            },
            'h1, h2, h3, h4, h5, h6': {
              color: 'var(--foreground)',
              fontWeight: '600',
              lineHeight: '1.24',
              fontFamily: 'charter, Georgia, Cambria, serif',
              padding: '0 !important',
            },
            'h2, h3': {
              lineHeight: '140%',
            },
            h1: {
              fontSize: '35px !important',
              margin: 'var(--heading-margin) 0px 0px !important',
            },
            h2: {
              fontSize: '26px !important',
              margin: 'var(--heading-margin) 0px 0px !important',
            },
            h3: {
              fontSize: '21px !important',
              margin: 'var(--subheading-margin) 0px 0px !important',
            },
            h4: {
              fontSize: '18px !important',
              margin: 'var(--subheading-margin) 0px 0px !important',
            },
            h5: {
              fontSize: '16px !important',
              margin: 'var(--subheading-margin) 0px 0px !important',
            },
            p: {
              marginBottom: '0',
              marginTop: 'var(--element-margin)',
            },
            iframe: {
              marginTop: 'var(--element-margin)',
            },
            'h3 + p, h4 + p, h5 + p': {
              marginTop: 'var(--subsubheading-margin)',
            },
            hr: {
              all: 'initial',
              height: '1px',
              display: 'block',
              margin: 'var(--element-margin) 0px !important',
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
              margin: '0',
              padding: '0',
              paddingLeft: '2rem',
              display: 'flex',
              flexDirection: 'column',
              rowGap: 'var(--list-item-spacing)',
              marginTop: 'var(--list-margin)',
            },
            'ul ul, ul ol, ol ul, ol ol': {
              marginTop: 'calc(var(--list-margin) / 2)',
            },
            blockquote: {
              margin: 0,
              borderLeft: 'none',
              fontWeight: 'inherit',
              color: 'inherit',
              fontStyle: 'inherit',
            },
            'blockquote > *:first-child': {
              marginTop: '0 !important',
            },

            'blockquote > *::before': {
              content: 'none',
            },
            'blockquote > *::after': {
              content: 'none',
            },
            img: {
              maxWidth: '100%',
              borderRadius: '5px',
              margin: '0px auto 0 auto',
              maxHeight: '500px',
            },
            'p:has(img)': {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              margin: '0',
            },
            table: {
              width: '100%',
              borderCollapse: 'collapse',
              borderSpacing: '0',
              marginTop: 'var(--element-margin)',
            },
            'thead th': {
              fontWeight: '500',
              backgroundColor: 'var(--secondary-background-color-light)',
              position: 'sticky',
              top: '0',
              zIndex: '1',
            },
            'thead th:empty': {
              padding: '0 !important',
              border: 'none !important',
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
            },
            pre: {
              padding: '0.625rem 1rem',
            },
            'input[type="checkbox"]': {
              appearance: 'none',
              width: '1.25rem',
              height: '1.25rem',
              border: '2px solid var(--muted-foreground)',
              borderRadius: '0.25rem',
              backgroundColor: 'var(--background)',
              position: 'relative',
              cursor: 'pointer',
              verticalAlign: 'text-top',
              marginRight: '0.5rem',
              flexShrink: '0',
              transition: 'all 0.15s ease-in-out',
              '&:checked': {
                backgroundColor: 'var(--primary)',
                borderColor: 'var(--primary)',
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  left: '0.25rem',
                  top: '0.065rem',
                  width: '0.45rem',
                  height: '0.725rem',
                  border: '2px solid white',
                  borderTop: 'none',
                  borderLeft: 'none',
                  transform: 'rotate(45deg)',
                },
              },
              '&:focus': {
                outline: '1px solid',
                outlineOffset: '1px',
                '&:not(:checked)': {
                  outlineColor: 'var(--muted-foreground)',
                },
                '&:checked': {
                  outlineColor: 'var(--primary-hover-color)',
                },
              },
              '&:disabled': {
                opacity: '0.5',
                cursor: 'not-allowed',
              },
            },
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
            '--tw-prose-pre-bg': 'var(--secondary-background)',
            '--tw-prose-th-borders': 'var(--border)',
            '--tw-prose-td-borders': 'var(--border)',

            'pre > code': {
              backgroundColor: 'transparent !important',
            },

            'thead th': {
              backgroundColor: 'var(--secondary-background-color)',
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
        60: '60',
        70: '70',
        80: '80',
        90: '90',
        100: '100',
      },
    },
  },
  plugins: [
    typography,
    function ({ addVariant }) {
      // Add a custom variant for reading mode
      plugin(addVariant('reading', 'html[data-reading-mode="true"] &'));
    },
  ],
};

export default config;
