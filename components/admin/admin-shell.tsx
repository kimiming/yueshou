"use client";

import type { ReactNode } from "react";
import { Avatar, Button, Dropdown, Layout, Menu, Space, Typography } from "antd";
import Link from "next/link";
import { signOut } from "next-auth/react";

import { can, type Permission } from "@/lib/auth/access";
import type { AuthenticatedUser } from "@/lib/auth/permissions";

const { Header, Content, Sider } = Layout;

const navigation: Array<{ key: string; label: string; href: string; permission?: Permission }> = [
  { key: "dashboard", label: "Dashboard", href: "/admin" },
  { key: "content", label: "Content", href: "/admin/content", permission: "content:read" },
  { key: "products", label: "Products", href: "/admin/products", permission: "content:read" },
  { key: "news", label: "News", href: "/admin/news", permission: "content:read" },
  { key: "navigation", label: "Navigation", href: "/admin/navigation", permission: "content:read" },
  { key: "media", label: "Media", href: "/admin/media", permission: "media:read" },
  { key: "inquiries", label: "Inquiries", href: "/admin/inquiries", permission: "inquiries:read" },
  { key: "settings", label: "Settings", href: "/admin/settings", permission: "settings:read" },
  { key: "users", label: "Users", href: "/admin/users", permission: "users:read" },
  { key: "audit", label: "Audit", href: "/admin/audit", permission: "users:read" },
];

export function AdminShell({ user, children }: { user: AuthenticatedUser; children: ReactNode }) {
  const items = navigation
    .filter((item) => !item.permission || can(user, item.permission))
    .map((item) => ({ key: item.key, label: <Link href={item.href}>{item.label}</Link> }));
  const displayName = user.name || user.email;

  return (
    <Layout className="admin-shell">
      <Sider breakpoint="lg" collapsedWidth="0" className="admin-shell__sider">
        <Link className="admin-shell__brand" href="/admin" aria-label="YueShou administration home">YueShou Admin</Link>
        <nav aria-label="Administration">
          <Menu theme="dark" mode="inline" selectable={false} items={items} />
        </nav>
      </Sider>
      <Layout>
        <Header className="admin-shell__header">
          <Typography.Text strong>Administration</Typography.Text>
          <Dropdown
            trigger={["click"]}
            menu={{
              items: [
                { key: "identity", label: user.email, disabled: true },
                { type: "divider" },
                {
                  key: "signout",
                  label: <Button type="text" onClick={() => void signOut({ callbackUrl: "/admin/login" })}>Sign out</Button>,
                },
              ],
            }}
          >
            <Button type="text" aria-label="Open current user menu">
              <Space><Avatar>{displayName.slice(0, 1).toUpperCase()}</Avatar><span>{displayName}</span></Space>
            </Button>
          </Dropdown>
        </Header>
        <Content className="admin-shell__content">{children}</Content>
      </Layout>
    </Layout>
  );
}
