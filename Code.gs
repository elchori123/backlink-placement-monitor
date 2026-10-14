// ===== Config.gs =====
/**
 * Backlink Placement Monitor v2
 * Cleaner operating view, resolved-target checks, index persistence,
 * health/action model, dashboard and run trends.
 */

const BLM = Object.freeze({
  VERSION: '2.0.7',

  SHEETS: Object.freeze({
    MONITOR: 'Link Monitor',
    HISTORY: 'History',
    RUNS: 'Runs',
    DASHBOARD: 'Dashboard'
  }),

  DATAFORSEO: Object.freeze({
    INSTANT_PAGES_URL: 'https://api.dataforseo.com/v3/on_page/instant_pages',
    USER_DATA_URL: 'https://api.dataforseo.com/v3/appendix/user_data',
    MAX_TASKS_PER_REQUEST: 20,
    MAX_IDENTICAL_DOMAINS_PER_REQUEST: 5,
    MAX_REDIRECTS: 5,
    ENABLE_JS_FALLBACK: true,
    CATASTROPHIC_ERROR_RATIO: 0.75
  }),

  INDEXCHECKR: Object.freeze({
    BASE_URL: 'https://indexcheckr.com/api/v1',
    PROJECT_NAME: 'Backlink Placement Monitor',
    PROJECT_DESCRIPTION: 'Placement URLs monitored by the Backlink Placement Monitor for Google Sheets',
    TAG: 'backlink-placement-monitor',
    CHECK_PERIOD: 'weekly',
    ITEMS_PER_PAGE: 100,
    MAX_BULK_URLS: 2000,
    PERSISTENT_NOT_INDEXED_THRESHOLD: 2
  }),

  PROPERTIES: Object.freeze({
    DATAFORSEO_LOGIN: 'DATAFORSEO_LOGIN',
    DATAFORSEO_PASSWORD: 'DATAFORSEO_PASSWORD',
    INDEXCHECKR_TOKEN: 'INDEXCHECKR_TOKEN',
    INDEXCHECKR_PROJECT_ID: 'INDEXCHECKR_PROJECT_ID',
    SPREADSHEET_ID: 'SPREADSHEET_ID'
  }),

  HEALTH: Object.freeze({
    HEALTHY: 'Healthy',
    WARNING: 'Warning',
    CRITICAL: 'Critical',
    ERROR: 'Error',
    PENDING: 'Pending'
  }),

  STATUS: Object.freeze({
    HEALTHY: 'Healthy',
    CHANGED: 'Changed',
    INDEX_ISSUE: 'Index Issue',
    WATCH: 'Watch',
    REDIRECTED: 'Redirected',
    LOST: 'Lost',
    TARGET_ISSUE: 'Target Issue',
    ERROR: 'Error',
    PENDING: 'Pending',
    UNKNOWN: 'Unknown'
  }),

  // Main operating view is A:R. Everything from S onward is technical/detail data.
  HEADERS: Object.freeze([
    'ID',                         // A   1
    'Active',                     // B   2
    'Health',                     // C   3
    'Issue Type',                 // D   4
    'Action',                     // E   5
    'Donor Domain',               // F   6
    'Placement URL',              // G   7
    'Expected Target URL',        // H   8
    'Actual Target URL',          // I   9
    'Resolved Target URL',        // J  10
    'Expected Anchor',            // K  11
    'Actual Anchor',              // L  12
    'Link Type',                  // M  13
    'Index Status',               // N  14
    'Target HTTP',                // O  15
    'Working Asset',              // P  16
    'Indexed Asset',              // Q  17
    'Last Checked',               // R  18

    // Technical / secondary fields (hidden by default).
    'Campaign',                   // S  19
    'Price',                      // T  20
    'Published Date',             // U  21
    'Expected Rel',               // V  22
    'Placement HTTP',             // W  23
    'Final Placement URL',        // X  24
    'Redirected',                 // Y  25
    'Link Found',                 // Z  26
    'Target Match',               // AA 27
    'Target Redirected',          // AB 28
    'Resolved Target Match',      // AC 29
    'Actual Rel',                 // AD 30
    'Robots',                     // AE 31
    'Canonical',                  // AF 32
    'Index Last Checked',         // AG 33
    'IndexCheckr Page ID',        // AH 34
    'Consecutive Not Indexed',    // AI 35
    'Previous Index Status',      // AJ 36
    'Overall Status',             // AK 37
    'Issues',                     // AL 38
    'Last Change',                // AM 39
    'First Checked'               // AN 40
  ]),

  HISTORY_HEADERS: Object.freeze([
    'Timestamp',
    'Placement ID',
    'Placement URL',
    'Change Type',
    'Severity',
    'Field',
    'Old Value',
    'New Value',
    'Health',
    'Issue Type'
  ]),

  RUN_HEADERS: Object.freeze([
    'Run ID',
    'Started',
    'Finished',
    'Trigger',
    'Rows Checked',
    'Active',
    'Live',
    'Working Assets',
    'Indexed Assets',
    'Healthy',
    'Warning',
    'Critical',
    'Pending',
    'Errors',
    'Lost',
    'Changed',
    'Target Issues',
    'Index Issues',
    'IndexCheckr Checks',
    'IndexCheckr Credits Used',
    'DataForSEO Cost',
    'Healthy %',
    'Indexed %',
    'Notes'
  ])
});

// 1-based Google Sheet column numbers.
const COL = Object.freeze({
  ID: 1,
  ACTIVE: 2,
  HEALTH: 3,
  ISSUE_TYPE: 4,
  ACTION: 5,
  DONOR_DOMAIN: 6,
  PLACEMENT_URL: 7,
  EXPECTED_TARGET_URL: 8,
  ACTUAL_TARGET_URL: 9,
  RESOLVED_TARGET_URL: 10,
  EXPECTED_ANCHOR: 11,
  ACTUAL_ANCHOR: 12,
  LINK_TYPE: 13,
  INDEX_STATUS: 14,
  TARGET_HTTP: 15,
  WORKING_ASSET: 16,
  INDEXED_ASSET: 17,
  LAST_CHECKED: 18,
  CAMPAIGN: 19,
  PRICE: 20,
  PUBLISHED_DATE: 21,
  EXPECTED_REL: 22,
  PLACEMENT_HTTP: 23,
  FINAL_PLACEMENT_URL: 24,
  REDIRECTED: 25,
  LINK_FOUND: 26,
  TARGET_MATCH: 27,
  TARGET_REDIRECTED: 28,
  RESOLVED_TARGET_MATCH: 29,
  ACTUAL_REL: 30,
  ROBOTS: 31,
  CANONICAL: 32,
  INDEX_LAST_CHECKED: 33,
  INDEXCHECKR_PAGE_ID: 34,
  CONSECUTIVE_NOT_INDEXED: 35,
  PREVIOUS_INDEX_STATUS: 36,
  OVERALL_STATUS: 37,
  ISSUES: 38,
  LAST_CHANGE: 39,
  FIRST_CHECKED: 40
});

function getSpreadsheet_() {
  const props = getScriptProperties_();
  const id = props.getProperty(BLM.PROPERTIES.SPREADSHEET_ID);
  if (id) return SpreadsheetApp.openById(id);
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error('Spreadsheet context is unavailable. Run Setup once from the target sheet.');
  props.setProperty(BLM.PROPERTIES.SPREADSHEET_ID, active.getId());
  return active;
}

function getScriptProperties_() {
  return PropertiesService.getScriptProperties();
}

function getRequiredProperty_(key) {
  const value = getScriptProperties_().getProperty(key);
  if (!value) throw new Error('Missing Script Property: ' + key);
  return value;
}

function hasDataForSeoCredentials_() {
  const props = getScriptProperties_();
  return !!(props.getProperty(BLM.PROPERTIES.DATAFORSEO_LOGIN) && props.getProperty(BLM.PROPERTIES.DATAFORSEO_PASSWORD));
}

function hasIndexCheckrToken_() {
  return !!getScriptProperties_().getProperty(BLM.PROPERTIES.INDEXCHECKR_TOKEN);
}

// ===== Utils.gs =====
/** General helpers. */

function now_() {
  return new Date();
}

function uuid_() {
  return Utilities.getUuid();
}

function sleep_(ms) {
  Utilities.sleep(ms);
}

function asString_(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function trim_(value) {
  return asString_(value).trim();
}

function collapseWhitespace_(value) {
  return trim_(value).replace(/\s+/g, ' ');
}

function normalizeAnchor_(value) {
  return collapseWhitespace_(value).toLowerCase();
}

function normalizeRelTokens_(value) {
  const text = collapseWhitespace_(value).toLowerCase();
  if (!text) return [];
  return Array.from(new Set(text.split(' ').filter(Boolean))).sort();
}

function isHttpUrl_(url) {
  return /^https?:\/\//i.test(trim_(url));
}

function parseHttpUrl_(url) {
  const input = trim_(url);
  const match = input.match(/^(https?):\/\/([^\/?#]+)([^?#]*)(\?[^#]*)?(#.*)?$/i);
  if (!match) return null;

  let protocol = match[1].toLowerCase();
  let authority = match[2];
  let path = match[3] || '/';
  const query = match[4] || '';
  const fragment = match[5] || '';

  let hostname = authority;
  let port = '';
  const portMatch = authority.match(/^(.+?):(\d+)$/);
  if (portMatch) {
    hostname = portMatch[1];
    port = portMatch[2];
  }
  hostname = hostname.toLowerCase();
  if ((protocol === 'http' && port === '80') || (protocol === 'https' && port === '443')) port = '';

  if (!path.startsWith('/')) path = '/' + path;
  path = normalizePathSegments_(path);

  return {
    protocol: protocol,
    hostname: hostname,
    port: port,
    authority: hostname + (port ? ':' + port : ''),
    path: path,
    query: query,
    fragment: fragment
  };
}

function normalizePathSegments_(path) {
  const parts = (path || '/').split('/');
  const stack = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (!p || p === '.') continue;
    if (p === '..') {
      if (stack.length) stack.pop();
      continue;
    }
    stack.push(p);
  }
  return '/' + stack.join('/');
}

function normalizeHostname_(host) {
  let h = trim_(host).toLowerCase();
  if (h.startsWith('www.')) h = h.substring(4);
  return h;
}

function normalizeComparablePath_(path) {
  let p = path || '/';
  p = normalizePathSegments_(p);
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p || '/';
}

/** Full URL normalizer for storage/lookup. Keeps query, drops fragment. */
function normalizeFullUrl_(url) {
  const parsed = parseHttpUrl_(url);
  if (!parsed) return trim_(url);
  let path = parsed.path || '/';
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return parsed.protocol + '://' + parsed.authority + path + parsed.query;
}

/** Target comparator: scheme/query/fragment ignored; hostname and path matter. */
function normalizeTargetKey_(url) {
  const parsed = parseHttpUrl_(url);
  if (!parsed) return '';
  return normalizeHostname_(parsed.hostname) + normalizeComparablePath_(parsed.path);
}

function getHostname_(url) {
  const parsed = parseHttpUrl_(url);
  return parsed ? normalizeHostname_(parsed.hostname) : '';
}

function resolveUrl_(baseUrl, location) {
  const loc = trim_(location);
  if (!loc) return '';
  if (/^https?:\/\//i.test(loc)) return loc;

  const base = parseHttpUrl_(baseUrl);
  if (!base) return loc;

  if (loc.startsWith('//')) return base.protocol + ':' + loc;
  if (loc.startsWith('/')) return base.protocol + '://' + base.authority + loc;

  // Query-only redirect.
  if (loc.startsWith('?')) {
    return base.protocol + '://' + base.authority + base.path + loc;
  }

  const baseDir = base.path.replace(/\/[^\/]*$/, '/');
  const resolvedPath = normalizePathSegments_(baseDir + loc.split('?')[0].split('#')[0]);
  const suffixMatch = loc.match(/([?#].*)$/);
  const suffix = suffixMatch ? suffixMatch[1] : '';
  return base.protocol + '://' + base.authority + resolvedPath + suffix;
}

function urlsEquivalentForPlacement_(a, b) {
  const pa = parseHttpUrl_(a);
  const pb = parseHttpUrl_(b);
  if (!pa || !pb) return trim_(a) === trim_(b);
  return normalizeHostname_(pa.hostname) === normalizeHostname_(pb.hostname) &&
    normalizeComparablePath_(pa.path) === normalizeComparablePath_(pb.path);
}

function getLinkTypeFromRel_(rel) {
  const tokens = normalizeRelTokens_(rel);
  const hasNoFollow = tokens.indexOf('nofollow') !== -1;
  const hasSponsored = tokens.indexOf('sponsored') !== -1;
  const hasUgc = tokens.indexOf('ugc') !== -1;
  const count = [hasNoFollow, hasSponsored, hasUgc].filter(Boolean).length;
  if (count > 1) return 'Mixed';
  if (hasSponsored) return 'Sponsored';
  if (hasUgc) return 'UGC';
  if (hasNoFollow) return 'Nofollow';
  return 'Dofollow';
}

function relMatchesExpected_(expected, actualRel) {
  const exp = collapseWhitespace_(expected).toLowerCase();
  if (!exp) return true;
  const tokens = normalizeRelTokens_(actualRel);
  if (exp === 'dofollow' || exp === 'follow') {
    return tokens.indexOf('nofollow') === -1 && tokens.indexOf('sponsored') === -1 && tokens.indexOf('ugc') === -1;
  }
  if (exp === 'nofollow') return tokens.indexOf('nofollow') !== -1;
  if (exp === 'sponsored') return tokens.indexOf('sponsored') !== -1;
  if (exp === 'ugc') return tokens.indexOf('ugc') !== -1;
  return normalizeRelTokens_(expected).join(' ') === tokens.join(' ');
}

function isRedirectCode_(code) {
  const n = Number(code);
  return [301, 302, 303, 307, 308].indexOf(n) !== -1;
}

function isMissingCode_(code) {
  const n = Number(code);
  return n === 404 || n === 410;
}

function isBlockedOrTransientHttp_(code) {
  const n = Number(code);
  return n === 401 || n === 403 || n === 408 || n === 425 || n === 429 || n >= 500;
}

function formatDateForSheet_(date) {
  return date instanceof Date ? date : new Date(date);
}


function parseProviderDate_(value) {
  if (!value) return '';
  if (value instanceof Date) return value;
  let text = typeof value === 'object' && value.date ? String(value.date) : String(value);
  // Provider examples use UTC-like `YYYY-MM-DD HH:mm:ss.ffffff` and sometimes ` +00:00`.
  text = text.replace(/ \+00:00$/, '');
  const m = text.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?/);
  if (!m) {
    const d = new Date(text);
    return isNaN(d.getTime()) ? '' : d;
  }
  const ms = Number(((m[7] || '') + '000').slice(0, 3));
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]), ms));
}

function extractDateValue_(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value.date) return value.date;
  return asString_(value);
}

function safeJsonParse_(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

function truncate_(value, maxLen) {
  const text = asString_(value);
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen - 1) + '…';
}

function valuesEqual_(a, b) {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof Date || b instanceof Date) return asString_(a) === asString_(b);
  return String(a === null || a === undefined ? '' : a) === String(b === null || b === undefined ? '' : b);
}


