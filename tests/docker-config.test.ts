import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const composePath = resolve(process.cwd(), "docker-compose.yml");

async function compose() {
  return readFile(composePath, "utf8");
}

async function deploymentFile(path: string) {
  return readFile(resolve(process.cwd(), path), "utf8");
}

describe("self-hosted Docker deployment", () => {
  it("keeps the database and object store on the private network", async () => {
    const config = await compose();

    expect(config).toContain("postgres:");
    expect(config).toContain("minio:");
    expect(config).toContain("postgres_data:");
    expect(config).toContain("minio_data:");
    expect(config).not.toMatch(/\n\s{4}(postgres|minio):[\s\S]*?\n\s{6}ports:/);
    expect(config).toMatch(/postgres:[\s\S]*?healthcheck:/);
    expect(config).toMatch(/minio:[\s\S]*?healthcheck:/);
  });

  it("exposes only Nginx and gates the application on healthy dependencies", async () => {
    const config = await compose();

    expect(config).toMatch(/nginx:[\s\S]*?\n\s{4}ports:/);
    expect(config).toMatch(/web:[\s\S]*?depends_on:[\s\S]*?postgres:[\s\S]*?condition: service_healthy/);
    expect(config).toMatch(/web:[\s\S]*?depends_on:[\s\S]*?minio:[\s\S]*?condition: service_healthy/);
    expect(config).toMatch(/migrate:[\s\S]*?command:.*prisma.*migrate.*deploy/);
  });

  it("defines lifecycle safety for every service", async () => {
    const config = await compose();

    for (const service of ["web", "postgres", "minio", "minio-init", "nginx", "migrate", "backup"]) {
      expect(config).toMatch(new RegExp(`${service}:[\\s\\S]*?logging:`));
    }

    expect(config).toMatch(/migrate:[\s\S]*?restart: "no"/);
    expect(config).toMatch(/minio-init:[\s\S]*?restart: "no"/);
    expect(config).toMatch(/backup:[\s\S]*?restart: unless-stopped/);
    expect(config).toContain("backup_data:");
    expect(config).toContain("internal: true");
    expect(config).toContain("INQUIRY_PROXY_MODE: nginx");
  });

  it("uses a signed private cron request and encrypted, explicitly confirmed restores", async () => {
    const [cron, backup, restore, nginx] = await Promise.all([
      deploymentFile("deploy/cron/runner.mjs"),
      deploymentFile("deploy/backup/backup.sh"),
      deploymentFile("deploy/backup/restore.sh"),
      deploymentFile("deploy/nginx/conf.d/site.conf"),
    ]);

    expect(cron).toContain('createHmac("sha256", secret)');
    expect(cron).toContain('http://web:3000');
    expect(backup).toContain("-aes-256-cbc");
    expect(backup).toContain("BACKUP_RETENTION_DAYS:-30");
    expect(backup).toContain("sha256sum backup.tar.gz.enc");
    expect(restore).toContain('RESTORE_CONFIRM" == "RESTORE"');
    expect(restore).toContain("sha256sum --check checksums.sha256");
    expect(nginx).toContain("client_max_body_size 20m");
    expect(nginx).toContain("Strict-Transport-Security");
  });
});
