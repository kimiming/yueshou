import { prisma } from "@/lib/db/prisma";

type CountRow = { count: number };
type TrendRow = { bucket: Date; views: number };
type DimensionRow = { name: string | null; views: number };
type RecentRow = { id: string; path: string; countryCode: string | null; deviceType: string; browser: string; viewedAt: Date };

const countSince = async (since?: Date) => {
  const rows = since
    ? await prisma.$queryRaw<CountRow[]>`SELECT count(*)::int AS count FROM "PageView" WHERE "viewedAt" >= ${since}`
    : await prisma.$queryRaw<CountRow[]>`SELECT count(*)::int AS count FROM "PageView"`;
  return rows[0]?.count ?? 0;
};

export async function getTrafficDashboard(now = new Date()) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const week = new Date(today); week.setUTCDate(week.getUTCDate() - 6);
  const month = new Date(today); month.setUTCDate(month.getUTCDate() - 29);
  const [todayViews, weekViews, monthViews, totalViews, trend, countries, devices, browsers, recent] = await Promise.all([
    countSince(today), countSince(week), countSince(month), countSince(),
    prisma.$queryRaw<TrendRow[]>`
      SELECT date_trunc('day', "viewedAt") AS bucket, count(*)::int AS views
      FROM "PageView" WHERE "viewedAt" >= ${month}
      GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<DimensionRow[]>`
      SELECT "countryCode" AS name, count(*)::int AS views FROM "PageView"
      WHERE "viewedAt" >= ${month} GROUP BY 1 ORDER BY views DESC LIMIT 10`,
    prisma.$queryRaw<DimensionRow[]>`
      SELECT "deviceType" AS name, count(*)::int AS views FROM "PageView"
      WHERE "viewedAt" >= ${month} GROUP BY 1 ORDER BY views DESC`,
    prisma.$queryRaw<DimensionRow[]>`
      SELECT browser AS name, count(*)::int AS views FROM "PageView"
      WHERE "viewedAt" >= ${month} GROUP BY 1 ORDER BY views DESC`,
    prisma.$queryRaw<RecentRow[]>`
      SELECT id, path, "countryCode", "deviceType", browser, "viewedAt"
      FROM "PageView" ORDER BY "viewedAt" DESC LIMIT 12`,
  ]);
  const byDate = new Map(trend.map((item) => [item.bucket.toISOString().slice(0, 10), item.views]));
  const days = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(month); date.setUTCDate(date.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    return { date: key, views: byDate.get(key) ?? 0 };
  });
  return {
    stats: { today: todayViews, week: weekViews, month: monthViews, total: totalViews },
    trend: days,
    countries: countries.map((item) => ({ name: item.name ?? "Unknown", value: item.views })),
    devices: devices.map((item) => ({ name: item.name ?? "Unknown", value: item.views })),
    browsers: browsers.map((item) => ({ name: item.name ?? "Unknown", value: item.views })),
    recent: recent.map((item) => ({ ...item, viewedAt: item.viewedAt.toISOString() })),
  };
}

export type TrafficDashboardData = Awaited<ReturnType<typeof getTrafficDashboard>>;
