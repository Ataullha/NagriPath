import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nagri Path — learn, hear and write Sylheti Nagri',
  description:
    'An app that teaches the Sylheti Nagri script. Learn all 32 letters, hear each one spoken, and convert Bangla writing into Nagri instantly. Built at Shahjalal University of Science & Technology.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Nagri Path',
  appleWebApp: {
    capable: true,
    title: 'Nagri Path',
    statusBarStyle: 'default',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-180.png',
  },
  openGraph: {
    title: 'Nagri Path',
    description:
      'Learn the Sylheti Nagri script, hear it spoken, and convert Bangla into Nagri.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#6B1B3C',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}`,
          }}
        />
      </body>
    </html>
  );
}
