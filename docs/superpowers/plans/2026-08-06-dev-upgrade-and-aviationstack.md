# Dev Upgrade and Aviationstack Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the frontend to a conflict-free ECharts 6 word-cloud stack, standardize `ods_flight_schedule` for manual and Aviationstack records, create the fixed China Southern Guangzhou-departure ingestion task, run it, and publish the complete local `dev` branch.

**Architecture:** The frontend registers Apache's ECharts 6 custom word-cloud series through one compatibility adapter. The backend adds one tested, allowlisted Aviationstack row adapter before generic stream field mapping. PostgreSQL remains the source of truth for the unified flight lake table, with source-specific primary keys and cross-source business keys.

**Tech Stack:** React, TypeScript, Vite, Apache ECharts 6.1, `@echarts-x/custom-word-cloud`, Node.js, Express, Node test runner, MySQL platform metadata, PostgreSQL ODS.

## Global Constraints

- Aviationstack requests must use `GET /v1/flights`, `airline_iata=CZ`, `dep_iata=CAN`, `limit=100`, `offset=0`, and at most one page per test run.
- The API key must never be added to Git files, generated artifacts, logs, test fixtures, or documentation.
- `ods_flight_schedule` must preserve both `MANUAL` and `AVIATIONSTACK` records without API runs overwriting manual records.
- Runtime caches, `backend/runtime/`, TypeScript build-info files, and generated Vite JavaScript/declaration files must not be staged.
- Publish all intended current business changes together to `origin/dev` after verification.

---

### Task 1: ECharts 6 Word-Cloud Compatibility

**Files:**
- Create: `frontend/src/pages/reporting/charts/echarts-word-cloud.ts`
- Create: `frontend/src/pages/reporting/charts/echarts-word-cloud.test.ts`
- Modify: `frontend/src/pages/reporting/ReportingDashboardEditorPage.tsx`
- Modify: `frontend/src/pages/reporting/ReportingDashboardPreviewPage.tsx`
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`

**Interfaces:**
- Produces: `installEchartsWordCloud(): void`
- Produces: `normalizeWordCloudOption(option: Record<string, unknown>): Record<string, unknown>`

- [ ] **Step 1: Write a failing compatibility test**

Test that a legacy `{ type: "wordCloud" }` series becomes `{ type: "custom", renderItem: "wordCloud", itemPayload, data }`, normal series remain unchanged, and a converted series is idempotent.

- [ ] **Step 2: Run the test and verify RED**

Run: `cd frontend && npx vitest run src/pages/reporting/charts/echarts-word-cloud.test.ts`

Expected: FAIL because the adapter module does not exist.

- [ ] **Step 3: Install ECharts 6-native dependencies**

Run: `cd frontend && npm uninstall echarts-wordcloud && npm install echarts@^6.1.0 @echarts-x/custom-word-cloud@^1.0.1 && npm install -D vitest`

The resulting lock file must have no ECharts 5-only word-cloud peer dependency.

- [ ] **Step 4: Implement the compatibility adapter**

Register the official installer once with `echarts.use()`. Convert legacy series data from `{ name, value, textStyle }` into `[name, value, textStyle]`, and move shape/layout fields into `itemPayload`. Preserve tooltip, emphasis, animation and all unrelated series properties.

- [ ] **Step 5: Replace old side-effect imports**

Both dashboard editor and preview must call the same installer and normalize the final ECharts option before rendering.

- [ ] **Step 6: Verify GREEN and build**

Run:

```bash
cd frontend
npx vitest run src/pages/reporting/charts/echarts-word-cloud.test.ts
npm ci
npm run build
```

Expected: all commands exit 0 without `--legacy-peer-deps`.

---

### Task 2: Unified Flight Lake Schema

**Files:**
- Modify: `scripts/aviation_ontology_governance.sql`
- Modify: `scripts/aviation_ontology_semantic_layer.md`

**Interfaces:**
- Produces PostgreSQL columns: `record_source`, `source_record_id`, `business_key`, `source_updated_at`, `ingested_at`, `raw_payload`.
- Produces unique source identity index on `(record_source, source_record_id)`.

- [ ] **Step 1: Add a schema assertion script and verify RED**

Run a read-only PostgreSQL assertion that queries `information_schema.columns` for the six columns and fails while any are missing.

- [ ] **Step 2: Extend the governance SQL**

Add idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, backfill existing rows as `MANUAL`, relax API-optional columns (`atd`, `tail_no`, `delay_code_raw`) to nullable, add field comments, and create the source identity index.

- [ ] **Step 3: Update semantic documentation**

Document the two source modes, source-specific primary key strategy, cross-source `business_key`, and the six quality rules from the approved design.

- [ ] **Step 4: Apply and verify GREEN**

Run the SQL against local `ods`, then query column metadata, manual row count and null constraints. Expected: all 18 existing records remain and have `record_source=MANUAL`.

---

### Task 3: Aviationstack API Row Adapter

**Files:**
- Create: `backend/src/services/apiRowAdapters.js`
- Create: `backend/src/services/apiRowAdapters.test.js`
- Modify: `backend/src/services/streamIngestionRunner.js`

**Interfaces:**
- Produces: `adaptApiRows(adapterCode: string, rows: object[], now?: Date): object[]`
- Adapter code: `aviationstack_flight_schedule`

- [ ] **Step 1: Write failing row-adapter tests**

Use a synthetic flattened Aviationstack row with `airline_iata=CZ` and `departure_iata=CAN`. Assert deterministic `flight_segment_id`, normalized ICAO airports, calculated delay, `record_source=AVIATIONSTACK`, business key, JSON raw payload and rejection of non-CZ/non-CAN rows.

- [ ] **Step 2: Run the test and verify RED**

Run: `cd backend && node --test src/services/apiRowAdapters.test.js`

Expected: FAIL because the adapter module does not exist.

- [ ] **Step 3: Implement the allowlisted adapter**

Use SHA-1 only for the deterministic identifier suffix, never for secrets. Derive `DOM` when arrival ICAO begins with `Z`, otherwise `INT`; calculate non-negative delay minutes from actual/estimated versus scheduled departure; retain nulls for unavailable fields.

- [ ] **Step 4: Integrate before generic field mapping**

In `executeApiTask`, call `adaptApiRows(sourceConfig.rowAdapter, collectResult.rows)` and pass only adapted rows to `writeMappedRows`. Expose no arbitrary expression evaluation.

- [ ] **Step 5: Verify GREEN**

Run: `cd backend && node --test src/services/apiRowAdapters.test.js`

Expected: all adapter tests pass.

---

### Task 4: Runtime Data Source and Ingestion Task

**Files:**
- Runtime MySQL records only; no API key-bearing Git file.

**Interfaces:**
- Data source code: `aviationstack`
- Task code: `aviationstack_cz_can_flights`
- Target: source 22, table `ods_flight_schedule`

- [ ] **Step 1: Update the local Aviationstack data source**

Set base URL `https://api.aviationstack.com/v1`, API-key query authentication using parameter `access_key`, 30-second timeout, and active status. Supply the key only through the local authenticated runtime operation.

