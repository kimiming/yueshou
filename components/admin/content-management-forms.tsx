"use client";

import { Button, Card, Form, Input, InputNumber, Select, Space, Tabs } from "antd";
import { useState, useTransition } from "react";

import { SUPPORTED_LOCALES } from "@/lib/i18n/config";

type Mutation = (input: unknown) => Promise<unknown>;
type Translation = { locale: string; title: string; body: string };

function translationsByLocale(translations: Translation[]) {
  return Object.fromEntries(translations.map((translation) => [translation.locale, translation]));
}

function collectTranslations(value: Record<string, { title?: string; body?: string }> = {}) {
  return SUPPORTED_LOCALES.flatMap((locale) => value[locale]?.title
    ? [{ locale, title: value[locale].title!, body: value[locale].body ?? "" }]
    : []);
}

function TranslationFields() {
  return <Tabs items={SUPPORTED_LOCALES.map((locale) => ({
    key: locale,
    label: locale === "en" ? "English (required)" : locale,
    children: <Space direction="vertical" style={{ width: "100%" }}>
      <Form.Item name={["translations", locale, "title"]} label="Title" rules={[{ required: locale === "en" }]}><Input /></Form.Item>
      <Form.Item name={["translations", locale, "body"]} label="Body" rules={[{ required: locale === "en" }]}><Input.TextArea rows={4} /></Form.Item>
    </Space>,
  }))} />;
}

export function CreatePageForm({ create }: { create: Mutation }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  return <Card title="Create page"><Form layout="vertical" onFinish={(value) => startTransition(async () => {
    try {
      setError(undefined);
      await create({ slug: value.slug, translations: [{ locale: "en", title: value.title, body: value.body }] });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create page");
    }
  })}>
    {error ? <p role="alert">{error}</p> : null}
    <Form.Item name="slug" label="Page slug" rules={[{ required: true }]}><Input /></Form.Item>
    <Form.Item name="title" label="English title" rules={[{ required: true }]}><Input /></Form.Item>
    <Form.Item name="body" label="English body" rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item>
    <Button htmlType="submit" type="primary" loading={pending}>Create page</Button>
  </Form></Card>;
}

export type ContentReferenceOption = {
  id: string;
  kind: "service" | "category" | "homepage-item" | "media";
  label: string;
  status: string;
  thumbnail?: string;
};

export function ContentReferencePicker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string[];
  options: ContentReferenceOption[];
  onChange(value: string[]): void;
}) {
  return <label>
    <span>{label}</span>
    <Select
      aria-label={label}
      mode="multiple"
      value={value}
      onChange={onChange}
      optionFilterProp="label"
      options={options.map((option) => ({
        value: option.id,
        label: option.label,
        disabled: option.status === "ARCHIVED",
      }))}
      style={{ width: "100%" }}
    />
  </label>;
}

export function ServiceEditorForm({
  save,
  initial,
  allowArchive,
}: {
  save: Mutation;
  initial: {
    id?: string;
    version?: string;
    slug: string;
    position: number;
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    translations: Translation[];
  };
  allowArchive: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  return <Card title={initial.id ? "Edit service" : "Create service"}><Form
    layout="vertical"
    initialValues={{ ...initial, translations: translationsByLocale(initial.translations) }}
    onFinish={(value) => startTransition(async () => {
      try {
        setError(undefined);
        setSuccess(undefined);
        await save({ ...initial, ...value, translations: collectTranslations(value.translations) });
        setSuccess("Service saved");
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Could not save service");
      }
    })}
  >
    {error ? <p role="alert">{error}</p> : null}
    {success ? <p role="status">{success}</p> : null}
    <Form.Item name="slug" label="Slug" rules={[{ required: true }]}><Input /></Form.Item>
    <Form.Item name="position" label="Sort position"><InputNumber min={0} /></Form.Item>
    <Form.Item name="status" label="Status"><Select options={[
      { value: "DRAFT", label: "DRAFT" },
      { value: "PUBLISHED", label: "PUBLISHED" },
      ...(allowArchive ? [{ value: "ARCHIVED", label: "ARCHIVED" }] : []),
    ]} /></Form.Item>
    <TranslationFields />
    <Button type="primary" htmlType="submit" loading={pending}>Save service</Button>
  </Form></Card>;
}
