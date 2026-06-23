import type { Metadata } from "next/dist/lib/metadata/types/metadata-interface";
import { Archivo, Archivo_Narrow } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

// Grotesk del sistema Swiss. Narrow se usa para numerales condensados.
const archivo = Archivo({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-archivo"
});

const archivoNarrow = Archivo_Narrow({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-archivo-narrow"
});

export const metadata: Metadata = {
  title: "Intranet colaborativa",
  description: "Intranet colaborativa empresarial",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${archivo.variable} ${archivoNarrow.variable}`}>
      <body className="min-h-screen bg-paper font-sans text-ink antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
