# OPERATIONS.md — Live System Operating Rules

> ⚠️ **READ THIS FILE BEFORE MAKING ANY CHANGE TO `inspektit-app` OR `inspekt-web`.**
>
> This file lives in the `inspekt-shared` submodule and is mounted at `./shared/OPERATIONS.md` in both consumer repos. There is one canonical copy — edits happen here; consumer repos pick it up via submodule pointer bumps.

**Last updated:** 2026-05-18
**Audience:** Any AI agent (Claude Code, Cursor, Codex CLI, Copilot, etc.) and any human contributor working on either repo.

---

## 1. The Guiding Principle

**Users must always be able to:**

1. Complete their inspection
2. Capture data (photos, form entries, notes)
3. Generate their reports

Every rule in this document exists to protect that critical path. Before any change, ask: *"If this fails in production, does it block the user from finishing their inspection or generating their report?"* If yes, the change requires extra care — branch-DB testing, a feature flag, a fallback, or a kill switch.

---

## 2. Why This Document Exists

Starting **2026-05-18**, INSPEKTiT has live users — independent insurance adjusters whose income depends on the app working during 8-hour field shifts in spotty cell coverage. Before this date, breaking things in production was tolerable because only Andrew and his partners used the app. **That period has ended.**

Three structural risks define the operating environment:

- **Shared backend.** `inspektit-app` (iOS field app) and `inspekt-web` (firm web platform) share a single Supabase database. A migration that breaks one product breaks the other simultaneously.
- **Mobile app immutability.** Once an iOS build is on TestFlight or the App Store, it stays installed on users' phones for weeks. Backend changes must remain compatible with at least the last 2 shipped iOS versions.
- **No second chance.** A failed inspection costs a real adjuster real money. A claim generated with a broken report costs trust we don't get back.

---

## 3. Database Change Rules

### 3.1 Default: additive only, direct to production

**Rule:** Migrations that *only* add a new column (nullable or with default), add a new table, add a new index, or grant a new permission may be applied directly to production via the `inspekt-db` agent.

**Why:** Additive changes can't break existing code paths — nothing reads from a column that didn't exist a moment ago. Old iOS clients in the wild continue working unchanged.

**Examples of safe-additive:**

- `ALTER TABLE inspections ADD COLUMN insured_signature_url TEXT NULL;`
- `CREATE TABLE feature_flags (...);`
- `CREATE INDEX idx_claims_status ON claims (status);`

### 3.2 Risky changes: branch DB first

**Rule:** Migrations that **rename**, **drop**, **change the type of**, or **backfill data into** any column or table the app reads or writes MUST be tested on a Supabase branch database before touching production. Same for RLS policy changes on tables read by either app.

**Why:** Destructive changes break running clients at the moment they apply. A typo in a backfill against real data is not recoverable.

**Workflow** (driven by the `inspekt-db` agent):

1. Create a Supabase branch via `mcp__supabase__create_branch`.
2. Apply the migration to the branch.
3. Validate the migration applies cleanly and the app still works against the new schema.
4. Merge the branch into production via `mcp__supabase__merge_branch`.
5. Delete the branch.

### 3.3 Deprecation pattern — add, then drop later

**Rule:** When deprecating a column or table, follow the **add → dual-write → migrate readers → wait → drop** sequence. Never drop a column in the same migration that adds its replacement.

**Why:** iOS clients on stale builds still read the old column for weeks after the new one is live. Dropping immediately strands those users.

**How to apply:**

- Migration 1: add the new column/table.
- Code change 1: write to *both* old and new for a transition period.
- Code change 2: switch reads to the new column.
- Wait at least 2 iOS releases (~4 weeks) for users to upgrade.
- Migration 2: drop the old column.

### 3.4 The `inspekt-db` agent is the gatekeeper

**Rule:** All schema work — migrations, audits, RLS changes, additions or modifications of columns/enums/tables — goes through the `inspekt-db` agent. Do not run schema-modifying SQL directly via the Supabase MCP from any other agent.

**Why:** The `inspekt-db` agent applies the rules above and writes the shared context file the other repo reads, so cross-repo impact is captured.

---

## 4. Feature Flags

### 4.1 The `feature_flags` table is the runtime kill switch

**Rule:** Any new feature that interacts with the critical inspection→capture→report path, or any feature that depends on a cloud service (Anthropic, cloud report worker, third-party API), must be gated by a row in the `feature_flags` table.

**Why:** When something breaks in production, redeploying takes minutes-to-hours and doesn't help users on the current iOS build. A flag flip takes seconds and reaches every client on next session load.

**The table:**

```sql
CREATE TABLE feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  enabled_user_ids UUID[] NOT NULL DEFAULT '{}',
  enabled_firm_ids UUID[] NOT NULL DEFAULT '{}',
  rollout_percent INT NOT NULL DEFAULT 0,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- RLS: authenticated users SELECT; service role only INSERT/UPDATE.
```

### 4.2 Rollout pattern for new features

**Rule:** New features ship dark by default. Enable for yourself first, then partners, then a beta firm, then percentage rollout, then 100%.

**Why:** This catches issues with real-world data variation before they reach the user base.

