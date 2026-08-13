"use client";

import { Button, Card, Form, Input, Modal, Select, Space, Tabs } from "antd";
import { useEffect, useState, useTransition } from "react";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";
import { localDateTimeToIso } from "@/features/admin/schedule";
import { isoToLocalDateTime } from "@/features/admin/schedule";
import { MediaPicker } from "./media-picker";
import { RichTextEditor } from "./rich-text-editor";
import { inquiryStatusOptions, localeLabels, roleOptions } from "./admin-labels";

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

function slugFromTitle(title: string) {
  return title.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);
}

function ProductCoverField({ form }: { form: ReturnType<typeof Form.useForm>[0] }) {
  const [assets, setAssets] = useState<Array<{ id: string; filename: string; alt?: string }>>([]);
  useEffect(() => { void fetch("/api/admin/media/available", { cache: "no-store" }).then((response) => response.ok ? response.json() : []).then(setAssets).catch(() => undefined); }, []);
  return <Form.Item shouldUpdate noStyle>{() => { const selected = (form.getFieldValue("mediaIds") as string[] | undefined) ?? []; const coverId = form.getFieldValue("coverMediaId") as string | undefined; return <><Form.Item name="coverMediaId" hidden rules={[{ required: selected.length > 0, message: "请选择一张产品封面" }]}><Input /></Form.Item>{selected.length ? <Form.Item label="点击缩略图设为封面"><div className="admin-cover-picker">{selected.map((id) => { const asset = assets.find((item) => item.id === id); return <button type="button" aria-pressed={coverId === id} className={coverId === id ? "is-cover" : ""} onClick={() => form.setFieldValue("coverMediaId", id)} key={id}><img src={`/api/admin/media/${encodeURIComponent(id)}`} alt={asset?.alt || asset?.filename || "产品图片"} /><span>{coverId === id ? "当前封面" : "设为封面"}</span></button>; })}</div></Form.Item> : null}</>; }}</Form.Item>;
}

function ProductBodyField({ name = ["translations", "en", "body"] }: { name?: (string | number)[] }) {
  return <Form.Item name={name} label="产品内容" rules={[{ required: true, message: "请输入产品内容" }]}>
    <RichTextEditor label="产品内容" placeholder="输入产品详情，可设置加粗、高亮、链接、列表和表格" />
  </Form.Item>;
}

export function ProductForm({ categories, save }: { categories: Array<{ id: string; label: string }>; save: Action }) {
  const [form] = Form.useForm(); const [error, setError] = useState<string>(); const [pending, start] = useTransition();
  return <Card title="新增产品（保存后立即发布）"><Form form={form} layout="vertical" initialValues={{ status: "PUBLISHED", mediaIds: [] }} onValuesChange={(changed) => { const title = changed.translations?.en?.title as string | undefined; if (title && !form.getFieldValue("slug")) form.setFieldValue("slug", slugFromTitle(title)); }} onFinish={(value) => start(async () => {
    try { setError(undefined); await save({ ...value, mediaIds: value.mediaIds ?? [], scheduledAt: null, translations: collectTranslations(value.translations ?? {}), specifications: { coverMediaId: value.coverMediaId } }); form.resetFields(); Modal.success({ title: "发布成功", content: "产品已新增并成功发布。" }); }
    catch (reason) { const message = reason instanceof Error ? reason.message : "无法保存产品"; setError(message); Modal.error({ title: "发布失败", content: message }); }
  })} onFinishFailed={() => Modal.error({ title: "发布失败", content: "请检查并补全必填的产品信息。" })}>
    {error ? <p role="alert">{error}</p> : null}
    <Form.Item name="categoryId" label="分类" rules={[{ required: true }]}><Select options={categories.map((item) => ({ value: item.id, label: item.label }))} /></Form.Item>
    <Form.Item name={["translations", "en", "title"]} label="产品标题" rules={[{ required: true }]}><Input /></Form.Item>
    <ProductBodyField />
    <Form.Item name="mediaIds" hidden><Input /></Form.Item><PublishedMediaField form={form} multiple />
    <ProductCoverField form={form} /><Form.Item name="slug" hidden rules={[{ required: true }]}><Input /></Form.Item>
    <Form.Item name="status" hidden><Input /></Form.Item>
    <Button type="primary" htmlType="submit" loading={pending}>保存并发布产品</Button>
  </Form></Card>;
}

