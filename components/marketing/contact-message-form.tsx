"use client";

import { Alert, Button, Form, Input } from "antd";
import { useState, useTransition } from "react";

import { submitContactMessageAction } from "@/features/inquiries/contact-message-actions";

export function ContactMessageForm({ onSuccess }: { onSuccess?: () => void }) {
  const [form] = Form.useForm();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState(false);
  const submit = (values: { name: string; email: string; whatsapp?: string; message?: string }) => startTransition(async () => {
    try {
      setError(undefined);
      await submitContactMessageAction(values);
      form.resetFields();
      setSuccess(true);
      onSuccess?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Message could not be sent. Please try again.");
    }
  });
  return <Form form={form} layout="vertical" onFinish={submit} requiredMark>
    {error ? <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} /> : null}
    {success ? <Alert type="success" showIcon message="Thank you. Your message has been sent." closable onClose={() => setSuccess(false)} style={{ marginBottom: 16 }} /> : null}
    <Form.Item name="name" label="Your Name" rules={[{ required: true }, { min: 2 }, { max: 200 }]}><Input autoComplete="name" /></Form.Item>
    <Form.Item name="email" label="Your Email" rules={[{ required: true }, { type: "email" }]}><Input type="email" autoComplete="email" /></Form.Item>
    <Form.Item name="whatsapp" label="Your WhatsApp (Optional)" extra="Phone number with country code" rules={[{ max: 60 }]}><Input type="tel" autoComplete="tel" placeholder="+86 134 3585 5558" /></Form.Item>
    <Form.Item name="message" label="Message (Optional)" rules={[{ max: 10000 }]}><Input.TextArea rows={5} /></Form.Item>
    <Button type="primary" htmlType="submit" loading={pending} block size="large">Send Message</Button>
  </Form>;
}
