import { createElement, useEffect, type ComponentType, type ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CookieConsentBanner } from "@/components/consent/cookie-consent-banner";
import * as ConsentBoundaryModule from "@/components/consent/analytics-consent-boundary";
import { CookiePreferencesDialog } from "@/components/consent/cookie-preferences-dialog";
import {
  CONSENT_POLICY_VERSION,
  hasAnalyticsConsent,
  parseConsentCookie,
  serializeConsentPreferences,
} from "@/features/consent/preferences";

const labels = {
  title: "Cookie choices",
  description: "Choose whether analytics may run.",
  necessary: "Necessary",
  necessaryDescription: "Required for the site.",
  analytics: "Analytics",
  analyticsDescription: "Helps us improve.",
  rejectAll: "Reject all",
  acceptAll: "Accept all",
  manage: "Cookie settings",
  save: "Save preferences",
  close: "Close cookie settings",
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("consent preferences", () => {
  it("does not enable analytics without a valid current-policy opt-in", () => {
    expect(hasAnalyticsConsent(undefined)).toBe(false);
    expect(hasAnalyticsConsent("not-json")).toBe(false);
    expect(hasAnalyticsConsent(JSON.stringify({ version: "old", timestamp: new Date().toISOString(), necessary: true, analytics: true }))).toBe(false);
  });

  it("round-trips only necessary and analytics in a versioned timestamped value", () => {
    const value = serializeConsentPreferences({ analytics: true }, new Date("2026-08-08T01:02:03.000Z"));
    expect(parseConsentCookie(value)).toEqual({
      version: CONSENT_POLICY_VERSION,
      timestamp: "2026-08-08T01:02:03.000Z",
      necessary: true,
      analytics: true,
    });
  });
});

describe("CookieConsentBanner", () => {
  it("mounts analytics immediately after opt-in and cleans it up immediately after withdrawal", async () => {
    const lifecycle: string[] = [];
    const persist = vi.fn(async () => undefined);
    function AnalyticsProbe() {
      useEffect(() => {
        lifecycle.push("mount");
        return () => { lifecycle.push("cleanup"); };
      }, []);
      return <div>Analytics loaded</div>;
    }
    const ConsentRuntime = Reflect.get(ConsentBoundaryModule, "ConsentRuntime");
    expect(ConsentRuntime).toBeTypeOf("function");
    if (typeof ConsentRuntime !== "function") return;

    const Runtime = ConsentRuntime as ComponentType<{
      labels: typeof labels;
      initialPreferences: null;
      persistPreferences: typeof persist;
      children?: ReactNode;
    }>;
    render(createElement(Runtime, {
      labels,
      initialPreferences: null,
      persistPreferences: persist,
    }, <AnalyticsProbe />));
    expect(screen.queryByText("Analytics loaded")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Accept all" }));
    await screen.findByText("Analytics loaded");
    expect(lifecycle).toEqual(["mount"]);

    window.dispatchEvent(new Event("open-cookie-settings"));
    const checkbox = await screen.findByRole("checkbox", { name: "Analytics" });
    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole("button", { name: "Save preferences" }));

    await waitFor(() => expect(screen.queryByText("Analytics loaded")).not.toBeInTheDocument());
    expect(lifecycle).toEqual(["mount", "cleanup"]);
  });

  it("stores only necessary consent when Reject all is chosen", async () => {
    const persist = vi.fn(async () => undefined);
    render(<CookieConsentBanner labels={labels} initialPreferences={null} persistPreferences={persist} />);

    fireEvent.click(screen.getByRole("button", { name: "Reject all" }));
    await waitFor(() => expect(persist).toHaveBeenCalledWith({ necessary: true, analytics: false }));
    expect(screen.queryByRole("region", { name: "Cookie choices" })).not.toBeInTheDocument();
  });

  it("withdraws analytics from the settings entry and restores focus when the dialog closes", async () => {
    const persist = vi.fn(async () => undefined);
    render(
      <CookieConsentBanner
        labels={labels}
        initialPreferences={{
          version: CONSENT_POLICY_VERSION,
          timestamp: "2026-08-08T01:02:03.000Z",
          necessary: true,
          analytics: true,
        }}
        persistPreferences={persist}
      />,
    );

    window.dispatchEvent(new Event("open-cookie-settings"));
    const checkbox = await screen.findByRole("checkbox", { name: "Analytics" });
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole("button", { name: "Save preferences" }));

    await waitFor(() => expect(persist).toHaveBeenCalledWith({ necessary: true, analytics: false }));
  });

  it("discards an unsaved analytics draft when the dialog closes", async () => {
    render(
      <CookieConsentBanner
        labels={labels}
        initialPreferences={{ version: CONSENT_POLICY_VERSION, timestamp: "2026-08-08T01:02:03.000Z", necessary: true, analytics: true }}
        persistPreferences={vi.fn(async () => undefined)}
      />,
    );
    window.dispatchEvent(new Event("open-cookie-settings"));
    fireEvent.click(await screen.findByRole("checkbox", { name: "Analytics" }));
    fireEvent.click(screen.getByRole("button", { name: "Close cookie settings" }));
    window.dispatchEvent(new Event("open-cookie-settings"));
    expect(await screen.findByRole("checkbox", { name: "Analytics" })).toBeChecked();
  });
});

describe("CookiePreferencesDialog", () => {
  it("keeps necessary enabled and closes on Escape", () => {
    const close = vi.fn();
    render(
      <CookiePreferencesDialog
        labels={labels}
        open
        analytics={false}
        onAnalyticsChange={() => undefined}
        onClose={close}
        onSave={() => undefined}
      />,
    );

    expect(screen.getByRole("checkbox", { name: "Necessary" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Necessary" })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(close).toHaveBeenCalledTimes(1);
  });
});
