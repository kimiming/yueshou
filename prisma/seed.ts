import argon2 from "argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  ContentLocale,
  LegalReviewStatus,
  PageSectionType,
  Prisma,
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

const corePages = [
  {
    slug: "home",
    translations: translated(
      { en: "Precision Peptide Research", zh_CN: "精准多肽研究", de: "Präzise Peptidforschung", fr: "Recherche peptidique de précision", es: "Investigación peptídica de precisión" },
      {
        en: "Peptide synthesis and analytical support for scientific research programs.",
        zh_CN: "为科学研究项目提供多肽合成与分析支持。",
        de: "Peptidsynthese und analytische Unterstützung für wissenschaftliche Forschungsprogramme.",
        fr: "Synthèse peptidique et soutien analytique pour les programmes de recherche scientifique.",
        es: "Síntesis de péptidos y apoyo analítico para programas de investigación científica.",
      },
    ),
  },
  {
    slug: "about",
    translations: translated(
      { en: "About YueShou", zh_CN: "关于悦寿", de: "Über YueShou", fr: "À propos de YueShou", es: "Acerca de YueShou" },
      {
        en: "Learn about our research-focused peptide workflow and collaboration approach.",
        zh_CN: "了解我们面向科研的多肽工作流程与合作方式。",
        de: "Erfahren Sie mehr über unseren forschungsorientierten Peptid-Workflow und unsere Zusammenarbeit.",
        fr: "Découvrez notre flux de travail peptidique axé sur la recherche et notre approche collaborative.",
        es: "Conozca nuestro flujo de trabajo de péptidos orientado a la investigación y nuestro enfoque colaborativo.",
      },
    ),
  },
  {
    slug: "services",
    translations: translated(
      { en: "Services", zh_CN: "服务", de: "Dienstleistungen", fr: "Services", es: "Servicios" },
      {
        en: "Explore configurable peptide synthesis, modification, analysis, and project support.",
        zh_CN: "了解可配置的多肽合成、修饰、分析与项目支持。",
        de: "Entdecken Sie konfigurierbare Peptidsynthese, Modifikation, Analytik und Projektunterstützung.",
        fr: "Découvrez la synthèse, la modification, l’analyse et le soutien de projet configurables.",
        es: "Explore síntesis, modificación, análisis y apoyo de proyectos configurables.",
      },
    ),
  },
  {
    slug: "products",
    translations: translated(
      { en: "Products", zh_CN: "产品", de: "Produkte", fr: "Produits", es: "Productos" },
      {
        en: "Browse research peptide categories and available catalog information.",
        zh_CN: "浏览科研多肽分类与可用的目录信息。",
        de: "Durchsuchen Sie Forschungspeptid-Kategorien und verfügbare Kataloginformationen.",
        fr: "Parcourez les catégories de peptides de recherche et les informations de catalogue disponibles.",
        es: "Explore categorías de péptidos de investigación e información de catálogo disponible.",
      },
    ),
  },
  {
    slug: "quality",
    translations: translated(
      { en: "Quality", zh_CN: "质量", de: "Qualität", fr: "Qualité", es: "Calidad" },
      {
        en: "Review the quality controls and analytical information available for research projects.",
        zh_CN: "了解科研项目可用的质量控制与分析信息。",
        de: "Informieren Sie sich über Qualitätskontrollen und analytische Informationen für Forschungsprojekte.",
        fr: "Consultez les contrôles qualité et les informations analytiques disponibles pour les projets de recherche.",
        es: "Revise los controles de calidad y la información analítica disponible para proyectos de investigación.",
      },
    ),
  },
  {
    slug: "news",
    translations: translated(
      { en: "News", zh_CN: "新闻", de: "Neuigkeiten", fr: "Actualités", es: "Noticias" },
      {
        en: "Read updates about peptide research support and company activities.",
        zh_CN: "阅读多肽科研支持与公司动态。",
        de: "Lesen Sie Neuigkeiten über Peptidforschungsunterstützung und Unternehmensaktivitäten.",
        fr: "Lisez les actualités sur le soutien à la recherche peptidique et les activités de l’entreprise.",
        es: "Lea novedades sobre apoyo a la investigación de péptidos y actividades de la empresa.",
      },
    ),
  },
  {
    slug: "contact",
    translations: translated(
      { en: "Contact", zh_CN: "联系我们", de: "Kontakt", fr: "Contact", es: "Contacto" },
      {
        en: "Contact YueShou to discuss a scientific research requirement.",
        zh_CN: "联系悦寿，讨论您的科学研究需求。",
        de: "Kontaktieren Sie YueShou, um eine wissenschaftliche Forschungsanforderung zu besprechen.",
        fr: "Contactez YueShou pour discuter d’un besoin de recherche scientifique.",
        es: "Contacte con YueShou para hablar de una necesidad de investigación científica.",
      },
    ),
  },
  {
    slug: "request-a-quote",
    translations: translated(
      { en: "Request a Quote", zh_CN: "申请报价", de: "Angebot anfordern", fr: "Demander un devis", es: "Solicitar presupuesto" },
      {
        en: "Share your research requirements so our team can prepare a project discussion.",
        zh_CN: "提交您的科研需求，以便我们的团队准备项目沟通。",
        de: "Teilen Sie Ihre Forschungsanforderungen mit, damit unser Team ein Projektgespräch vorbereiten kann.",
        fr: "Partagez vos besoins de recherche afin que notre équipe prépare un échange sur votre projet.",
        es: "Comparta sus requisitos de investigación para que nuestro equipo prepare una conversación sobre el proyecto.",
      },
    ),
  },
] as const;

