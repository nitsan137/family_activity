/** @OnlyCurrentDoc */

/*
 * חמישי משפחתי: הדלת של הגיליון
 *
 * הקובץ הזה הוא החלק היחיד שרץ ב-Google. הוא לא מכיר את האפליקציה: הוא רק קורא וכותב שורות
 * בגיליון שאליו הוא מחובר, ובודק את הקוד המשפחתי. כל ההיגיון (רעיונות, הצבעות, היסטוריה)
 * נמצא במאגר nitsan137/family_activity ב-GitHub, ולכן הקובץ הזה לא אמור להשתנות כשהאפליקציה משתנה.
 *
 * התקנה, פעם אחת: מדביקים את הקובץ במקום התוכן של קוד.gs, שומרים, ואז
 * פריסה > ניהול פריסות > עריכה > גרסה חדשה > פריסה.
 *
 * מה האפליקציה שולחת (POST, JSON):
 *   code    הקוד המשפחתי
 *   schema  אילו לשוניות ועמודות היא צריכה. לשונית או עמודה שחסרה נוצרת לבד.
 *   unless  תנאי דילוג: אם כבר קיימת שורה כזו, לא מבצעים כלום (כך פעולה חד פעמית לא רצה פעמיים)
 *   ops     רשימת פעולות על שורות: append, update, upsert, remove, setCode
 * מה חוזר: כל השורות של כל הלשוניות שבסכמה, אחרי הפעולות.
 */

var APP_URL = 'https://nitsan137.github.io/family_activity/';
var SETTINGS = { tab: 'הגדרות', cols: ['key', 'value'] };
var CODE_KEY = 'familyCode';
var MAX_OPS = 300;
var MAX_CELL = 2000;

