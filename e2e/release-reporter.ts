import type { FullResult, Reporter, TestCase, TestResult } from "@playwright/test/reporter";

export default class ReleaseReporter implements Reporter {
  private skipped = 0;
  onTestEnd(_test: TestCase, result: TestResult) { if (result.status === "skipped") this.skipped++; }
  async onEnd(result: FullResult) {
    if (process.env.E2E_REQUIRED === "1" && this.skipped > 0 && result.status === "passed") return { status: "failed" as const };
  }
}