const serviceSeeds = [
  {
    slug: "custom-peptide-synthesis",
    position: 10,
    translations: translated(
      { en: "Custom Peptide Synthesis", zh_CN: "定制多肽合成", de: "Kundenspezifische Peptidsynthese", fr: "Synthèse peptidique sur mesure", es: "Síntesis personalizada de péptidos" },
      {
        en: "Configurable peptide synthesis support for scientific research requirements.",
        zh_CN: "为科学研究需求提供可配置的多肽合成支持。",
        de: "Konfigurierbare Peptidsynthese-Unterstützung für wissenschaftliche Forschungsanforderungen.",
        fr: "Soutien configurable à la synthèse peptidique pour les besoins de recherche scientifique.",
        es: "Apoyo configurable de síntesis de péptidos para requisitos de investigación científica.",
      },
    ),
  },
  {
    slug: "peptide-modification",
    position: 20,
    translations: translated(
      { en: "Peptide Modification", zh_CN: "多肽修饰", de: "Peptidmodifikation", fr: "Modification peptidique", es: "Modificación de péptidos" },
      {
        en: "Discuss research-oriented peptide modification options with the project team.",
        zh_CN: "与项目团队讨论面向科研的多肽修饰方案。",
        de: "Besprechen Sie forschungsorientierte Peptidmodifikationen mit dem Projektteam.",
        fr: "Discutez des options de modification peptidique pour la recherche avec l’équipe projet.",
        es: "Analice opciones de modificación de péptidos para investigación con el equipo del proyecto.",
      },
    ),
  },
  {
    slug: "analytical-support",
    position: 30,
    translations: translated(
      { en: "Analytical Support", zh_CN: "分析支持", de: "Analytische Unterstützung", fr: "Soutien analytique", es: "Apoyo analítico" },
      {
        en: "Analytical information and documentation support can be aligned with project needs.",
        zh_CN: "分析信息与文件支持可根据项目需求进行配置。",
        de: "Analytische Informationen und Dokumentation können auf Projektanforderungen abgestimmt werden.",
        fr: "Les informations analytiques et la documentation peuvent être adaptées aux besoins du projet.",
        es: "La información analítica y la documentación pueden adaptarse a las necesidades del proyecto.",
      },
    ),
  },
  {
    slug: "project-consultation",
    position: 40,
    translations: translated(
      { en: "Project Consultation", zh_CN: "项目咨询", de: "Projektberatung", fr: "Conseil de projet", es: "Consultoría de proyectos" },
      {
        en: "Start a technical discussion about sequence, scale, timeline, and research documentation.",
        zh_CN: "围绕序列、规模、周期与科研文件开展技术沟通。",
        de: "Beginnen Sie ein technisches Gespräch über Sequenz, Maßstab, Zeitplan und Forschungsdokumentation.",
        fr: "Démarrez un échange technique sur la séquence, l’échelle, le calendrier et la documentation de recherche.",
        es: "Inicie una conversación técnica sobre secuencia, escala, calendario y documentación de investigación.",
      },
    ),
  },
] as const;

