import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Budget App | Ett drag i taget",
  description: "En enklare privatekonomi: dagsnetto, köp och en tydlig framtidsbild.",
  applicationName: "Budget App",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sv">
      <body>{children}</body>
    </html>
  );
}
