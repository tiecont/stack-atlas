import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Stack Atlas',
    template: '%s · Stack Atlas',
  },
  description: 'Engineering knowledge, from code to infrastructure.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <head>
        <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml" />
        <link rel="stylesheet" href="/assets/tokens.css" />
        <link rel="stylesheet" href="/assets/site.css" />
      </head>
      <body>
        {children}
        <Script src="/assets/legacy-runtime.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
