import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#F8F9FA",
        surface: "#FFFFFF",
        "surface-subtle": "#F3F4F5",
        "surface-muted": "#EDEEEF",
        hairline: "rgba(18, 20, 23, 0.08)",
        "hairline-strong": "rgba(18, 20, 23, 0.12)",
        ink: "#121417",
        "ink-secondary": "#45474A",
        slate: "#5E6573",
        placeholder: "#8E95A2",
        gold: "#B89558",
        "gold-hover": "#A38349",
        "gold-text": "#8F7341",
        danger: "#BA1A1A",
        "success-bg": "#EAF4EC",
        "success-text": "#285D39",
        "warning-bg": "#F8EEDF",
        "warning-text": "#8F7341",
      },
      fontFamily: {
        sans: ["var(--font-manrope)", "Manrope", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-newsreader)", "Newsreader", "ui-serif", "Georgia", "serif"],
      },
      borderRadius: {
        sm: "2px",
        DEFAULT: "4px",
        md: "6px",
        card: "8px",
        modal: "12px",
        pill: "9999px",
      },
      boxShadow: {
        float:
          "0 12px 32px -4px rgba(18,20,23,.04), 0 4px 12px -2px rgba(18,20,23,.02)",
        modal:
          "0 24px 64px -12px rgba(18,20,23,.14), 0 8px 24px -6px rgba(18,20,23,.06)",
      },
      letterSpacing: {
        overline: "0.045em",
      },
      transitionDuration: {
        160: "160ms",
      },
      maxWidth: {
        page: "1440px",
      },
    },
  },
  plugins: [],
};

export default config;
