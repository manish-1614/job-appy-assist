import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Job Discovery Portal | Senior Engineering Career Intelligence',
  description: 'Automated, high-precision job intelligence system with glassmorphic UI and AI candidate evaluation.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="bg-glow-orb-1" />
        <div className="bg-glow-orb-2" />
        {children}
      </body>
    </html>
  );
}
