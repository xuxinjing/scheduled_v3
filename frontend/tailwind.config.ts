import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        secondary: "hsl(var(--secondary))",
        "secondary-foreground": "hsl(var(--secondary-foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        accent: "hsl(var(--accent))",
        "accent-foreground": "hsl(var(--accent-foreground))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        danger: "hsl(var(--danger))",
      },
      borderRadius: {
        xl: "1.25rem",
        "2xl": "1.75rem",
      },
      boxShadow: {
        glow: "0 24px 80px rgba(75, 43, 20, 0.16)",
        panel: "0 20px 60px rgba(45, 28, 17, 0.12)",
      },
      keyframes: {
        "pulse-soft": {
          "0%, 100%": { opacity: "0.4", transform: "scale(0.96)" },
          "50%": { opacity: "1", transform: "scale(1)" },
        },
        "rise-in": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        wave: {
          "0%, 100%": { transform: "scaleY(0.38)" },
          "50%": { transform: "scaleY(1)" },
        },
      },
      animation: {
        "pulse-soft": "pulse-soft 1.6s ease-in-out infinite",
        "rise-in": "rise-in 0.55s cubic-bezier(0.16, 1, 0.3, 1)",
        shimmer: "shimmer 2.2s linear infinite",
        wave: "wave 1.1s ease-in-out infinite",
      },
      backgroundImage: {
        "oven-glow": "radial-gradient(circle at top, rgba(255,196,145,0.45), transparent 38%), radial-gradient(circle at bottom right, rgba(138,78,45,0.2), transparent 36%)",
      },
    },
  },
  plugins: [],
};

export default config;
