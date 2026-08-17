"use client";

import { Tooltip } from "antd";

import type { Locale } from "@/lib/i18n/config";

export const WHATSAPP_HREF = "https://wa.me/+8613438855558";

export function WhatsAppFloat({ locale, href }: { locale: Locale; href?: string }) {
  const label = locale === "zh-CN" ? "通过 WhatsApp 联系客服" : "Contact us on WhatsApp";
  if (!href) return null;

  return (
    <Tooltip title={label} placement="left">
      <a
        className="whatsapp-float"
        href={WHATSAPP_HREF}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
      >
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path
            fill="currentColor"
            d="M16.01 3A12.8 12.8 0 0 0 5.13 22.55L3 29l6.66-2.08A12.9 12.9 0 1 0 16.01 3Zm0 2.58a10.3 10.3 0 1 1-5.25 19.17l-.64-.38-3.84 1.2 1.23-3.72-.42-.66a10.2 10.2 0 0 1-1.58-5.48A10.42 10.42 0 0 1 16.01 5.58Zm-4.54 4.34c-.2 0-.52.08-.8.38-.27.3-1.05 1.03-1.05 2.52 0 1.48 1.08 2.92 1.23 3.12.15.2 2.1 3.35 5.17 4.56 2.55 1 3.07.8 3.62.75.56-.05 1.8-.74 2.05-1.45.25-.72.25-1.34.18-1.47-.08-.12-.28-.2-.59-.35-.3-.15-1.8-.89-2.08-.99-.28-.1-.48-.15-.68.15-.2.3-.78.99-.96 1.19-.18.2-.35.22-.66.07-.3-.15-1.28-.47-2.44-1.51a9.15 9.15 0 0 1-1.69-2.1c-.17-.31-.02-.47.14-.62.13-.13.3-.35.45-.53.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.64-.93-2.24-.24-.58-.5-.5-.68-.51Z"
          />
        </svg>
      </a>
    </Tooltip>
  );
}
