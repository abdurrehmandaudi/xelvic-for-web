import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: "rgb(var(--accent-rgb) / <alpha-value>)",
        "accent-pill": "rgb(var(--accent-pill-rgb) / <alpha-value>)",
        page: "rgb(var(--page-rgb) / <alpha-value>)",
        card: "rgb(var(--card-rgb) / <alpha-value>)",
        line: "rgb(var(--line-rgb) / <alpha-value>)",
        ink: "rgb(var(--ink-rgb) / <alpha-value>)",
        dim: "rgb(var(--dim-rgb) / <alpha-value>)",
        "on-accent": "rgb(var(--on-accent-rgb) / <alpha-value>)",
        solid: "rgb(var(--solid-rgb) / <alpha-value>)",
        good: "rgb(var(--good-rgb) / <alpha-value>)",
        bad: "rgb(var(--bad-rgb) / <alpha-value>)",
        "accent-5": "color-mix(in srgb, rgb(var(--accent-rgb)) 5%, rgb(var(--card-rgb)))",
        "accent-30": "color-mix(in srgb, rgb(var(--accent-rgb)) 30%, rgb(var(--line-rgb)))",
        "ink-5": "color-mix(in srgb, rgb(var(--ink-rgb)) 5%, transparent)",
        "ink-6": "color-mix(in srgb, rgb(var(--ink-rgb)) 6%, transparent)",
        "dim-80": "color-mix(in srgb, rgb(var(--dim-rgb)) 80%, transparent)",
        "dim-26": "color-mix(in srgb, rgb(var(--dim-rgb)) 26%, transparent)",
        "line-58": "color-mix(in srgb, rgb(var(--line-rgb)) 58%, transparent)",
        "bad-10": "color-mix(in srgb, rgb(var(--bad-rgb)) 10%, rgb(var(--card-rgb)))",
        "bad-24": "color-mix(in srgb, rgb(var(--bad-rgb)) 24%, rgb(var(--line-rgb)))",
        "nav-glass": "rgb(var(--nav) / var(--nav-fill))",
        "nav-edge-38": "color-mix(in srgb, var(--nav-edge) 38%, transparent)",
      },
      backgroundImage: {
        skeleton:
          "linear-gradient(90deg, transparent, color-mix(in srgb, rgb(var(--card-rgb)) 50%, transparent), transparent)",
      },
      boxShadow: {
        "field-focus": "0 0 0 3px color-mix(in srgb, rgb(var(--accent-rgb)) 12%, transparent)",
      },
      fontFamily: {
        sans: ["Manrope Variable", "ui-sans-serif", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "Cascadia Mono", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        control: "14px",
        sheet: "20px",
        panel: "28px",
      },
      screens: {
        xs: "420px",
      },
      transitionTimingFunction: {
        "out-soft": "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-live": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: ".35", transform: "scale(.82)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "voice-dance": {
          "0%, 100%": { transform: "scaleY(0.5)" },
          "50%": { transform: "scaleY(1)" },
        },
        "voice-playhead": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: ".45" },
        },
      },
      animation: {
        "fade-up": "fade-up .35s cubic-bezier(0.22, 1, 0.36, 1) both",
        "pulse-live": "pulse-live 1.6s ease-in-out infinite",
        shimmer: "shimmer 1.6s infinite",
        "voice-dance": "voice-dance 1s ease-in-out infinite",
        "voice-playhead": "voice-playhead 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
