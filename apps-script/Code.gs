/** @OnlyCurrentDoc */

/*
 * חמישי משפחתי: הצד של הגיליון (Google Apps Script)
 *
 * המסכים עצמם יושבים ב-GitHub Pages (המאגר nitsan137/family_activity) ומדברים עם הקובץ הזה דרך doPost.
 * הקובץ הזה קורא וכותב לגיליון שאליו הוא מחובר. הלשוניות נוצרות לבד, ואפשר לערוך אותן גם ידנית.
 *
 * אחרי שינוי כאן: פריסה > ניהול פריסות > עריכה > גרסה חדשה (הכתובת נשארת אותה כתובת).
 * העותק במאגר (apps-script/Code.gs) הוא המקור. מה שרץ בפועל הוא מה שפרוס בעורך של Apps Script.
 */

var TZ = 'Asia/Jerusalem';

// הכתובת של האפליקציה ב-GitHub Pages
var APP_URL = 'https://nitsan137.github.io/family_activity/';

// true: הקישור הישן של Apps Script עדיין מציג את המסכים הישנים (תקופת מעבר).
// false: הקישור הישן מפנה לכתובת החדשה, והגישה לנתונים היא רק דרך האפליקציה החדשה.
var LEGACY_UI = true;

var TABLES = {
  members:  { tab: 'משפחה',   cols: ['id', 'name', 'emoji', 'active', 'createdAt'] },
  ideas:    { tab: 'רעיונות',  cols: ['id', 'title', 'pic', 'place', 'note', 'addedBy', 'createdAt', 'archived'] },
  votes:    { tab: 'הצבעות',   cols: ['weekId', 'memberId', 'ideaId', 'createdAt'] },
  history:  { tab: 'היסטוריה', cols: ['id', 'date', 'ideaIds', 'titles', 'type', 'note', 'ratings', 'avgRating', 'createdBy', 'createdAt'] },
  settings: { tab: 'הגדרות',   cols: ['key', 'value'] }
};

// רשימת הפתיחה: שם, תמונה, בבית או בחוץ. אפשר להסיר כל רעיון מתוך האפליקציה.
// כדי להוסיף רעיונות בכמות: מוסיפים שורות כאן, מעלים את STARTER_VERSION באחד ופורסים גרסה חדשה.
// רעיון שכבר קיים בגיליון (לפי השם) לא מתווסף שוב, ורעיון שהוסר מהאפליקציה לא חוזר.
var STARTER_VERSION = 2;
var SEED_IDEAS = [
  ['ערב סרט עם פופקורן', '🎬 🍿', 'home'],
  ['משחקי קופסה', '🎲 🧩', 'home'],
  ['מכינים פיצה ביחד', '🍕 🍳', 'home'],
  ['ערב קריוקי', '🎤 🎶', 'home'],
  ['אוהל בסלון ומסיבת פיג\'מות', '⛺ 🛌', 'home'],
  ['גלידה וטיול ערב', '🍦 🚶', 'out'],
  ['באולינג', '🎳', 'out'],
  ['פיקניק שקיעה בפארק', '🧺 🌅', 'out'],
  ['מסעדה שכולם בוחרים יחד', '🍽️', 'out'],
  ['גן שעשועים בחושך עם פנסים', '🎠 🔦', 'out'],
  ['מאסטר שף', '🍳 🏆', 'home'],
  ['חדר בריחה ביתי', '🔐 🏠', 'home'],
  ['מבחן טעימות עיוור', '🙈 😋', 'home'],
  ['ספא ביתי', '🧖 💅', 'home'],
  ['פיקניק גינה', '🧺 🌼', 'home'],
  ['חדר בריחה אמיתי - הפיצה', '🔐 🍕', 'out'],
  ['טניס', '🎾', 'out'],
  ['קולנוע', '🎟️ 🎬', 'out'],
  ['טיול במדרחוב זכרון יעקוב', '🚶 🏘️', 'out'],
  ['טיול בנמל קיסריה', '⛵ 🏛️', 'out']
];

