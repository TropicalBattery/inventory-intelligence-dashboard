import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "tbc-red": "#CC2B2B",
        "tbc-red-hover": "#B02424",
        "tbc-red-light": "#FDF2F2",
        "tbc-amber": "#F5A000",
        "tbc-amber-light": "#FFFBEB",
        "tbc-sidebar": "#111111",
        "tbc-sidebar-text": "#E5E5E5",
        "tbc-sidebar-active": "#CC2B2B",
        "tbc-sidebar-hover": "#1F1F1F",
        "tbc-sidebar-icon": "#888888",
        surface: {
          DEFAULT: "#F3F4F6",
          card: "#FFFFFF",
        },
        accent: {
          DEFAULT: "#CC2B2B",
          hover: "#B02424",
        },
      },
      borderRadius: {
        xl: "12px",
        "2xl": "16px",
        "3xl": "24px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
        "card-hover":
          "0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06)",
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
