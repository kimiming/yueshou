import { describe, expect, it } from "vitest";

import { parseBootstrapAdmin } from "../prisma/bootstrap-admin";

const valid = {
  INITIAL_ADMIN_EMAIL: "admin@yueshou.test",
  INITIAL_ADMIN_PASSWORD: "Strong!Passw0rd",
  BOOTSTRAP_ADMIN_CONFIRM: "I_UNDERSTAND_BOOTSTRAP_ADMIN",
};

describe("seed administrator bootstrap", () => {
  it("allows content-only seed when no bootstrap values were supplied", () => {
    expect(parseBootstrapAdmin({ NODE_ENV: "production" })).toBeNull();
  });

  it("requires a complete, explicitly confirmed, strong administrator credential set", () => {
    expect(parseBootstrapAdmin({ ...valid, NODE_ENV: "production" })).toEqual({ email: valid.INITIAL_ADMIN_EMAIL, password: valid.INITIAL_ADMIN_PASSWORD });
    expect(() => parseBootstrapAdmin({ ...valid, NODE_ENV: "production", BOOTSTRAP_ADMIN_CONFIRM: "yes" })).toThrow("BOOTSTRAP_ADMIN_CONFIRM");
    expect(() => parseBootstrapAdmin({ ...valid, NODE_ENV: "production", INITIAL_ADMIN_EMAIL: "not-an-email" })).toThrow("INITIAL_ADMIN_EMAIL");
    expect(() => parseBootstrapAdmin({ ...valid, NODE_ENV: "production", INITIAL_ADMIN_PASSWORD: "replace-me" })).toThrow("INITIAL_ADMIN_PASSWORD");
    expect(() => parseBootstrapAdmin({ ...valid, NODE_ENV: "production", INITIAL_ADMIN_PASSWORD: "Weakpass" })).toThrow("INITIAL_ADMIN_PASSWORD");
    expect(() => parseBootstrapAdmin({ NODE_ENV: "production", INITIAL_ADMIN_EMAIL: valid.INITIAL_ADMIN_EMAIL })).toThrow("INITIAL_ADMIN_PASSWORD");
  });
});
