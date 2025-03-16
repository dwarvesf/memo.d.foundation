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
        // Using the color variables from your Hugo theme
        primary: {
          DEFAULT: '#e13f5e',
          foreground: '#ffffff',
        },
        background: {
          DEFAULT: 'var(--background)',
          light: '#fff',
          dark: '#1e1e1e',
        },
        foreground: 'var(--foreground)',
        muted: {
          DEFAULT: 'hsl(220, 14.3%, 95.9%)',
          foreground: 'hsl(220, 8.9%, 46.1%)',
        },
        accent: {
          DEFAULT: '#e13f5e',
          foreground: '#ffffff',
        },
        border: {
          DEFAULT: 'hsl(220, 13%, 91%)',
        },
        input: {
          DEFAULT: 'hsl(220, 13%, 91%)',
        },
        card: {
          DEFAULT: 'hsl(0, 0%, 100%)',
          foreground: 'hsl(224, 71.4%, 4.1%)',
        },
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.75rem' }],
      },
      typography: (theme) => ({
        DEFAULT: {
          css: {
            '--tw-prose-body': theme('colors.foreground'),
            '--tw-prose-headings': theme('colors.foreground'),
            '--tw-prose-lead': theme('colors.muted.foreground'),
            '--tw-prose-links': theme('colors.primary.DEFAULT'),
            '--tw-prose-bold': theme('colors.foreground'),
            '--tw-prose-counters': theme('colors.muted.foreground'),
            '--tw-prose-bullets': theme('colors.muted.foreground'),
            '--tw-prose-hr': theme('colors.border'),
            '--tw-prose-quotes': theme('colors.foreground'),
            '--tw-prose-quote-borders': theme('colors.border'),
            '--tw-prose-captions': theme('colors.muted.foreground'),
            '--tw-prose-code': theme('colors.foreground'),
            '--tw-prose-pre-code': theme('colors.foreground'),
            '--tw-prose-pre-bg': theme('colors.muted.DEFAULT'),
            '--tw-prose-th-borders': theme('colors.border'),
            '--tw-prose-td-borders': theme('colors.border'),
            maxWidth: 'none',
            'code::before': {
              content: '""',
            },
            'code::after': {
              content: '""',
            },
            code: {
              backgroundColor: theme('colors.muted.DEFAULT'),
              padding: '0.25rem 0.4rem',
              borderRadius: '0.25rem',
              fontWeight: '500',
            },
            'a:hover': {
              textDecoration: 'underline',
            },
            a: {
              textDecoration: 'none',
              fontWeight: '500',
            },
            'h1, h2, h3, h4, h5, h6': {
              fontWeight: '700',
              marginBottom: '1rem',
              marginTop: '2rem',
            },
            h1: {
              fontSize: '2.25rem',
            },
            h2: {
              fontSize: '1.875rem',
              borderBottom: `1px solid ${theme('colors.border')}`,
              paddingBottom: '0.5rem',
            },
            h3: {
              fontSize: '1.5rem',
            },
            h4: {
              fontSize: '1.25rem',
            },
            hr: {
              marginTop: '2rem',
              marginBottom: '2rem',
            },
            ul: {
              listStyleType: 'disc',
            },
            ol: {
              listStyleType: 'decimal',
            },
            'ul, ol': {
              paddingLeft: '1.5rem',
              marginTop: '1rem',
              marginBottom: '1rem',
            },
            'li > ul, li > ol': {
              marginTop: '0.5rem',
              marginBottom: '0.5rem',
            },
            blockquote: {
              fontStyle: 'italic',
              borderLeftWidth: '4px',
              borderLeftColor: theme('colors.border'),
              paddingLeft: '1rem',
              marginTop: '1.5rem',
              marginBottom: '1.5rem',
            },
            table: {
              width: '100%',
              tableLayout: 'auto',
              textAlign: 'left',
              margin: '2rem 0',
            },
            'thead th': {
              fontWeight: '700',
              borderBottomWidth: '2px',
            },
            'tbody td, tfoot td': {
              padding: '0.5rem',
              borderWidth: '1px',
              borderColor: theme('colors.border'),
            },
            'tbody tr': {
              borderBottomWidth: '1px',
              borderColor: theme('colors.border'),
            },
          },
        },
        dark: {
          css: {
            '--tw-prose-body': theme('colors.foreground'),
            '--tw-prose-headings': theme('colors.foreground'),
            '--tw-prose-lead': theme('colors.muted.foreground'),
            '--tw-prose-links': theme('colors.primary.DEFAULT'),
            '--tw-prose-bold': theme('colors.foreground'),
            '--tw-prose-counters': theme('colors.muted.foreground'),
            '--tw-prose-bullets': theme('colors.muted.foreground'),
            '--tw-prose-hr': theme('colors.border'),
            '--tw-prose-quotes': theme('colors.foreground'),
            '--tw-prose-quote-borders': theme('colors.border'),
            '--tw-prose-captions': theme('colors.muted.foreground'),
            '--tw-prose-code': theme('colors.foreground'),
            '--tw-prose-pre-code': theme('colors.foreground'),
            '--tw-prose-pre-bg': theme('colors.muted.DEFAULT'),
            '--tw-prose-th-borders': theme('colors.border'),
            '--tw-prose-td-borders': theme('colors.border'),
          },
        },
      }),
    },
  },
  plugins: [
    typography,
  ],
};

export default config;
