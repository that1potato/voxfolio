import type { Metadata } from "next";
import {
  Fira_Code,
  Fira_Sans,
  Fraunces,
  Inter,
  Press_Start_2P,
  VT323,
} from "next/font/google";
import { ArticleMosaicFilter } from "@/components/article/ArticleMosaicFilter";
import { site } from "@/site.config";
import { siteTheme } from "@/theme.config";
import "./globals.css";
import "./article.css";

const pressStart = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-press-start",
  display: "swap",
});

const vt323 = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-vt323",
  display: "swap",
});

const inter = Inter({
  weight: ["400", "600", "700"],
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const firaSans = Fira_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-fira-sans",
  display: "swap",
});

const firaCode = Fira_Code({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-fira-code",
  display: "swap",
});

const fraunces = Fraunces({
  weight: "variable",
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-fraunces",
  display: "swap",
});

const fontVariables = [
  pressStart.variable,
  vt323.variable,
  inter.variable,
  firaSans.variable,
  firaCode.variable,
  fraunces.variable,
].join(" ");

export const metadata: Metadata = {
  title: {
    default: site.name,
    template: `%s · ${site.name}`,
  },
  description: site.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={fontVariables}
      data-site-theme={siteTheme.activeMode}
      style={{ colorScheme: siteTheme.activeMode }}
    >
      <body className="min-h-screen antialiased">
        {/* The #article-mosaic SVG filter behind every glass surface (reading
            overlay, hover cards, theme/XR pills). Mount exactly once. */}
        <ArticleMosaicFilter />
        {children}
      </body>
    </html>
  );
}
