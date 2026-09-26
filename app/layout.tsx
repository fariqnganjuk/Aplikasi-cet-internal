import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Akselera.Tech Internal Chat',
  description: 'Aplikasi Chat Internal Akselera.Tech dengan autentikasi aman, percakapan 1-on-1, dan tema light/dark mode.',
  openGraph: {
    title: 'Akselera.Tech Internal Chat',
    description: 'Aplikasi Chat Internal Akselera.Tech dengan autentikasi aman, percakapan 1-on-1, dan tema light/dark mode.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="font-['Nunito',sans-serif] antialiased">
        {children}
      </body>
    </html>
  );
}

