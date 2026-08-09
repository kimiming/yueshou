"use client";

import { Button, Card, Form, Input, Select, Space, Tabs } from "antd";
import { useEffect, useState, useTransition } from "react";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";
import { localDateTimeToIso } from "@/features/admin/schedule";
import { isoToLocalDateTime } from "@/features/admin/schedule";
import { MediaPicker } from "./media-picker";

type Action = (input: unknown) => Promise<unknown>;
type Translation = { title?: string; body?: string; excerpt?: string };
type ContentKind = "product" | "article";

const collectTranslations = (value: Record<string, Translation>) => SUPPORTED_LOCALES.flatMap((locale) => value[locale]?.title ? [{ locale, title: value[locale].title, body: value[locale].body ?? "", ...(value[locale].excerpt ? { excerpt: value[locale].excerpt } : {}) }] : []);

function TranslationTabs({ article = false }: { article?: boolean }) {
  return <Tabs items={SUPPORTED_LOCALES.map((locale) => ({
    key: locale,
    label: locale === "en" ? "English (required)" : locale,
    children: <Space direction="vertical" style={{ width: "100%" }}>
      <Form.Item name={["translations", locale, "title"]} label="Title" rules={[{ required: locale === "en" }]}><Input /></Form.Item>
      <Form.Item name={["translations", locale, "body"]} label="Body" rules={[{ required: locale === "en" }]}><Input.TextArea rows={4} /></Form.Item>
      {article ? <Form.Item name={["translations", locale, "excerpt"]} label="Excerpt"><Input.TextArea rows={2} /></Form.Item> : null}
    </Space>,
  }))} />;
}

function PublishedMediaField({ form, multiple }: { form: ReturnType<typeof Form.useForm>[0]; multiple: boolean }) {
  const field = multiple ? "mediaIds" : "coverMediaId";
  return <Form.Item shouldUpdate noStyle>{() => <MediaPicker
    multiple={multiple}
    value={form.getFieldValue(field) as string | string[] | undefined}
    onChange={(value) => form.setFieldValue(field, value)}
  />}</Form.Item>;
}

function ScheduleField({ form }: { form: ReturnType<typeof Form.useForm>[0] }) {
  return <Form.Item shouldUpdate noStyle>{() => <Form.Item name="scheduledAt" label="Schedule publication" extra={form.getFieldValue("status") !== "DRAFT" ? "Scheduling is available only while the item is a draft." : undefined}><Input type="datetime-local" disabled={form.getFieldValue("status") !== "DRAFT"} /></Form.Item>}</Form.Item>;
}

