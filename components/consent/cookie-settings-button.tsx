"use client";

export function CookieSettingsButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="site-footer__cookie-settings"
      onClick={(event) => window.dispatchEvent(new CustomEvent("open-cookie-settings", { detail: event.currentTarget }))}
    >
      {label}
    </button>
  );
}