// ===== Setup.gs =====
/** Sheet/setup, v1→v2 migration, dashboard and credentials. */

function setupMonitor() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  getScriptProperties_().setProperty(BLM.PROPERTIES.SPREADSHEET_ID, ss.getId());

  setupMonitorSheet_(ss);
  setupHistorySheet_(ss);
  setupRunsSheet_(ss);
  setupDashboardSheet_(ss);
  refreshDashboard_();

  SpreadsheetApp.flush();
  ss.toast('Link Placement Monitor v' + BLM.VERSION + ' is ready.', 'Backlink Monitor', 5);
}

function setupMonitorSheet_(ss) {
  let sheet = ss.getSheetByName(BLM.SHEETS.MONITOR);
  if (!sheet) sheet = ss.insertSheet(BLM.SHEETS.MONITOR);

  migrateSheetByHeaders_(sheet, BLM.HEADERS, {
    'Health': [],
    'Issue Type': [],
    'Action': [],
    'Resolved Target URL': [],
    'Target Redirected': [],
    'Resolved Target Match': [],
    'Working Asset': [],
    'Indexed Asset': [],
    'Consecutive Not Indexed': [],
    'Previous Index Status': []
  });

  if (sheet.getMaxColumns() < BLM.HEADERS.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), BLM.HEADERS.length - sheet.getMaxColumns());
  }

  seedMigratedV2State_(sheet);

  const headerRange = sheet.getRange(1, 1, 1, BLM.HEADERS.length);
  headerRange.setValues([BLM.HEADERS])
    .setFontWeight('bold')
    .setBackground('#202124')
    .setFontColor('#ffffff');

  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(2);

  if (sheet.getFilter()) sheet.getFilter().remove();
  sheet.getRange(1, 1, Math.max(2, sheet.getMaxRows()), BLM.HEADERS.length).createFilter();

  const dataRows = Math.max(1, sheet.getMaxRows() - 1);

  // The v1 sheet had Expected Rel in column H. During the v1→v2 header migration
  // Google Sheets keeps cell-level data-validation rules in their physical columns,
  // so the old dofollow/nofollow dropdown could remain attached to the new
  // Expected Target URL column. The monitor owns validation on its data area, so
  // clear legacy rules first and then recreate only the current v2 rules below.
  sheet.getRange(2, 1, dataRows, BLM.HEADERS.length).clearDataValidations();

  sheet.getRange(2, COL.ACTIVE, dataRows, 1).insertCheckboxes();

  sheet.getRange(2, COL.PRICE, dataRows, 1).setNumberFormat('$0.00');
  [
    COL.PUBLISHED_DATE,
    COL.LAST_CHECKED,
    COL.INDEX_LAST_CHECKED,
    COL.LAST_CHANGE,
    COL.FIRST_CHECKED
  ].forEach(col => {
    sheet.getRange(2, col, dataRows, 1).setNumberFormat('yyyy-mm-dd hh:mm');
  });

  const relRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['dofollow', 'nofollow', 'sponsored', 'ugc'], true)
    .setAllowInvalid(true)
    .build();
  sheet.getRange(2, COL.EXPECTED_REL, dataRows, 1).setDataValidation(relRule);

  applyStatusConditionalFormatting_(sheet);
  formatMainMonitorView_(sheet);
  hideTechnicalColumns_();
}

function migrateSheetByHeaders_(sheet, newHeaders, aliases) {
  aliases = aliases || {};
  const lastRow = Math.max(1, sheet.getLastRow());
  const lastCol = Math.max(1, sheet.getLastColumn());

  const oldHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(v => trim_(v));
  const hasAnyHeader = oldHeaders.some(Boolean);

  if (!hasAnyHeader) {
    if (sheet.getMaxColumns() < newHeaders.length) {
      sheet.insertColumnsAfter(sheet.getMaxColumns(), newHeaders.length - sheet.getMaxColumns());
    }
    sheet.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);
    return;
  }

  const same = newHeaders.length === oldHeaders.length &&
    newHeaders.every((h, i) => oldHeaders[i] === h);
  if (same) return;

  const oldIndex = {};
  oldHeaders.forEach((h, i) => {
    if (h && oldIndex[h] === undefined) oldIndex[h] = i;
  });

  const oldData = lastRow > 1
    ? sheet.getRange(2, 1, lastRow - 1, lastCol).getValues()
    : [];

  const newData = oldData.map(row => newHeaders.map(header => {
    let index = oldIndex[header];
    if (index === undefined && aliases[header]) {
      const list = Array.isArray(aliases[header]) ? aliases[header] : [aliases[header]];
      for (let i = 0; i < list.length; i++) {
        if (oldIndex[list[i]] !== undefined) {
          index = oldIndex[list[i]];
          break;
        }
      }
    }
    return index === undefined ? '' : row[index];
  }));

  if (sheet.getFilter()) sheet.getFilter().remove();

  if (sheet.getMaxColumns() < newHeaders.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), newHeaders.length - sheet.getMaxColumns());
  }

  const clearCols = Math.max(lastCol, newHeaders.length);
  sheet.getRange(1, 1, Math.max(1, lastRow), clearCols).clearContent();
  sheet.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);
  if (newData.length) {
    sheet.getRange(2, 1, newData.length, newHeaders.length).setValues(newData);
  }
}

function seedMigratedV2State_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const values = sheet.getRange(2, 1, lastRow - 1, BLM.HEADERS.length).getValues();
  const rows = values.map((v, i) => rowObjectFromValues_(v, i + 2));
  let changed = false;

  rows.forEach(row => {
    const v = row.values;
    if (!trim_(v[COL.PLACEMENT_URL - 1])) return;

    const indexStatus = trim_(v[COL.INDEX_STATUS - 1]);
    if ((indexStatus === 'Not indexed' || indexStatus === 'Domain not indexed') &&
        !Number(v[COL.CONSECUTIVE_NOT_INDEXED - 1] || 0)) {
      v[COL.CONSECUTIVE_NOT_INDEXED - 1] = 1;
      changed = true;
    }

    if (!trim_(v[COL.RESOLVED_TARGET_URL - 1]) &&
        v[COL.TARGET_MATCH - 1] === true &&
        trim_(v[COL.ACTUAL_TARGET_URL - 1])) {
      v[COL.RESOLVED_TARGET_URL - 1] = v[COL.ACTUAL_TARGET_URL - 1];
      v[COL.RESOLVED_TARGET_MATCH - 1] = true;
      changed = true;
    }

    if (Number(v[COL.PLACEMENT_HTTP - 1] || 0)) {
      applyComputedStatusToRow_(row, '');
      changed = true;
    }
  });

  if (changed) {
    sheet.getRange(2, 1, rows.length, BLM.HEADERS.length).setValues(rows.map(r => r.values));
  }
}

function formatMainMonitorView_(sheet) {
  const widths = {};
  widths[COL.ID] = 90;
  widths[COL.ACTIVE] = 60;
  widths[COL.HEALTH] = 90;
  widths[COL.ISSUE_TYPE] = 190;
  widths[COL.ACTION] = 240;
  widths[COL.DONOR_DOMAIN] = 155;
  widths[COL.PLACEMENT_URL] = 320;
  widths[COL.EXPECTED_TARGET_URL] = 270;
  widths[COL.ACTUAL_TARGET_URL] = 270;
  widths[COL.RESOLVED_TARGET_URL] = 270;
  widths[COL.EXPECTED_ANCHOR] = 190;
  widths[COL.ACTUAL_ANCHOR] = 190;
  widths[COL.LINK_TYPE] = 90;
  widths[COL.INDEX_STATUS] = 110;
  widths[COL.TARGET_HTTP] = 90;
  widths[COL.WORKING_ASSET] = 95;
  widths[COL.INDEXED_ASSET] = 95;
  widths[COL.LAST_CHECKED] = 145;
  widths[COL.ISSUES] = 420;

  Object.keys(widths).forEach(col => sheet.setColumnWidth(Number(col), widths[col]));
  sheet.getRange(1, 1, sheet.getMaxRows(), Math.min(18, sheet.getMaxColumns())).setVerticalAlignment('middle');
}

function hideTechnicalColumns_() {
  const sheet = getSpreadsheet_().getSheetByName(BLM.SHEETS.MONITOR);
  if (!sheet) return;
  try { sheet.showColumns(1, Math.min(18, sheet.getMaxColumns())); } catch (e) {}
  if (BLM.HEADERS.length > 18) {
    try { sheet.hideColumns(19, BLM.HEADERS.length - 18); } catch (e) {}
  }
}

function showTechnicalColumns_() {
  const sheet = getSpreadsheet_().getSheetByName(BLM.SHEETS.MONITOR);
  if (!sheet) return;
  try { sheet.showColumns(1, BLM.HEADERS.length); } catch (e) {}
}

function hideTechnicalColumns() {
  hideTechnicalColumns_();
  SpreadsheetApp.getActive().toast('Technical columns hidden.', 'Backlink Monitor', 3);
}

function showTechnicalColumns() {
  showTechnicalColumns_();
  SpreadsheetApp.getActive().toast('Technical columns shown.', 'Backlink Monitor', 3);
}

function applyStatusConditionalFormatting_(sheet) {
  const maxRows = Math.max(1, sheet.getMaxRows() - 1);
  const healthRange = sheet.getRange(2, COL.HEALTH, maxRows, 1);
  const issueRange = sheet.getRange(2, COL.ISSUE_TYPE, maxRows, 1);

  const rules = sheet.getConditionalFormatRules().filter(rule => {
    const ranges = rule.getRanges();
    return !ranges.some(r =>
      r.getColumn() === COL.HEALTH ||
      r.getColumn() === COL.ISSUE_TYPE
    );
  });

  const healthStyles = [
    [BLM.HEALTH.HEALTHY, '#d9ead3'],
    [BLM.HEALTH.WARNING, '#fff2cc'],
    [BLM.HEALTH.CRITICAL, '#f4cccc'],
    [BLM.HEALTH.ERROR, '#d9d9d9'],
    [BLM.HEALTH.PENDING, '#eeeeee']
  ];

  healthStyles.forEach(pair => {
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(pair[0])
      .setBackground(pair[1])
      .setBold(true)
      .setRanges([healthRange])
      .build());
  });

  // Apps Script has no whenTextNotEqualTo() on ConditionalFormatRuleBuilder.
  // Use a custom formula so every non-empty Issue Type cell is highlighted.
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=LEN($D2)>0')
    .setBackground('#fce5cd')
    .setRanges([issueRange])
    .build());

  sheet.setConditionalFormatRules(rules);
}

function setupHistorySheet_(ss) {
  let sheet = ss.getSheetByName(BLM.SHEETS.HISTORY);
  if (!sheet) sheet = ss.insertSheet(BLM.SHEETS.HISTORY);

  migrateSheetByHeaders_(sheet, BLM.HISTORY_HEADERS, {
    'Health': ['Overall Status'],
    'Change Type': [],
    'Severity': [],
    'Issue Type': []
  });

  sheet.getRange(1, 1, 1, BLM.HISTORY_HEADERS.length)
    .setFontWeight('bold').setBackground('#202124').setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(3, 320);
  sheet.setColumnWidth(4, 160);
  sheet.setColumnWidth(5, 90);
  sheet.setColumnWidth(7, 220);
  sheet.setColumnWidth(8, 220);
}

function setupRunsSheet_(ss) {
  let sheet = ss.getSheetByName(BLM.SHEETS.RUNS);
  if (!sheet) sheet = ss.insertSheet(BLM.SHEETS.RUNS);

  migrateSheetByHeaders_(sheet, BLM.RUN_HEADERS, {
    'Warning': ['Warnings'],
    'Errors': ['Errors'],
    'DataForSEO Cost': ['DataForSEO Cost']
  });

  sheet.getRange(1, 1, 1, BLM.RUN_HEADERS.length)
    .setFontWeight('bold').setBackground('#202124').setFontColor('#ffffff');
  sheet.setFrozenRows(1);

  // Re-apply formats by header name so old column formats do not survive migrations.
  // This fixes cases where Healthy/Warning/etc. inherited the old currency format.
  const rows = Math.max(1, sheet.getMaxRows() - 1);
  const countHeaders = [
    'Rows Checked', 'Active', 'Live', 'Working Assets', 'Indexed Assets',
    'Healthy', 'Warning', 'Critical', 'Pending', 'Errors', 'Lost', 'Changed',
    'Target Issues', 'Index Issues', 'IndexCheckr Checks', 'IndexCheckr Credits Used'
  ];
  countHeaders.forEach(name => {
    const col = runHeaderColumn_(name);
    if (col) sheet.getRange(2, col, rows, 1).setNumberFormat('0');
  });

  const startedCol = runHeaderColumn_('Started');
  const finishedCol = runHeaderColumn_('Finished');
  if (startedCol) sheet.getRange(2, startedCol, rows, 1).setNumberFormat('yyyy-mm-dd hh:mm');
  if (finishedCol) sheet.getRange(2, finishedCol, rows, 1).setNumberFormat('yyyy-mm-dd hh:mm');

  const dfsCostCol = runHeaderColumn_('DataForSEO Cost');
  if (dfsCostCol) sheet.getRange(2, dfsCostCol, rows, 1).setNumberFormat('$0.000000');

  ['Healthy %', 'Indexed %'].forEach(name => {
    const col = runHeaderColumn_(name);
    if (col) sheet.getRange(2, col, rows, 1).setNumberFormat('0.0%');
  });

  const notesCol = runHeaderColumn_('Notes');
  if (notesCol) sheet.setColumnWidth(notesCol, 420);
}

function runHeaderColumn_(name) {
  const index = BLM.RUN_HEADERS.indexOf(name);
  return index === -1 ? 0 : index + 1;
}

function runHeaderIndex_(name) {
  return BLM.RUN_HEADERS.indexOf(name);
}

function setupDashboardSheet_(ss) {
  let sheet = ss.getSheetByName(BLM.SHEETS.DASHBOARD);
  if (!sheet) sheet = ss.insertSheet(BLM.SHEETS.DASHBOARD);
  // Do not remove charts here. setupMonitor() calls refreshDashboard_() immediately
  // afterwards, and deleting the same embedded chart twice can produce a stale
  // chart reference in Google Sheets ("embedded object ... does not exist").
}

