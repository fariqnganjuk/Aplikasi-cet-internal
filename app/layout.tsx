import type { Metadata } from 'next';
import { Nunito } from 'next/font/google';
import './globals.css';

const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-nunito',
  display: 'swap',
});

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
    <html lang="id" className={nunito.variable} suppressHydrationWarning>
      <head>
        <script
          // Inline sebelum React hydrate agar tidak flash putih di dark mode.
          // eslint-disable-next-line @next/next/no-sync-scripts
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('akselera_tech_theme');if(t!=='dark'&&t!=='light'){t='light';}if(t==='dark'){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="font-sans antialiased bg-white text-black dark:bg-black dark:text-white">
        {children}
      </body>
    </html>
  );
}

