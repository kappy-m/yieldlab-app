import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		fontFamily: {
  			sans: ["var(--font-plus-jakarta)", "Noto Sans JP", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
  		},
  		colors: {
  			// Yieldlab manage brand tokens
  			brand: {
  				navy: "#1E3A8A",
  				gold: "#CA8A04",
  			},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			// YieldLab design tokens
  			yl: {
  				'ai-bg': '#F5F3FF',
  				'ai-border': '#DDD6FE',
  				'ai-text': '#5B21B6',
  				'ai-dot': '#7C3AED',
  				'positive': '#16A34A',
  				'positive-bg': '#F0FDF4',
  				'negative': '#DC2626',
  				'negative-bg': '#FFF1F2',
  				'neutral-bg': '#F9FAFB',
  				'tab-bg': '#F3F4F6',
  				'header-border': '#E5E7EB',
  				'apply': '#EF4444',
  			},
  			bar: {
  				'a': '#7C3AED',
  				'a-bg': '#EDE9FE',
  				'b': '#2563EB',
  				'b-bg': '#DBEAFE',
  				'c': '#6B7280',
  				'c-bg': '#F3F4F6',
  				'd': '#D97706',
  				'd-bg': '#FEF3C7',
  				'e': '#DC2626',
  				'e-bg': '#FEE2E2',
  			},
  			comp: {
  				'own': '#2563EB',
  				'a': '#EF4444',
  				'b': '#10B981',
  				'c': '#F59E0B',
  				'd': '#8B5CF6',
  				'e': '#EC4899',
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
