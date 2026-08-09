"use client";

import { Button, Card, Form, Input, InputNumber, Select, Space, Tabs } from "antd";
import { useState, useTransition } from "react";

import { SUPPORTED_LOCALES } from "@/lib/i18n/config";
import { localeLabels, publicationStatusOptions } from "./admin-labels";

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
    label: localeLabels[locale] ?? locale,
    children: <Space direction="vertical" style={{ width: "100%" }}>
      <Form.Item name={["translations", locale, "title"]} label="标题" rules={[{ required: locale === "en" }]}><Input /></Form.Item>
      <Form.Item name={["translations", locale, "body"]} label="正文" rules={[{ required: locale === "en" }]}><Input.TextArea rows={4} /></Form.Item>
    </Space>,
  }))} />;
}

export function CreatePageForm({ create }: { create: Mutation }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  return <Card title="创建页面"><Form layout="vertical" onFinish={(value) => startTransition(async () => {
    try {
      setError(undefined);
      await create({ slug: value.slug, translations: [{ locale: "en", title: value.title, body: value.body }] });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法创建页面");
    }
  })}>
    {error ? <p role="alert">{error}</p> : null}
    <Form.Item name="slug" label="页面路径标识（Slug）" rules={[{ required: true }]}><Input /></Form.Item>
    <Form.Item name="title" label="英语标题" rules={[{ required: true }]}><Input /></Form.Item>
    <Form.Item name="body" label="英语正文" rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item>
    <Button htmlType="submit" type="primary" loading={pending}>创建页面</Button>
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
  return <Card title={initial.id ? "编辑服务" : "创建服务"}><Form
    layout="vertical"
    initialValues={{ ...initial, translations: translationsByLocale(initial.translations) }}
    onFinish={(value) => startTransition(async () => {
      try {
        setError(undefined);
        setSuccess(undefined);
        await save({ ...initial, ...value, translations: collectTranslations(value.translations) });
        setSuccess("服务已保存");
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "无法保存服务");
      }
    })}
  >
    {error ? <p role="alert">{error}</p> : null}
    {success ? <p role="status">{success}</p> : null}
    <Form.Item name="slug" label="路径标识（Slug）" rules={[{ required: true }]}><Input /></Form.Item>
    <Form.Item name="position" label="排序位置"><InputNumber min={0} /></Form.Item>
    <Form.Item name="status" label="状态"><Select options={[
      ...publicationStatusOptions.slice(0, 2),
      ...(allowArchive ? [publicationStatusOptions[2]!] : []),
    ]} /></Form.Item>
    <TranslationFields />
    <Button type="primary" htmlType="submit" loading={pending}>保存服务</Button>
  </Form></Card>;
}
