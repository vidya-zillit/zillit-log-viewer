import '@ant-design/v5-patch-for-react-19';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import './globals.css';

export const metadata = {
  title: 'Zillit Log Viewer',
  description: 'Browse and filter Zillit client logs from the LCW API',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AntdRegistry>{children}</AntdRegistry>
      </body>
    </html>
  );
}