function removeAllChartsSafe_(sheet) {
  const charts = sheet.getCharts();
  charts.forEach(chart => {
    try {
      sheet.removeChart(chart);
    } catch (e) {
      const message = String(e && e.message ? e.message : e);
      // Google Sheets can briefly return a stale embedded-chart reference after
      // a previous chart deletion. It is already gone, so this specific error is safe to ignore.
      if (!/embedded object.*does not exist/i.test(message)) throw e;
    }
  });
  SpreadsheetApp.flush();
}

function refreshDashboard_() {
  const ss = getSpreadsheet_();
  let dash = ss.getSheetByName(BLM.SHEETS.DASHBOARD);
  if (!dash) {
    dash = ss.insertSheet(BLM.SHEETS.DASHBOARD);
  }

  const table = readMonitorTable_();
  const metrics = computeMonitorMetrics_(table.rows);

  removeAllChartsSafe_(dash);
  try { dash.getRange(1, 1, dash.getMaxRows(), Math.min(16, dash.getMaxColumns())).breakApart(); } catch (e) {}
  dash.clear();

  dash.getRange('A1:H1').merge()
    .setValue('Backlink Placement Monitor')
    .setFontSize(16)
    .setFontWeight('bold')
    .setBackground('#202124')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('left');

  dash.getRange('A2:H2').merge()
    .setValue('Current health of monitored link placements')
    .setFontColor('#5f6368');

  const labels1 = [['Active Links', '', 'Live Links', '', 'Working Assets', '', 'Working + Indexed', '']];
  const values1 = [[
    metrics.active, '',
    metrics.live + ' / ' + percentText_(metrics.live, metrics.active), '',
    metrics.working + ' / ' + percentText_(metrics.working, metrics.active), '',
    metrics.indexedAssets + ' / ' + percentText_(metrics.indexedAssets, metrics.active), ''
  ]];

  dash.getRange(4, 1, 1, 8).setValues(labels1).setFontWeight('bold').setFontColor('#5f6368');
  dash.getRange(5, 1, 1, 8).setValues(values1).setFontSize(14).setFontWeight('bold');

  const labels2 = [['Healthy', '', 'Warning', '', 'Critical', '', 'Action Required', '']];
  const values2 = [[
    metrics.healthy, '',
    metrics.warning, '',
    metrics.critical, '',
    metrics.actionRequired, ''
  ]];
  dash.getRange(7, 1, 1, 8).setValues(labels2).setFontWeight('bold').setFontColor('#5f6368');
  dash.getRange(8, 1, 1, 8).setValues(values2).setFontSize(14).setFontWeight('bold');

  dash.getRange('A10:E10').setValues([['Donor', 'Health', 'Issue', 'Target', 'Action']])
    .setFontWeight('bold').setBackground('#202124').setFontColor('#ffffff');

  const actionRows = buildDashboardActionRows_(table.rows);
  if (actionRows.length) {
    dash.getRange(11, 1, actionRows.length, 5).setValues(actionRows);
  } else {
    dash.getRange('A11').setValue('No issues requiring action.');
  }

  // Helper data for charts (hidden later).
  dash.getRange('N1:O1').setValues([['Health', 'Count']]);
  dash.getRange('N2:O6').setValues([
    ['Healthy', metrics.healthy],
    ['Warning', metrics.warning],
    ['Critical', metrics.critical],
    ['Error', metrics.error],
    ['Pending', metrics.pending]
  ]);

  dash.getRange('N8:O8').setValues([['Index', 'Count']]);
  dash.getRange('N9:O11').setValues([
    ['Indexed', metrics.indexed],
    ['Not indexed', metrics.notIndexed],
    ['Pending / Unknown', metrics.indexPending]
  ]);

  const trend = getRunTrendData_();
  dash.getRange('N14:P14').setValues([['Run', 'Healthy %', 'Indexed %']]);
  if (trend.length) {
    dash.getRange(15, 14, trend.length, 3).setValues(trend);
    dash.getRange(15, 15, trend.length, 2).setNumberFormat('0.0%');
  }

  const healthChart = dash.newChart()
    .setChartType(Charts.ChartType.BAR)
    .addRange(dash.getRange('N1:O6'))
    .setNumHeaders(1)
    .setPosition(10, 7, 0, 0)
    .setOption('title', 'Health distribution')
    .setOption('legend', { position: 'none' })
    .setOption('height', 280)
    .setOption('width', 520)
    .build();
  dash.insertChart(healthChart);

  const indexChart = dash.newChart()
    .setChartType(Charts.ChartType.PIE)
    .addRange(dash.getRange('N8:O11'))
    .setNumHeaders(1)
    .setPosition(27, 7, 0, 0)
    .setOption('title', 'Placement index status')
    .setOption('pieHole', 0.5)
    .setOption('height', 280)
    .setOption('width', 520)
    .build();
  dash.insertChart(indexChart);

  if (trend.length >= 2) {
    const trendChart = dash.newChart()
      .setChartType(Charts.ChartType.LINE)
      .addRange(dash.getRange(14, 14, trend.length + 1, 3))
      .setNumHeaders(1)
      .setPosition(Math.max(45, 13 + actionRows.length), 1, 0, 0)
      .setOption('title', 'Health and indexation over time')
      .setOption('vAxis', { format: '0%' })
      .setOption('height', 300)
      .setOption('width', 780)
      .build();
    dash.insertChart(trendChart);
  }

  dash.setColumnWidth(1, 170);
  dash.setColumnWidth(2, 95);
  dash.setColumnWidth(3, 220);
  dash.setColumnWidth(4, 280);
  dash.setColumnWidth(5, 260);
  for (let c = 6; c <= 8; c++) dash.setColumnWidth(c, 120);

  try { dash.hideColumns(14, 3); } catch (e) {}
}

function percentText_(value, total) {
  if (!total) return '0.0%';
  return (100 * Number(value || 0) / Number(total)).toFixed(1) + '%';
}

function buildDashboardActionRows_(rows) {
  const priority = { 'Critical': 1, 'Error': 2, 'Warning': 3, 'Pending': 4, 'Healthy': 5 };
  return rows
    .filter(row => row.active && [BLM.HEALTH.WARNING, BLM.HEALTH.CRITICAL, BLM.HEALTH.ERROR].indexOf(trim_(row.values[COL.HEALTH - 1])) !== -1)
    .sort((a, b) => {
      const pa = priority[trim_(a.values[COL.HEALTH - 1])] || 9;
      const pb = priority[trim_(b.values[COL.HEALTH - 1])] || 9;
      return pa - pb;
    })
    .map(row => [
      trim_(row.values[COL.DONOR_DOMAIN - 1]),
      trim_(row.values[COL.HEALTH - 1]),
      trim_(row.values[COL.ISSUE_TYPE - 1]),
      trim_(row.values[COL.RESOLVED_TARGET_URL - 1]) || trim_(row.values[COL.EXPECTED_TARGET_URL - 1]),
      trim_(row.values[COL.ACTION - 1])
    ]);
}

function getRunTrendData_() {
  const sheet = getSpreadsheet_().getSheetByName(BLM.SHEETS.RUNS);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const startedIdx = runHeaderIndex_('Started');
  const activeIdx = runHeaderIndex_('Active');
  const healthyPctIdx = runHeaderIndex_('Healthy %');
  const indexedPctIdx = runHeaderIndex_('Indexed %');

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, BLM.RUN_HEADERS.length).getValues();
  const rows = values
    .filter(r => r[startedIdx] && Number(r[activeIdx] || 0) > 0 && !isCatastrophicRunRecord_(r))
    .slice(-20);
  return rows.map(r => [
    r[startedIdx],
    Number(r[healthyPctIdx] || 0),
    Number(r[indexedPctIdx] || 0)
  ]);
}

function isCatastrophicRunRecord_(runRow) {
  if (!runRow) return false;
  const rowsChecked = Number(runRow[runHeaderIndex_('Rows Checked')] || 0);
  const errors = Number(runRow[runHeaderIndex_('Errors')] || 0);
  const notes = trim_(runRow[runHeaderIndex_('Notes')] || '');
  if (/^FAILED_GLOBAL:/i.test(notes)) return true;
  return rowsChecked >= 3 && errors / rowsChecked >= BLM.DATAFORSEO.CATASTROPHIC_ERROR_RATIO;
}

function setApiCredentials() {
  const ui = SpreadsheetApp.getUi();
  const props = getScriptProperties_();

  const login = promptSecretLike_(ui, 'DataForSEO API login', 'Enter your DataForSEO API login (not your normal account password).');
  if (login === null) return;
  const password = promptSecretLike_(ui, 'DataForSEO API password', 'Enter the API password from DataForSEO → API Access.');
  if (password === null) return;
  const token = promptSecretLike_(ui, 'IndexCheckr API token', 'Enter your IndexCheckr X-AUTH-TOKEN value.');
  if (token === null) return;

  props.setProperties({
    [BLM.PROPERTIES.DATAFORSEO_LOGIN]: login,
    [BLM.PROPERTIES.DATAFORSEO_PASSWORD]: password,
    [BLM.PROPERTIES.INDEXCHECKR_TOKEN]: token
  }, false);

  ui.alert('Credentials saved in Script Properties. They are not written to the spreadsheet.');
}

function promptSecretLike_(ui, title, message) {
  const result = ui.prompt(title, message + '\n\nGoogle Sheets prompts are not masked while typing.', ui.ButtonSet.OK_CANCEL);
  if (result.getSelectedButton() !== ui.Button.OK) return null;
  const value = result.getResponseText().trim();
  if (!value) throw new Error(title + ' cannot be empty.');
  return value;
}

// ===== Menu.gs =====
/** UI menu and public wrappers. */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🔗 Link Monitor')
    .addItem('Setup / Upgrade to v2', 'setupMonitor')
    .addItem('Set API Credentials', 'setApiCredentials')
    .addItem('Test API Connections', 'testApiConnections')
    .addSeparator()
    .addItem('Check Selected Rows', 'checkSelectedRows')
    .addItem('Check All Active', 'checkAllActive')
    .addSeparator()
    .addItem('Sync IndexCheckr', 'syncIndexCheckr')
    .addItem('Refresh Index Status', 'refreshIndexStatuses')
    .addSeparator()
    .addItem('Refresh Dashboard', 'refreshDashboard')
    .addItem('Cleanup Failed Test Artifacts', 'cleanupFailedTestArtifacts')
    .addItem('Set Current State as Baseline', 'setCurrentStateAsBaseline')
    .addItem('Show Technical Columns', 'showTechnicalColumns')
    .addItem('Hide Technical Columns', 'hideTechnicalColumns')
    .addSeparator()
    .addItem('Install Weekly Trigger', 'installWeeklyTrigger')
    .addItem('Remove Trigger', 'removeWeeklyTrigger')
    .addSeparator()
    .addItem('Run Self-tests', 'runSelfTests')
    .addToUi();
}

function refreshDashboard() {
  refreshDashboard_();
  SpreadsheetApp.getActive().toast('Dashboard refreshed.', 'Backlink Monitor', 3);
}

function setCurrentStateAsBaseline() {
  const ui = SpreadsheetApp.getUi();
  const ss = getSpreadsheet_();
  const history = ss.getSheetByName(BLM.SHEETS.HISTORY);
  const monitor = ss.getSheetByName(BLM.SHEETS.MONITOR);

  const historyCount = history && history.getLastRow() >= 2 ? history.getLastRow() - 1 : 0;
  const answer = ui.alert(
    'Set current state as baseline',
    'This will clear ' + historyCount + ' History event(s) and reset Last Change timestamps.\n\n' +
      'Current Link Monitor values, index statuses, not-indexed counters, First Checked dates, Runs and API settings will be preserved.\n\n' +
      'Use this once after setup/testing so future History contains only real changes from the current state.',
    ui.ButtonSet.YES_NO
  );
  if (answer !== ui.Button.YES) return;

  if (history && history.getMaxRows() > 1) {
    history.getRange(2, 1, history.getMaxRows() - 1, BLM.HISTORY_HEADERS.length).clearContent();
  }

  if (monitor && monitor.getLastRow() >= 2) {
    monitor.getRange(2, COL.LAST_CHANGE, monitor.getLastRow() - 1, 1).clearContent();
  }

  refreshDashboard_();
  SpreadsheetApp.flush();
  ui.alert(
    'Baseline set',
    'History was cleared and the current Link Monitor state is now the baseline.\n\nFuture checks will record only changes from this point forward.',
    ui.ButtonSet.OK
  );
}