export function ArticleForm({ categories, tags, save }: { categories: Array<{ id: string; label: string }>; tags: Array<{ id: string; name: string }>; save: Action }) {
  const [form] = Form.useForm(); const [error, setError] = useState<string>(); const [pending, start] = useTransition();
  return <Card title="新增文章（保存后立即发布）"><Form form={form} layout="vertical" initialValues={{ status: "PUBLISHED", tagIds: [] }} onValuesChange={(changed) => { if (changed.status && changed.status !== "DRAFT") form.setFieldValue("scheduledAt", ""); }} onFinish={(value) => start(async () => {
    try { setError(undefined); await save({ ...value, coverMediaId: value.coverMediaId ?? null, scheduledAt: localDateTimeToIso(value.scheduledAt), translations: collectTranslations(value.translations ?? {}) }); form.resetFields(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "无法保存文章"); }
  })}>
    {error ? <p role="alert">{error}</p> : null}
    <Form.Item name="categoryId" label="分类" rules={[{ required: true }]}><Select options={categories.map((item) => ({ value: item.id, label: item.label }))} /></Form.Item>
    <Form.Item name="slug" label="路径标识（Slug）" rules={[{ required: true }]}><Input /></Form.Item>
    <Form.Item name="coverMediaId" hidden><Input /></Form.Item><PublishedMediaField form={form} multiple={false} />
    <Form.Item name="tagIds" label="标签"><Select mode="multiple" options={tags.map((item) => ({ value: item.id, label: item.name }))} /></Form.Item>
    <Form.Item name="status" hidden><Input /></Form.Item><TranslationTabs article />
    <Button type="primary" htmlType="submit" loading={pending}>保存并发布文章</Button>
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
  const [form] = Form.useForm(); const [pending, start] = useTransition(); const [error, setError] = useState<string>(); const [success, setSuccess] = useState<string>(); const [version, setVersion] = useState(initial.version);
  useEffect(() => { form.setFieldValue("scheduledAt", isoToLocalDateTime(initial.scheduledAt as string | null | undefined)); }, [form, initial.scheduledAt]);
  return <Card title={kind === "product" ? "编辑产品" : "编辑文章"}><Form form={form} layout="vertical" initialValues={{ ...initial, scheduledAt: "", translations: Object.fromEntries((initial.translations as Array<{ locale: string }>).map((item) => [item.locale, item])) }} onFinish={(value) => start(async () => {
    try { setError(undefined); setSuccess(undefined); const result = await save({ ...initial, ...value, version, translations: collectTranslations(value.translations ?? {}), mediaIds: kind === "product" ? value.mediaIds ?? [] : undefined, specifications: kind === "product" ? { ...((initial.specifications as object | undefined) ?? {}), coverMediaId: value.coverMediaId } : undefined, tagIds: kind === "article" ? value.tagIds ?? [] : undefined, coverMediaId: kind === "article" ? value.coverMediaId ?? null : undefined, scheduledAt: null }); if (typeof result === "object" && result !== null && "version" in result && typeof result.version === "string") setVersion(result.version); setSuccess("保存并发布成功"); if (kind === "product") Modal.success({ title: "发布成功", content: "产品修改已保存并成功发布。" }); }
    catch (reason) { const message = reason instanceof Error ? reason.message : "无法保存并发布内容"; setError(message); if (kind === "product") Modal.error({ title: "发布失败", content: message }); }
  })} onFinishFailed={kind === "product" ? () => Modal.error({ title: "发布失败", content: "请检查并补全必填的产品信息。" }) : undefined}>
    {error ? <p role="alert">{error}</p> : null}{success ? <p role="status">{success}</p> : null}<Form.Item name="categoryId" label="分类"><Select options={categories.map((item) => ({ value: item.id, label: item.label }))} /></Form.Item>
    {kind === "product" ? <><Form.Item name={["translations", "en", "title"]} label="产品标题" rules={[{ required: true }]}><Input /></Form.Item><ProductBodyField /><Form.Item name="mediaIds" hidden><Input /></Form.Item><PublishedMediaField form={form} multiple /><ProductCoverField form={form} /><Form.Item name="slug" hidden><Input /></Form.Item></> : <><Form.Item name="slug" label="Slug"><Input /></Form.Item><Form.Item name="coverMediaId" hidden><Input /></Form.Item><PublishedMediaField form={form} multiple={false} /><Form.Item name="tagIds" label="Tags"><Select mode="multiple" options={tags.map((item) => ({ value: item.id, label: item.name }))} /></Form.Item><TranslationTabs article /><SeoPreview form={form} /></>}
    <Form.Item name="status" hidden><Input /></Form.Item><Button type="primary" htmlType="submit" loading={pending}>保存并立即发布</Button>
  </Form></Card>;
}
