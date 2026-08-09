# Content release checklist

Use this checklist for every public content release. It is an operational
record, not a substitute for regulatory, legal, scientific, export-control, or
security review.

## Prepare the release

- [ ] Record the release owner, date, environment, CMS entity IDs, exact public
      URLs, expected content revision, and rollback owner in the change record.
- [ ] Work through `/admin/content` for generic pages and `/admin/services` for
      services. Use the labelled entity/media pickers for home, service,
      category, and media relationships; do not paste unverified database IDs.
- [ ] Confirm every published item has a complete English translation. For
      `zh-CN`, German, French, or Spanish gaps, explicitly accept or resolve the
      English fallback before release.
- [ ] Confirm a fallback response renders the English content with `lang="en"`,
      a localized fallback notice, and metadata whose content locale matches the
      resolved translation.
- [ ] Verify scientific copy states Research Use Only where required and does
      not make therapeutic, diagnostic, efficacy, certification, capacity, or
      unsubstantiated quality claims.
- [ ] Verify product sequence, CAS number, specification, category, source
      files, and media metadata against the approved source record.
- [ ] Verify site setting changes (logo, favicon, banner imagery, address,
      email, phone, social links, footer columns, and default SEO) are correct in
      every intended locale.
- [ ] For a legal-policy change, stop here and complete the separate legal
      review checklist against the exact current `contentRevision`.

## Media and storage checks

- [ ] Verify every selected public media asset is `PUBLISHED`, `PUBLIC`, has a
      useful English accessible name/alt, and contains no personal data,
      customer details, hidden credentials, or unlicensed content.
- [ ] Complete a representative CMS image through the application, not by
      inserting a database row. Confirm server-side decoding accepted its
      actual magic/type, the image is at most 10 MiB, 8,192 pixels on either
      dimension, and 40 megapixels, and the stored MIME type, byte size, width,
      and height are measured values.
- [ ] Check `StorageDeletionJob` and `MediaDeletionJob` for `DEAD_LETTER` rows
      and review the corresponding audit entries. Resolve the cause; do not
      delete referenced objects manually.
- [ ] Confirm object-store lifecycle expiration is limited to the exact
      `media/pending/` and `inquiry/tmp/` staging prefixes and only supplements
      the scheduled worker. It must never target broad `media/`/`inquiry/`,
      final media, `inquiry/final/`, or legacy inquiry staging keys.

## Publish and inspect the public result

- [ ] Save/publish in the CMS, record the audit-log entry, and note the cache
      invalidation time. Slug changes must invalidate both old and new detail
      paths where applicable.
- [ ] Confirm the item is visible in its intended list and detail route in
      English and at least one non-English locale. Confirm drafts, archived
      records, and stale legal revisions are absent.
- [ ] Request the public route without an admin session and confirm title,
      canonical URL, alternate-language links, Open Graph metadata, JSON-LD,
      fallback notice/`lang` where applicable, and exactly one H1.
- [ ] Confirm the header shows configured phone/email, search, and a dedicated
      `/request-a-quote` CTA on desktop and mobile. Confirm locale switching
      preserves the current query string and hash.
- [ ] Confirm `/robots.txt` and `/sitemap.xml` remain reachable; search and
      admin routes must not be indexed. A legal URL must appear only when its
      exact current revision is approved.
- [ ] Confirm public media loads only through `/api/media/public/<id>` and a
      draft/private/deleted media ID returns the indistinguishable `404`.
- [ ] Test keyboard navigation, mobile menu, footer legal links, accessible
      media names, plain card excerpts without nested headings, and no
      horizontal scrolling at 390 px width.

## Consent, inquiry, and admin concurrency

- [ ] Test first-visit Reject all, Accept all, and later withdrawal. Verify the
      analytics boundary mounts immediately after opt-in and unmounts after
      withdrawal; any real analytics integration must clean up listeners,
      timers, and vendor state on unmount.
- [ ] Submit an invalid quote and confirm field-level errors plus safe field
      retention. Confirm no upload session, upload intent, storage object,
      inquiry, or consent row was created for invalid preflight data.
- [ ] Submit one valid quote, verify private attachments and consent evidence,
      and confirm an anonymous attachment request is denied.
- [ ] When changing inquiry status or internal notes, retain the form's version.
      Simulate or review a stale edit and confirm the CMS reports a conflict
      requiring refresh instead of silently overwriting a colleague's update.

## Verification, evidence, and rollback

- [ ] Run lint, TypeScript, the full Vitest suite, Prisma format/validate/generate,
      and a production webpack build with explicit non-production-safe build
      values. Record exact pass/skip/fail counts.
- [ ] Run `pnpm test:e2e:release` only against the marked disposable `_e2e`
      database and explicitly E2E-named bucket documented in the README. A
      default run with skipped journeys is not release acceptance.
- [ ] Verify the scheduled publication, archived-media deletion, and storage
      maintenance endpoints through the deployment's authenticated internal
      path, and attach results to the release record.
- [ ] Attach command output, screenshots/URLs where required, audit identifiers,
      migration names, and external acceptance results to the release record.
- [ ] If incorrect content is public, archive it or restore its prior approved
      version in the CMS, verify path/tag refresh, and record the corrective
      action. Do not edit production tables or object storage directly.
- [ ] A legal rollback or restore never revives a stale approval: complete the
      legal checklist and approve the exact restored revision before publishing.