function cleanupFailedTestArtifacts() {
  const ui = SpreadsheetApp.getUi();
  const ss = getSpreadsheet_();
  const runs = ss.getSheetByName(BLM.SHEETS.RUNS);
  if (!runs || runs.getLastRow() < 2) {
    ui.alert('No failed runs found.');
    return;
  }

  const runValues = runs.getRange(2, 1, runs.getLastRow() - 1, BLM.RUN_HEADERS.length).getValues();
  const candidates = [];
  runValues.forEach((row, index) => {
    if (!isCatastrophicRunRecord_(row)) return;
    candidates.push({
      sheetRow: index + 2,
      started: row[runHeaderIndex_('Started')],
      finished: row[runHeaderIndex_('Finished')],
      trigger: trim_(row[runHeaderIndex_('Trigger')]),
      rowsChecked: Number(row[runHeaderIndex_('Rows Checked')] || 0),
      errors: Number(row[runHeaderIndex_('Errors')] || 0)
    });
  });

  if (!candidates.length) {
    ui.alert('No catastrophic/failed test runs were detected.');
    return;
  }

  const preview = candidates.slice(-5).map(item => {
    const started = item.started instanceof Date
      ? Utilities.formatDate(item.started, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')
      : String(item.started);
    return started + ' | ' + item.trigger + ' | ' + item.errors + '/' + item.rowsChecked + ' errors';
  }).join('\n');

  const answer = ui.alert(
    'Cleanup failed test artifacts',
    'Detected ' + candidates.length + ' catastrophic run(s).\n\n' + preview +
      '\n\nThis will delete those run rows and History events created during their run windows. Current Link Monitor data will not be deleted.',
    ui.ButtonSet.YES_NO
  );
  if (answer !== ui.Button.YES) return;

  const windows = candidates.map(item => ({
    start: dateMs_(item.started) - 5000,
    end: dateMs_(item.finished || item.started) + 5000
  }));

  candidates.slice().sort((a, b) => b.sheetRow - a.sheetRow).forEach(item => runs.deleteRow(item.sheetRow));

  let removedHistory = 0;
  const history = ss.getSheetByName(BLM.SHEETS.HISTORY);
  if (history && history.getLastRow() >= 2) {
    const hValues = history.getRange(2, 1, history.getLastRow() - 1, BLM.HISTORY_HEADERS.length).getValues();
    const kept = hValues.filter(row => {
      const ts = dateMs_(row[0]);
      const remove = !!ts && windows.some(w => ts >= w.start && ts <= w.end);
      if (remove) removedHistory++;
      return !remove;
    });

    history.getRange(2, 1, history.getMaxRows() - 1, BLM.HISTORY_HEADERS.length).clearContent();
    if (kept.length) history.getRange(2, 1, kept.length, BLM.HISTORY_HEADERS.length).setValues(kept);
  }

  rebuildLastChangeFromHistory_();
  refreshDashboard_();
  SpreadsheetApp.flush();

  ui.alert(
    'Cleanup complete',
    'Removed failed runs: ' + candidates.length + '\nRemoved History events: ' + removedHistory +
      '\nCurrent Link Monitor values were preserved.',
    ui.ButtonSet.OK
  );
}

function dateMs_(value) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  const d = new Date(value);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

function rebuildLastChangeFromHistory_() {
  const ss = getSpreadsheet_();
  const monitor = ss.getSheetByName(BLM.SHEETS.MONITOR);
  if (!monitor || monitor.getLastRow() < 2) return;

  const history = ss.getSheetByName(BLM.SHEETS.HISTORY);
  const latestById = {};
  if (history && history.getLastRow() >= 2) {
    const hValues = history.getRange(2, 1, history.getLastRow() - 1, BLM.HISTORY_HEADERS.length).getValues();
    hValues.forEach(row => {
      const id = trim_(row[1]);
      const ms = dateMs_(row[0]);
      if (!id || !ms) return;
      if (!latestById[id] || ms > latestById[id].ms) latestById[id] = { ms: ms, value: row[0] };
    });
  }

  const values = monitor.getRange(2, 1, monitor.getLastRow() - 1, BLM.HEADERS.length).getValues();
  values.forEach(row => {
    const id = trim_(row[COL.ID - 1]);
    row[COL.LAST_CHANGE - 1] = latestById[id] ? latestById[id].value : '';
  });
  monitor.getRange(2, 1, values.length, BLM.HEADERS.length).setValues(values);
}

function testApiConnections() {
  const ui = SpreadsheetApp.getUi();
  const messages = [];

  try {
    const dfs = testDataForSeoConnection_();
    messages.push('DataForSEO: Connected' + (dfs.balance !== '' ? ' | Balance: $' + dfs.balance : ''));
  } catch (e) {
    messages.push('DataForSEO: ERROR — ' + e.message);
  }

  try {
    const idx = testIndexCheckrConnection_();
    messages.push('IndexCheckr: Connected | Credits: ' + idx.credits);
  } catch (e) {
    messages.push('IndexCheckr: ERROR — ' + e.message);
  }

  ui.alert(messages.join('\n\n'));
}

function checkSelectedRows() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BLM.SHEETS.MONITOR);
  if (!sheet) throw new Error('Run Setup first.');
  const range = sheet.getActiveRange();
  if (!range || range.getRow() < 2) throw new Error('Select one or more data rows in Link Monitor.');
  const rowNumbers = [];
  for (let r = range.getRow(); r <= range.getLastRow(); r++) if (r >= 2) rowNumbers.push(r);
  runMonitor_({ triggerLabel: 'Manual selected', selectedRows: rowNumbers, showToast: true });
}

function checkAllActive() {
  runMonitor_({ triggerLabel: 'Manual all', selectedRows: null, showToast: true });
}

function runScheduledMonitor() {
  runMonitor_({ triggerLabel: 'Weekly trigger', selectedRows: null, showToast: false });
}

function installWeeklyTrigger() {
  removeWeeklyTrigger_(false);
  ScriptApp.newTrigger('runScheduledMonitor')
    .timeBased()
    .everyWeeks(1)
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(8)
    .create();
  SpreadsheetApp.getUi().alert('Weekly trigger installed: Monday around 08:00 in the script timezone.');
}

function removeWeeklyTrigger() {
  const count = removeWeeklyTrigger_(true);
  SpreadsheetApp.getUi().alert('Removed ' + count + ' Link Monitor trigger(s).');
}

function removeWeeklyTrigger_(notify) {
  let count = 0;
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'runScheduledMonitor') {
      ScriptApp.deleteTrigger(trigger);
      count++;
    }
  });
  return count;
}

// ===== DataForSEO.gs =====
/** DataForSEO OnPage Instant Pages client and placement parsing. */

function dataForSeoAuthHeader_() {
  const login = getRequiredProperty_(BLM.PROPERTIES.DATAFORSEO_LOGIN);
  const password = getRequiredProperty_(BLM.PROPERTIES.DATAFORSEO_PASSWORD);
  return 'Basic ' + Utilities.base64Encode(login + ':' + password);
}

function dataForSeoFetch_(method, url, payload) {
  const options = {
    method: method,
    muteHttpExceptions: true,
    headers: {
      'Authorization': dataForSeoAuthHeader_(),
      'Accept': 'application/json'
    }
  };
  if (payload !== undefined && payload !== null) {
    options.contentType = 'application/json';
    options.payload = JSON.stringify(payload);
  }

  const delays = [0, 1000, 3000];
  let lastError = null;
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt]) sleep_(delays[attempt]);
    try {
      const response = UrlFetchApp.fetch(url, options);
      const code = response.getResponseCode();
      const body = response.getContentText();
      if (code === 429 || code >= 500) {
        lastError = new Error('DataForSEO HTTP ' + code + ': ' + truncate_(body, 300));
        continue;
      }
      if (code < 200 || code >= 300) throw new Error('DataForSEO HTTP ' + code + ': ' + truncate_(body, 500));
      const json = safeJsonParse_(body);
      if (!json) throw new Error('DataForSEO returned invalid JSON.');
      return json;
    } catch (e) {
      lastError = e;
      if (attempt === delays.length - 1) throw e;
    }
  }
  throw lastError || new Error('DataForSEO request failed.');
}

function testDataForSeoConnection_() {
  const json = dataForSeoFetch_('get', BLM.DATAFORSEO.USER_DATA_URL);
  if (Number(json.status_code) !== 20000) throw new Error(json.status_message || 'API status ' + json.status_code);
  let balance = '';
  try {
    balance = json.tasks[0].result[0].money.balance;
  } catch (e) {}
  return { ok: true, balance: balance };
}

/**
 * Main placement crawl. Returns {resultsByRow, cost}.
 * Each input row must have rowNumber, placementUrl, targetUrl.
 */
function crawlPlacements_(rows) {
  let totalCost = 0;
  const resultsByRow = {};
  if (!rows.length) return { resultsByRow: resultsByRow, cost: 0 };

  const initial = crawlPlacementStates_(rows.map(row => ({
    rowNumber: row.rowNumber,
    id: row.id,
    placementUrl: row.placementUrl,
    targetUrl: row.targetUrl,
    expectedAnchor: row.expectedAnchor || ''
  })), false);

  totalCost += initial.cost;
  Object.keys(initial.resultsByRow).forEach(key => { resultsByRow[key] = initial.resultsByRow[key]; });

  if (BLM.DATAFORSEO.ENABLE_JS_FALLBACK) {
    const fallbackRows = [];
    rows.forEach(row => {
      const result = resultsByRow[row.rowNumber];
      if (result && result.ok && Number(result.finalHttp) === 200 && !result.linkFound) {
        fallbackRows.push({
          rowNumber: row.rowNumber,
          id: row.id,
          placementUrl: result.finalUrl || row.placementUrl,
          targetUrl: row.targetUrl,
          expectedAnchor: row.expectedAnchor || ''
        });
      }
    });

    if (fallbackRows.length) {
      const fallback = crawlPlacementStates_(fallbackRows, true);
      totalCost += fallback.cost;
      fallbackRows.forEach(row => {
        const base = resultsByRow[row.rowNumber];
        const fb = fallback.resultsByRow[row.rowNumber];
        if (!base || !fb) return;
        if (fb.ok) {
          base.linkFound = fb.linkFound;
          base.targetMatch = fb.targetMatch;
          base.actualTarget = fb.actualTarget;
          base.anchor = fb.anchor;
          base.rel = fb.rel;
          base.linkType = fb.linkType;
          base.robots = fb.robots || base.robots;
          base.canonical = fb.canonical || base.canonical;
          base.linksToDomainCount = fb.linksToDomainCount;
          base.usedJsFallback = true;
        } else {
          // Static result remains authoritative; fallback failure is diagnostic only.
          base.jsFallbackError = fb.error || 'JS fallback failed';
        }
        base.cost = Number(base.cost || 0) + Number(fb.cost || 0);
      });
    }
  }

  return { resultsByRow: resultsByRow, cost: totalCost };
}

/**
 * Crawls placement URLs, follows HTTP redirects manually up to MAX_REDIRECTS,
 * and runs custom_js against the final HTML page.
 */
function crawlPlacementStates_(entries, enableJavascript) {
  const states = entries.map(entry => ({
    rowNumber: entry.rowNumber,
    id: entry.id,
    originalUrl: entry.placementUrl,
    currentUrl: entry.placementUrl,
    targetUrl: entry.targetUrl,
    expectedAnchor: entry.expectedAnchor || '',
    initialHttp: '',
    finalHttp: '',
    finalUrl: entry.placementUrl,
    redirected: false,
    redirectCount: 0,
    seen: {},
    done: false,
    ok: true,
    error: '',
    linkFound: false,
    targetMatch: false,
    actualTarget: '',
    anchor: '',
    rel: '',
    linkType: '',
    robots: '',
    canonical: '',
    linksToDomainCount: 0,
    cost: 0
  }));

  for (let step = 0; step <= BLM.DATAFORSEO.MAX_REDIRECTS; step++) {
    const active = states.filter(s => !s.done);
    if (!active.length) break;

    const batches = buildHostSafeBatches_(active, BLM.DATAFORSEO.MAX_TASKS_PER_REQUEST, BLM.DATAFORSEO.MAX_IDENTICAL_DOMAINS_PER_REQUEST);
    batches.forEach(batch => {
      const tasks = batch.map(state => ({
        url: state.currentUrl,
        enable_javascript: !!enableJavascript,
        switch_pool: true,
        return_despite_timeout: true,
        custom_js: buildPlacementCustomJs_(state.targetUrl, state.expectedAnchor)
      }));

      let response;
      try {
        response = dataForSeoFetch_('post', BLM.DATAFORSEO.INSTANT_PAGES_URL, tasks);
      } catch (e) {
        batch.forEach(state => {
          state.ok = false;
          state.error = e.message;
          state.done = true;
        });
        return;
      }

      const responseTasks = response.tasks || [];
      batch.forEach((state, index) => {
        const task = responseTasks[index];
        if (!task) {
          state.ok = false;
          state.error = 'DataForSEO returned no task result for ' + state.currentUrl;
          state.done = true;
          return;
        }
        state.cost += Number(task.cost || 0);

        if (Number(task.status_code) !== 20000) {
          state.ok = false;
          state.error = 'DataForSEO task ' + task.status_code + ': ' + (task.status_message || 'Unknown task error');
          state.done = true;
          return;
        }

        const item = getFirstDataForSeoItem_(task);
        if (!item) {
          state.ok = false;
          state.error = 'DataForSEO returned no page item for ' + state.currentUrl;
          state.done = true;
          return;
        }

        const http = Number(item.status_code || 0);
        if (state.initialHttp === '') state.initialHttp = http || '';
        state.finalHttp = http || '';
        state.finalUrl = item.url || state.currentUrl;

        const redirectLocation = item.location || '';
        if (isRedirectCode_(http) && redirectLocation) {
          if (step >= BLM.DATAFORSEO.MAX_REDIRECTS) {
            state.ok = false;
            state.error = 'Redirect limit exceeded (' + BLM.DATAFORSEO.MAX_REDIRECTS + ')';
            state.done = true;
            return;
          }
          const nextUrl = resolveUrl_(state.currentUrl, redirectLocation);
          const key = normalizeFullUrl_(nextUrl);
          if (!nextUrl || state.seen[key]) {
            state.ok = false;
            state.error = 'Redirect loop or invalid Location header.';
            state.done = true;
            return;
          }
          state.seen[normalizeFullUrl_(state.currentUrl)] = true;
          state.seen[key] = true;
          state.redirected = true;
          state.redirectCount++;
          state.currentUrl = nextUrl;
          return;
        }

        if (item.custom_js_client_exception) {
          state.ok = false;
          state.error = 'custom_js error: ' + item.custom_js_client_exception;
          state.done = true;
          return;
        }
        applyCustomJsToPlacementState_(state, item.custom_js_response, item);
        if (state.error) state.ok = false;
        state.done = true;
      });
    });
  }

  states.filter(s => !s.done).forEach(state => {
    state.ok = false;
    state.error = 'Crawl did not finish.';
    state.done = true;
  });

  const resultsByRow = {};
  let cost = 0;
  states.forEach(state => {
    cost += Number(state.cost || 0);
    resultsByRow[state.rowNumber] = {
      ok: state.ok,
      error: state.error,
      initialHttp: state.initialHttp,
      finalHttp: state.finalHttp,
      finalUrl: state.finalUrl,
      redirected: state.redirected,
      linkFound: state.linkFound,
      targetMatch: state.targetMatch,
      actualTarget: state.actualTarget,
      anchor: state.anchor,
      rel: state.rel,
      linkType: state.linkType,
      robots: state.robots,
      canonical: state.canonical,
      linksToDomainCount: state.linksToDomainCount,
      cost: state.cost,
      usedJsFallback: enableJavascript
    };
  });
  return { resultsByRow: resultsByRow, cost: cost };
}

function buildHostSafeBatches_(states, maxTasks, maxSameHost) {
  const pending = states.slice();
  const batches = [];
  while (pending.length) {
    const batch = [];
    const hostCounts = {};
    for (let i = 0; i < pending.length && batch.length < maxTasks;) {
      const state = pending[i];
      const host = getHostname_(state.currentUrl) || '__unknown__';
      const count = hostCounts[host] || 0;
      if (count < maxSameHost) {
        batch.push(state);
        hostCounts[host] = count + 1;
        pending.splice(i, 1);
      } else {
        i++;
      }
    }
    // Safety: should never happen, but avoid an infinite loop.
    if (!batch.length) batch.push(pending.shift());
    batches.push(batch);
  }
  return batches;
}

function getFirstDataForSeoItem_(task) {
  try {
    const result = task.result && task.result[0];
    const items = result && result.items;
    return items && items.length ? items[0] : null;
  } catch (e) {
    return null;
  }
}