function doGet() {
  if (LEGACY_UI) {
    return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('חמישי משפחתי')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  var page = '<!DOCTYPE html><html lang="he" dir="rtl"><head><base target="_top"></head>' +
    '<body style="margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
    'gap:18px;padding:24px;box-sizing:border-box;text-align:center;background:#17143A;color:#F0EEFF;font-family:Arial,sans-serif">' +
    '<div style="font-size:34px;font-weight:bold;color:#FFB52E">חמישי משפחתי עבר כתובת</div>' +
    '<div style="font-size:17px">מהיום נכנסים מכאן, ואפשר גם להתקין על מסך הבית.</div>' +
    '<a href="' + APP_URL + '" style="display:inline-block;background:#FFB52E;color:#17143A;font-weight:bold;font-size:18px;' +
    'padding:14px 26px;border-radius:16px;text-decoration:none">לאפליקציה החדשה</a>' +
    '</body></html>';
  return HtmlService.createHtmlOutput(page)
    .setTitle('חמישי משפחתי')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * נקודת הכניסה של האפליקציה ב-GitHub Pages.
 * מקבלת JSON עם action, payload ו-code (הקוד המשפחתי), ומחזירה JSON עם מצב הגיליון המעודכן.
 */
function doPost(e) {
  var out;
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var res = run_(String(req.action || 'getState'), req.payload || {}, String(req.code || ''), true);
    out = { ok: true, state: res.state, created: res.created };
  } catch (err) {
    out = { ok: false, error: String((err && err.message) || err), reason: (err && err.reason) || '' };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

// נקודת הכניסה של המסכים הישנים שרצים בתוך Apps Script. פעילה רק בתקופת המעבר.
function api(action, payloadJson) {
  if (!LEGACY_UI) throw new Error('האפליקציה עברה לכתובת חדשה: ' + APP_URL);
  return JSON.stringify(run_(action, payloadJson ? JSON.parse(payloadJson) : {}, '', false));
}

function run_(action, p, code, checkCode) {
  ensureSheets_();
  syncStarterIdeas_();
  if (checkCode) checkCode_(code);
  var created = null;
  if (action !== 'getState') {
    if (!ACTIONS[action]) throw new Error('פעולה לא מוכרת: ' + action);
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      created = ACTIONS[action](p) || null;
    } finally {
      lock.releaseLock();
    }
  }
  return { state: getState_(), created: created };
}

// קוד משפחתי: כל עוד לא נבחר קוד, הכניסה פתוחה. אחרי שנבחר, כל בקשה חייבת לכלול אותו.
function checkCode_(code) {
  var saved = codeKey_(settings_().familyCode);
  if (!saved) return;
  if (codeKey_(code) !== saved) {
    var err = new Error('הקוד המשפחתי לא מתאים');
    err.reason = 'code';
    throw err;
  }
}

function codeKey_(code) {
  return String(code === undefined || code === null ? '' : code).trim().toLowerCase();
}

var ACTIONS = {
  addMember: function (p) {
    var name = clean_(p.name, 30);
    if (!name) throw new Error('חסר שם');
    var row = { id: id_('m'), name: name, emoji: clean_(p.emoji, 8) || '🙂', active: '1', createdAt: now_() };
    append_('members', row);
    return row.id;
  },

  updateMember: function (p) {
    update_('members', p.id, function (r) {
      if (p.name !== undefined) {
        var name = clean_(p.name, 30);
        if (!name) throw new Error('חסר שם');
        r.name = name;
      }
      if (p.emoji !== undefined) r.emoji = clean_(p.emoji, 8) || r.emoji;
      if (p.active !== undefined) r.active = p.active ? '1' : '';
    });
  },

  addIdea: function (p) {
    var title = clean_(p.title, 60);
    if (!title) throw new Error('חסר שם לרעיון');
    var place = p.place === 'out' ? 'out' : 'home';
    var row = {
      id: id_('i'), title: title,
      pic: clean_(p.pic, 12) || (place === 'out' ? '🌳' : '🏠'),
      place: place, note: clean_(p.note, 140), addedBy: clean_(p.addedBy, 20),
      createdAt: now_(), archived: ''
    };
    append_('ideas', row);
    return row.id;
  },

  updateIdea: function (p) {
    update_('ideas', p.id, function (r) {
      if (p.title !== undefined) {
        var title = clean_(p.title, 60);
        if (!title) throw new Error('חסר שם לרעיון');
        r.title = title;
      }
      if (p.place !== undefined) r.place = p.place === 'out' ? 'out' : 'home';
      if (p.pic !== undefined) r.pic = clean_(p.pic, 12) || r.pic;
      if (p.note !== undefined) r.note = clean_(p.note, 140);
      if (p.archived !== undefined) r.archived = p.archived ? '1' : '';
    });
  },

  setVotes: function (p) {
    var weekId = weekId_();
    if (!find_(read_('members'), p.memberId)) throw new Error('לא מצאנו את מי שמצביע');
    var ideas = read_('ideas');
    var ids = [];
    (p.ideaIds || []).forEach(function (iid) {
      var idea = find_(ideas, iid);
      if (idea && !yes_(idea.archived) && ids.indexOf(iid) < 0) ids.push(iid);
    });
    var max = votesPerPerson_(settings_());
    if (ids.length > max) throw new Error('אפשר לבחור עד ' + max + ' רעיונות');
    var rows = read_('votes').filter(function (v) {
      return !(v.weekId === weekId && v.memberId === p.memberId);
    });
    var ts = now_();
    ids.forEach(function (iid) {
      rows.push({ weekId: weekId, memberId: p.memberId, ideaId: iid, createdAt: ts });
    });
    write_('votes', rows);
  },

  reveal: function () {
    setSetting_('revealedWeek', weekId_());
  },

  markDone: function (p) {
    var date = String(p.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('תאריך לא תקין');
    var ideas = read_('ideas');
    var chosen = [];
    (p.ideaIds || []).forEach(function (iid) {
      var idea = find_(ideas, iid);
      if (idea && chosen.indexOf(idea) < 0) chosen.push(idea);
    });
    if (!chosen.length) throw new Error('בחרו מה עשיתם');
    if (chosen.length > 2) throw new Error('אפשר לשלב עד שני רעיונות');
    var places = chosen.map(function (i) { return i.place === 'out' ? 'out' : 'home'; });
    var type = places.indexOf('home') >= 0 && places.indexOf('out') >= 0 ? 'combo' : places[0];
    var row = {
      id: id_('h'), date: date,
      ideaIds: chosen.map(function (i) { return i.id; }).join(','),
      titles: chosen.map(function (i) { return i.title; }).join(' + '),
      type: type, note: clean_(p.note, 200), ratings: '{}', avgRating: '',
      createdBy: clean_(p.createdBy, 20), createdAt: now_()
    };
    append_('history', row);
    return row.id;
  },

  rate: function (p) {
    var stars = Math.round(Number(p.stars));
    if (!(stars >= 0 && stars <= 5)) throw new Error('דירוג לא תקין');
    if (!find_(read_('members'), p.memberId)) throw new Error('לא מצאנו את מי שמדרג');
    update_('history', p.historyId, function (r) {
      var ratings = parse_(r.ratings);
      if (stars === 0) delete ratings[p.memberId]; else ratings[p.memberId] = stars;
      r.ratings = JSON.stringify(ratings);
      var vals = Object.keys(ratings).map(function (k) { return Number(ratings[k]); });
      r.avgRating = vals.length
        ? (vals.reduce(function (a, b) { return a + b; }, 0) / vals.length).toFixed(1)
        : '';
    });
  },

  deleteHistory: function (p) {
    var rows = read_('history');
    var kept = rows.filter(function (r) { return r.id !== p.id; });
    if (kept.length === rows.length) throw new Error('הרשומה לא נמצאה');
    write_('history', kept);
  },

  // בחירה או החלפה של הקוד המשפחתי. מי שמחליף קוד קיים כבר הזדהה עם הקוד הישן.
  setFamilyCode: function (p) {
    var code = String(p.code === undefined || p.code === null ? '' : p.code).trim();
    if (!/^[0-9A-Za-z\u0590-\u05FF]{4,30}$/.test(code)) {
      throw new Error('הקוד צריך להיות 4 תווים לפחות, אותיות וספרות בלבד');
    }
    setSetting_('familyCode', code);
  },

  setVotesPerPerson: function (p) {
    var n = Math.round(Number(p.value));
    if (!(n >= 1 && n <= 5)) throw new Error('אפשר לבחור בין 1 ל-5 לבבות');
    setSetting_('votesPerPerson', String(n));
  }
};

/* ---------- מצב מלא לאפליקציה ---------- */

function getState_() {
  var weekId = weekId_();
  var settings = settings_();
  var appUrl = '';
  try { appUrl = ScriptApp.getService().getUrl() || ''; } catch (e) { appUrl = ''; }
  return {
    today: today_(),
    weekId: weekId,
    members: read_('members').map(function (m) {
      return { id: m.id, name: m.name, emoji: m.emoji, active: yes_(m.active) };
    }),
    ideas: read_('ideas').map(function (i) {
      return {
        id: i.id, title: i.title, pic: i.pic, place: i.place === 'out' ? 'out' : 'home',
        note: i.note, addedBy: i.addedBy, archived: yes_(i.archived)
      };
    }),
    votes: read_('votes')
      .filter(function (v) { return v.weekId === weekId; })
      .map(function (v) { return { memberId: v.memberId, ideaId: v.ideaId }; }),
    history: read_('history').map(function (h) {
      return {
        id: h.id, date: h.date, ideaIds: h.ideaIds ? h.ideaIds.split(',') : [],
        titles: h.titles, type: h.type, note: h.note, ratings: parse_(h.ratings)
      };
    }),
    settings: {
      votesPerPerson: votesPerPerson_(settings),
      revealedWeek: settings.revealedWeek || '',
      hasCode: !!codeKey_(settings.familyCode)
    },
    appUrl: appUrl
  };
}

/* ---------- תאריכים ---------- */

function today_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
}

function now_() {
  return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ss");
}

// יום חמישי הקרוב (כולל היום, אם היום חמישי). זה המזהה של סבב ההצבעה.
function weekId_() {
  var p = today_().split('-');
  var d = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2])));
  d.setUTCDate(d.getUTCDate() + ((4 - d.getUTCDay() + 7) % 7));
  return d.toISOString().slice(0, 10);
}

