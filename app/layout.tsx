import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://margaretnorthup.com"),
  title: "Technical Sourcing Query Builder",
  description:
    "Describe a role in plain language. Get runnable X-ray searches, an ideal-candidate profile, and a screening rubric.",
  alternates: {
    canonical: "/tools/sourcing-query-builder/app",
  },
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
