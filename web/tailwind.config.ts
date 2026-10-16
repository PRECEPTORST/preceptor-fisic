import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

// Token em var() com suporte a opacidade do Tailwind (bg-brand/25, border-line/50).
const mix = (v: string) => `color-mix(in srgb, var(${v}) calc(<alpha-value> * 100%), transparent)`;

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Geist Sans", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["Geist Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        micro: ["10px", { lineHeight: "1.3", letterSpacing: "0.08em" }],
        label: ["11px", { lineHeight: "1.4", letterSpacing: "0.06em" }],
        caption: ["12px", { lineHeight: "1.45" }],
        body: ["14px", { lineHeight: "1.55" }],
        "body-lg": ["15px", { lineHeight: "1.6" }],
        lead: ["17px", { lineHeight: "1.55" }],
        h6: ["18px", { lineHeight: "1.4", letterSpacing: "-0.005em" }],
        h5: ["22px", { lineHeight: "1.3", letterSpacing: "-0.01em" }],
        h4: ["28px", { lineHeight: "1.2", letterSpacing: "-0.015em" }],
        h3: ["36px", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        h2: ["48px", { lineHeight: "1.05", letterSpacing: "-0.025em" }],
        h1: ["64px", { lineHeight: "0.95", letterSpacing: "-0.03em" }],
      },
      colors: {
        /* Tokens semânticos diretos (padrão Cockpit) */
        bg: {
          DEFAULT: mix("--bg"),
          elevated: mix("--bg-elevated"),
          subtle: mix("--bg-subtle"),
          muted: mix("--bg-muted"),
        },
        ink: {
          DEFAULT: mix("--c-ink"),
          soft: mix("--c-ink-soft"),
          mute: mix("--c-ink-mute"),
          disabled: mix("--c-ink-disabled"),
        },
        line: {
          DEFAULT: mix("--c-border"),
          strong: mix("--c-border-strong"),
        },
        brand: {
          DEFAULT: mix("--accent-c"),
          soft: "var(--accent-soft)",
          strong: mix("--accent-strong"),
          on: "var(--on-accent)",
        },
        positive: { DEFAULT: mix("--positive"), soft: "var(--positive-soft)" },
        warning: { DEFAULT: mix("--warning"), soft: "var(--warning-soft)" },
        negative: { DEFAULT: mix("--negative"), soft: "var(--negative-soft)" },
        info: { DEFAULT: mix("--info"), soft: "var(--info-soft)" },

        /* Camada shadcn */
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 6px)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        pop: "var(--shadow-pop)",
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        "soft-fade": { "0%": { opacity: "0", transform: "translateY(6px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "soft-fade": "soft-fade 0.4s cubic-bezier(0.22, 0.61, 0.36, 1) both",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