function applyCustomJsToPlacementState_(state, custom, item) {
  let data = custom && typeof custom === 'object' ? custom : {};
  if (typeof custom === 'string') {
    const parsed = safeJsonParse_(custom);
    if (parsed && typeof parsed === 'object') data = parsed;
  }
  if (data.error) {
    state.error = 'custom_js: ' + data.error;
    return;
  }
  state.robots = data.robots || '';
  state.canonical = data.canonical || (item.meta && item.meta.canonical) || '';
  state.linksToDomainCount = Number(data.links_to_target_domain || 0);
  const best = data.best_link || null;
  if (!best) {
    state.linkFound = false;
    state.targetMatch = false;
    state.actualTarget = '';
    state.anchor = '';
    state.rel = '';
    state.linkType = '';
    return;
  }
  state.linkFound = true;
  state.targetMatch = !!best.exact_target;
  state.actualTarget = best.href || '';
  state.anchor = best.anchor || '';
  state.rel = best.rel || '';
  state.linkType = getLinkTypeFromRel_(state.rel);
}

function buildPlacementCustomJs_(targetUrl, expectedAnchor) {
  const targetLiteral = JSON.stringify(trim_(targetUrl));
  const anchorLiteral = JSON.stringify(collapseWhitespace_(expectedAnchor || '').toLowerCase());

  // DataForSEO OnPage custom_js has a 2,000-character limit.
  // Keep this deliberately compact while preserving exact-target -> anchor -> first-link selection.
  return '(function(){' +
    'var T=' + targetLiteral + ',E=' + anchorLiteral + ';' +
    'function h(x){x=(x||"").toLowerCase();return x.indexOf("www.")===0?x.slice(4):x}' +
    'function p(x){x=x||"/";return x.length>1&&x.charAt(x.length-1)==="/"?x.slice(0,-1):x}' +
    'function n(x){return (x||"").replace(/\\s+/g," ").trim().toLowerCase()}' +
    'var o={robots:"",canonical:"",links_to_target_domain:0,best_link:null};' +
    'try{' +
      'var t=document.createElement("a");t.href=T;var H=h(t.hostname),P=p(t.pathname),R=[],M=document.querySelectorAll("meta[name=robots],meta[name=googlebot]");' +
      'for(var i=0;i<M.length;i++){var c=(M[i].getAttribute("content")||"").trim();if(c)R.push(c)}o.robots=R.join(" | ");' +
      'var C=document.querySelector("link[rel~=canonical]");if(C)o.canonical=C.href||C.getAttribute("href")||"";' +
      'var A=document.querySelectorAll("a[href]"),x=[],a,u,q,l,e,z;' +
      'for(i=0;i<A.length;i++){a=A[i];q=a.getAttribute("href");if(!q)continue;u=document.createElement("a");u.href=q;if(!u.hostname||h(u.hostname)!==H)continue;' +
      'l=(a.textContent||"").replace(/\\s+/g," ").trim();if(!l){z=a.querySelector("img[alt]");l=z&&z.getAttribute("alt")?"[image: "+z.getAttribute("alt").trim()+"]":"[empty anchor]"}' +
      'e=(a.getAttribute("rel")||"").replace(/\\s+/g," ").trim();x.push({href:u.href,anchor:l,rel:e,exact_target:p(u.pathname)===P,anchor_match:!!E&&n(l)===E})}' +
      'o.links_to_target_domain=x.length;' +
      'for(i=0;i<x.length;i++)if(x[i].exact_target){o.best_link=x[i];break}' +
      'if(!o.best_link&&E)for(i=0;i<x.length;i++)if(x[i].anchor_match){o.best_link=x[i];break}' +
      'if(!o.best_link&&x.length)o.best_link=x[0]' +
    '}catch(e){o.error=String(e&&e.message?e.message:e)}return o})()';
}
/** Checks unique target URLs and follows redirects. */
function checkTargetUrls_(urls) {
  const unique = {};
  urls.forEach(url => {
    const u = trim_(url);
    if (u) unique[normalizeFullUrl_(u)] = u;
  });

  const states = Object.keys(unique).map(key => ({
    key: key,
    originalUrl: unique[key],
    currentUrl: unique[key],
    initialHttp: '',
    finalHttp: '',
    finalUrl: unique[key],
    redirected: false,
    seen: {},
    done: false,
    ok: true,
    error: '',
    cost: 0
  }));

  for (let step = 0; step <= BLM.DATAFORSEO.MAX_REDIRECTS; step++) {
    const active = states.filter(s => !s.done);
    if (!active.length) break;
    const batches = buildHostSafeBatches_(active, BLM.DATAFORSEO.MAX_TASKS_PER_REQUEST, BLM.DATAFORSEO.MAX_IDENTICAL_DOMAINS_PER_REQUEST);
    batches.forEach(batch => {
      const tasks = batch.map(state => ({
        url: state.currentUrl,
        enable_javascript: false,
        switch_pool: true,
        return_despite_timeout: true
      }));
      let response;
      try {
        response = dataForSeoFetch_('post', BLM.DATAFORSEO.INSTANT_PAGES_URL, tasks);
      } catch (e) {
        batch.forEach(state => { state.ok = false; state.error = e.message; state.done = true; });
        return;
      }
      const responseTasks = response.tasks || [];
      batch.forEach((state, index) => {
        const task = responseTasks[index];
        if (!task) { state.ok = false; state.error = 'No target task result'; state.done = true; return; }
        state.cost += Number(task.cost || 0);
        if (Number(task.status_code) !== 20000) {
          state.ok = false;
          state.error = 'DataForSEO task ' + task.status_code + ': ' + (task.status_message || 'Unknown target error');
          state.done = true;
          return;
        }
        const item = getFirstDataForSeoItem_(task);
        if (!item) { state.ok = false; state.error = 'No target page item'; state.done = true; return; }
        const http = Number(item.status_code || 0);
        if (state.initialHttp === '') state.initialHttp = http || '';
        state.finalHttp = http || '';
        state.finalUrl = item.url || state.currentUrl;
        if (isRedirectCode_(http) && item.location) {
          if (step >= BLM.DATAFORSEO.MAX_REDIRECTS) {
            state.ok = false; state.error = 'Target redirect limit exceeded'; state.done = true; return;
          }
          const nextUrl = resolveUrl_(state.currentUrl, item.location);
          const nextKey = normalizeFullUrl_(nextUrl);
          if (!nextUrl || state.seen[nextKey]) {
            state.ok = false; state.error = 'Target redirect loop'; state.done = true; return;
          }
          state.seen[normalizeFullUrl_(state.currentUrl)] = true;
          state.seen[nextKey] = true;
          state.redirected = true;
          state.currentUrl = nextUrl;
          return;
        }
        state.done = true;
      });
    });
  }

  const byUrl = {};
  let cost = 0;
  states.forEach(state => {
    cost += Number(state.cost || 0);
    byUrl[state.key] = {
      ok: state.ok,
      error: state.error,
      initialHttp: state.initialHttp,
      finalHttp: state.finalHttp,
      finalUrl: state.finalUrl,
      redirected: state.redirected,
      cost: state.cost
    };
  });
  return { byUrl: byUrl, cost: cost };
}


// ===== IndexCheckr.gs =====
/** IndexCheckr API client. */

function indexCheckrToken_() {
  return getRequiredProperty_(BLM.PROPERTIES.INDEXCHECKR_TOKEN);
}

function indexCheckrFetch_(method, path, payload, query) {
  let url = BLM.INDEXCHECKR.BASE_URL + path;
  if (query && Object.keys(query).length) {
    const parts = [];
    Object.keys(query).forEach(key => {
      if (query[key] === null || query[key] === undefined || query[key] === '') return;
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(query[key]));
    });
    if (parts.length) url += '?' + parts.join('&');
  }

  const options = {
    method: method,
    muteHttpExceptions: true,
    headers: {
      'Accept': 'application/json',
      'X-AUTH-TOKEN': indexCheckrToken_()
    }
  };
  if (payload !== undefined && payload !== null) {
    options.contentType = 'application/json';
    options.payload = JSON.stringify(payload);
  }

  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = UrlFetchApp.fetch(url, options);
      const code = response.getResponseCode();
      const body = response.getContentText();
      if (code === 429) {
        const headers = response.getAllHeaders ? response.getAllHeaders() : {};
        const retry = Number(headers['Retry-After'] || headers['retry-after'] || 2);
        lastError = new Error('IndexCheckr rate limit reached.');
        sleep_(Math.max(1, retry) * 1000);
        continue;
      }
      if (code === 503 || code >= 500) {
        lastError = new Error('IndexCheckr HTTP ' + code + ': ' + truncate_(body, 300));
        sleep_((attempt + 1) * 1500);
        continue;
      }
      if (code === 402) throw new Error('IndexCheckr: insufficient credits.');
      if (code < 200 || code >= 300) throw new Error('IndexCheckr HTTP ' + code + ': ' + truncate_(body, 500));
      if (code === 204 || !body) return { status: 'ok', data: null };
      const json = safeJsonParse_(body);
      if (!json) throw new Error('IndexCheckr returned invalid JSON.');
      return json;
    } catch (e) {
      lastError = e;
      if (attempt === 2 || /insufficient credits/i.test(e.message)) throw e;
    }
  }
  throw lastError || new Error('IndexCheckr request failed.');
}

function getIndexCheckrCreditsBalance_() {
  const creditsJson = indexCheckrFetch_('get', '/user/credits');
  const raw = creditsJson && creditsJson.data ? creditsJson.data.credits : '';
  if (raw === '' || raw === null || raw === undefined) return null;
  const value = Number(raw);
  return isFinite(value) ? value : null;
}

function testIndexCheckrConnection_() {
  const credits = getIndexCheckrCreditsBalance_();
  indexCheckrFetch_('get', '/projects');
  return { ok: true, credits: credits === null ? '' : credits };
}

function ensureIndexCheckrProject_() {
  const props = getScriptProperties_();
  const stored = props.getProperty(BLM.PROPERTIES.INDEXCHECKR_PROJECT_ID);
  if (stored) {
    try {
      const project = indexCheckrFetch_('get', '/projects/' + encodeURIComponent(stored));
      if (project && project.data && project.data.id) return Number(project.data.id);
    } catch (e) {
      // Stored project may have been deleted; fall through to discovery/creation.
    }
  }

  let page = 1;
  while (page <= 50) {
    const json = indexCheckrFetch_('get', '/projects', null, { page: page });
    const data = json.data || [];
    for (let i = 0; i < data.length; i++) {
      if (data[i].name === BLM.INDEXCHECKR.PROJECT_NAME) {
        props.setProperty(BLM.PROPERTIES.INDEXCHECKR_PROJECT_ID, String(data[i].id));
        return Number(data[i].id);
      }
    }
    const meta = json.meta || {};
    if (!meta.pageCount || page >= Number(meta.pageCount)) break;
    page++;
  }

  const created = indexCheckrFetch_('post', '/projects', {
    name: BLM.INDEXCHECKR.PROJECT_NAME,
    shortDescription: BLM.INDEXCHECKR.PROJECT_DESCRIPTION,
    isStarred: false
  });
  if (!created.data || !created.data.id) throw new Error('IndexCheckr project could not be created.');
  props.setProperty(BLM.PROPERTIES.INDEXCHECKR_PROJECT_ID, String(created.data.id));
  return Number(created.data.id);
}

function getIndexCheckrPages_(projectId) {
  const all = [];
  let page = 1;
  let pageCount = 1;
  do {
    const query = { itemsPerPage: BLM.INDEXCHECKR.ITEMS_PER_PAGE };
    if (page > 1) query.page = page;
    const json = indexCheckrFetch_('get', '/project/' + projectId + '/pages', null, query);
    (json.data || []).forEach(item => all.push(item));
    const meta = json.meta || {};
    pageCount = Number(meta.pageCount || meta.last || 1);
    page++;
  } while (page <= pageCount && page <= 200);
  return all;
}

function addIndexCheckrPages_(projectId, urls) {
  const clean = Array.from(new Set(urls.map(trim_).filter(Boolean)));
  const created = [];
  for (let i = 0; i < clean.length; i += BLM.INDEXCHECKR.MAX_BULK_URLS) {
    const chunk = clean.slice(i, i + BLM.INDEXCHECKR.MAX_BULK_URLS);
    const json = indexCheckrFetch_('post', '/project/' + projectId + '/pages', {
      url: chunk.join('\n'),
      checkPeriod: BLM.INDEXCHECKR.CHECK_PERIOD,
      stopCheckWhenIndexed: false,
      tags: [BLM.INDEXCHECKR.TAG]
    });
    (json.data || []).forEach(item => created.push(item));
  }
  return created;
}

function normalizeIndexStatus_(raw) {
  const status = trim_(raw).toLowerCase();
  if (status === 'page_indexed' || status === 'indexed') return 'Indexed';
  if (status === 'page_not_indexed' || status === 'not_indexed') return 'Not indexed';
  if (status === 'domain_not_indexed') return 'Domain not indexed';
  if (status === 'being_processed' || status === 'none') return 'Pending';
  if (status === 'not_available') return 'Unknown';
  return status ? raw : 'Unknown';
}

function indexPageMap_(pages) {
  const map = {};
  pages.forEach(page => {
    const key = normalizeFullUrl_(page.url || '');
    if (!key) return;
    map[key] = page;
  });
  return map;
}

/**
 * Synchronizes active placement URLs with IndexCheckr and returns the current page map.
 * Creating a new IndexCheckr page triggers its first paid index check on the provider side.
 */
function syncIndexCheckrRows_(rows) {
  const projectId = ensureIndexCheckrProject_();
  let pages = getIndexCheckrPages_(projectId);
  let map = indexPageMap_(pages);

  const missing = [];
  rows.forEach(row => {
    const url = trim_(row.placementUrl);
    if (!url) return;
    const key = normalizeFullUrl_(url);
    if (!map[key]) missing.push(url);
  });

  if (missing.length) {
    const created = addIndexCheckrPages_(projectId, missing);
    created.forEach(page => {
      const key = normalizeFullUrl_(page.url || '');
      if (key) map[key] = page;
    });
    // Re-read once so URLs skipped as already existing/normalized are also resolved.
    pages = getIndexCheckrPages_(projectId);
    map = indexPageMap_(pages);
  }
  return { projectId: projectId, pageMap: map };
}

function getIndexCheckrCurrentMap_() {
  const projectId = ensureIndexCheckrProject_();
  return { projectId: projectId, pageMap: indexPageMap_(getIndexCheckrPages_(projectId)) };
}


// ===== SheetRepository.gs =====
/** Spreadsheet read/write helpers. */

