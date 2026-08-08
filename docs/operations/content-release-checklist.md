# Content release checklist

Use this checklist for every public content release. It is an operational
record, not a substitute for regulatory, legal, scientific, or export-control
review.

## Before publishing

- [ ] Record the release owner, date, environment, CMS entity IDs, and the
      exact page/product/news URLs in the change record.
- [ ] Confirm every public item has an English translation. Confirm the
      intended `zh-CN`, German, French, and Spanish translations are complete
      or intentionally rely on the documented English fallback.
- [ ] Verify scientific copy states Research Use Only where required and does
      not make therapeutic, diagnostic, efficacy, or unsubstantiated quality
      claims.
- [ ] Verify product sequence, CAS number, specification, category, source
      files, and media metadata against the approved source record.
- [ ] Verify every public media asset is `PUBLISHED`, `PUBLIC`, has useful
      English alt text, and contains no personal data, customer details, or
      embedded credentials.
- [ ] Verify site setting changes (logo, favicon, banner imagery, address,
      email, phone, social links, footer columns, and default SEO) are correct
      in all intended locales.

## Publish and check the public result

- [ ] Publish in the CMS, record the audit-log entry, and wait for the content
      publication/cache refresh to complete.
- [ ] In an authenticated editor session, confirm the item is visible in its
      intended list and detail route in English and one non-English locale.
- [ ] Request the public route without an admin session and confirm the title,
      canonical URL, alternate-language links, Open Graph metadata, and JSON-LD
      match the released content.
- [ ] Confirm `/robots.txt` and `/sitemap.xml` remain reachable; search and
      admin routes must not be indexed.
- [ ] Confirm public media loads only through `/api/media/public/<id>` and a
      draft/private/deleted media ID returns the indistinguishable `404`.
- [ ] Test keyboard navigation, mobile menu, footer legal links, cookie
      settings, and no horizontal scrolling at 390 px width.

## Release evidence and rollback

- [ ] Run `pnpm test:release` in a prepared release environment. For real
      browser journeys, supply the dedicated E2E variables documented in the
      README; do not point them at production.
- [ ] Attach command output, screenshots/URLs where required by internal
      process, and the audit-log identifiers to the release record.
- [ ] If an incorrect item is public, archive or restore its prior approved
      version in the CMS, verify its public route/cache refresh, and record the
      corrective action. Do not edit the production database directly.
