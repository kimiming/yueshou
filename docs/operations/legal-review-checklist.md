# Legal and policy review checklist

This checklist records the handoff required before a legal policy becomes
public. It is not legal advice and a checked technical control does not mean
that counsel has approved the text.

The protected legal slugs are `terms`, `privacy`, `ruo-policy`,
`shipping-compliance`, and `cookie-policy`.

## Establish the exact review package

- [ ] Assign counsel or the responsible compliance owner. Record the governing
      entity, jurisdiction, effective date, review date, external approval
      reference, and release owner outside the public repository.
- [ ] In the CMS, save every intended slug, translation, and page section first.
      Record the page ID and the exact current `contentRevision`; approval is
      valid only for that revision.
- [ ] Review the English source and every translation intended for publication
      for semantic equivalence. Do not publish unreviewed machine-translated
      legal text.
- [ ] Verify footer labels and public routes for Terms of Service, Privacy
      Policy, Research Use Only Policy, Shipping & Compliance Notice, and Cookie
      Policy.
- [ ] If a non-English translation is intentionally absent, counsel/compliance
      must accept the English fallback. Verify the response keeps `lang="en"`,
      shows the localized fallback notice, and identifies the resolved content
      language in metadata.

## Revision-bound approval control

- [ ] Confirm the page is `DRAFT` with legal review `PENDING`, and that stale
      reviewer ID, reviewed timestamp, and reviewed revision are empty.
- [ ] Have an active `ADMIN` use **Approve current legal revision** only after
      reviewing the saved content. An `EDITOR`, inactive/deleted administrator,
      direct historic timestamp, or approval for another revision is invalid.
- [ ] Record the `LEGAL_PAGE_APPROVED` audit entry, administrator ID,
      reviewed timestamp, and `legalReviewedRevision`. Confirm it equals
      `contentRevision` before publishing.
- [ ] Publish only after approval. Confirm the database constraint, public legal
      getter, and sitemap all require `APPROVED`, a reviewer/timestamp, and exact
      revision equality.
- [ ] After publication, make a controlled test edit in a non-production
      environment. A slug, page translation, section, section configuration or
      ordering, or section translation insert/update/delete must advance the
      revision, demote the page to `DRAFT`/`PENDING`, clear approval metadata,
      and remove public/sitemap exposure until re-reviewed.
- [ ] After the legal-revision migration, re-review every historic policy. The
      migration intentionally demotes all old approvals because the former
      schema cannot prove the reviewed child content. Do not restore the old
      status or timestamp manually.

## Privacy and cookie checks

- [ ] Privacy Policy identifies controller/contact details, categories and
      purposes of inquiry data, lawful basis, retention, processors/transfers,
      security measures, subject rights, and the contact/escalation route
      required for the target markets, including GDPR where applicable.
- [ ] Cookie Policy lists necessary and optional analytics categories, vendors,
      purposes, duration, and how visitors change their choices.
- [ ] Verify first visit shows the choices banner, Reject all works, analytics
      remains off unless opted in, opt-in takes effect without a reload, and
      Cookie settings withdrawal unmounts analytics and triggers integration
      cleanup.
- [ ] Confirm inquiry attachment handling is private, staff downloads require
      authorization, downloads are audited, and anonymous access is denied.
- [ ] Confirm retention/lifecycle documentation never expires final inquiry
      attachments and that dead-lettered cleanup is investigated rather than
      bypassed.

## B2B, scientific, shipping, and publication review

- [ ] Terms identify acceptable site use, intellectual-property ownership, B2B
      contact process, limitation language, and governing law/forum as advised
      by counsel.
- [ ] RUO Policy limits products and discussions to qualified, compliant
      research use; rejects sales to unqualified individuals and minors where
      applicable; and avoids medical-use claims.
- [ ] Shipping & Compliance Notice accurately states supported carriers only
      where actually offered, Incoterms/customs responsibility,
      export/sanctions screening, destination restrictions, and buyer duties.
- [ ] Counsel approves the final content, translations, and effective date in
      writing before publication. Store that approval outside this repository.
- [ ] Request every public policy URL without an admin session; verify the
      approved revision, title/canonical/alternates, content language and notice,
      cache refresh, footer link, and sitemap result.

## Change and rollback rule

Any post-approval content change creates a new review package. A rollback,
database restore, copied timestamp, or manually changed status cannot transfer
approval to a different revision. Save, review, approve, publish, and record the
new audit evidence again.
