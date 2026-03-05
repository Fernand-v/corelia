import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        appBg: "#e8edf2",
        panel: "#ffffff",
        accent: {
          DEFAULT: "#0a84ff",
          hover: "#0071e3",
          muted: "rgba(10,132,255,0.12)",
          ring: "rgba(10,132,255,0.35)"
        },
        glass: {
          DEFAULT: "rgba(255,255,255,0.72)",
          heavy: "rgba(255,255,255,0.88)",
          border: "rgba(0,0,0,0.07)"
        },
        sidebar: "rgba(246,248,250,0.90)",
        "nav-active-text": "#0a84ff",
        "nav-active-bg": "rgba(10,132,255,0.10)",
        "admin-active-bg": "rgba(220,38,38,0.10)",
        "admin-active-text": "#dc2626"
      },
      fontFamily: {
        sans: [
          "SF Pro Display",
          "SF Pro Text",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif"
        ]
      },
      boxShadow: {
        panel: "0 2px 16px rgba(15,23,42,0.07), 0 1px 3px rgba(15,23,42,0.05)",
        card: "0 1px 4px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.05)",
        dropdown: "0 8px 32px rgba(15,23,42,0.14), 0 2px 8px rgba(15,23,42,0.08)",
        header: "0 1px 0 rgba(0,0,0,0.06)"
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "20px"
      },
      backdropBlur: {
        xs: "4px",
        sidebar: "20px",
        header: "24px",
        dropdown: "28px"
      },
      transitionTimingFunction: {
        macos: "cubic-bezier(0.25, 0.46, 0.45, 0.94)"
      }
    }
  },
  plugins: []
};

export default config;
