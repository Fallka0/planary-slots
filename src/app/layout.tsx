import type { Metadata } from "next";
import { Big_Shoulders, Onest } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import { WalletProvider } from "@/components/WalletProvider";
import "./globals.css";

const ui = Onest({ variable: "--font-ui", subsets: ["latin"] });
const poster = Big_Shoulders({ variable: "--font-poster", weight: ["700", "800", "900"], subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Planary Slots",
  description: "Three machines with their reel strips published and their return printed on the cabinet. Play money only.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${ui.variable} ${poster.variable}`}>
      <body>
        <AuthProvider>
          <WalletProvider>{children}</WalletProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
