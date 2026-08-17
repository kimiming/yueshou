"use client";

import { Button, Form, Input, Modal, Space, Tabs, Typography } from "antd";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/config";

type Mutation = (input: unknown) => Promise<unknown>;
type Translation = { locale: Locale; title: string; body: string; alt?: string };

function TranslationFields() {
  return <Tabs items={SUPPORTED_LOCALES.map((locale) => ({
    key: locale,
    label: locale === "en" ? "English (default)" : locale,
    children: <Space direction="vertical" style={{ width: "100%" }}>
      <Form.Item name={["translations", locale, "title"]} label="Title"><Input placeholder="留空则使用文件名" /></Form.Item>
      <Form.Item name={["translations", locale, "body"]} label="Body"><Input.TextArea rows={4} /></Form.Item>
      <Form.Item name={["translations", locale, "alt"]} label="Alternative text"><Input placeholder="留空则使用文件名" /></Form.Item>
    </Space>,
  }))} />;
}

function toTranslations(value: Record<string, { title?: string; body?: string; alt?: string }>) {
  return SUPPORTED_LOCALES.flatMap((locale) => value[locale]?.title ? [{ locale, title: value[locale].title, body: value[locale].body ?? "", alt: value[locale].alt ?? "" }] : []);
}

export function MediaMetadataForm({ initial, save, archive, publish, allowArchive }: { initial: { id: string; version: string; translations: Translation[] }; save: Mutation; archive: Mutation; publish: Mutation; allowArchive: boolean }) {
  const [form] = Form.useForm();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<{ kind: "success" | "error"; title: string; message: string }>();
  const showFailure = (reason: unknown, fallback: string) => { const message = reason instanceof Error && reason.message ? reason.message : fallback; setError(message); setResult({ kind: "error", title: "操作失败", message }); };
  const showSuccess = (title: string, message: string) => { setError(undefined); setResult({ kind: "success", title, message }); };
  const saveMedia = (values: { translations?: Record<string, { title?: string; body?: string; alt?: string }> }) => startTransition(async () => {
    try { setError(undefined); setResult(undefined); await save({ ...initial, translations: toTranslations(values.translations ?? {}) }); showSuccess("保存成功", "媒体信息已经保存，图片也已发布。点击确定返回媒体库。"); }
    catch (reason) { showFailure(reason, "无法保存媒体信息，请稍后重试。"); }
  });
  const publishMedia = () => startTransition(async () => {
    try { setError(undefined); setResult(undefined); await publish({ mediaAssetId: initial.id, version: initial.version }); showSuccess("发布成功", "图片已经成功发布，现在可以在官网各模块中选择和使用。"); }
    catch (reason) { showFailure(reason, "无法发布图片，请刷新页面后重试。"); }
  });
  return <><Form form={form} layout="vertical" initialValues={{ translations: Object.fromEntries(initial.translations.map((item) => [item.locale, item])) }} onFinish={saveMedia}>
    {error ? <p role="alert">{error}</p> : null}<TranslationFields /><Space><Button htmlType="submit" loading={pending}>保存媒体信息</Button><Button htmlType="button" type="primary" loading={pending} onClick={publishMedia}>发布图片</Button>{allowArchive ? <Button htmlType="button" danger disabled={pending} onClick={() => startTransition(async () => { await archive({ mediaAssetId: initial.id }); })}>安全归档</Button> : null}</Space>
  </Form><Modal open={Boolean(result)} title={result?.title} okText={result?.kind === "success" ? "返回媒体库" : "关闭"} cancelButtonProps={{ style: { display: "none" } }} closable={result?.kind === "error"} maskClosable={false} onCancel={() => setResult(undefined)} onOk={() => { if (result?.kind === "success") router.replace("/admin/media"); else setResult(undefined); }}><Typography.Text type={result?.kind === "error" ? "danger" : undefined}>{result?.message}</Typography.Text></Modal></>;
}
