import type { Config } from "tailwindcss";

// Sistema "Swiss editorial": blanco puro, una grotesk, tinta + un rojo
// reservado a urgencia, hairlines 1px, cero glass/sombra/blur, esquinas duras.
// Los nombres de token heredados (accent, glass, sidebar…) se conservan pero
// se remapean a la paleta Swiss para que las clases existentes migren solas.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        // Paleta Swiss
        paper: "#ffffff",
        ink: "#111111",
        mid: "#6b6b6b",
        faint: "#9a9a9a",
        line: "#e3e3e3",
        urgent: {
          DEFAULT: "#e4002b",
          muted: "rgba(228,0,43,0.06)"
        },

        // Heredados, remapeados a Swiss
        appBg: "#ffffff",
        panel: "#ffffff",
        // accent = acción primaria → tinta (negro), no azul
        accent: {
          DEFAULT: "#111111",
          hover: "#000000",
          muted: "rgba(17,17,17,0.06)",
          ring: "rgba(17,17,17,0.30)"
        },
        // glass → superficie blanca plana + hairline
        glass: {
          DEFAULT: "#ffffff",
          heavy: "#ffffff",
          border: "#e3e3e3"
        },
        sidebar: "#ffffff",
        "nav-active-text": "#111111",
        "nav-active-bg": "rgba(17,17,17,0.05)",
        "admin-active-bg": "rgba(228,0,43,0.06)",
        "admin-active-text": "#e4002b"
      },
      fontFamily: {
        sans: [
          "var(--font-archivo)",
          "Helvetica Neue",
          "Helvetica",
          "Arial",
          "sans-serif"
        ],
        condensed: [
          "var(--font-archivo-narrow)",
          "var(--font-archivo)",
          "Helvetica Neue",
          "Arial Narrow",
          "sans-serif"
        ]
      },
      // Swiss = sin sombras. Neutralizamos toda la escala (incl. sm/md/lg).
      boxShadow: {
        none: "none",
        sm: "none",
        DEFAULT: "none",
        md: "none",
        lg: "none",
        xl: "none",
        "2xl": "none",
        inner: "none",
        panel: "none",
        card: "none",
        dropdown: "0 0 0 1px #e3e3e3",
        header: "0 1px 0 #e3e3e3"
      },
      // Esquinas duras: aplanamos la escala a 2px; círculos siguen redondos.
      borderRadius: {
        none: "0px",
        sm: "2px",
        DEFAULT: "2px",
        md: "2px",
        lg: "2px",
        xl: "2px",
        "2xl": "2px",
        "3xl": "2px",
        full: "9999px"
      },
      // Sin desenfoque.
      backdropBlur: {
        none: "0",
        xs: "0",
        sm: "0",
        DEFAULT: "0",
        sidebar: "0",
        header: "0",
        dropdown: "0"
      },
      transitionTimingFunction: {
        macos: "cubic-bezier(0.25, 0.46, 0.45, 0.94)"
      }
    }
  },
  plugins: []
};

export default config;
