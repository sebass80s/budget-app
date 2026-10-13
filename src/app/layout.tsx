import type { Metadata, Viewport } from "next";
import { PwaRegistration } from "@/components/PwaRegistration";
import "./globals.css";
import "./month.css";

const basePath = process.env.GITHUB_PAGES === "true" ? "/budget-app" : "";

export const viewport: Viewport = { themeColor: "#11282c", width: "device-width", initialScale: 1 };

export const metadata: Metadata = {
  title: "Agile Economy | Ett drag i taget",
  description: "En enklare privatekonomi: dagsnetto, köp och en tydlig framtidsbild.",
  applicationName: "Agile Economy",
  manifest: basePath + "/manifest.webmanifest",
  icons: {
    icon: [
      { url: basePath + "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: basePath + "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: basePath + "/icons/apple-touch-icon-180.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Agile Economy" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sv">
      <body><PwaRegistration />{children}</body>
    </html>
  );
}
