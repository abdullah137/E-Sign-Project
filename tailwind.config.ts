import type { Config } from "tailwindcss";

const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: token("bg"),
        surface: token("surface"),
        "surface-subtle": token("surface-subtle"),
        "surface-muted": token("surface-muted"),
        card: token("card"),
        hairline: token("border"),
        "hairline-strong": token("border-strong"),
        ink: token("ink"),
        "ink-secondary": token("ink-secondary"),
        slate: token("slate"),
        placeholder: token("placeholder"),
        gold: token("accent"),
        "gold-hover": token("accent-hover"),
        "gold-text": token("accent-text"),
        danger: token("danger"),
        "danger-bg": token("danger-bg"),
        "success-bg": token("success-bg"),
        "success-text": token("success-text"),
        "warning-bg": token("warning-bg"),
        "warning-text": token("warning-text"),
        amber: token("amber"),
        "amber-strong": token("amber-strong"),
        "amber-soft": token("amber-soft"),
        "btn-dark": token("btn-dark"),
        "btn-dark-text": token("btn-dark-text"),
        brand: {
          50: token("brand-50"),
          100: token("brand-100"),
          200: token("brand-200"),
          300: token("brand-300"),
          500: token("brand-500"),
          600: token("brand-600"),
          700: token("brand-700"),
          900: token("brand-900"),
          text: token("brand-text"),
          ink: token("ink"),
          muted: token("slate"),
          line: token("border"),
          wash: token("brand-50"),
        },
      },
      fontFamily: {
        sans: ["var(--font-open-sans)", "Open Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-open-sans)", "Open Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        signature: [
          "var(--font-signature)",
          "var(--font-open-sans)",
          "Open Sans",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
      borderRadius: {
        sm: "6px",
        DEFAULT: "8px",
        md: "10px",
        card: "16px",
        modal: "16px",
        pill: "9999px",
      },
      boxShadow: {
        float: "0 12px 32px rgba(15,23,42,.10)",
        modal: "0 24px 64px -16px rgba(15,23,42,.18), 0 8px 24px -8px rgba(15,23,42,.08)",
        blue: "0 8px 24px rgba(8,17,31,.18)",
      },
      spacing: {
        4.5: "1.125rem",
      },
      letterSpacing: {
        overline: "0.06em",
      },
      transitionDuration: {
        160: "160ms",
      },
      maxWidth: {
        page: "1152px",
        nav: "1000px",
      },
    },
  },
  plugins: [],
};

export default config;
