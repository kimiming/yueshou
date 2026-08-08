import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { parse } from "yaml";
import { describe, expect, it } from "vitest";

type Service = Record<string, unknown>;
type Compose = { services: Record<string, Service>; networks: Record<string, Record<string, unknown>>; volumes: Record<string, unknown> };

async function compose(): Promise<Compose> {
  return parse(await readFile(resolve(process.cwd(), "docker-compose.yml"), "utf8")) as Compose;
}

async function deploymentFile(path: string) {
  return readFile(resolve(process.cwd(), path), "utf8");
}

function environment(service: Service) {
  return service.environment as Record<string, string>;
}

describe("self-hosted Docker deployment", () => {
  it("keeps all stateful services private and exposes only Nginx", async () => {
    const config = await compose();

    expect(Object.keys(config.services)).toEqual(expect.arrayContaining(["web", "postgres", "minio", "minio-init", "migrate", "cron", "backup", "nginx"]));
    expect(config.services.nginx.ports).toEqual(["80:80", "443:443"]);
    expect(config.services.postgres.ports).toBeUndefined();
    expect(config.services.minio.ports).toBeUndefined();
    expect(Object.keys(config.volumes)).toEqual(expect.arrayContaining(["postgres_data", "minio_data", "backup_data", "operations_lock"]));
    expect(config.networks.private.internal).toBe(true);
    expect(config.services.postgres.healthcheck).toBeDefined();
    expect(config.services.minio.healthcheck).toBeDefined();
  });

  it("uses minimal per-service environments and correct dependency lifecycles", async () => {
    const config = await compose();
    const { web, migrate, cron, backup, minio, "minio-init": minioInit } = config.services;

    expect(environment(web)).toEqual(expect.objectContaining({ INQUIRY_PROXY_MODE: "nginx", STORAGE_ENDPOINT: "https://${STORAGE_HOST:?Set STORAGE_HOST in .env.docker}" }));
    expect(environment(web)).not.toHaveProperty("MINIO_ROOT_PASSWORD");
    expect(environment(web)).not.toHaveProperty("BACKUP_ENCRYPTION_PASSPHRASE");
    expect(environment(migrate)).not.toHaveProperty("AUTH_SECRET");
    expect(environment(cron)).toEqual({ INTERNAL_APP_URL: "http://web:3000", CRON_SECRET: "${CRON_SECRET:?Set CRON_SECRET in .env.docker}", CRON_INTERVAL_SECONDS: "${CRON_INTERVAL_SECONDS:-300}" });
    expect(environment(backup)).toEqual(expect.objectContaining({ STORAGE_ENDPOINT: "http://minio:9000", BACKUP_ENCRYPTION_PASSPHRASE: "${BACKUP_ENCRYPTION_PASSPHRASE:?Set BACKUP_ENCRYPTION_PASSPHRASE in .env.docker}" }));
    expect(environment(minio)).toEqual(expect.objectContaining({ MINIO_ROOT_USER: "${MINIO_ROOT_USER:?Set MINIO_ROOT_USER in .env.docker}" }));
    expect(environment(minioInit)).toEqual(expect.objectContaining({ MINIO_ROOT_PASSWORD: "${MINIO_ROOT_PASSWORD:?Set MINIO_ROOT_PASSWORD in .env.docker}" }));
    expect(web.depends_on).toEqual(expect.objectContaining({ postgres: { condition: "service_healthy" }, minio: { condition: "service_healthy" }, "minio-init": { condition: "service_completed_successfully" }, migrate: { condition: "service_completed_successfully" } }));
    expect(migrate.command).toEqual(["pnpm", "exec", "prisma", "migrate", "deploy"]);
    expect(migrate.restart).toBe("no");
    expect(minioInit.restart).toBe("no");
    expect(backup.restart).toBe("unless-stopped");
  });

  it("uses a single shared lock for media deletion and physical backups", async () => {
    const config = await compose();
    const [cronScript, backupScript] = await Promise.all([
      deploymentFile("deploy/ops/cron-runner.sh"),
      deploymentFile("deploy/backup/backup.sh"),
    ]);

    expect(config.services.cron.volumes).toContain("operations_lock:/operations-lock");
    expect(config.services.backup.volumes).toContain("operations_lock:/operations-lock");
    expect(cronScript).toContain("flock -s /operations-lock/media-deletion.lock");
    expect(backupScript).toContain("flock -x 9");
    expect(backupScript).toContain("snapshot_order=postgres_then_minio_under_exclusive_lock");
  });

  it("uses a complete encrypted backup and a deliberately explicit restore", async () => {
    const [backup, restore, restorePowerShell] = await Promise.all([
      deploymentFile("deploy/backup/backup.sh"),
      deploymentFile("deploy/backup/restore.sh"),
      deploymentFile("deploy/backup/restore.ps1"),
    ]);

    expect(backup).toContain("COMPLETE");
    expect(backup).toContain("mv -T");
    expect(backup).toContain("sha256sum --check checksums.sha256");
    expect(backup).toContain("-aes-256-cbc");
    expect(restore).toContain('RESTORE_CONFIRM" == "RESTORE"');
    expect(restore).toContain("COMPLETE");
    expect(restore).toContain("tar -tzf");
    expect(restorePowerShell).toContain("--entrypoint /backup/restore.sh");
    expect(restorePowerShell).toContain("backup $BackupDirectory");
  });

  it("uses a traced standalone runtime without hard-coded Prisma paths", async () => {
    const dockerfile = await deploymentFile("Dockerfile");
    expect(dockerfile).toContain("/app/.next/standalone");
    expect(dockerfile).not.toContain("node_modules/.prisma");
    expect(dockerfile).not.toContain("node_modules/@prisma");
    await expect(access(resolve(process.cwd(), "deploy/ops/cron-runner.sh"))).resolves.toBeUndefined();
    await expect(access(resolve(process.cwd(), "deploy/nginx/templates/site.conf.template"))).resolves.toBeUndefined();
  });

  it("preserves HTTPS security headers while routing the S3 hostname privately", async () => {
    const [template, securityHeaders] = await Promise.all([
      deploymentFile("deploy/nginx/templates/site.conf.template"),
      deploymentFile("deploy/nginx/snippets/security-headers.conf"),
    ]);
    expect(template).toContain("server_name ${SERVER_NAME};");
    expect(template).toContain("server_name ${STORAGE_HOST};");
    expect(template).toContain("proxy_pass http://yueshou_minio;");
    expect(template).toContain("client_max_body_size 20m");
    expect(template).toContain("include /etc/nginx/snippets/security-headers.conf;");
    expect(template).toContain("Cache-Control \"public, max-age=31536000, immutable\"");
    expect(securityHeaders).toContain("Strict-Transport-Security");
    expect(securityHeaders).toContain("X-Content-Type-Options");
    expect(template).toContain("location /_next/static/");
  });
});
