# Phase 0 — Safety Net and Hygiene

> **Status:** Proposed / Under Review  
> **Phase:** 0 (Safety Net & Hygiene)  
> **Target Size:** S (Small)  
> **Author:** Antigravity  
> **Timestamp:** 2026-09-20  

---

## 1. Goal

Establish an unshakeable safety net and operational hygiene baseline before structural architecture changes in Phase 1+:
1. **Safety Net:** Introduce `vitest` test runner and write characterization tests capturing current behavior for `canonicalizeUrl`, `passesDeterministicGate`, `checkJobDeduplication`, and `evaluateWithHeuristics` / `evaluateRawJob`.
2. **Data Preservation:** Snapshot existing `data/` directory to `data-backup/<timestamp>/`.
3. **Data & Privacy Hygiene (F19):** Untrack `data/`, `data-backup/`, `*.pdf`, and `.env*` from git index (`git rm -r --cached data`) and add them to `.gitignore` to prevent exposure of personal contact information, compensation floor, and raw scans.
4. **Ops & Security Hygiene (F18):**
   - Bind local Next.js dev server strictly to `127.0.0.1`.
   - Move Gemini API key from URL query parameter (`?key=...`) to HTTP header (`x-goog-api-key`).
   - Switch Telegram digest formatting from raw Markdown to `parse_mode: 'HTML'` with entity escaping.

---

## 2. Technical Design & Implementation Details

### 2.1 Test Framework (`vitest`)
- **Dependency:** Add `vitest` to `devDependencies`.
  - *Justification:* Fast, ESM-native, TypeScript-first, zero-config compatibility with existing Next.js / TypeScript setup.
  - *Alternatives considered:* Jest (requires complex Babel/ts-jest configuration for ESM Next.js).
- **Scripts:** Add `"test": "vitest run"` and `"test:watch": "vitest"` to `package.json`.
- **Characterization Tests (`tests/characterization/*.test.ts`):**
  - Pin down current behavior of `canonicalizeUrl` (including tracking param deletion and `gh_jid` handling).
  - Pin down current behavior of `passesDeterministicGate` (including substring matching behavior on keywords like `junior`, `intern`).
  - Pin down current behavior of `checkJobDeduplication` (Level 1 exact URL match and Level 2 fuzzy title similarity).
  - Pin down current behavior of `evaluateWithHeuristics` with candidate profile fixtures.
  - Test Telegram HTML escaping helper to verify safe payload formatting without parse errors.

### 2.2 Data Backup & Untracking
- Copy `data/` to `data-backup/2026-09-20T.../` using Windows `cmd.exe` compatible commands (`xcopy` or Node script).
- Update `.gitignore`:
  - Ensure `/data/`, `/data-backup/`, `*.pdf`, `.env*` are explicitly ignored.
- Untrack `data/` from git index:
  - `git rm -r --cached data` (keeps files intact in workspace, removes them from git tracking).

### 2.3 Dev Server Localhost Binding
- Update `package.json` `"dev"` script:
  - `"dev": "next dev -H 127.0.0.1"` to prevent accidental LAN exposure of local-only tooling.

### 2.4 Gemini API Key in Headers (`lib/ai-evaluator.ts`)
- Replace:
  ```ts
  fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }, ...
  })
  ```
- With:
  ```ts
  fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': geminiApiKey
    }, ...
  })
  ```

### 2.5 Telegram HTML Formatting & Escaping (`lib/telegram.ts`)
- Add an HTML escape function for string interpolation:
  ```ts
  function escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  ```
- Update `formatTelegramDigest` to emit well-formed HTML tags (`<b>`, `<code>`, `<i>`, `<a href="...">`) with escaped user/job data.
- Update `sendTelegramDigest` to send `parse_mode: 'HTML'`.

---

## 3. Task List

- [ ] **Task 0.1:** Create full snapshot backup of `data/` into `data-backup/<timestamp>/`.
- [ ] **Task 0.2:** Install `vitest` as devDependency and configure test scripts in `package.json`.
- [ ] **Task 0.3:** Write characterization tests in `tests/characterization/` covering:
  - `dedup.test.ts` (`canonicalizeUrl`, `checkJobDeduplication`)
  - `gate.test.ts` (`passesDeterministicGate`)
  - `heuristics.test.ts` (`evaluateWithHeuristics`)
  - `telegram.test.ts` (HTML formatting & entity escaping)
- [ ] **Task 0.4:** Update `.gitignore` with `data/`, `data-backup/`, `*.pdf`, `.env*`.
- [ ] **Task 0.5:** Untrack `data/` from git index (`git rm -r --cached data`).
- [ ] **Task 0.6:** Update `package.json` dev script to bind to `127.0.0.1`.
- [ ] **Task 0.7:** Update `lib/ai-evaluator.ts` to transmit Gemini API key via `x-goog-api-key` header.
- [ ] **Task 0.8:** Update `lib/telegram.ts` to use `parse_mode: 'HTML'` with entity escaping.
- [ ] **Task 0.9:** Execute `pnpm test` and verify characterization suite passes.
- [ ] **Task 0.10:** Verify `git ls-files data` returns zero entries.
- [ ] **Task 0.11:** Commit Phase 0 changes and generate Phase 0 Report.

---

## 4. Test Plan

1. **Unit & Characterization Tests:**
   - Run `pnpm test`. All characterization tests must pass cleanly.
   - Verify `canonicalizeUrl` behaves according to current baseline.
   - Verify `passesDeterministicGate` behavior against sample titles.
   - Verify `evaluateWithHeuristics` calculates expected baseline score and tech stack tags.
   - Verify `formatTelegramDigest` produces valid HTML with correctly escaped symbols (`&`, `<`, `>`).
2. **Git Tracking Verification:**
   - Run `git ls-files data` -> must output empty.
   - Run `git status` -> `data/` must not appear as tracked modifications.
3. **Backup Verification:**
   - Confirm file count and size in `data-backup/<timestamp>/` match `data/`.

---

## 5. Rollback Strategy

1. **Code changes:** Revert via `git checkout` / `git revert`.
2. **Data recovery:** In the event of any data corruption or loss, restore directly from `data-backup/<timestamp>/`.
3. **Git tracking:** If data tracking needs to be restored, run `git add data`.