**Workflow:**

1. Code the feature. Wrap UI/behavior in a flag check: `if (flags.feature_x) { ... }`.
2. Ship the migration adding the flag row with `enabled = FALSE`.
3. Deploy code. No user sees a difference.
4. Add Andrew's UUID to `enabled_user_ids`. Test on real claims.
5. Add partners. They test.
6. Add a beta firm to `enabled_firm_ids`.
7. `rollout_percent = 25` → 50 → 100.
8. After 2 weeks stable at 100%, remove the flag row AND the `if`/`else` from code in a follow-up PR. **Flags are debt and must retire.**

### 4.3 Kill switch on existing features

**Rule:** Existing features that depend on a fragile or new code path (cloud workers, third-party APIs, large rewrites) must have a flag controlling them — even after they're stable. The flag protects against runtime failures, not just rollout.

**Why:** Cloud services fail. APIs go down. Bugs ship. A flag means recovery is "flip a row," not "deploy a patch."

### 4.4 Flags can hide UI, switch behavior, or both

**Rule:** The flag is just a boolean. What it controls depends on where you check it in the code:

- **Hide UI entirely:** `{flags.x && <Button />}` — feature disappears.
- **Show but disable:** `<Button disabled={!flags.x}>` — visible, grayed.
- **Switch behavior:** `flags.x ? newPath() : oldPath()` — UI unchanged.
- **Show "temporarily unavailable":** `flags.x ? <Feature /> : <Notice />` — user knows it's intentionally off.

Pick the pattern that fits the situation. For brand-new features, hide. For kill switches on existing features, switch behavior with a fallback.

---

## 5. Report Generator Versioning (V1/V2)

### 5.1 Every cloud report generator is versioned

**Rule:** Each cloud generator in `inspekt-web/api/report-jobs/generation/` exists as two files on disk:

- `<name>.v1.js` — frozen, last known-good version. **Never edited.**
- `<name>.v2.js` — active development target.

A dispatcher reads a `feature_flags` row to pick which version runs.

**Generators covered:**

- `generateGlrOutputDocx` — Standard GLR
- `generateAmfamGlrDocx` — AmFam GLR
- `generatePhotoReportPdf` — Standard Photo Report
- `generateAmfamPhotoSheetPdf` — AmFam Photo Sheet

**Why:** If a deployed report change breaks for a real adjuster, flipping the flag back to V1 restores the last working version in seconds with no redeploy.

### 5.2 Promotion: V2 → V1 after 2 weeks at 100%

**Rule:** Once a V2 generator has been at `rollout_percent = 100` with no rollback for 2 weeks, copy V2 → V1 (overwrite), delete V2, simplify the dispatcher, and remove the flag row.

**Why:** Without promotion, V1 stays frozen at the AmFam demo state forever and the codebase accumulates V3, V4, V5. Promotion resets the cycle.

### 5.3 Support files version with their generator

**Rule:** When a V2 generator needs new shared-helper logic (`extractReportData`, `buildGlrPayload`, `photoReportText`), version those helpers too. V1 generator imports `helper.v1.js`; V2 imports `helper.v2.js`.

**Why:** Editing a shared helper in place changes V1's output for everyone — defeating the purpose of having a frozen V1.

### 5.4 V1 files are read-only

**Rule:** Do not edit a `.v1.js` file. Not for bug fixes, not for "small improvements," not for renames. If V1 has a bug, fix it in V2 and roll out V2.

**Why:** The point of V1 is to be the snapshot you trust didn't change. If you edit it, you can no longer roll back to "the version that worked yesterday."

---

## 6. AI Service Redundancy

### 6.1 Anthropic narrative requires a fallback key

**Rule:** All Anthropic API calls (currently `api/generate-narrative.js` and `api/email-intake.js`) must support an `ANTHROPIC_API_KEY_FALLBACK` env var. If the primary key returns a 401/402/billing error, the call automatically retries against the fallback key once.

**Why:** A single billing failure on one Anthropic account would take down AI narrative generation and email intake simultaneously, with no recourse short of provisioning a new account.

**How to apply:**

- Primary key and fallback key live under different billing accounts.
- Fallback key is used only on billing/auth class errors — not on rate limit or transient network errors (those retry against primary).
- Both keys logged anonymously (key prefix only) so we can tell which served a request.

### 6.2 Anthropic is not on the critical path

**Rule:** Inspection capture, photo capture, autosave, and the photo report PDF must NOT require Anthropic to function. A complete Anthropic outage must degrade gracefully — narratives become blank or template-only — without blocking report generation.

**Why:** Anthropic is a single-vendor dependency. Treating it as critical-path makes our uptime equal to theirs.

### 6.3 Health checks must not burn credits

**Rule:** Uptime monitoring health checks use synthetic checks (Supabase `SELECT 1`, env-var presence). They must never make real LLM API calls.

**Why:** A check polled every minute = 43,200 LLM calls/month for zero user value.

---

## 7. Deployment Process

### 7.1 Web (`inspekt-web`) — preview-deploy before merge

**Rule:** Changes to `inspekt-web` are tested via the auto-generated Vercel preview URL on the branch before merging to `main`. Localhost is good for development confidence; the preview URL is the gate.

