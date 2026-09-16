import "./globals.css";

export const metadata = {
  title: "Business Video AI",
  description: "Create AI-powered business videos",
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