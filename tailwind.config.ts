import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        page: "#f9f9f7",
        surface: "#ffffff",
        ink: "#0b0b0b",
        "ink-secondary": "#52514e",
        "ink-tertiary": "#898781",
        accent: "#2a78d6",
        "accent-hover": "#2569bf",
        "accent-soft": "rgba(42,120,214,0.12)",
        success: "#0ca30c",
        danger: "#d03b3b",
        forecast: "#eda100",
        actual: "#1baf7a",
        border: "rgba(11,11,11,0.08)",
        "border-strong": "rgba(11,11,11,0.14)",
        divider: "#e1e0d9",
        gridline: "#c3c2b7",
        chip: "#eeede8",
        field: "#fcfcfb",
        faint: "#b8b6ae",
      },
      fontFamily: {
        sora: ["var(--font-sora)", "sans-serif"],
        manrope: ["var(--font-manrope)", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      borderRadius: {
        card: "12px",
        btn: "8px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(11,11,11,0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