const corePageTranslations = (slug: string) => corePages.find((page) => page.slug === slug)!.translations;

const homeSectionSeeds = [
  { type: PageSectionType.HERO, config: { primaryCta: { label: "Request a quote", href: "/request-a-quote" }, secondaryCta: { label: "Explore services", href: "/services" } }, translations: corePageTranslations("home") },
  { type: PageSectionType.SERVICES, config: {}, translations: corePageTranslations("services") },
  { type: PageSectionType.ABOUT, config: {}, translations: corePageTranslations("about") },
  { type: PageSectionType.CAPABILITIES, config: {}, translations: translated(
    { en: "Research Capabilities", zh_CN: "科研能力", de: "Forschungskapazitäten", fr: "Capacités de recherche", es: "Capacidades de investigación" },
    { en: "Configure project requirements with our peptide research team.", zh_CN: "与我们的多肽科研团队配置项目需求。", de: "Konfigurieren Sie Projektanforderungen mit unserem Peptidforschungsteam.", fr: "Configurez les besoins du projet avec notre équipe de recherche peptidique.", es: "Configure los requisitos del proyecto con nuestro equipo de investigación de péptidos." },
  ) },
  { type: PageSectionType.QUALITY, config: {}, translations: corePageTranslations("quality") },
  { type: PageSectionType.STATS, config: { items: [] }, translations: translated(
    { en: "Project Information", zh_CN: "项目信息", de: "Projektinformationen", fr: "Informations projet", es: "Información del proyecto" },
    { en: "Replace these editable placeholders with verified operating information.", zh_CN: "请使用经核实的运营信息替换这些可编辑占位内容。", de: "Ersetzen Sie diese bearbeitbaren Platzhalter durch geprüfte Betriebsinformationen.", fr: "Remplacez ces éléments modifiables par des informations opérationnelles vérifiées.", es: "Sustituya estos elementos editables por información operativa verificada." },
  ) },
  { type: PageSectionType.NEWS, config: { count: 3 }, translations: corePageTranslations("news") },
  { type: PageSectionType.CTA, config: { primaryCta: { label: "Request a quote", href: "/request-a-quote" } }, translations: corePageTranslations("request-a-quote") },
] as const;

const navigation = [
  { slug: "about", href: "/about", position: 10, title: "About" },
  { slug: "services", href: "/services", position: 20, title: "Services" },
  { slug: "products", href: "/products", position: 30, title: "Products" },
  { slug: "quality", href: "/quality", position: 40, title: "Quality" },
  { slug: "news", href: "/news", position: 50, title: "News" },
  { slug: "contact", href: "/contact", position: 60, title: "Contact" },
] as const;

const pageTranslationData = (translations: ReturnType<typeof translated>) => translations.map(({ locale, title, body }) => ({
  locale,
  title,
  body,
  seoTitle: title,
  seoDescription: body,
}));

async function seedServices(seededAt: Date) {
  const seeded = [] as Array<{ id: string; slug: string; position: number; status: PublishStatus; deletedAt: Date | null }>;
  for (const serviceSeed of serviceSeeds) {
    const existing = await prisma.service.findUnique({
      where: { slug: serviceSeed.slug },
      select: { id: true, slug: true, position: true, status: true, deletedAt: true },
    });
    if (existing) {
      seeded.push(existing);
      continue;
    }
    seeded.push(await prisma.service.create({
      data: {
        slug: serviceSeed.slug,
        position: serviceSeed.position,
        status: PublishStatus.PUBLISHED,
        publishedAt: seededAt,
        translations: {
          create: serviceSeed.translations.map(({ locale, title, body }) => ({ locale, title, body })),
        },
      },
      select: { id: true, slug: true, position: true, status: true, deletedAt: true },
    }));
  }
  return seeded;
}

