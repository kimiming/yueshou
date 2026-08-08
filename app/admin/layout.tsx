import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AntdRegistry } from "@ant-design/nextjs-registry";

import "../globals.css";

export const metadata: Metadata = {
  title: { default: "YueShou Administration", template: "%s | YueShou Administration" },
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body><AntdRegistry>{children}</AntdRegistry></body>
    </html>
  );
}
