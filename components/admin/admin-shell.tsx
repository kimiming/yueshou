"use client";

import type { ReactNode } from "react";
import { Avatar, Button, Dropdown, Layout, Menu, Space, Typography } from "antd";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { DashboardOutlined, FileTextOutlined, FolderOpenOutlined, MessageOutlined, PictureOutlined, ProductOutlined, SettingOutlined, TeamOutlined } from "@ant-design/icons";

import type { AuthenticatedUser } from "@/lib/auth/permissions";

const { Header, Content, Sider } = Layout;

const navigation = [
  { key: "dashboard", label: "仪表盘", href: "/admin", icon: <DashboardOutlined /> },
  { key: "media", label: "媒体库", href: "/admin/media", icon: <PictureOutlined /> },
  { key: "factory", label: "Our Factory", href: "/admin/factory", icon: <FolderOpenOutlined /> },
  { key: "social-media", label: "社交媒体管理", href: "/admin/social-media", icon: <SettingOutlined /> },
  { key: "customer-messages", label: "客户信息管理", href: "/admin/customer-messages", icon: <MessageOutlined /> },
  { key: "news", label: "新闻管理", href: "/admin/news", icon: <FileTextOutlined /> },
  { key: "products", label: "产品管理", href: "/admin/products", icon: <ProductOutlined /> },
  { key: "users", label: "用户管理", href: "/admin/users", icon: <TeamOutlined /> },
];

export function AdminShell({ user, children }: { user: AuthenticatedUser; children: ReactNode }) {
  const items = navigation.map((item) => ({ key: item.key, icon: item.icon, label: <Link href={item.href}>{item.label}</Link> }));
  const displayName = user.name || user.email;

  return (
    <Layout className="admin-shell">
      <Sider breakpoint="lg" collapsedWidth="0" className="admin-shell__sider">
        <Link className="admin-shell__brand" href="/admin" aria-label="粤首管理后台首页">粤首管理后台</Link>
        <nav aria-label="管理后台">
          <Menu theme="dark" mode="inline" selectable={false} items={items} />
        </nav>
      </Sider>
      <Layout>
        <Header className="admin-shell__header">
          <Typography.Text strong>管理后台</Typography.Text>
          <Dropdown
            trigger={["click"]}
            menu={{
              items: [
                { key: "identity", label: user.email, disabled: true },
                { type: "divider" },
                {
                  key: "signout",
                  label: <Button type="text" onClick={() => void signOut({ callbackUrl: "/admin/login" })}>退出登录</Button>,
                },
              ],
            }}
          >
            <Button type="text" aria-label="打开当前用户菜单">
              <Space><Avatar>{displayName.slice(0, 1).toUpperCase()}</Avatar><span>{displayName}</span></Space>
            </Button>
          </Dropdown>
        </Header>
        <Content className="admin-shell__content">{children}</Content>
      </Layout>
    </Layout>
  );
}
