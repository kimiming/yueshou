import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { AdminChinese } from "@/components/admin/admin-chinese";

import "../globals.css";

export const metadata: Metadata = {
  title: { default: "粤首管理后台", template: "%s | 粤首管理后台" },
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body><AntdRegistry><AdminChinese />{children}</AntdRegistry></body>
    </html>
  );
}