- [ ] **Step 2: Create or update the ingestion task**

Configure `/flights`, one offset page, `limit=100`, filters `airline_iata=CZ` and `dep_iata=CAN`, response path `data`, row adapter `aviationstack_flight_schedule`, target source 22, existing table mode, and source-specific upsert identity.

- [ ] **Step 3: Run source preview**

Verify every returned row has airline IATA `CZ` and departure IATA `CAN`. If Aviationstack returns zero current flights, preserve the successful zero-row run rather than broadening filters.

- [ ] **Step 4: Run the ingestion task**

Start the task through the authenticated platform API, poll to terminal status, and capture only task ID, run ID, status, read count and write count.

- [ ] **Step 5: Verify target data and idempotency**

Query `ods_flight_schedule` for `record_source='AVIATIONSTACK'`, validate all source rules, rerun once, and verify the same source identities are not duplicated and all 18 manual rows remain unchanged.

---

### Task 5: Full Verification and Git Publication

**Files:**
- Stage all intended source, SQL, Markdown, spec and plan files.
- Exclude generated/runtime files listed in Global Constraints.

- [ ] **Step 1: Run verification**

Run frontend clean install/tests/build, backend adapter test plus existing test suite, `git diff --check`, API health checks and database assertions.

- [ ] **Step 2: Review the complete diff**

Confirm no API key or other secret occurs in tracked content. Confirm only intended files are staged.

- [ ] **Step 3: Commit the implementation**

Use a terse commit describing ECharts 6, Aviationstack ingestion and field-level research relationships.

- [ ] **Step 4: Push the branch**

Run: `git push -u origin dev`

Expected: remote branch `origin/dev` is created or fast-forwarded to the local commit.

- [ ] **Step 5: Final remote verification**

Run `git rev-list --left-right --count dev...origin/dev` and expect `0 0`. Report runtime task/run IDs and verification results without disclosing the API key.
