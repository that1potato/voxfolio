import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Map Editor",
  robots: { index: false, follow: false },
};

export default function EditorLayout({ children }: { children: ReactNode }) {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_ENABLE_EDITOR !== "1"
  ) {
    notFound();
  }
  return <div className="min-h-screen bg-charcoal text-cream">{children}</div>;
}
