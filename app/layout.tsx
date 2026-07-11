import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Senior SDE Sourcing Query Builder",
  description:
    "Describe a role in plain language. Get runnable X-ray searches, an ideal-candidate profile, and a screening rubric.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
