import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: "class",

  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/layouts/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/widgets/**/*.{js,ts,jsx,tsx,mdx}",
  ],

  theme: {
    extend: {
      colors: {
        primary: process.env.NEXT_PUBLIC_BRAND_PRIMARY || "#C7A645",
        accent: process.env.NEXT_PUBLIC_BRAND_ACCENT || "#0B2545",
        light: process.env.NEXT_PUBLIC_BRAND_LIGHT || "#FFFFFF",
        dark: process.env.NEXT_PUBLIC_BRAND_DARK || "#0B2545",
        success: process.env.NEXT_PUBLIC_BRAND_SUCCESS || "#2e7d6c",
        danger: process.env.NEXT_PUBLIC_BRAND_DANGER || "#b23a48",
        muted: "#5f6368",
        info: "#bfd7ea",
        warning: "#f5d7b2",
      },

      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Poppins", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["Fira Code", "ui-monospace", "SFMono-Regular"],
      },

      container: {
        center: true,
        padding: {
          DEFAULT: "1rem",
          sm: "1.5rem",
          lg: "2rem",
          xl: "3rem",
          "2xl": "4rem",
        },
      },

      screens: {
        xs: "475px",
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1536px",
      },

      boxShadow: {
        soft: "0 4px 14px rgba(0, 0, 0, 0.05)",
        brand: "0 4px 20px rgba(212, 175, 55, 0.25)",
      },

      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },

      transitionTimingFunction: {
        "in-expo": "cubic-bezier(0.95, 0.05, 0.795, 0.035)",
        "out-expo": "cubic-bezier(0.19, 1, 0.22, 1)",
      },
    },
  },

  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/typography"),
    require("@tailwindcss/aspect-ratio"),
  ],
}

export default config