/* ---------- גיליון: יצירה, קריאה, כתיבה ---------- */

function ss_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function sheet_(name) {
  return ss_().getSheetByName(TABLES[name].tab);
}

function ensureSheets_() {
  var ss = ss_();
  var missing = Object.keys(TABLES).filter(function (k) { return !ss.getSheetByName(TABLES[k].tab); });
  if (!missing.length) return;
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    missing.forEach(function (k) {
      var t = TABLES[k];
      if (ss.getSheetByName(t.tab)) return;
      var sh = ss.insertSheet(t.tab);
      // הכל נשמר כטקסט, כדי שהגיליון לא יהפוך תאריכים ומספרים לפורמט משלו
      sh.getRange(1, 1, sh.getMaxRows(), t.cols.length).setNumberFormat('@');
      sh.getRange(1, 1, 1, t.cols.length).setValues([t.cols]).setFontWeight('bold');
      sh.setFrozenRows(1);
      try { sh.setRightToLeft(true); } catch (e) { /* לא קריטי */ }
      if (k === 'ideas') {
        var ts = now_();
        write_('ideas', SEED_IDEAS.map(function (s) {
          return { id: id_('i'), title: s[0], pic: s[1], place: s[2], note: '', addedBy: '', createdAt: ts, archived: '' };
        }));
      }
      if (k === 'settings') {
        write_('settings', [
          { key: 'votesPerPerson', value: '3' },
          { key: 'starterVersion', value: String(STARTER_VERSION) }
        ]);
      }
    });
  } finally {
    lock.releaseLock();
  }
}

