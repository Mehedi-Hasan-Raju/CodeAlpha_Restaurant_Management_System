import './globals.css';
import Shell from '@/components/Shell';
export const metadata = { title: 'RestroPOS' };
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" /></head>
      <body><Shell>{children}</Shell></body>
    </html>
  );
}
