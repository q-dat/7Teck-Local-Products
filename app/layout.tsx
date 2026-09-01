import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Local Product Manager",
  description: "Quản lý sản phẩm với MongoDB và ảnh gốc trên Cloudinary",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
