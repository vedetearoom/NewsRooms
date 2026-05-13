import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Sidebar } from "@/components/layout/sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthGuard } from "@/components/auth-guard";
import { ClerkSync } from "@/components/clerk-sync";
import { Toaster } from "@/components/ui/use-toast";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Newsroom — Automated Intelligence Editorial",
  description: "Your personal, fully automated content assembly line",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex bg-background text-foreground">
        <ClerkProvider>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
            <ClerkSync />
            <AuthGuard>
              <Sidebar />
              <main className="flex-1 min-w-0 flex flex-col ambient-main">
                {children}
              </main>
            </AuthGuard>
          </ThemeProvider>
        </ClerkProvider>
        <Toaster />
      </body>
    </html>
  );
}
