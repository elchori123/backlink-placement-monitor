# Backlink Placement Monitor for Google Sheets

A Google Sheets + Apps Script workflow for monitoring backlink placements after publication.

Instead of treating a placement as permanently "done", the monitor checks whether the paid asset still works as expected: the donor page is reachable, the backlink is still present, the target resolves correctly, agreed anchor/rel values have not changed, and the placement's index status can be tracked over time.

## What it checks

For each active placement the monitor can track:

- placement HTTP status and redirects;
- whether the expected backlink is still present;
- actual target URL and final resolved target after redirects;
- anchor text;
- link type (`Dofollow`, `Nofollow`, `Sponsored`, `UGC`, or `Mixed`);
- target HTTP status;
- `meta robots` and canonical;
- placement index status via IndexCheckr;
- history of meaningful changes between runs;
- run-level health, errors, indexation metrics, API usage, and DataForSEO cost.

The main operating view uses three fields: **Health**, **Issue Type**, and **Action**. The goal is not to produce a decorative score, but to turn a detected problem into the next action.

## Stack

- Google Sheets
- Google Apps Script
- DataForSEO OnPage Instant Pages API
- IndexCheckr API

No separate server is required for a small monitoring list.

## Sheets created by the script

- **Link Monitor** — main registry and current state
- **Dashboard** — current health summary and action queue
- **History** — meaningful changes after the baseline is set
- **Runs** — execution log, metrics, errors, and API usage

## Installation

1. Create a new Google Sheet.
2. Open **Extensions → Apps Script**.
3. Replace the contents of `Code.gs` with the contents of [`Code.gs`](./Code.gs).
4. Save the Apps Script project and reload the spreadsheet.
5. Open **Link Monitor → Setup / Upgrade to v2**.
6. Open **Link Monitor → Set API Credentials** and enter:
   - DataForSEO API login
   - DataForSEO API password
   - IndexCheckr API token
7. Add your placements to **Link Monitor**. At minimum, provide:
   - Placement URL
   - Expected Target URL
8. Optionally add Expected Anchor and Expected Rel when these were part of the placement agreement.
9. Test a few rows with **Check Selected Rows**.
10. Run **Check All Active**.
11. After the first clean run, use **Set Current State as Baseline**.
12. Optionally enable **Install Weekly Trigger**.

## API credentials

Credentials are stored in Apps Script **Script Properties**, not in spreadsheet cells.

This prevents them from appearing in the working sheet or normal sheet exports, but it is not a separate secrets vault. Users with sufficient edit access to the bound Apps Script project may be able to read Script Properties. Only grant edit access to trusted users.

## Status logic

The monitor distinguishes between different kinds of problems instead of collapsing them into one score.

- **Healthy** — no detected issue
- **Warning** — placement still works, but something needs review
- **Critical** — the paid asset no longer works as expected
- **Error** — the technical check itself failed; previous known state should not be treated as lost
- **Pending** — the check or index status is not yet conclusive

A first `Not indexed` result is treated as a watch signal. A persistent negative result across separate observations can be escalated to an index issue.

## Redirect handling

The script follows HTTP redirects for both placement pages and target URLs. This matters because an old href can still resolve to the correct final target. Comparing URL strings alone would create false positives after site migrations or URL changes.

## Failure protection

The monitor is designed not to overwrite known-good technical state when an external API call fails for a row.

It also detects catastrophic runs where the same technical error affects most of the batch. In that case, the run is stopped safely and existing link statuses are preserved.

## What this does not do

This tool does **not**:

- evaluate donor quality before purchase;
- prove the ranking impact of an individual backlink;
- replace Search Console, rank tracking, or a full backlink-profile audit;
- guarantee Google's index state from a single third-party check.

Its scope is intentionally narrow: **monitor already-published placements and surface changes that need action**.

## Scale considerations

For a small list, Apps Script is sufficient. For hundreds or thousands of URLs, execution-time and `UrlFetch` quotas become relevant and the workflow should be split into resumable batches/triggers.

DataForSEO and IndexCheckr are paid external services. Check their current pricing and quotas before running large lists.

## Notes

This repository contains a generic, anonymized version of the monitor. Example domains in self-tests use `example.com` and are not tied to any production project.

Use on a copy of your sheet first and validate the output before relying on it for operational decisions.
