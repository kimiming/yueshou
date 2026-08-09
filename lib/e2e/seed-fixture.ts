import {
  E2E_ARTICLE_SLUG,
  E2E_HERO_STORAGE_KEY,
  E2E_LOGO_STORAGE_KEY,
} from "./mutation-fixture";

export const E2E_BASELINE_LOGO_STORAGE_KEY = "e2e/fixtures/baseline-logo.png";
export const E2E_BASELINE_HERO_STORAGE_KEY = "e2e/fixtures/baseline-hero.png";

const onePixelPng = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
));

const pages = [
  ["home", "Peptide synthesis for research", "Precision peptide synthesis for global scientific research."],
  ["about", "About YueShou", "A research-focused peptide synthesis partner."],
  ["services", "Services", "Explore peptide synthesis and analytical services."],
  ["products", "Products", "Browse research-use-only peptide products."],
  ["quality", "Quality", "Quality controls support every research project."],
  ["news", "News", "Research updates from YueShou."],
  ["contact", "Contact", "Contact the YueShou scientific team."],
  ["request-a-quote", "Request a quote", "Share your research requirements."],
] as const;

const services = [
  ["custom-peptide-synthesis", "Custom peptide synthesis"],
  ["peptide-modification", "Peptide modification"],
  ["analytical-services", "Analytical services"],
  ["project-consultation", "Project consultation"],
] as const;

const legalPages = [
  ["terms", "Terms of Service"],
  ["privacy", "Privacy Policy"],
  ["ruo-policy", "Research Use Only Policy"],
  ["shipping-compliance", "Shipping and Compliance Notice"],
  ["cookie-policy", "Cookie Policy"],
] as const;

export function buildE2eSeedPlan() {
  return {
    storageObjects: [
      E2E_BASELINE_LOGO_STORAGE_KEY,
      E2E_BASELINE_HERO_STORAGE_KEY,
      E2E_LOGO_STORAGE_KEY,
      E2E_HERO_STORAGE_KEY,
    ].map((key) => ({ key, body: Uint8Array.from(onePixelPng), mimeType: "image/png" as const })),
    pages: pages.map(([slug, title, body]) => ({ slug, title, body })),
    services: services.map(([slug, title], position) => ({
      slug,
      title,
      body: `${title} for scientific research projects.`,
      position: (position + 1) * 10,
    })),
    products: [{
      slug: "e2e-research-peptide",
      title: "E2E research peptide",
      body: "A published peptide fixture for release search and catalog journeys.",
      categorySlug: "research-peptides",
    }],
    articles: [{
      slug: E2E_ARTICLE_SLUG,
      title: "E2E peptide research release",
      body: "Published research news used by the release mutation journey.",
      categorySlug: "research-updates",
    }],
    legalPages: legalPages.map(([slug, title]) => ({
      slug,
      title,
      body: `${title} fixture approved only for the disposable E2E release environment.`,
    })),
  };
}
