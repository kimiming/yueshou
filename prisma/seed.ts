import argon2 from "argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  ContentLocale,
  LegalReviewStatus,
  PrismaClient,
  PublishStatus,
} from "@prisma/client";
import { createBootstrapAdmin, parseBootstrapAdmin } from "./bootstrap-admin";

function requiredSeedEnvironment(name: "DATABASE_URL"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required to seed the database`);
  }

  return value;
}

const databaseUrl = requiredSeedEnvironment("DATABASE_URL");
const bootstrapAdmin = parseBootstrapAdmin(process.env);

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

const locales: ContentLocale[] = [
  ContentLocale.en,
  ContentLocale.zh_CN,
  ContentLocale.de,
  ContentLocale.fr,
  ContentLocale.es,
];

const translated = (titles: Record<ContentLocale, string>, bodies: Record<ContentLocale, string>) =>
  locales.map((locale) => ({ locale, title: titles[locale], body: bodies[locale] }));

const legalPages = [
  {
    slug: "terms",
    translations: translated(
      { en: "Terms of Service", zh_CN: "服务条款", de: "Nutzungsbedingungen", fr: "Conditions d’utilisation", es: "Términos del servicio" },
      {
        en: "This draft page describes the terms for using YueShou’s website. It requires legal review before publication.",
        zh_CN: "此草稿页面说明使用 YueShou 网站的条款。发布前需要法律审核。",
        de: "Diese Entwurfsseite beschreibt die Bedingungen für die Nutzung der Website von YueShou. Vor der Veröffentlichung ist eine rechtliche Prüfung erforderlich.",
        fr: "Cette page de travail décrit les conditions d’utilisation du site YueShou. Elle nécessite un examen juridique avant publication.",
        es: "Esta página de borrador describe las condiciones de uso del sitio web de YueShou. Requiere revisión legal antes de su publicación.",
      },
    ),
  },
  {
    slug: "privacy",
    translations: translated(
      { en: "Privacy Policy", zh_CN: "隐私政策", de: "Datenschutzerklärung", fr: "Politique de confidentialité", es: "Política de privacidad" },
      {
        en: "This draft page describes how YueShou intends to handle website inquiries and consent records. It requires legal review before publication.",
        zh_CN: "此草稿页面说明 YueShou 拟如何处理网站询盘和同意记录。发布前需要法律审核。",
        de: "Diese Entwurfsseite beschreibt, wie YueShou Website-Anfragen und Einwilligungsnachweise behandeln möchte. Vor der Veröffentlichung ist eine rechtliche Prüfung erforderlich.",
        fr: "Cette page de travail décrit la manière dont YueShou prévoit de traiter les demandes du site et les preuves de consentement. Elle nécessite un examen juridique avant publication.",
        es: "Esta página de borrador describe cómo YueShou pretende tratar las consultas del sitio web y los registros de consentimiento. Requiere revisión legal antes de su publicación.",
      },
    ),
  },
  {
    slug: "ruo-policy",
    translations: translated(
      { en: "Research Use Only Policy", zh_CN: "仅限科研用途政策", de: "Richtlinie nur für Forschungszwecke", fr: "Politique réservée à la recherche", es: "Política solo para investigación" },
      {
        en: "YueShou website content is provided for scientific research discussions. Products must not be represented as intended for human diagnostic or therapeutic use.",
        zh_CN: "YueShou 网站内容用于科学研究交流。产品不得被表述为用于人体诊断或治疗。",
        de: "Die Inhalte der YueShou-Website dienen wissenschaftlichen Forschungsgesprächen. Produkte dürfen nicht als für diagnostische oder therapeutische Anwendungen am Menschen bestimmt dargestellt werden.",
        fr: "Le contenu du site YueShou est fourni pour les échanges liés à la recherche scientifique. Les produits ne doivent pas être présentés comme destinés au diagnostic ou au traitement humain.",
        es: "El contenido del sitio web de YueShou se proporciona para conversaciones sobre investigación científica. Los productos no deben presentarse como destinados al diagnóstico o tratamiento humano.",
      },
    ),
  },
  {
    slug: "shipping-compliance",
    translations: translated(
      { en: "Shipping and Compliance Notice", zh_CN: "运输与合规说明", de: "Versand- und Compliance-Hinweis", fr: "Avis d’expédition et de conformité", es: "Aviso de envío y cumplimiento" },
      {
        en: "Shipping options and compliance requirements depend on the order and destination. Customers are responsible for providing accurate order and delivery information.",
        zh_CN: "运输方式和合规要求取决于订单及目的地。客户负责提供准确的订单和交付信息。",
        de: "Versandoptionen und Compliance-Anforderungen hängen von Bestellung und Zielort ab. Kundinnen und Kunden sind für korrekte Bestell- und Lieferinformationen verantwortlich.",
        fr: "Les options d’expédition et les exigences de conformité dépendent de la commande et de la destination. Les clients sont responsables de l’exactitude des informations de commande et de livraison.",
        es: "Las opciones de envío y los requisitos de cumplimiento dependen del pedido y del destino. Los clientes son responsables de proporcionar información precisa sobre el pedido y la entrega.",
      },
    ),
  },
  {
    slug: "cookie-policy",
    translations: translated(
      { en: "Cookie Policy", zh_CN: "Cookie 政策", de: "Cookie-Richtlinie", fr: "Politique relative aux cookies", es: "Política de cookies" },
      {
        en: "This draft page describes necessary cookies and any optional analytics cookies. Visitors can change optional choices through the site’s cookie settings.",
        zh_CN: "此草稿页面说明必要 Cookie 和任何可选的分析 Cookie。访客可通过网站的 Cookie 设置更改可选选择。",
        de: "Diese Entwurfsseite beschreibt notwendige Cookies und optionale Analyse-Cookies. Besucher können optionale Einstellungen über die Cookie-Einstellungen der Website ändern.",
        fr: "Cette page de travail décrit les cookies nécessaires et les cookies analytiques facultatifs. Les visiteurs peuvent modifier leurs choix facultatifs dans les paramètres de cookies du site.",
        es: "Esta página de borrador describe las cookies necesarias y las cookies analíticas opcionales. Los visitantes pueden cambiar sus opciones en la configuración de cookies del sitio.",
      },
    ),
  },
] as const;

const navigation = [
  { slug: "about", href: "/about", position: 10, title: "About" },
  { slug: "services", href: "/services", position: 20, title: "Services" },
  { slug: "products", href: "/products", position: 30, title: "Products" },
  { slug: "quality", href: "/quality", position: 40, title: "Quality" },
  { slug: "news", href: "/news", position: 50, title: "News" },
  { slug: "contact", href: "/contact", position: 60, title: "Contact" },
] as const;

async function main() {
  if (bootstrapAdmin) {
    const passwordHash = await argon2.hash(bootstrapAdmin.password, { type: argon2.argon2id });
    await prisma.$transaction(
      (transaction) => createBootstrapAdmin(transaction, { email: bootstrapAdmin.email, passwordHash }),
      { isolationLevel: "Serializable" },
    );
  }

  const brand = await prisma.siteSetting.upsert({
    where: { key: "brand" },
    update: { status: PublishStatus.PUBLISHED, publishedAt: new Date(), deletedAt: null },
    create: { key: "brand", status: PublishStatus.PUBLISHED, publishedAt: new Date() },
  });

  await Promise.all(
    translated(
      { en: "YueShou", zh_CN: "YueShou", de: "YueShou", fr: "YueShou", es: "YueShou" },
      {
        en: "Precision Peptide Synthesis for Global Scientific Research",
        zh_CN: "面向全球科学研究的精准多肽合成",
        de: "Präzise Peptidsynthese für die globale wissenschaftliche Forschung",
        fr: "Synthèse peptidique de précision pour la recherche scientifique mondiale",
        es: "Síntesis precisa de péptidos para la investigación científica global",
      },
    ).map(({ locale, title, body }) =>
      prisma.siteSettingTranslation.upsert({
        where: { siteSettingId_locale: { siteSettingId: brand.id, locale } },
        update: { title, body },
        create: { siteSettingId: brand.id, locale, title, body },
      }),
    ),
  );

  for (const item of navigation) {
    const { title, ...navigationData } = item;
    const navigationItem = await prisma.navigationItem.upsert({
      where: { slug: item.slug },
      update: { href: item.href, position: item.position, isVisible: true, status: PublishStatus.PUBLISHED, deletedAt: null },
      create: { ...navigationData, status: PublishStatus.PUBLISHED, publishedAt: new Date() },
    });

    await Promise.all(
      locales.map((locale) =>
        prisma.navigationItemTranslation.upsert({
          where: { navigationItemId_locale: { navigationItemId: navigationItem.id, locale } },
          update: { title },
          create: { navigationItemId: navigationItem.id, locale, title },
        }),
      ),
    );
  }

  for (const legalPage of legalPages) {
    const page = await prisma.page.upsert({
      where: { slug: legalPage.slug },
      update: {},
      create: {
        slug: legalPage.slug,
        status: PublishStatus.DRAFT,
        legalReviewStatus: LegalReviewStatus.PENDING,
      },
    });

    await prisma.pageTranslation.createMany({
      data: legalPage.translations.map(({ locale, title, body }) => ({
        pageId: page.id,
        locale,
        title,
        body,
        seoTitle: title,
        seoDescription: body,
      })),
      skipDuplicates: true,
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    await prisma.$disconnect();
    throw error;
  });