// מוסיף לגיליון קיים את הרעיונות מרשימת הפתיחה שעוד לא נמצאים בו. רץ פעם אחת לכל STARTER_VERSION.
function syncStarterIdeas_() {
  if (Number(settings_().starterVersion) >= STARTER_VERSION) return;
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (Number(settings_().starterVersion) >= STARTER_VERSION) return;
    var rows = read_('ideas');
    var titles = {};
    rows.forEach(function (r) { titles[r.title] = true; });
    // שם ישן מרשימת הדוגמאות הראשונה
    if (!titles['ערב קריוקי']) {
      rows.forEach(function (r) {
        if (r.title === 'קריוקי בסלון') { r.title = 'ערב קריוקי'; titles['ערב קריוקי'] = true; }
      });
    }
    var ts = now_();
    SEED_IDEAS.forEach(function (s) {
      if (titles[s[0]]) return;
      rows.push({ id: id_('i'), title: s[0], pic: s[1], place: s[2], note: '', addedBy: '', createdAt: ts, archived: '' });
      titles[s[0]] = true;
    });
    write_('ideas', rows);
    setSetting_('starterVersion', String(STARTER_VERSION));
  } finally {
    lock.releaseLock();
  }
}

function read_(name) {
  var sh = sheet_(name);
  var cols = TABLES[name].cols;
  var last = sh.getLastRow();
  if (last < 2) return [];
  var values = sh.getRange(2, 1, last - 1, cols.length).getValues();
  var out = [];
  for (var r = 0; r < values.length; r++) {
    var row = {};
    var empty = true;
    for (var c = 0; c < cols.length; c++) {
      var v = norm_(values[r][c]);
      if (v !== '') empty = false;
      row[cols[c]] = v;
    }
    if (!empty) out.push(row);
  }
  return out;
}