**Why:** Preview deploys catch env-var drift, build-config issues, and runtime differences that localhost won't.

**Rollback:** Vercel's "Promote previous deployment" is instant (~10 seconds). Use it the moment something is wrong; debug after.

### 7.2 iOS (`inspektit-app`) — TestFlight before App Store

**Rule:** Every iOS release goes to internal TestFlight before App Store submission. Andrew + partners install and use it for at least 24 hours of real claim work before submitting for review.

**Why:** Apple review takes 1–3 days. An App Store release can't be recalled — only superseded. TestFlight is the safety net.

### 7.3 Backend stays backwards-compatible with the last 2 iOS versions

**Rule:** Any change to Supabase schema, RLS, or Vercel API contracts must keep working for users on the last 2 shipped iOS versions of `inspektit-app`.

**Why:** Users don't update the day a new version ships. A change incompatible with v1.4 breaks every adjuster who hasn't tapped Update.

---

## 8. Shared Code in `inspekt-shared`

### 8.1 What lives in `inspekt-shared`

**Rule:** Pure logic with no platform dependencies (no Supabase client, no env vars, no I/O) that needs to behave identically in both repos lives in `inspekt-shared`. Both repos consume it via submodule at `./shared/`.

**Currently shared:** `photoOrder.js`, `photoLabelValidation.js`, `OPERATIONS.md`. More to come as we identify drift candidates.

### 8.2 Edit in `inspekt-shared`, never in `./shared/`

**Rule:** Edits to shared files happen in `/Users/andrewowen/inspekt-shared/`, NOT in the `./shared/` directory of a consumer repo. After editing, commit + push in `inspekt-shared`, then bump the submodule pointer in BOTH consumer repos.

**Why:** Editing directly in `./shared/` creates a detached-HEAD mess in the submodule and silently diverges from the canonical copy. The drift bug this submodule was created to fix returns immediately if only one consumer updates.

### 8.3 No forking shared logic

**Rule:** If `inspekt-web` needs the same logic as `inspektit-app`, it must consume the shared submodule — not fork the file. Forks drift; the submodule prevents drift.

**Why:** This rule exists because we already lived through 3 days of silent drift between iOS and cloud copies of `photoOrder.js` that broke a live claim's photo report (2026-05-04). The submodule is the fix; honoring this rule keeps the fix.

---

## 9. The Critical Path — Hard-Protected Code

The following code paths are load-bearing. Changes here require extra scrutiny — read this section before editing.

### 9.1 Inspection capture & autosave

- `inspektit-app/src/hooks/useAutosave.js`, `useDraft.js`, `useClaim.js`
- Failures here mean lost adjuster work. Save retries must be robust; failed saves must surface to the user, not be silently swallowed.

### 9.2 Photo queue

- `inspektit-app/src/hooks/usePhotoQueue.js`, `src/utils/mergeEntryHelpers.js`
- Already hard-protected in CLAUDE.md. Quota errors must surface; permanent failures must show which photos failed and why.

### 9.3 Report generation

- Cloud canonicals in `inspekt-web/api/report-jobs/generation/`
- Cloud job dispatch in `inspektit-app/src/components/report/ReportSurface.jsx`
- Already hard-protected in CLAUDE.md.

### 9.4 Auth session

- `inspektit-app/src/supabaseClient.js`, `src/context/AuthContext.jsx`
- Token expiry during long inspections is a known risk. A 401 from any storage upload should be treated as a session error, not a transient retryable failure.

---

## 10. The Decision Tree

Before making a change, walk through this:

1. **Does it touch the database?** → Section 3.
2. **Does it add a new feature or significant code path?** → Wrap it in a flag (Section 4). Default OFF.
3. **Does it modify a cloud report generator?** → V1/V2 versioning (Section 5).
4. **Does it call an external API** (Anthropic, Mapbox, Google, SendGrid)? → Section 6. Fallback or graceful degradation required.
5. **Could it break for users on the previous iOS build?** → Section 7.3. If yes, stop and design a backwards-compatible approach.
6. **Could it silently swallow an error the user needs to know about?** → Section 9. Surface the error.

If you can't answer any of these confidently, stop and ask Andrew before writing code.

---

## 11. Escalation

If you've read this document and you're still uncertain whether a change is safe, **stop**. Tell Andrew what you were about to do and why you're uncertain. A 5-minute pause costs nothing compared to a real adjuster losing data mid-shift.

---

## 12. Updating This Document

When operating context changes (new third-party dependencies, new fragile subsystems, lessons from a near-miss incident), update this doc. To change a rule:

1. Edit this file in `/Users/andrewowen/inspekt-shared/OPERATIONS.md`.
2. Commit + push in `inspekt-shared`.
3. Bump the submodule pointer in `inspektit-app`: `git -C shared pull origin main && git add shared && git commit -m "chore: bump inspekt-shared (OPERATIONS update)"`.
4. Bump the submodule pointer in `inspekt-web` the same way.
5. Update the `Last updated` date at the top.

Both consumer repos must be bumped or one will operate on stale rules.
