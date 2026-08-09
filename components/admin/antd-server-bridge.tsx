"use client";

import type { ComponentProps } from "react";
import { Button, Card, Input, Space, Typography } from "antd";

export { Button, Card, Input, Space };

export function AdminPageTitle(props: ComponentProps<typeof Typography.Title>) {
  return <Typography.Title {...props} />;
}
