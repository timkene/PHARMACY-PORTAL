This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.


## PA frontend foundation (Phase 4B.1)

Contracts target pharmacy-portal-api commit
`c0c8540e754409b8ff4c3b40bbb2420428cf7ab7` on
`integration/pharmacy-pa-foundation`. That backend work is local and is not
assumed deployed. No production requests are part of implementation/tests.

`lib/pa-types.ts` models the 21 reviewed preparation, CSV transfer, proposal and
catalog routes. `lib/pa-api.ts` exposes only those operations: no IssuePa,
generate-pa, reconciliation or retry API. Request bodies select only the actual
contract fields; actor, permission, price and catalog-authority extras are not
forwarded. Catalog ingestion uploads an already signed, untrusted UTF-8 artifact;
there is no client signing, key storage, extraction or trust inference.

`lib/pa-permissions.ts` retains only the eleven allowlisted PA permissions from
GET /api/auth/staff/me. Missing permissions on older backends default to none.
Cookies remain opaque and login/logout behavior stays unchanged. UI permission
checks never replace backend authorization or the three-person workflow rules.
The dashboard passes this server-validated permission list to StaffShell. Other
legacy staff pages that do not supply permissions keep the existing navigation.
Permitted PA entries are visibly disabled/coming soon: full screens and links to
them are deliberately deferred. No broken route or new public page is added.

The shared apiResponse/apiFetch transport merges all HeadersInit forms, keeps
credentials include, and handles raw and JSON responses through the same 401
login flow. A 403 is a permission denial, not session expiry. ApiError exposes
only allowlisted structured PA reason codes and, for ownership conflicts, a
validated owningBatchId. Arbitrary nested error documents are discarded and 5xx
responses are sanitized. No mutation is automatically retried.

PA mutations include X-Pharmacy-CSRF: 1 alongside the actual JSON or CSV media
type. Browsers supply Origin; the client never invents a trusted Origin or uses
the CSRF header to bypass the backend origin policy. Use NEXT_PUBLIC_API_URL for
the API base only; never put keys, session secrets or database credentials in
public environment configuration. Real preview/production origins must match
the backend allowlist. No proxy, authentication mechanism or environment change
is introduced here.

Mapping uploads accept the original Uint8Array bytes; readMappingCsv accepts a
File/Blob. Both enforce 512 KiB and strict UTF-8. Byte order marks, CRLF, escaping,
quoted cells and protected values are not reserialized or altered. Only
proposed_medicloud_code, proposed_medicloud_description and mapping_notes are
Cursor-editable; server-held manifest validation remains authoritative. Downloads
use authenticated raw fetch and return a Blob, not parsed JSON or a public link.
No CSV, artifact, credential or member-evidence content is logged or persisted.

Presentation helpers are read-only labels, never authorization decisions:
proposal/catalog lists are metadata-only; proposal detail supplies fully checked
workflow evidence. A recorded ACTIVE status is insufficient. Valid existing
ACTIVE mappings may resolve with expired trusted evidence while new approval or
activation still needs fresh evidence. REPLACED is historical. Catalog evidence
never establishes provider tariff, coverage or price eligibility. READY means
prepared data only, without PA submission or authorization.

Validation uses existing dependencies only:

```sh
bun run test
./node_modules/.bin/tsc --noEmit --incremental false
./node_modules/.bin/next lint --no-cache
git diff --check
```

Vitest's existing setup rejects unmocked fetch requests. Browser/deployment
integration with cross-site cookies remains a later isolated validation step;
these unit tests do not establish deployed origin/cookie compatibility.


### PA preparation workspace (Phase 4B.2, local implementation)

`/staff/pa-preparation` and `/staff/pa-preparation/[batchId]` use the reviewed
backend preparation contracts. The backend changes must be released separately;
this frontend work does not publish or deploy them.

- Staff sessions are validated server-side. Standalone batch/line reads and
  navigation require `PA_PREPARATION_READ`; mutations require
  `PA_PREPARATION_WRITE`. WRITE does not imply READ. WRITE-only staff can create
  a batch and use its returned version and minimized mutation results inline;
  they cannot browse arbitrary batch pages or issue batch GETs.
- Creation sends `businessDate`; prepare, recalculate and close send only the
  latest authoritative batch `expectedVersion`. No state-changing request is
  retried automatically.
- Uncertain mutation outcomes (network failures, 5xx responses) and batch or
  version conflicts pause controls until current data is reloaded. A READ user
  must explicitly reload; WRITE-only users need a reader to reconcile uncertain
  outcomes. Batch creation stays locked only when its outcome is uncertain; a
  definite 4xx rejection is shown and may be retried explicitly.
- Two known cases do not pause controls because the batch is unchanged:
  `ORDER_ALREADY_IN_ACTIVE_BATCH` (the backend rejects it before any write, so
  the error is shown and other orders can still be prepared), and a rejected
  line filter (400/422) when the batch itself was reloaded successfully (a
  filter-specific message is shown instead). Filter IDs are limited to 100
  characters. Closing requires confirmation and releases ownership without
  altering historical preparation.
- Pagination uses opaque backend cursors, including empty filtered pages with
  a next cursor. Filters use preparation/mapping status, IssuePa provider ID,
  aggregator ID and stale revision state. Counts labelled `LAST_CALCULATION`
  are historical totals; null counts remain unavailable.
- Approved amounts are displayed as existing NGN line totals, never multiplied
  by quantity. Referring provider, aggregator and IssuePa provider stay distinct.
  Member validation unavailable remains BLOCKED. READY means prepared data,
  never PA authorization or submission. Transmission is read-only.
- Other PA administration navigation remains coming soon. No order-processing,
  payment, approval, export/import, submission or recovery UI changed. No
  browser persistence or logging of preparation payloads is introduced.


### Mapping review files (Phase 4B.3, local implementation)

`/staff/pa-mapping-review` uses the reviewed mapping-review export/import
contracts. Navigation shows it for `PA_MAPPING_EXPORT` or `PA_MAPPING_IMPORT`.

- Export and import are separate permissions; neither grants preparation READ.
  With `PA_PREPARATION_READ`, open batches can be picked with their listed
  version; otherwise the batch ID and current version are entered explicitly
  and the backend version check stays authoritative.
- Export requests send `expectedVersion`, an optional `after` cursor and a
  1–100 row limit. Results show exported and skipped rows with backend skip
  reason codes, expiry and the export ID. An empty scan offers its next cursor
  without submitting again. Downloads use the authenticated raw CSV response.
- Uploads accept a file of at most 512 KiB that is valid UTF-8 and send its
  original bytes unchanged (BOM, line endings and quoting preserved). Only
  `proposed_medicloud_code`, `proposed_medicloud_description` and
  `mapping_notes` may be edited. Receipts state that imported rows are
  PROPOSED only; approval and activation are separate workflows.
- Definite 4xx rejections are explained and may be retried explicitly. Network
  failures, 5xx, 408 and `TRANSACTION_CONFLICT_REFRESH_REQUIRED` are uncertain:
  export creation stays locked until acknowledged, and upload stays locked
  until an import-status check reports the outcome. Nothing is retried
  automatically and double submissions are blocked.
- Export expiry is shown when known; a device-clock warning never replaces the
  server's `EXPORT_EXPIRED` decision.
