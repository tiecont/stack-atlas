import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || 'https://tiecont.github.io'),
  title: {
    default: 'Stack Atlas',
    template: '%s · Stack Atlas',
  },
  description: 'Engineering knowledge, from code to infrastructure.',
  openGraph: {
    siteName: 'Stack Atlas',
    title: 'Stack Atlas',
    description: 'Engineering knowledge, from code to infrastructure.',
    type: 'website',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
