"use client";

import { useState } from "react";
import { Alert, Button, Form, Input } from "antd";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export const GENERIC_LOGIN_ERROR = "Unable to sign in with those credentials. Please try again.";

type CredentialSignIn = (
  provider: "credentials",
  options: { email: string; password: string; redirect: false; callbackUrl: string },
) => Promise<{ ok?: boolean; error?: string | null; status?: number; url?: string | null } | undefined>;

export async function attemptAdminLogin(
  authenticate: CredentialSignIn,
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const result = await authenticate("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: "/admin",
    });
    return result?.ok ? { ok: true } : { ok: false, error: GENERIC_LOGIN_ERROR };
  } catch {
    return { ok: false, error: GENERIC_LOGIN_ERROR };
  }
}

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(values: { email: string; password: string }) {
    setSubmitting(true);
    setError(null);
    const result = await attemptAdminLogin(signIn as CredentialSignIn, values.email, values.password);
    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
      return;
    }
    router.replace("/admin");
    router.refresh();
  }

  return (
    <Form layout="vertical" onFinish={submit} requiredMark={false} aria-label="员工登录">
      {error ? <Alert type="error" showIcon message={error} role="alert" /> : null}
      <Form.Item label="邮箱" name="email" rules={[{ required: true, type: "email", message: "请输入有效的邮箱地址。" }]}>
        <Input type="email" autoComplete="username" autoFocus />
      </Form.Item>
      <Form.Item label="密码" name="password" rules={[{ required: true, message: "请输入密码。" }]}>
        <Input.Password autoComplete="current-password" />
      </Form.Item>
      <Button type="primary" htmlType="submit" loading={submitting} block>
        登录
      </Button>
    </Form>
  );
}