export function ProductForm({ categories, save }: { categories: Array<{ id: string; label: string }>; save: Action }) {
  const [form] = Form.useForm(); const [error, setError] = useState<string>(); const [pending, start] = useTransition();
  return <Card title="Product editor"><Form form={form} layout="vertical" initialValues={{ status: "DRAFT", mediaIds: [] }} onValuesChange={(changed) => { if (changed.status && changed.status !== "DRAFT") form.setFieldValue("scheduledAt", ""); }} onFinish={(value) => start(async () => {
    try { setError(undefined); await save({ ...value, mediaIds: value.mediaIds ?? [], scheduledAt: localDateTimeToIso(value.scheduledAt), translations: collectTranslations(value.translations ?? {}), specifications: {} }); form.resetFields(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save product"); }
  })}>
    {error ? <p role="alert">{error}</p> : null}
    <Form.Item name="categoryId" label="Category" rules={[{ required: true }]}><Select options={categories.map((item) => ({ value: item.id, label: item.label }))} /></Form.Item>
    <Form.Item name="slug" label="Slug" rules={[{ required: true }]}><Input /></Form.Item>
    <Form.Item name="casNumber" label="CAS number"><Input /></Form.Item>
    <Form.Item name="sequence" label="Peptide sequence"><Input /></Form.Item>
    <Form.Item name="mediaIds" hidden><Input /></Form.Item><PublishedMediaField form={form} multiple />
    <Form.Item name="status" label="Status"><Select options={["DRAFT", "PUBLISHED"].map((value) => ({ value }))} /></Form.Item>
    <ScheduleField form={form} /><TranslationTabs />
    <Button type="primary" htmlType="submit" loading={pending}>Save product</Button>
  </Form></Card>;
}

export function ArticleForm({ categories, tags, save }: { categories: Array<{ id: string; label: string }>; tags: Array<{ id: string; name: string }>; save: Action }) {
  const [form] = Form.useForm(); const [error, setError] = useState<string>(); const [pending, start] = useTransition();
  return <Card title="News editor"><Form form={form} layout="vertical" initialValues={{ status: "DRAFT", tagIds: [] }} onValuesChange={(changed) => { if (changed.status && changed.status !== "DRAFT") form.setFieldValue("scheduledAt", ""); }} onFinish={(value) => start(async () => {
    try { setError(undefined); await save({ ...value, coverMediaId: value.coverMediaId ?? null, scheduledAt: localDateTimeToIso(value.scheduledAt), translations: collectTranslations(value.translations ?? {}) }); form.resetFields(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save article"); }
  })}>
    {error ? <p role="alert">{error}</p> : null}
    <Form.Item name="categoryId" label="Category" rules={[{ required: true }]}><Select options={categories.map((item) => ({ value: item.id, label: item.label }))} /></Form.Item>
    <Form.Item name="slug" label="Slug" rules={[{ required: true }]}><Input /></Form.Item>
    <Form.Item name="coverMediaId" hidden><Input /></Form.Item><PublishedMediaField form={form} multiple={false} />
    <Form.Item name="tagIds" label="Tags"><Select mode="multiple" options={tags.map((item) => ({ value: item.id, label: item.name }))} /></Form.Item>
    <Form.Item name="status" label="Status"><Select options={["DRAFT", "PUBLISHED"].map((value) => ({ value }))} /></Form.Item>
    <ScheduleField form={form} /><TranslationTabs article />
    <Button type="primary" htmlType="submit" loading={pending}>Save article</Button>
  </Form></Card>;
}

export function InquiryStatusForm({ inquiryId, status, notes, version: initialVersion, update, saveNotes }: { inquiryId: string; status: string; notes: string | null; version: string; update: Action; saveNotes: Action }) {
  const [form] = Form.useForm(); const [pending, start] = useTransition(); const [error, setError] = useState<string>(); const [version, setVersion] = useState(initialVersion);
  const acceptVersion = (result: unknown) => { if (typeof result === "object" && result !== null && "version" in result && typeof result.version === "string") setVersion(result.version); };
  return <Form form={form} layout="vertical" initialValues={{ status, internalNotes: notes ?? "" }} onFinish={(value) => start(async () => { try { setError(undefined); acceptVersion(await update({ inquiryId, status: value.status, version })); } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update inquiry"); } })}>
    {error ? <p role="alert">{error}</p> : null}<Form.Item name="status" label="Status"><Select options={["NEW", "IN_PROGRESS", "RESOLVED", "ARCHIVED"].map((value) => ({ value }))} /></Form.Item><Form.Item name="internalNotes" label="Internal notes"><Input.TextArea rows={3} /></Form.Item><Space><Button htmlType="submit" loading={pending}>Update status</Button><Button onClick={() => start(async () => { try { setError(undefined); acceptVersion(await saveNotes({ inquiryId, internalNotes: form.getFieldValue("internalNotes") || null, version })); } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save notes"); } })} loading={pending}>Save notes</Button></Space>
  </Form>;
}

export function UserForm({ save }: { save: Action }) { const [pending, start] = useTransition(); const [error, setError] = useState<string>(); return <Card title="Create administrator or editor"><Form layout="vertical" initialValues={{ role: "EDITOR" }} onFinish={(value) => start(async () => { try { setError(undefined); await save(value); } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not create user"); } })}>{error ? <p role="alert">{error}</p> : null}<Form.Item name="email" label="Email" rules={[{ required: true, type: "email" }]}><Input /></Form.Item><Form.Item name="password" label="Temporary password" rules={[{ required: true, min: 12 }]}><Input.Password /></Form.Item><Form.Item name="role" label="Role"><Select options={["EDITOR", "ADMIN"].map((value) => ({ value }))} /></Form.Item><Button type="primary" htmlType="submit" loading={pending}>Create user</Button></Form></Card>; }

export function UserUpdateForm({ user, update, protectedAdmin }: { user: { id: string; role: "ADMIN" | "EDITOR"; isActive: boolean }; update: Action; protectedAdmin: boolean }) { const [pending, start] = useTransition(); const [error, setError] = useState<string>(); return <Form layout="vertical" initialValues={{ role: user.role, isActive: user.isActive }} onFinish={(value) => start(async () => { try { setError(undefined); await update({ id: user.id, role: value.role, isActive: value.isActive, ...(value.password ? { password: value.password } : {}) }); } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update user"); } })}>{error ? <p role="alert">{error}</p> : null}<Form.Item name="role" label="Role"><Select disabled={protectedAdmin} options={["EDITOR", "ADMIN"].map((value) => ({ value }))} /></Form.Item><Form.Item name="isActive" label="Account state"><Select disabled={protectedAdmin} options={[{ value: true, label: "Active" }, { value: false, label: "Disabled" }]} /></Form.Item><Form.Item name="password" label="Reset password"><Input.Password placeholder="Leave blank to keep" /></Form.Item><Button htmlType="submit" loading={pending}>Save account</Button></Form>; }

function SeoPreview({ form }: { form: ReturnType<typeof Form.useForm>[0] }) { return <Form.Item shouldUpdate noStyle>{() => { const translation = form.getFieldValue(["translations", "en"]) as Translation | undefined; return <Card size="small" title="Google search preview"><strong>{translation?.title || "SEO title preview"}</strong><p style={{ color: "#1677ff" }}>https://yueshou.example/…</p><p>{(translation?.body || "SEO description preview").slice(0, 160)}</p></Card>; }}</Form.Item>; }

export function ExistingContentForm({ kind, initial, categories, tags = [], save }: { kind: ContentKind; initial: Record<string, unknown>; categories: Array<{ id: string; label: string }>; tags?: Array<{ id: string; name: string }>; save: Action }) {
  const [form] = Form.useForm(); const [pending, start] = useTransition(); const [error, setError] = useState<string>(); const [success, setSuccess] = useState<string>();
  useEffect(() => { form.setFieldValue("scheduledAt", isoToLocalDateTime(initial.scheduledAt as string | null | undefined)); }, [form, initial.scheduledAt]);
  return <Card title={`Edit ${kind}`}><Form form={form} layout="vertical" initialValues={{ ...initial, scheduledAt: "", translations: Object.fromEntries((initial.translations as Array<{ locale: string }>).map((item) => [item.locale, item])) }} onValuesChange={(changed) => { if (changed.status && changed.status !== "DRAFT") form.setFieldValue("scheduledAt", ""); }} onFinish={(value) => start(async () => {
    try { setError(undefined); setSuccess(undefined); await save({ ...initial, ...value, translations: collectTranslations(value.translations ?? {}), mediaIds: kind === "product" ? value.mediaIds ?? [] : undefined, tagIds: kind === "article" ? value.tagIds ?? [] : undefined, coverMediaId: kind === "article" ? value.coverMediaId ?? null : undefined, scheduledAt: localDateTimeToIso(value.scheduledAt) }); setSuccess(`${kind === "article" ? "Article" : "Product"} saved as ${String(value.status)}`); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save content"); }
  })}>
    {error ? <p role="alert">{error}</p> : null}{success ? <p role="status">{success}</p> : null}<Form.Item name="categoryId" label="Category"><Select options={categories.map((item) => ({ value: item.id, label: item.label }))} /></Form.Item><Form.Item name="slug" label="Slug"><Input /></Form.Item>
    {kind === "product" ? <><Form.Item name="casNumber" label="CAS"><Input /></Form.Item><Form.Item name="sequence" label="Sequence"><Input /></Form.Item><Form.Item name="mediaIds" hidden><Input /></Form.Item><PublishedMediaField form={form} multiple /></> : <><Form.Item name="coverMediaId" hidden><Input /></Form.Item><PublishedMediaField form={form} multiple={false} /><Form.Item name="tagIds" label="Tags"><Select mode="multiple" options={tags.map((item) => ({ value: item.id, label: item.name }))} /></Form.Item></>}
    <Form.Item name="status" label="Status"><Select options={["DRAFT", "PUBLISHED", "ARCHIVED"].map((value) => ({ value }))} /></Form.Item><ScheduleField form={form} /><TranslationTabs article={kind === "article"} /><SeoPreview form={form} /><Button htmlType="submit" loading={pending}>Save changes</Button>
  </Form></Card>;
}
