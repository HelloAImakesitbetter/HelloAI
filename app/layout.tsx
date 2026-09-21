import "./globals.css";
import LiveAgent from "../components/live-agent";

export const metadata = {
  title: "HelloAI",
  description: "Build, run, and grow with HelloAI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}<LiveAgent /></body>
    </html>
  );
}