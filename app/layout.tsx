import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export const metadata: Metadata = {
  title: 'Flight Simulator ✈️',
  description: 'a browser based flight simulator',
  alternates: { canonical: 'https://eclectickarthik.com/flight-simulator/' },
  openGraph: {
    type: 'website',
    title: 'Flight Simulator ✈️',
    description: 'a browser based flight simulator',
    url: 'https://eclectickarthik.com/flight-simulator/',
    images: [{
      url: 'https://eclectickarthik.com/flight-simulator/flight-deck-preview.png',
      width: 1920,
      height: 1080,
      type: 'image/png',
      alt: 'Flight Deck simulator showing a white-and-blue Airbus A320 parked in a hangar with flight controls and airport map.',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Flight Simulator ✈️',
    description: 'a browser based flight simulator',
    images: ['https://eclectickarthik.com/flight-simulator/flight-deck-preview.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