function getMonitorSheet_() {
  const sheet = getSpreadsheet_().getSheetByName(BLM.SHEETS.MONITOR);
  if (!sheet) throw new Error('Link Monitor sheet does not exist. Run Setup first.');
  return sheet;
}

function readMonitorTable_() {
  const sheet = getMonitorSheet_();
  const lastRow = Math.max(1, sheet.getLastRow());
  if (lastRow < 2) return { sheet: sheet, values: [], rows: [] };
  const values = sheet.getRange(2, 1, lastRow - 1, BLM.HEADERS.length).getValues();
  const rows = values.map((valueRow, index) => rowObjectFromValues_(valueRow, index + 2));
  return { sheet: sheet, values: values, rows: rows };
}

function rowObjectFromValues_(values, rowNumber) {
  return {
    rowNumber: rowNumber,
    values: values,
    id: trim_(values[COL.ID - 1]),
    active: values[COL.ACTIVE - 1] === true,
    campaign: trim_(values[COL.CAMPAIGN - 1]),
    donorDomain: trim_(values[COL.DONOR_DOMAIN - 1]),
    placementUrl: trim_(values[COL.PLACEMENT_URL - 1]),
    targetUrl: trim_(values[COL.EXPECTED_TARGET_URL - 1]),
    expectedAnchor: trim_(values[COL.EXPECTED_ANCHOR - 1]),
    expectedRel: trim_(values[COL.EXPECTED_REL - 1])
  };
}

function refreshRowObject_(row) {
  const updated = rowObjectFromValues_(row.values, row.rowNumber);
  Object.keys(updated).forEach(k => row[k] = updated[k]);
  return row;
}

function ensureIdentifiers_(rows) {
  let maxId = 0;
  rows.forEach(row => {
    const m = trim_(row.values[COL.ID - 1]).match(/^BLM-(\d+)$/i);
    if (m) maxId = Math.max(maxId, Number(m[1]));
  });

  rows.forEach(row => {
    if (!trim_(row.values[COL.PLACEMENT_URL - 1])) return;
    if (!trim_(row.values[COL.ID - 1])) {
      maxId++;
      row.values[COL.ID - 1] = 'BLM-' + String(maxId).padStart(4, '0');
    }
    const host = getHostname_(row.values[COL.PLACEMENT_URL - 1]);
    if (host) row.values[COL.DONOR_DOMAIN - 1] = host;
    refreshRowObject_(row);
  });
}

function writeMonitorTable_(sheet, values) {
  if (!values.length) return;
  sheet.getRange(2, 1, values.length, BLM.HEADERS.length).setValues(values);
}

function appendHistoryEvents_(events) {
  if (!events.length) return;
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(BLM.SHEETS.HISTORY);
  if (!sheet) {
    setupHistorySheet_(ss);
    sheet = ss.getSheetByName(BLM.SHEETS.HISTORY);
  }
  sheet.getRange(sheet.getLastRow() + 1, 1, events.length, BLM.HISTORY_HEADERS.length).setValues(events);
}

function appendRunLog_(run) {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(BLM.SHEETS.RUNS);

  // Keep the log schema safe even if a user forgets to run Setup after an upgrade.
  let needsSetup = !sheet;
  if (sheet) {
    const currentHeaders = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0].map(v => trim_(v));
    needsSetup = BLM.RUN_HEADERS.some((header, i) => currentHeaders[i] !== header);
  }
  if (needsSetup) {
    setupRunsSheet_(ss);
    sheet = ss.getSheetByName(BLM.SHEETS.RUNS);
  }

  const row = [[
    run.runId,
    run.started,
    run.finished,
    run.triggerLabel,
    run.rowsChecked,
    run.active,
    run.live,
    run.working,
    run.indexedAssets,
    run.healthy,
    run.warning,
    run.critical,
    run.pending,
    run.errors,
    run.lost,
    run.changed,
    run.targetIssues,
    run.indexIssues,
    run.indexChecks,
    run.indexCreditsUsed,
    run.cost,
    run.healthyPct,
    run.indexedPct,
    run.notes || ''
  ]];

  sheet.getRange(sheet.getLastRow() + 1, 1, 1, BLM.RUN_HEADERS.length).setValues(row);
}

function snapshotTrackedState_(rows) {
  const map = {};
  rows.forEach(row => {
    const v = row.values;
    const id = trim_(v[COL.ID - 1]) || 'ROW-' + row.rowNumber;
    map[id] = {
      id: id,
      rowNumber: row.rowNumber,
      placementUrl: v[COL.PLACEMENT_URL - 1],
      firstChecked: v[COL.FIRST_CHECKED - 1],
      values: v.slice()
    };
  });
  return map;
}

function computeMonitorMetrics_(rows) {
  const metrics = {
    active: 0,
    live: 0,
    working: 0,
    indexedAssets: 0,
    healthy: 0,
    warning: 0,
    critical: 0,
    error: 0,
    pending: 0,
    indexed: 0,
    notIndexed: 0,
    indexPending: 0,
    actionRequired: 0,
    lost: 0,
    changed: 0,
    targetIssues: 0,
    indexIssues: 0
  };

  rows.forEach(row => {
    refreshRowObject_(row);
    if (!row.active || !row.placementUrl) return;
    metrics.active++;

    const v = row.values;
    const http = Number(v[COL.PLACEMENT_HTTP - 1] || 0);
    const linkFound = v[COL.LINK_FOUND - 1] === true;
    if (http === 200 && linkFound) metrics.live++;
    if (v[COL.WORKING_ASSET - 1] === true) metrics.working++;
    if (v[COL.INDEXED_ASSET - 1] === true) metrics.indexedAssets++;

    const health = trim_(v[COL.HEALTH - 1]);
    if (health === BLM.HEALTH.HEALTHY) metrics.healthy++;
    else if (health === BLM.HEALTH.WARNING) metrics.warning++;
    else if (health === BLM.HEALTH.CRITICAL) metrics.critical++;
    else if (health === BLM.HEALTH.ERROR) metrics.error++;
    else metrics.pending++;

    if ([BLM.HEALTH.WARNING, BLM.HEALTH.CRITICAL, BLM.HEALTH.ERROR].indexOf(health) !== -1) {
      metrics.actionRequired++;
    }

    const index = trim_(v[COL.INDEX_STATUS - 1]);
    if (index === 'Indexed') metrics.indexed++;
    else if (index === 'Not indexed' || index === 'Domain not indexed') metrics.notIndexed++;
    else metrics.indexPending++;

    const status = trim_(v[COL.OVERALL_STATUS - 1]);
    if (status === BLM.STATUS.LOST) metrics.lost++;
    if (status === BLM.STATUS.CHANGED) metrics.changed++;
    if (status === BLM.STATUS.TARGET_ISSUE) metrics.targetIssues++;
    if (status === BLM.STATUS.INDEX_ISSUE || status === BLM.STATUS.WATCH) metrics.indexIssues++;
  });

  return metrics;
}

// ===== StatusEngine.gs =====
/** Health, issue classification, actions and working-asset logic. */

function calculateOverallStatusForRow_(row, technicalError) {
  const v = row.values;
  const issues = [];
  const types = [];
  const actions = [];

  const result = {
    health: BLM.HEALTH.PENDING,
    issueType: '',
    action: 'Wait for first check',
    status: BLM.STATUS.PENDING,
    issues: '',
    workingAsset: false,
    indexedAsset: false
  };

  if (technicalError) {
    result.health = BLM.HEALTH.ERROR;
    result.issueType = 'Technical check error';
    result.action = 'Retry technical check';
    result.status = BLM.STATUS.ERROR;
    result.issues = 'Technical check error: ' + technicalError;
    return result;
  }

  const placementHttp = Number(v[COL.PLACEMENT_HTTP - 1] || 0);
  const redirected = v[COL.REDIRECTED - 1] === true;
  const linkFound = v[COL.LINK_FOUND - 1] === true;
  const directTargetMatch = v[COL.TARGET_MATCH - 1] === true;
  const targetRedirected = v[COL.TARGET_REDIRECTED - 1] === true;
  const resolvedTargetMatch = v[COL.RESOLVED_TARGET_MATCH - 1] === true;
  const actualAnchor = trim_(v[COL.ACTUAL_ANCHOR - 1]);
  const actualRel = trim_(v[COL.ACTUAL_REL - 1]);
  const expectedAnchor = trim_(v[COL.EXPECTED_ANCHOR - 1]);
  const expectedRel = trim_(v[COL.EXPECTED_REL - 1]);
  const targetHttp = Number(v[COL.TARGET_HTTP - 1] || 0);
  const indexStatus = trim_(v[COL.INDEX_STATUS - 1]);
  const consecutiveNotIndexed = Number(v[COL.CONSECUTIVE_NOT_INDEXED - 1] || 0);
  const robots = trim_(v[COL.ROBOTS - 1]).toLowerCase();
  const canonical = trim_(v[COL.CANONICAL - 1]);
  const finalUrl = trim_(v[COL.FINAL_PLACEMENT_URL - 1]) || trim_(v[COL.PLACEMENT_URL - 1]);

  if (!placementHttp) {
    result.health = BLM.HEALTH.PENDING;
    result.issueType = 'Not checked';
    result.action = 'Run technical check';
    result.status = BLM.STATUS.UNKNOWN;
    result.issues = 'Placement has not been technically checked yet';
    return result;
  }

  if (isMissingCode_(placementHttp)) {
    result.health = BLM.HEALTH.CRITICAL;
    result.issueType = 'Placement lost';
    result.action = 'Contact donor / restore placement';
    result.status = BLM.STATUS.LOST;
    result.issues = 'Placement HTTP ' + placementHttp;
    return result;
  }

  if (isBlockedOrTransientHttp_(placementHttp) || placementHttp >= 400) {
    result.health = BLM.HEALTH.ERROR;
    result.issueType = 'Placement verification error';
    result.action = 'Retry technical check';
    result.status = BLM.STATUS.ERROR;
    result.issues = 'Placement could not be verified reliably: HTTP ' + placementHttp;
    return result;
  }

  if (placementHttp === 200 && !linkFound) {
    result.health = BLM.HEALTH.CRITICAL;
    result.issueType = 'Link missing';
    result.action = 'Contact donor / restore link';
    result.status = BLM.STATUS.LOST;
    result.issues = 'Expected-domain link not found';
    return result;
  }

  let critical = false;
  let changed = false;
  let indexIssue = false;
  let watchOnly = false;

  // Resolved target comparison has priority over the raw href comparison.
  if (linkFound && !resolvedTargetMatch) {
    changed = true;
    types.push('Target mismatch');
    actions.push('Verify target / contact donor');
    issues.push('Resolved target does not match expected target');
  } else if (linkFound && !directTargetMatch && resolvedTargetMatch) {
    changed = true;
    types.push('Target redirect');
    actions.push('Verify redirect is intentional');
    issues.push('Link href differs, but redirect resolves to the expected target');
  } else if (targetRedirected) {
    changed = true;
    types.push('Target redirect');
    actions.push('Verify redirect is intentional');
    issues.push('Target URL redirects');
  }

  if (expectedAnchor && normalizeAnchor_(expectedAnchor) !== normalizeAnchor_(actualAnchor)) {
    changed = true;
    types.push('Anchor changed');
    actions.push('Verify placement agreement');
    issues.push('Anchor changed: expected "' + expectedAnchor + '", got "' + actualAnchor + '"');
  }

  if (expectedRel && !relMatchesExpected_(expectedRel, actualRel)) {
    changed = true;
    types.push('Rel changed');
    actions.push('Contact donor');
    issues.push('Rel changed: expected "' + expectedRel + '", got "' + (actualRel || '[empty]') + '"');
  }

  if (targetHttp) {
    if (isMissingCode_(targetHttp) || targetHttp >= 500) {
      critical = true;
      types.push('Target HTTP ' + targetHttp);
      actions.push('Restore target or add 301 redirect');
      issues.push('Target HTTP ' + targetHttp);
    } else if (targetHttp >= 400) {
      critical = true;
      types.push('Target HTTP ' + targetHttp);
      actions.push('Review target availability');
      issues.push('Target could not be verified reliably: HTTP ' + targetHttp);
    }
  }

  if (robots.indexOf('noindex') !== -1) {
    indexIssue = true;
    types.push('Noindex');
    actions.push('Review placement indexability');
    issues.push('Placement robots contains noindex');
  }

  if (canonical && finalUrl && !urlsEquivalentForPlacement_(canonical, finalUrl)) {
    indexIssue = true;
    types.push('Canonical elsewhere');
    actions.push('Review placement canonical');
    issues.push('Canonical points to another URL: ' + canonical);
  }

  if (indexStatus === 'Not indexed' || indexStatus === 'Domain not indexed') {
    if (consecutiveNotIndexed >= BLM.INDEXCHECKR.PERSISTENT_NOT_INDEXED_THRESHOLD) {
      indexIssue = true;
      types.push('Persistent not indexed');
      actions.push('Review placement indexation');
      issues.push('IndexCheckr: ' + indexStatus + ' for ' + consecutiveNotIndexed + ' consecutive checks');
    } else {
      watchOnly = true;
      types.push('Index watch');
      actions.push('Recheck next index run');
      issues.push('IndexCheckr: ' + indexStatus + ' (first observed check)');
    }
  }

  if (redirected) {
    changed = true;
    types.push('Placement redirect');
    actions.push('Verify new placement URL');
    issues.push('Placement URL redirects to ' + finalUrl);
  }

  const relOk = !expectedRel || relMatchesExpected_(expectedRel, actualRel);
  result.workingAsset =
    placementHttp === 200 &&
    linkFound &&
    resolvedTargetMatch &&
    relOk &&
    targetHttp === 200;

  result.indexedAsset = result.workingAsset && indexStatus === 'Indexed';

  if (critical) {
    result.health = BLM.HEALTH.CRITICAL;
    result.status = BLM.STATUS.TARGET_ISSUE;
  } else if (changed) {
    result.health = BLM.HEALTH.WARNING;
    result.status = BLM.STATUS.CHANGED;
  } else if (indexIssue) {
    result.health = BLM.HEALTH.WARNING;
    result.status = BLM.STATUS.INDEX_ISSUE;
  } else if (watchOnly) {
    result.health = BLM.HEALTH.WARNING;
    result.status = BLM.STATUS.WATCH;
  } else if (indexStatus === 'Pending' || !indexStatus || indexStatus === 'Unknown') {
    result.health = BLM.HEALTH.PENDING;
    result.status = BLM.STATUS.PENDING;
    if (!types.length) types.push(indexStatus === 'Unknown' ? 'Index unknown' : 'Index pending');
    if (!actions.length) actions.push(indexStatus === 'Unknown' ? 'Refresh index status' : 'Wait for IndexCheckr');
    if (!issues.length) issues.push(indexStatus === 'Unknown' ? 'Index status unknown' : 'IndexCheckr check pending');
  } else {
    result.health = BLM.HEALTH.HEALTHY;
    result.status = BLM.STATUS.HEALTHY;
    result.action = '—';
  }

  if (result.health !== BLM.HEALTH.HEALTHY) {
    result.issueType = uniqueList_(types).join('; ');
    result.action = chooseAction_(actions, result.health);
  }

  result.issues = uniqueList_(issues).join('; ');
  return result;
}