function write_(name, rows) {
  var sh = sheet_(name);
  var cols = TABLES[name].cols;
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, cols.length).clearContent();
  if (!rows.length) return;
  room_(sh, rows.length + 1);
  sh.getRange(2, 1, rows.length, cols.length)
    .setNumberFormat('@')
    .setValues(rows.map(function (r) { return toCells_(cols, r); }));
}

function append_(name, row) {
  var sh = sheet_(name);
  var cols = TABLES[name].cols;
  var at = sh.getLastRow() + 1;
  room_(sh, at);
  sh.getRange(at, 1, 1, cols.length).setNumberFormat('@').setValues([toCells_(cols, row)]);
}

function update_(name, id, change) {
  var rows = read_(name);
  var row = find_(rows, id);
  if (!row) throw new Error('הרשומה לא נמצאה');
  change(row);
  write_(name, rows);
}

function room_(sh, neededRows) {
  var max = sh.getMaxRows();
  if (neededRows > max) sh.insertRowsAfter(max, neededRows - max + 50);
}

function toCells_(cols, row) {
  return cols.map(function (c) {
    var v = row[c];
    return v === undefined || v === null ? '' : String(v);
  });
}

function norm_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, ss_().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  return v === null || v === undefined ? '' : String(v);
}

/* ---------- עזרים ---------- */

function settings_() {
  var out = {};
  read_('settings').forEach(function (r) { if (r.key) out[r.key] = r.value; });
  return out;
}

function setSetting_(key, value) {
  var rows = read_('settings');
  var row = null;
  rows.forEach(function (r) { if (r.key === key) row = r; });
  if (row) row.value = value; else rows.push({ key: key, value: value });
  write_('settings', rows);
}

function votesPerPerson_(settings) {
  var n = Math.round(Number(settings.votesPerPerson));
  return n >= 1 && n <= 5 ? n : 3;
}

function find_(rows, id) {
  for (var i = 0; i < rows.length; i++) if (rows[i].id === id) return rows[i];
  return null;
}

function yes_(v) {
  var s = String(v).toLowerCase();
  return s === '1' || s === 'true';
}

function parse_(json) {
  try {
    var o = JSON.parse(json || '{}');
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  } catch (e) {
    return {};
  }
}

function id_(prefix) {
  return prefix + '_' + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
}

// מנקה טקסט שהגיע מהאפליקציה: שורה אחת, בלי תחילית של נוסחה, באורך מוגבל
function clean_(value, maxChars) {
  var s = String(value === undefined || value === null ? '' : value)
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
    .replace(/^[=+]+/, '')
    .trim();
  return Array.from(s).slice(0, maxChars).join('');
}
