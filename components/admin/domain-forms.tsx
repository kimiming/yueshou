"use client";

import { Button, Card, Form, Input, Select, Space, Tabs } from "antd";
import { useEffect, useState, useTransition } from "react";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";
import { localDateTimeToIso } from "@/features/admin/schedule";
import { isoToLocalDateTime } from "@/features/admin/schedule";
import { MediaPicker } from "./media-picker";
import { inquiryStatusOptions, localeLabels, publicationStatusOptions, roleOptions } from "./admin-labels";

type Action = (input: unknown) => Promise<unknown>;
type Translation = { title?: string; body?: string; excerpt?: string };
type ContentKind = "product" | "article";

const collectTranslations = (value: Record<string, Translation>) => SUPPORTED_LOCALES.flatMap((locale) => value[locale]?.title ? [{ locale, title: value[locale].title, body: value[locale].body ?? "", ...(value[locale].excerpt ? { excerpt: value[locale].excerpt } : {}) }] : []);

function TranslationTabs({ article = false }: { article?: boolean }) {
  return <Tabs items={SUPPORTED_LOCALES.map((locale) => ({
    key: locale,
    label: localeLabels[locale] ?? locale,
    children: <Space direction="vertical" style={{ width: "100%" }}>
      <Form.Item name={["translations", locale, "title"]} label="标题" rules={[{ required: locale === "en" }]}><Input /></Form.Item>
      <Form.Item name={["translations", locale, "body"]} label="正文" rules={[{ required: locale === "en" }]}><Input.TextArea rows={4} /></Form.Item>
      {article ? <Form.Item name={["translations", locale, "excerpt"]} label="摘要"><Input.TextArea rows={2} /></Form.Item> : null}
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
  return <Form.Item shouldUpdate noStyle>{() => <Form.Item name="scheduledAt" label="定时发布" extra={form.getFieldValue("status") !== "DRAFT" ? "只有草稿状态可以设置定时发布。" : undefined}><Input type="datetime-local" disabled={form.getFieldValue("status") !== "DRAFT"} /></Form.Item>}</Form.Item>;
}

export function ProductForm({ categories, save }: { categories: Array<{ id: string; label: string }>; save: Action }) {
  const [form] = Form.useForm(); const [error, setError] = useState<string>(); const [pending, start] = useTransition();
  return <Card title="产品编辑器"><Form form={form} layout="vertical" initialValues={{ status: "DRAFT", mediaIds: [] }} onValuesChange={(changed) => { if (changed.status && changed.status !== "DRAFT") form.setFieldValue("scheduledAt", ""); }} onFinish={(value) => start(async () => {
    try { setError(undefined); await save({ ...value, mediaIds: value.mediaIds ?? [], scheduledAt: localDateTimeToIso(value.scheduledAt), translations: collectTranslations(value.translations ?? {}), specifications: {} }); form.resetFields(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "无法保存产品"); }
  })}>
    {error ? <p role="alert">{error}</p> : null}
    <Form.Item name="categoryId" label="分类" rules={[{ required: true }]}><Select options={categories.map((item) => ({ value: item.id, label: item.label }))} /></Form.Item>
    <Form.Item name="slug" label="路径标识（Slug）" rules={[{ required: true }]}><Input /></Form.Item>
    <Form.Item name="casNumber" label="CAS 编号"><Input /></Form.Item>
    <Form.Item name="sequence" label="肽序列"><Input /></Form.Item>
    <Form.Item name="mediaIds" hidden><Input /></Form.Item><PublishedMediaField form={form} multiple />
    <Form.Item name="status" label="状态"><Select options={publicationStatusOptions.slice(0, 2)} /></Form.Item>
    <ScheduleField form={form} /><TranslationTabs />
    <Button type="primary" htmlType="submit" loading={pending}>保存产品</Button>
  </Form></Card>;
}

export function ArticleForm({ categories, tags, save }: { categories: Array<{ id: string; label: string }>; tags: Array<{ id: string; name: string }>; save: Action }) {
  const [form] = Form.useForm(); const [error, setError] = useState<string>(); const [pending, start] = useTransition();
  return <Card title="新闻编辑器"><Form form={form} layout="vertical" initialValues={{ status: "DRAFT", tagIds: [] }} onValuesChange={(changed) => { if (changed.status && changed.status !== "DRAFT") form.setFieldValue("scheduledAt", ""); }} onFinish={(value) => start(async () => {
    try { setError(undefined); await save({ ...value, coverMediaId: value.coverMediaId ?? null, scheduledAt: localDateTimeToIso(value.scheduledAt), translations: collectTranslations(value.translations ?? {}) }); form.resetFields(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "无法保存文章"); }
  })}>
    {error ? <p role="alert">{error}</p> : null}
    <Form.Item name="categoryId" label="分类" rules={[{ required: true }]}><Select options={categories.map((item) => ({ value: item.id, label: item.label }))} /></Form.Item>
    <Form.Item name="slug" label="路径标识（Slug）" rules={[{ required: true }]}><Input /></Form.Item>
    <Form.Item name="coverMediaId" hidden><Input /></Form.Item><PublishedMediaField form={form} multiple={false} />
    <Form.Item name="tagIds" label="标签"><Select mode="multiple" options={tags.map((item) => ({ value: item.id, label: item.name }))} /></Form.Item>
    <Form.Item name="status" label="状态"><Select options={publicationStatusOptions.slice(0, 2)} /></Form.Item>
    <ScheduleField form={form} /><TranslationTabs article />
    <Button type="primary" htmlType="submit" loading={pending}>保存文章</Button>
  </Form></Card>;
}

export function InquiryStatusForm({ inquiryId, status, notes, version: initialVersion, update, saveNotes }: { inquiryId: string; status: string; notes: string | null; version: string; update: Action; saveNotes: Action }) {
  const [form] = Form.useForm(); const [pending, start] = useTransition(); const [error, setError] = useState<string>(); const [version, setVersion] = useState(initialVersion);
  const acceptVersion = (result: unknown) => { if (typeof result === "object" && result !== null && "version" in result && typeof result.version === "string") setVersion(result.version); };
  return <Form form={form} layout="vertical" initialValues={{ status, internalNotes: notes ?? "" }} onFinish={(value) => start(async () => { try { setError(undefined); acceptVersion(await update({ inquiryId, status: value.status, version })); } catch (reason) { setError(reason instanceof Error ? reason.message : "无法更新询盘"); } })}>
    {error ? <p role="alert">{error}</p> : null}<Form.Item name="status" label="状态"><Select options={inquiryStatusOptions} /></Form.Item><Form.Item name="internalNotes" label="内部备注"><Input.TextArea rows={3} /></Form.Item><Space><Button htmlType="submit" loading={pending}>更新状态</Button><Button onClick={() => start(async () => { try { setError(undefined); acceptVersion(await saveNotes({ inquiryId, internalNotes: form.getFieldValue("internalNotes") || null, version })); } catch (reason) { setError(reason instanceof Error ? reason.message : "无法保存备注"); } })} loading={pending}>保存备注</Button></Space>
  </Form>;
}

export function UserForm({ save }: { save: Action }) { const [pending, start] = useTransition(); const [error, setError] = useState<string>(); return <Card title="创建管理员或编辑员"><Form layout="vertical" initialValues={{ role: "EDITOR" }} onFinish={(value) => start(async () => { try { setError(undefined); await save(value); } catch (reason) { setError(reason instanceof Error ? reason.message : "无法创建用户"); } })}>{error ? <p role="alert">{error}</p> : null}<Form.Item name="email" label="邮箱" rules={[{ required: true, type: "email" }]}><Input /></Form.Item><Form.Item name="password" label="临时密码" rules={[{ required: true, min: 12 }]}><Input.Password /></Form.Item><Form.Item name="role" label="角色"><Select options={roleOptions} /></Form.Item><Button type="primary" htmlType="submit" loading={pending}>创建用户</Button></Form></Card>; }

export function UserUpdateForm({ user, update, protectedAdmin }: { user: { id: string; role: "ADMIN" | "EDITOR"; isActive: boolean }; update: Action; protectedAdmin: boolean }) { const [pending, start] = useTransition(); const [error, setError] = useState<string>(); return <Form layout="vertical" initialValues={{ role: user.role, isActive: user.isActive }} onFinish={(value) => start(async () => { try { setError(undefined); await update({ id: user.id, role: value.role, isActive: value.isActive, ...(value.password ? { password: value.password } : {}) }); } catch (reason) { setError(reason instanceof Error ? reason.message : "无法更新用户"); } })}>{error ? <p role="alert">{error}</p> : null}<Form.Item name="role" label="角色"><Select disabled={protectedAdmin} options={roleOptions} /></Form.Item><Form.Item name="isActive" label="账号状态"><Select disabled={protectedAdmin} options={[{ value: true, label: "启用" }, { value: false, label: "停用" }]} /></Form.Item><Form.Item name="password" label="重置密码"><Input.Password placeholder="留空则保持不变" /></Form.Item><Button htmlType="submit" loading={pending}>保存账号</Button></Form>; }

function SeoPreview({ form }: { form: ReturnType<typeof Form.useForm>[0] }) { return <Form.Item shouldUpdate noStyle>{() => { const translation = form.getFieldValue(["translations", "en"]) as Translation | undefined; return <Card size="small" title="Google 搜索预览"><strong>{translation?.title || "SEO 标题预览"}</strong><p style={{ color: "#1677ff" }}>https://yueshou.example/…</p><p>{(translation?.body || "SEO 描述预览").slice(0, 160)}</p></Card>; }}</Form.Item>; }

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