function doGet() {
  var page = '<!DOCTYPE html><html lang="he" dir="rtl"><head><base target="_top"></head>' +
    '<body style="margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
    'gap:18px;padding:24px;box-sizing:border-box;text-align:center;background:#17143A;color:#F0EEFF;font-family:Arial,sans-serif">' +
    '<div style="font-size:34px;font-weight:bold;color:#FFB52E">חמישי משפחתי עבר כתובת</div>' +
    '<div style="font-size:17px">מהיום נכנסים מכאן, ואפשר גם להתקין על מסך הבית.</div>' +
    '<a href="' + APP_URL + '" style="display:inline-block;background:#FFB52E;color:#17143A;font-weight:bold;font-size:18px;' +
    'padding:14px 26px;border-radius:16px;text-decoration:none">לאפליקציה</a>' +
    '</body></html>';
  return HtmlService.createHtmlOutput(page)
    .setTitle('חמישי משפחתי')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function doPost(e) {
  var out;
  try {
    out = handle_(JSON.parse((e && e.postData && e.postData.contents) || '{}'));
  } catch (err) {
    out = { ok: false, error: String((err && err.message) || err), reason: (err && err.reason) || '' };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function handle_(req) {
  var schema = checkSchema_(req.schema);
  var ops = req.ops || [];
  if (!Array.isArray(ops) || ops.length > MAX_OPS) throw new Error('רשימת הפעולות לא תקינה');

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // הקוד המשפחתי נבדק לפני כל דבר אחר, כולל יצירת לשוניות
    var settingsSheet = ss.getSheetByName(SETTINGS.tab);
    var saved = '';
    if (settingsSheet) {
      load_(settingsSheet, SETTINGS.cols).rows.forEach(function (r) { if (r.key === CODE_KEY) saved = r.value; });
    }
    if (codeKey_(saved) && codeKey_(req.code) !== codeKey_(saved)) {
      var err = new Error('הקוד המשפחתי לא מתאים');
      err.reason = 'code';
      throw err;
    }

    var db = {};
    Object.keys(schema).forEach(function (name) {
      var sheet = ss.getSheetByName(schema[name].tab) || create_(ss, schema[name].tab);
      db[name] = load_(sheet, schema[name].cols);
      db[name].sheet = sheet;
    });

    var skipped = !!(req.unless && find_(db, req.unless.table, req.unless.match).length);
    if (!skipped) ops.forEach(function (op) { apply_(db, op); });

    Object.keys(db).forEach(function (name) { if (db[name].dirty) save_(db[name]); });

    var tables = {};
    var hasCode = false;
    Object.keys(db).forEach(function (name) {
      tables[name] = db[name].rows.filter(function (r) {
        if (name === 'settings' && r.key === CODE_KEY) { hasCode = !!codeKey_(r.value); return false; }
        return true;
      });
    });
    return { ok: true, skipped: skipped, hasCode: hasCode, now: new Date().toISOString(), tables: tables };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- פעולות על שורות ---------- */

function apply_(db, op) {
  if (!op || typeof op !== 'object') throw new Error('פעולה לא תקינה');
  if (op.op === 'setCode') {
    var code = String(op.code === undefined || op.code === null ? '' : op.code).trim();
    if (!/^[0-9A-Za-z֐-׿]{4,30}$/.test(code)) throw new Error('הקוד צריך להיות 4 תווים לפחות, אותיות וספרות בלבד');
    var t = db.settings;
    var row = null;
    t.rows.forEach(function (r) { if (r.key === CODE_KEY) row = r; });
    if (row) row.value = code; else t.rows.push(fill_(t, { key: CODE_KEY, value: code }));
    t.dirty = true;
    return;
  }
  var table = db[op.table];
  if (!table) throw new Error('לשונית לא מוכרת: ' + op.table);
  if (op.op === 'append') {
    guard_(op.table, op.row);
    table.rows.push(fill_(table, op.row));
  } else if (op.op === 'update') {
    guard_(op.table, op.set);
    find_(db, op.table, op.match).forEach(function (r) { assign_(table, r, op.set); });
  } else if (op.op === 'upsert') {
    guard_(op.table, op.row);
    var hits = find_(db, op.table, op.match);
    if (hits.length) hits.forEach(function (r) { assign_(table, r, op.row); });
    else table.rows.push(fill_(table, op.row));
  } else if (op.op === 'remove') {
    var gone = find_(db, op.table, op.match);
    table.rows = table.rows.filter(function (r) { return gone.indexOf(r) < 0; });
  } else {
    throw new Error('פעולה לא מוכרת: ' + op.op);
  }
  table.dirty = true;
}

// שורות שמתאימות לכל התנאים. חייב להיות לפחות תנאי אחד, והקוד המשפחתי אף פעם לא נכלל.
function find_(db, name, match) {
  var table = db[name];
  if (!table) throw new Error('לשונית לא מוכרת: ' + name);
  var keys = match && typeof match === 'object' ? Object.keys(match) : [];
  if (!keys.length) throw new Error('חסר תנאי לבחירת שורות');
  return table.rows.filter(function (r) {
    if (name === 'settings' && r.key === CODE_KEY) return false;
    return keys.every(function (k) { return String(r[k] === undefined ? '' : r[k]) === cell_(match[k]); });
  });
}

// את הקוד המשפחתי משנים רק דרך setCode, שבודקת אותו
function guard_(name, values) {
  if (!values || typeof values !== 'object') throw new Error('חסרים ערכים לפעולה');
  if (name === 'settings' && values.key === CODE_KEY) throw new Error('את הקוד המשפחתי משנים דרך מסך המשפחה');
}

function fill_(table, values) {
  var row = {};
  table.cols.forEach(function (c) { row[c] = cell_(values[c]); });
  return row;
}

function assign_(table, row, values) {
  table.cols.forEach(function (c) { if (values[c] !== undefined) row[c] = cell_(values[c]); });
}

// כל תא נשמר כטקסט בשורה אחת, בלי תחילית של נוסחה
function cell_(v) {
  var s = String(v === undefined || v === null ? '' : v).replace(/[\r\n\t]+/g, ' ').trim().replace(/^[=+]+/, '').trim();
  return s.length > MAX_CELL ? s.slice(0, MAX_CELL) : s;
}

function codeKey_(code) {
  return String(code === undefined || code === null ? '' : code).trim().toLowerCase();
}

/* ---------- סכמה ---------- */

function checkSchema_(schema) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) throw new Error('חסר תיאור של הלשוניות');
  var out = {};
  var names = Object.keys(schema);
  if (names.length > 20) throw new Error('יותר מדי לשוניות');
  names.forEach(function (name) {
    var t = schema[name] || {};
    var tab = String(t.tab || '').trim();
    var cols = Array.isArray(t.cols) ? t.cols.map(function (c) { return String(c).trim(); }) : [];
    var bad = !/^[A-Za-z][A-Za-z0-9_]{0,30}$/.test(name) || !tab || tab.length > 50 || !cols.length || cols.length > 40 ||
      cols.some(function (c) { return !/^[A-Za-z][A-Za-z0-9_]{0,30}$/.test(c); });
    if (bad) throw new Error('תיאור לא תקין של הלשונית ' + name);
    out[name] = { tab: tab, cols: cols };
  });
  out.settings = SETTINGS; // הלשונית של ההגדרות קבועה, כדי שאי אפשר יהיה לעקוף את הקוד המשפחתי
  return out;
}

/* ---------- גיליון ---------- */

function create_(ss, tab) {
  var sheet = ss.insertSheet(tab);
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).setNumberFormat('@');
  sheet.setFrozenRows(1);
  try { sheet.setRightToLeft(true); } catch (e) { /* לא קריטי */ }
  return sheet;
}

// קורא לשונית שלמה. שורת הכותרת בגיליון קובעת את סדר העמודות, ועמודה שחסרה מתווספת בסוף.
function load_(sheet, wanted) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var cols = [];
  if (lastRow >= 1 && lastCol >= 1) {
    cols = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (v) { return String(v).trim(); });
    while (cols.length && !cols[cols.length - 1]) cols.pop();
  }
  var rows = [];
  if (lastRow >= 2 && cols.length) {
    var values = sheet.getRange(2, 1, lastRow - 1, cols.length).getValues();
    for (var r = 0; r < values.length; r++) {
      var row = {};
      var empty = true;
      for (var c = 0; c < cols.length; c++) {
        if (!cols[c]) continue;
        var v = norm_(values[r][c]);
        if (v !== '') empty = false;
        row[cols[c]] = v;
      }
      if (!empty) rows.push(row);
    }
  }
  var table = { cols: cols, rows: rows, dirty: false, had: lastRow };
  wanted.forEach(function (c) {
    if (table.cols.indexOf(c) >= 0) return;
    table.cols.push(c);
    table.rows.forEach(function (row) { row[c] = ''; });
    table.dirty = true;
  });
  return table;
}

function save_(table) {
  var sheet = table.sheet;
  var width = table.cols.length;
  var height = Math.max(table.rows.length + 1, table.had, 1);
  if (height > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), height - sheet.getMaxRows() + 50);
  if (width > sheet.getMaxColumns()) sheet.insertColumnsAfter(sheet.getMaxColumns(), width - sheet.getMaxColumns());
  var values = [table.cols.slice()];
  table.rows.forEach(function (row) {
    values.push(table.cols.map(function (c) { return c && row[c] !== undefined && row[c] !== null ? String(row[c]) : ''; }));
  });
  while (values.length < height) values.push(table.cols.map(function () { return ''; }));
  sheet.getRange(1, 1, height, width).setNumberFormat('@').setValues(values);
  sheet.getRange(1, 1, 1, width).setFontWeight('bold');
}

function norm_(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  }
  return v === null || v === undefined ? '' : String(v);
}
