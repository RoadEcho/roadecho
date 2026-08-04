import './globals.css';

export const metadata = {
  title: 'RoadEcho - Secure Plate Messaging',
  description: 'Privacy-first plate-to-plate messaging with cryptographic hashing & AI pre-moderation.',
  metadataBase: new URL('https://roadecho.vercel.app'),
  openGraph: {
    title: 'RoadEcho - Secure Plate Messaging',
    description: 'Privacy-first plate-to-plate messaging with cryptographic hashing & AI pre-moderation.',
    url: 'https://roadecho.vercel.app',
    siteName: 'RoadEcho',
    images: [
      {
        url: '/logo.PNG',
        width: 1200,
        height: 630,
        alt: 'RoadEcho Logo',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RoadEcho - Secure Plate Messaging',
    description: 'Privacy-first plate-to-plate messaging with cryptographic hashing & AI pre-moderation.',
    images: ['/logo.PNG'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-white antialiased">
        {children}
      </body>
    </html>
  );
}