function uniqueList_(items) {
  const seen = {};
  const out = [];
  (items || []).forEach(item => {
    const value = trim_(item);
    if (!value || seen[value]) return;
    seen[value] = true;
    out.push(value);
  });
  return out;
}

function chooseAction_(actions, health) {
  const list = uniqueList_(actions);
  if (!list.length) {
    if (health === BLM.HEALTH.ERROR) return 'Retry technical check';
    if (health === BLM.HEALTH.PENDING) return 'Wait for next check';
    return 'Review';
  }

  const priority = [
    'Restore target or add 301 redirect',
    'Contact donor / restore link',
    'Contact donor / restore placement',
    'Contact donor',
    'Verify target / contact donor',
    'Review target availability',
    'Review placement indexation',
    'Review placement indexability',
    'Review placement canonical',
    'Verify placement agreement',
    'Verify redirect is intentional',
    'Verify new placement URL',
    'Recheck next index run',
    'Retry technical check',
    'Refresh index status',
    'Wait for IndexCheckr'
  ];

  for (let i = 0; i < priority.length; i++) {
    if (list.indexOf(priority[i]) !== -1) return priority[i];
  }
  return list[0];
}

// ===== History.gs =====
/** Human-readable change tracking. */

const TRACKED_FIELDS = Object.freeze([
  ['Placement HTTP', COL.PLACEMENT_HTTP],
  ['Final URL', COL.FINAL_PLACEMENT_URL],
  ['Link Found', COL.LINK_FOUND],
  ['Resolved Target Match', COL.RESOLVED_TARGET_MATCH],
  ['Actual Target', COL.ACTUAL_TARGET_URL],
  ['Resolved Target URL', COL.RESOLVED_TARGET_URL],
  ['Anchor', COL.ACTUAL_ANCHOR],
  ['Rel', COL.ACTUAL_REL],
  ['Target HTTP', COL.TARGET_HTTP],
  ['Index Status', COL.INDEX_STATUS],
  ['Consecutive Not Indexed', COL.CONSECUTIVE_NOT_INDEXED],
  ['Health', COL.HEALTH],
  ['Issue Type', COL.ISSUE_TYPE]
]);

function buildHistoryEvents_(beforeMap, rows, rowFilterSet, timestamp) {
  const events = [];
  const changedIds = {};

  rows.forEach(row => {
    if (rowFilterSet && !rowFilterSet[row.rowNumber]) return;

    const id = trim_(row.values[COL.ID - 1]) || 'ROW-' + row.rowNumber;
    const before = beforeMap[id];
    if (!before) return;

    // First successful observation establishes the baseline.
    if (!before.firstChecked) return;

    TRACKED_FIELDS.forEach(def => {
      const label = def[0];
      const col = def[1];
      const oldValue = before.values[col - 1];
      const newValue = row.values[col - 1];
      if (valuesEqual_(oldValue, newValue)) return;

      const classification = classifyHistoryChange_(label, oldValue, newValue);
      events.push([
        timestamp,
        id,
        row.values[COL.PLACEMENT_URL - 1],
        classification.type,
        classification.severity,
        label,
        oldValue,
        newValue,
        row.values[COL.HEALTH - 1],
        row.values[COL.ISSUE_TYPE - 1]
      ]);
      changedIds[id] = true;
    });
  });

  rows.forEach(row => {
    const id = trim_(row.values[COL.ID - 1]) || 'ROW-' + row.rowNumber;
    if (changedIds[id]) row.values[COL.LAST_CHANGE - 1] = timestamp;
  });

  return events;
}

function classifyHistoryChange_(field, oldValue, newValue) {
  const oldText = trim_(oldValue);
  const newText = trim_(newValue);

  if (field === 'Link Found') {
    if (String(newValue) === 'false' || newValue === false) return { type: 'Link Lost', severity: 'Critical' };
    if (String(newValue) === 'true' || newValue === true) return { type: 'Link Restored', severity: 'Resolved' };
  }

  if (field === 'Index Status') {
    if (oldText === 'Indexed' && (newText === 'Not indexed' || newText === 'Domain not indexed')) {
      return { type: 'Index Lost', severity: 'Warning' };
    }
    if ((oldText === 'Not indexed' || oldText === 'Domain not indexed') && newText === 'Indexed') {
      return { type: 'Index Restored', severity: 'Resolved' };
    }
    return { type: 'Index Status Changed', severity: 'Info' };
  }

  if (field === 'Target HTTP') {
    if (isMissingCode_(Number(newValue)) || Number(newValue) >= 500) return { type: 'Target Broken', severity: 'Critical' };
    if ((isMissingCode_(Number(oldValue)) || Number(oldValue) >= 400) && Number(newValue) === 200) {
      return { type: 'Target Restored', severity: 'Resolved' };
    }
  }

  if (field === 'Placement HTTP') {
    if (isMissingCode_(Number(newValue))) return { type: 'Placement Lost', severity: 'Critical' };
    if (isMissingCode_(Number(oldValue)) && Number(newValue) === 200) return { type: 'Placement Restored', severity: 'Resolved' };
  }

  if (field === 'Final URL') return { type: 'Placement Redirected', severity: 'Warning' };
  if (field === 'Resolved Target Match') {
    return (newValue === true || String(newValue) === 'true')
      ? { type: 'Target Restored', severity: 'Resolved' }
      : { type: 'Target Mismatch', severity: 'Warning' };
  }
  if (field === 'Actual Target') return { type: 'Target Changed', severity: 'Warning' };
  if (field === 'Resolved Target URL') return { type: 'Resolved Target Changed', severity: 'Warning' };
  if (field === 'Anchor') return { type: 'Anchor Changed', severity: 'Warning' };
  if (field === 'Rel') return { type: 'Rel Changed', severity: 'Warning' };
  if (field === 'Health') {
    return newText === BLM.HEALTH.HEALTHY
      ? { type: 'Health Restored', severity: 'Resolved' }
      : { type: 'Health Changed', severity: newText || 'Info' };
  }
  if (field === 'Issue Type') return { type: 'Issue Changed', severity: 'Info' };
  if (field === 'Consecutive Not Indexed') return { type: 'Index Persistence Changed', severity: 'Info' };

  return { type: field + ' Changed', severity: 'Info' };
}

function normalizeTechnicalErrorSignature_(message) {
  let text = collapseWhitespace_(message).toLowerCase();
  text = text.replace(/https?:\/\/\S+/g, '[url]');
  text = text.replace(/\b\d{5,}\b/g, '#');
  return truncate_(text, 240);
}

function detectCatastrophicTechnicalFailure_(technicalErrors, totalRows) {
  const messages = Object.keys(technicalErrors || {})
    .map(key => trim_(technicalErrors[key]))
    .filter(Boolean);
  const threshold = Math.max(3, Math.ceil(Number(totalRows || 0) * BLM.DATAFORSEO.CATASTROPHIC_ERROR_RATIO));
  if (messages.length < threshold) {
    return { catastrophic: false, errorCount: messages.length, threshold: threshold, signature: '', sameErrorCount: 0 };
  }

  const counts = {};
  messages.forEach(message => {
    const signature = normalizeTechnicalErrorSignature_(message);
    counts[signature] = (counts[signature] || 0) + 1;
  });

  let topSignature = '';
  let topCount = 0;
  Object.keys(counts).forEach(signature => {
    if (counts[signature] > topCount) {
      topSignature = signature;
      topCount = counts[signature];
    }
  });

  return {
    catastrophic: topCount >= threshold,
    errorCount: messages.length,
    threshold: threshold,
    signature: topSignature,
    sameErrorCount: topCount
  };
}

// ===== Monitor.gs =====
/** Main monitoring workflow. */

function runMonitor_(options) {
  options = options || {};
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) throw new Error('Another Link Monitor run is already in progress.');

  const started = now_();
  const runId = uuid_();
  let runLog = newRunLog_(runId, started, options.triggerLabel || 'Manual');

  try {
    if (!hasDataForSeoCredentials_()) {
      throw new Error('DataForSEO credentials are missing. Use Link Monitor → Set API Credentials.');
    }

    const table = readMonitorTable_();
    ensureIdentifiers_(table.rows);
    const beforeMap = snapshotTrackedState_(table.rows);
    const preRunMetrics = computeMonitorMetrics_(table.rows);

    const selectedSet = options.selectedRows
      ? Object.fromEntries(options.selectedRows.map(r => [r, true]))
      : null;

    const targetRows = table.rows.filter(row => {
      if (selectedSet && !selectedSet[row.rowNumber]) return false;
      refreshRowObject_(row);
      return row.active && !!row.placementUrl && !!row.targetUrl;
    });

    if (!targetRows.length) {
      runLog.notes = 'No active rows with both Placement URL and Expected Target URL.';
      runLog.finished = now_();
      populateRunLogMetrics_(runLog, computeMonitorMetrics_(table.rows));
      appendRunLog_(runLog);
      writeMonitorTable_(table.sheet, table.rows.map(r => r.values));
      refreshDashboard_();
      if (options.showToast) SpreadsheetApp.getActive().toast(runLog.notes, 'Backlink Monitor', 5);
      return;
    }

    runLog.rowsChecked = targetRows.length;

    const placementCheck = crawlPlacements_(targetRows);
    runLog.cost += Number(placementCheck.cost || 0);

    // Check expected targets and the hrefs actually found on donor pages in one deduplicated batch.
    const targetUrlsToCheck = targetRows.map(r => r.targetUrl);
    targetRows.forEach(row => {
      const placement = placementCheck.resultsByRow[row.rowNumber];
      if (placement && placement.ok && placement.actualTarget) {
        targetUrlsToCheck.push(placement.actualTarget);
      }
    });

    const targetCheck = checkTargetUrls_(targetUrlsToCheck);
    runLog.cost += Number(targetCheck.cost || 0);

    const technicalErrors = {};
    const checkTime = now_();

    targetRows.forEach(row => {
      const result = placementCheck.resultsByRow[row.rowNumber];
      if (!result || !result.ok) {
        technicalErrors[row.rowNumber] = result ? result.error : 'No DataForSEO result';
        return; // Preserve previous technical values on API/crawl failure.
      }

      row.values[COL.LAST_CHECKED - 1] = checkTime;
      row.values[COL.PLACEMENT_HTTP - 1] = result.finalHttp || result.initialHttp || '';
      row.values[COL.FINAL_PLACEMENT_URL - 1] = result.finalUrl || row.placementUrl;
      row.values[COL.REDIRECTED - 1] = !!result.redirected;
      row.values[COL.LINK_FOUND - 1] = !!result.linkFound;
      row.values[COL.TARGET_MATCH - 1] = !!result.targetMatch;
      row.values[COL.ACTUAL_TARGET_URL - 1] = result.actualTarget || '';
      row.values[COL.ACTUAL_ANCHOR - 1] = result.anchor || '';
      row.values[COL.ACTUAL_REL - 1] = result.rel || '';
      row.values[COL.LINK_TYPE - 1] = result.linkType || '';
      row.values[COL.ROBOTS - 1] = result.robots || '';
      row.values[COL.CANONICAL - 1] = result.canonical || '';

      const expectedResult = targetCheck.byUrl[normalizeFullUrl_(row.targetUrl)];
      const actualResult = result.actualTarget
        ? targetCheck.byUrl[normalizeFullUrl_(result.actualTarget)]
        : null;

      if (actualResult && actualResult.ok) {
        row.values[COL.RESOLVED_TARGET_URL - 1] = actualResult.finalUrl || result.actualTarget;
        row.values[COL.TARGET_REDIRECTED - 1] = !!actualResult.redirected;
        row.values[COL.TARGET_HTTP - 1] = actualResult.finalHttp || actualResult.initialHttp || '';
      } else if (result.actualTarget && actualResult && !actualResult.ok) {
        technicalErrors[row.rowNumber] = 'Actual target check failed: ' + (actualResult.error || 'unknown error');
      } else if (expectedResult && expectedResult.ok) {
        row.values[COL.RESOLVED_TARGET_URL - 1] = expectedResult.finalUrl || row.targetUrl;
        row.values[COL.TARGET_REDIRECTED - 1] = !!expectedResult.redirected;
        row.values[COL.TARGET_HTTP - 1] = expectedResult.finalHttp || expectedResult.initialHttp || '';
      } else if (expectedResult && !expectedResult.ok) {
        technicalErrors[row.rowNumber] = 'Target check failed: ' + (expectedResult.error || 'unknown error');
      }

      const expectedResolved = expectedResult && expectedResult.ok
        ? (expectedResult.finalUrl || row.targetUrl)
        : row.targetUrl;
      const actualResolved = actualResult && actualResult.ok
        ? (actualResult.finalUrl || result.actualTarget)
        : (result.actualTarget || '');

      row.values[COL.RESOLVED_TARGET_MATCH - 1] =
        !!actualResolved &&
        !!expectedResolved &&
        normalizeTargetKey_(actualResolved) === normalizeTargetKey_(expectedResolved);

      if (!row.values[COL.FIRST_CHECKED - 1]) row.values[COL.FIRST_CHECKED - 1] = checkTime;
    });

    const globalFailure = detectCatastrophicTechnicalFailure_(technicalErrors, targetRows.length);
    if (globalFailure.catastrophic) {
      populateRunLogMetrics_(runLog, preRunMetrics);
      runLog.errors = globalFailure.errorCount;
      runLog.finished = now_();
      runLog.notes = 'FAILED_GLOBAL: ' + globalFailure.sameErrorCount + '/' + targetRows.length +
        ' rows returned the same technical error — ' + globalFailure.signature;
      appendRunLog_(runLog);
      refreshDashboard_();
      SpreadsheetApp.flush();

      if (options.showToast) {
        SpreadsheetApp.getActive().toast(
          'Run stopped safely: global technical failure detected. Existing link statuses were preserved.',
          'Backlink Placement Monitor',
          10
        );
      }
      return;
    }

    if (hasIndexCheckrToken_()) {
      try {
        let creditsBefore = null;
        try { creditsBefore = getIndexCheckrCreditsBalance_(); } catch (creditError) {}

        const sync = syncIndexCheckrRows_(targetRows);
        const indexStats = applyIndexMapToRows_(targetRows, sync.pageMap);
        runLog.indexChecks = Number(indexStats.observations || 0);

        try {
          const creditsAfter = getIndexCheckrCreditsBalance_();
          if (creditsBefore !== null && creditsAfter !== null) {
            runLog.indexCreditsUsed = Math.max(0, creditsBefore - creditsAfter);
          }
        } catch (creditError) {}
      } catch (e) {
        runLog.notes += (runLog.notes ? ' | ' : '') + 'IndexCheckr: ' + e.message;
      }
    } else {
      runLog.notes += (runLog.notes ? ' | ' : '') +
        'IndexCheckr token missing; technical checks completed without index refresh.';
    }

    targetRows.forEach(row => applyComputedStatusToRow_(row, technicalErrors[row.rowNumber] || ''));

    const historyEvents = buildHistoryEvents_(
      beforeMap,
      table.rows,
      selectedSet || rowsToSet_(targetRows),
      checkTime
    );

    writeMonitorTable_(table.sheet, table.rows.map(r => r.values));
    appendHistoryEvents_(historyEvents);

    const metrics = computeMonitorMetrics_(table.rows);
    populateRunLogMetrics_(runLog, metrics);
    runLog.finished = now_();
    appendRunLog_(runLog);

    refreshDashboard_();
    SpreadsheetApp.flush();

    if (options.showToast) {
      SpreadsheetApp.getActive().toast(
        targetRows.length + ' checked | Healthy ' + metrics.healthy +
        ' | Warning ' + metrics.warning +
        ' | Critical ' + metrics.critical +
        ' | Errors ' + metrics.error,
        'Backlink Placement Monitor',
        7
      );
    }
  } catch (e) {
    runLog.finished = now_();
    runLog.errors = Math.max(1, runLog.errors);
    runLog.notes = (runLog.notes ? runLog.notes + ' | ' : '') + e.message;
    try { appendRunLog_(runLog); } catch (logError) {}
    throw e;
  } finally {
    lock.releaseLock();
  }
}

