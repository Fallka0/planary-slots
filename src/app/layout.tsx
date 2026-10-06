import type { Metadata } from "next";
import { Big_Shoulders, Onest } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import { WalletProvider } from "@/components/WalletProvider";
import { SoundProvider } from "@/lib/sound";
import "./globals.css";

const ui = Onest({ variable: "--font-ui", subsets: ["latin"] });
const poster = Big_Shoulders({ variable: "--font-poster", weight: ["700", "800", "900"], subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Planary Slots",
  description: "Three planetary slot machines with free spins, Hold & Win and the Orbit Wheel — reel strips published, return printed on the cabinet. Play money only.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${ui.variable} ${poster.variable}`}>
      <body>
        <AuthProvider>
          <WalletProvider>
            <SoundProvider>{children}</SoundProvider>
          </WalletProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
