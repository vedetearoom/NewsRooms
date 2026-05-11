import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Newsroom — Automated Intelligence Editorial",
  description: "Your personal, fully automated AI editorial pipeline. Extract. Write. Critique. Publish.",
};

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