async function seedCorePages(seededAt: Date) {
  const seeded = new Map<string, { id: string }>();
  for (const pageSeed of corePages) {
    const existing = await prisma.page.findUnique({ where: { slug: pageSeed.slug }, select: { id: true } });
    if (existing) {
      seeded.set(pageSeed.slug, existing);
      continue;
    }
    const created = await prisma.page.create({
      data: {
        slug: pageSeed.slug,
        status: PublishStatus.PUBLISHED,
        publishedAt: seededAt,
        translations: { create: pageTranslationData([...pageSeed.translations]) },
      },
      select: { id: true },
    });
    seeded.set(pageSeed.slug, created);
  }
  return seeded;
}

async function seedHomeSections(homePageId: string, serviceIds: string[], seededAt: Date) {
  const existing = await prisma.pageSection.findMany({
    where: { pageId: homePageId },
    select: { type: true, position: true },
  });
  const existingTypes = new Set(existing.map((section) => section.type));
  let nextPosition = existing.reduce((highest, section) => Math.max(highest, section.position), -1) + 1;

  for (const sectionSeed of homeSectionSeeds) {
    if (existingTypes.has(sectionSeed.type)) continue;
    const config = sectionSeed.type === PageSectionType.SERVICES
      ? { serviceIds }
      : sectionSeed.config;
    await prisma.pageSection.create({
      data: {
        pageId: homePageId,
        type: sectionSeed.type,
        position: nextPosition,
        isEnabled: true,
        config: config as Prisma.InputJsonValue,
        status: PublishStatus.PUBLISHED,
        publishedAt: seededAt,
        translations: {
          create: sectionSeed.translations.map(({ locale, title, body }) => ({ locale, title, body })),
        },
      },
    });
    existingTypes.add(sectionSeed.type);
    nextPosition += 1;
  }
}

async function main() {
  if (bootstrapAdmin) {
    const passwordHash = await argon2.hash(bootstrapAdmin.password, { type: argon2.argon2id });
    await prisma.$transaction(
      (transaction) => createBootstrapAdmin(transaction, { email: bootstrapAdmin.email, passwordHash }),
      { isolationLevel: "Serializable" },
    );
  }

  const seededAt = new Date();
  const brandTranslations = translated(
      { en: "YueShou", zh_CN: "YueShou", de: "YueShou", fr: "YueShou", es: "YueShou" },
      {
        en: "Precision Peptide Synthesis for Global Scientific Research",
        zh_CN: "面向全球科学研究的精准多肽合成",
        de: "Präzise Peptidsynthese für die globale wissenschaftliche Forschung",
        fr: "Synthèse peptidique de précision pour la recherche scientifique mondiale",
        es: "Síntesis precisa de péptidos para la investigación científica global",
      },
    );
  const existingBrand = await prisma.siteSetting.findUnique({ where: { key: "brand" }, select: { id: true } });
  if (!existingBrand) {
    await prisma.siteSetting.create({
      data: {
        key: "brand",
        status: PublishStatus.PUBLISHED,
        publishedAt: seededAt,
        translations: {
          create: brandTranslations.map(({ locale, title, body }) => ({ locale, title, body })),
        },
      },
    });
  }

  for (const item of navigation) {
    const { title, ...navigationData } = item;
    const existingNavigation = await prisma.navigationItem.findUnique({ where: { slug: item.slug }, select: { id: true } });
    if (existingNavigation) continue;
    await prisma.navigationItem.create({
      data: {
        ...navigationData,
        status: PublishStatus.PUBLISHED,
        publishedAt: seededAt,
        translations: { create: locales.map((locale) => ({ locale, title })) },
      },
    });
  }

  const services = await seedServices(seededAt);
  const pages = await seedCorePages(seededAt);
  const home = pages.get("home");
  if (!home) throw new Error("The home page seed is missing");
  await seedHomeSections(
    home.id,
    services
      .filter((service) => service.status === PublishStatus.PUBLISHED && service.deletedAt === null)
      .sort((left, right) => left.position - right.position)
      .map((service) => service.id),
    seededAt,
  );

  for (const legalPage of legalPages) {
    const existingLegalPage = await prisma.page.findUnique({ where: { slug: legalPage.slug }, select: { id: true } });
    if (existingLegalPage) continue;
    await prisma.page.create({
      data: {
        slug: legalPage.slug,
        status: PublishStatus.DRAFT,
        legalReviewStatus: LegalReviewStatus.PENDING,
        translations: { create: pageTranslationData([...legalPage.translations]) },
      },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    await prisma.$disconnect();
    throw error;
  });