function newRunLog_(runId, started, triggerLabel) {
  return {
    runId: runId,
    started: started,
    finished: '',
    triggerLabel: triggerLabel,
    rowsChecked: 0,
    active: 0,
    live: 0,
    working: 0,
    indexedAssets: 0,
    healthy: 0,
    warning: 0,
    critical: 0,
    pending: 0,
    errors: 0,
    lost: 0,
    changed: 0,
    targetIssues: 0,
    indexIssues: 0,
    indexChecks: 0,
    indexCreditsUsed: 0,
    cost: 0,
    healthyPct: 0,
    indexedPct: 0,
    notes: ''
  };
}

function populateRunLogMetrics_(runLog, metrics) {
  runLog.active = metrics.active;
  runLog.live = metrics.live;
  runLog.working = metrics.working;
  runLog.indexedAssets = metrics.indexedAssets;
  runLog.healthy = metrics.healthy;
  runLog.warning = metrics.warning;
  runLog.critical = metrics.critical;
  runLog.pending = metrics.pending;
  runLog.errors = metrics.error;
  runLog.lost = metrics.lost;
  runLog.changed = metrics.changed;
  runLog.targetIssues = metrics.targetIssues;
  runLog.indexIssues = metrics.indexIssues;
  runLog.healthyPct = metrics.active ? metrics.healthy / metrics.active : 0;
  runLog.indexedPct = metrics.active ? metrics.indexedAssets / metrics.active : 0;
}

function applyComputedStatusToRow_(row, technicalError) {
  const status = calculateOverallStatusForRow_(row, technicalError || '');
  row.values[COL.HEALTH - 1] = status.health;
  row.values[COL.ISSUE_TYPE - 1] = status.issueType;
  row.values[COL.ACTION - 1] = status.action;
  row.values[COL.OVERALL_STATUS - 1] = status.status;
  row.values[COL.ISSUES - 1] = status.issues;
  row.values[COL.WORKING_ASSET - 1] = !!status.workingAsset;
  row.values[COL.INDEXED_ASSET - 1] = !!status.indexedAsset;
}

function rowsToSet_(rows) {
  const set = {};
  rows.forEach(r => set[r.rowNumber] = true);
  return set;
}

function applyIndexMapToRows_(rows, pageMap) {
  const stats = { observations: 0 };

  rows.forEach(row => {
    const page = pageMap[normalizeFullUrl_(row.placementUrl)];
    if (!page) return;

    const newStatus = normalizeIndexStatus_(page.status);
    const oldStatus = trim_(row.values[COL.INDEX_STATUS - 1]);
    const oldLast = row.values[COL.INDEX_LAST_CHECKED - 1];
    const newLastRaw = extractDateValue_(page.lastCheckAt);
    const newLast = newLastRaw ? parseProviderDate_(newLastRaw) : '';

    const oldLastMs = oldLast instanceof Date ? oldLast.getTime() : (oldLast ? new Date(oldLast).getTime() : 0);
    const newLastMs = newLast instanceof Date ? newLast.getTime() : (newLast ? new Date(newLast).getTime() : 0);
    const isNewObservation =
      !oldStatus ||
      oldStatus !== newStatus ||
      (!!newLastMs && newLastMs !== oldLastMs);

    if (isNewObservation) {
      stats.observations++;
      row.values[COL.PREVIOUS_INDEX_STATUS - 1] = oldStatus;

      if (newStatus === 'Not indexed' || newStatus === 'Domain not indexed') {
        const previousCount = Number(row.values[COL.CONSECUTIVE_NOT_INDEXED - 1] || 0);
        row.values[COL.CONSECUTIVE_NOT_INDEXED - 1] =
          (oldStatus === 'Not indexed' || oldStatus === 'Domain not indexed')
            ? previousCount + 1
            : 1;
      } else if (newStatus === 'Indexed') {
        row.values[COL.CONSECUTIVE_NOT_INDEXED - 1] = 0;
      }
    }

    row.values[COL.INDEX_STATUS - 1] = newStatus;
    row.values[COL.INDEX_LAST_CHECKED - 1] = newLast || row.values[COL.INDEX_LAST_CHECKED - 1] || '';
    row.values[COL.INDEXCHECKR_PAGE_ID - 1] = page.id || '';
  });

  return stats;
}

function syncIndexCheckr() {
  runIndexOnly_('Sync IndexCheckr', true);
}

function refreshIndexStatuses() {
  runIndexOnly_('Refresh Index Status', false);
}

function runIndexOnly_(label, addMissing) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) throw new Error('Another Link Monitor run is already in progress.');

  const started = now_();
  const runLog = newRunLog_(uuid_(), started, label);

  try {
    if (!hasIndexCheckrToken_()) throw new Error('IndexCheckr token is missing.');

    const table = readMonitorTable_();
    ensureIdentifiers_(table.rows);
    const activeRows = table.rows.filter(row => {
      refreshRowObject_(row);
      return row.active && !!row.placementUrl;
    });

    runLog.rowsChecked = activeRows.length;

    const beforeMap = snapshotTrackedState_(table.rows);

    let creditsBefore = null;
    try { creditsBefore = getIndexCheckrCreditsBalance_(); } catch (creditError) {}

    const current = addMissing ? syncIndexCheckrRows_(activeRows) : getIndexCheckrCurrentMap_();
    const indexStats = applyIndexMapToRows_(activeRows, current.pageMap);
    runLog.indexChecks = Number(indexStats.observations || 0);

    try {
      const creditsAfter = getIndexCheckrCreditsBalance_();
      if (creditsBefore !== null && creditsAfter !== null) {
        runLog.indexCreditsUsed = Math.max(0, creditsBefore - creditsAfter);
      }
    } catch (creditError) {}

    activeRows.forEach(row => applyComputedStatusToRow_(row, ''));

    const stamp = now_();
    const events = buildHistoryEvents_(beforeMap, table.rows, rowsToSet_(activeRows), stamp);
    writeMonitorTable_(table.sheet, table.rows.map(r => r.values));
    appendHistoryEvents_(events);

    const metrics = computeMonitorMetrics_(table.rows);
    populateRunLogMetrics_(runLog, metrics);
    runLog.finished = now_();
    appendRunLog_(runLog);

    refreshDashboard_();
    SpreadsheetApp.getActive().toast(
      label + ': ' + activeRows.length + ' row(s) | Healthy ' + metrics.healthy +
      ' | Warning ' + metrics.warning + ' | Critical ' + metrics.critical,
      'Backlink Monitor',
      5
    );
  } catch (e) {
    runLog.finished = now_();
    runLog.errors = Math.max(1, runLog.errors);
    runLog.notes = e.message;
    try { appendRunLog_(runLog); } catch (logError) {}
    throw e;
  } finally {
    lock.releaseLock();
  }
}

// ===== Tests.gs =====
/** Lightweight pure-function self-tests. No external API calls. */

function runSelfTests() {
  const tests = [];

  function assert_(name, condition, details) {
    if (!condition) throw new Error('FAIL: ' + name + (details ? ' — ' + details : ''));
    tests.push('PASS: ' + name);
  }

  assert_(
    'Normalize target ignores scheme/query/trailing slash',
    normalizeTargetKey_('https://www.example.com/a/?utm=1') === normalizeTargetKey_('http://example.com/a')
  );

  assert_(
    'Full URL drops fragment',
    normalizeFullUrl_('https://Example.com/a/#x') === 'https://example.com/a'
  );

  assert_(
    'Resolve absolute path',
    resolveUrl_('https://example.com/a/b', '/new') === 'https://example.com/new'
  );

  assert_(
    'Resolve relative path',
    resolveUrl_('https://example.com/a/b', '../new') === 'https://example.com/new'
  );

  assert_('Dofollow expected matches empty rel', relMatchesExpected_('dofollow', ''));
  assert_('Dofollow expected rejects sponsored', !relMatchesExpected_('dofollow', 'sponsored'));
  assert_('Nofollow expected matches mixed rel', relMatchesExpected_('nofollow', 'nofollow sponsored'));
  assert_('Link type mixed', getLinkTypeFromRel_('nofollow sponsored') === 'Mixed');
  assert_('Runs schema contains IndexCheckr checks', runHeaderIndex_('IndexCheckr Checks') !== -1);
  assert_('Runs schema contains IndexCheckr credits used', runHeaderIndex_('IndexCheckr Credits Used') !== -1);
  assert_(
    'DataForSEO cost is after IndexCheckr usage fields',
    runHeaderIndex_('DataForSEO Cost') > runHeaderIndex_('IndexCheckr Credits Used')
  );

  const customJsProbe = buildPlacementCustomJs_(
    'https://example.com/target-page/',
    'Build Authoritative Backlinks in Finance Niche'
  );
  assert_('DataForSEO custom_js stays within 2000 chars', customJsProbe.length <= 2000, 'Length: ' + customJsProbe.length);

  const catastrophicErrors = {};
  for (let i = 1; i <= 25; i++) catastrophicErrors[i] = 'DataForSEO task 40501: Invalid Field: custom_js';
  assert_(
    'Catastrophic failure detected for same error on 75%+ rows',
    detectCatastrophicTechnicalFailure_(catastrophicErrors, 33).catastrophic
  );

  const minorityErrors = {};
  for (let i = 1; i <= 10; i++) minorityErrors[i] = 'Temporary error ' + i;
  assert_(
    'Catastrophic failure not triggered by minority errors',
    !detectCatastrophicTechnicalFailure_(minorityErrors, 33).catastrophic
  );

  const dummyValues = new Array(BLM.HEADERS.length).fill('');
  dummyValues[COL.ACTIVE - 1] = true;
  dummyValues[COL.PLACEMENT_URL - 1] = 'https://donor.example/post';
  dummyValues[COL.EXPECTED_TARGET_URL - 1] = 'https://example.com/tool/';
  dummyValues[COL.PLACEMENT_HTTP - 1] = 200;
  dummyValues[COL.FINAL_PLACEMENT_URL - 1] = 'https://donor.example/post';
  dummyValues[COL.LINK_FOUND - 1] = true;
  dummyValues[COL.TARGET_MATCH - 1] = true;
  dummyValues[COL.RESOLVED_TARGET_MATCH - 1] = true;
  dummyValues[COL.TARGET_HTTP - 1] = 200;
  dummyValues[COL.INDEX_STATUS - 1] = 'Indexed';

  const healthyRow = rowObjectFromValues_(dummyValues.slice(), 2);
  const healthy = calculateOverallStatusForRow_(healthyRow, '');
  assert_('Healthy health', healthy.health === BLM.HEALTH.HEALTHY);
  assert_('Healthy working asset', healthy.workingAsset === true);
  assert_('Healthy indexed asset', healthy.indexedAsset === true);

  const redirectValues = dummyValues.slice();
  redirectValues[COL.TARGET_MATCH - 1] = false;
  redirectValues[COL.TARGET_REDIRECTED - 1] = true;
  redirectValues[COL.RESOLVED_TARGET_MATCH - 1] = true;
  const redirectRow = rowObjectFromValues_(redirectValues, 2);
  const redirectStatus = calculateOverallStatusForRow_(redirectRow, '');
  assert_('Resolved redirect is not target mismatch', redirectStatus.issueType.indexOf('Target mismatch') === -1);
  assert_('Resolved redirect stays working asset', redirectStatus.workingAsset === true);

  const watchValues = dummyValues.slice();
  watchValues[COL.INDEX_STATUS - 1] = 'Not indexed';
  watchValues[COL.CONSECUTIVE_NOT_INDEXED - 1] = 1;
  const watch = calculateOverallStatusForRow_(rowObjectFromValues_(watchValues, 2), '');
  assert_('First not-indexed check is Watch', watch.status === BLM.STATUS.WATCH);

  const persistentValues = dummyValues.slice();
  persistentValues[COL.INDEX_STATUS - 1] = 'Not indexed';
  persistentValues[COL.CONSECUTIVE_NOT_INDEXED - 1] = 2;
  const persistent = calculateOverallStatusForRow_(rowObjectFromValues_(persistentValues, 2), '');
  assert_('Second not-indexed check is persistent issue', persistent.status === BLM.STATUS.INDEX_ISSUE);

  const lostValues = dummyValues.slice();
  lostValues[COL.LINK_FOUND - 1] = false;
  const lost = calculateOverallStatusForRow_(rowObjectFromValues_(lostValues, 2), '');
  assert_('Missing link is Critical', lost.health === BLM.HEALTH.CRITICAL);
  assert_('Missing link legacy status is Lost', lost.status === BLM.STATUS.LOST);

  SpreadsheetApp.getUi().alert('Self-tests passed:\n\n' + tests.join('\n'));
}


