"use client";

import { Badge, Tabs } from "antd";
import { Input } from "antd";

import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/config";

const labels: Record<Locale, string> = { en: "英语", "zh-CN": "简体中文", de: "德语", fr: "法语", es: "西班牙语" };

export function translationFieldName(locale: Locale, field: string) {
  return `translations.${locale}.${field}`;
}

export function TranslationTabs({ completeLocales = [], values = {}, body = true }: { completeLocales?: readonly Locale[]; values?: Partial<Record<Locale, { title?: string; body?: string }>>; body?: boolean }) {
  const complete = new Set(completeLocales);
  return <Tabs items={SUPPORTED_LOCALES.map((locale) => ({
    key: locale,
    label: <span>{labels[locale]} {locale === "en" ? <Badge status="processing" text="必填" /> : <Badge status={complete.has(locale) ? "success" : "default"} />}</span>,
    children: <section lang={locale}><h2 className="sr-only">{labels[locale]}翻译</h2><label htmlFor={translationFieldName(locale, "title")}>标题</label><Input id={translationFieldName(locale, "title")} name={translationFieldName(locale, "title")} defaultValue={values[locale]?.title} />{body ? <><label htmlFor={translationFieldName(locale, "body")}>正文</label><Input.TextArea id={translationFieldName(locale, "body")} name={translationFieldName(locale, "body")} defaultValue={values[locale]?.body} rows={6} /></> : null}</section>,
  }))} />;
}
