const OS = Object.freeze({
  scheduleUrl: 'https://cs.nyu.edu/~mwalfish/classes/26fa/syllabus.html',
  labsUrl: 'https://cs.nyu.edu/~mwalfish/classes/26fa/labs.html',
  year: 2026,
  timeZone: 'America/New_York',
  taskListName: 'Operating Systems',
  calendarName: 'Operating Systems',
  taskListId: '',
  calendarId: '',
  namespace: 'nyu-cs202-26fa',
  firstDate: '2026-09-01'
});

function previewSchedule() {
  const items = loadSchedule_();
  console.log(JSON.stringify(items, null, 2));
  return items;
}

function installDailySync() {
  syncSchedule();
  removeDailySync();
  ScriptApp.newTrigger('syncSchedule').timeBased().everyDays(1)
    .atHour(6).inTimezone(OS.timeZone).create();
  console.log('Daily sync installed for approximately 6–7 AM New York time.');
}

function removeDailySync() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'syncSchedule')
    .forEach(t => ScriptApp.deleteTrigger(t));
}

function syncSchedule() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) throw new Error('Another sync is running.');
  try {
    const items = loadSchedule_().filter(x => x.date >= OS.firstDate);
    const listId = resolveList_();
    const calendarId = resolveCalendar_();
    const tasks = pages_(token => Tasks.Tasks.list(listId, {
      maxResults: 100, showCompleted: true, showHidden: true,
      showDeleted: false, ...(token ? {pageToken: token} : {})
    }));
    const events = pages_(token => Calendar.Events.list(calendarId, {
      maxResults: 2500, showDeleted: false,
      privateExtendedProperty: ['courseSync=' + OS.namespace],
      ...(token ? {pageToken: token} : {})
    }));
    const taskMap = index_(tasks, t => taskKey_(t.notes || ''));
    const eventMap = index_(events, e => (e.extendedProperties.private || {}).itemKey);
    const wanted = new Set(items.map(x => x.key));
    for (const item of items) {
      if (item.type === 'task') {
        const old = taskMap[item.key];
        const desired = {
          title: item.title,
          due: item.date + 'T00:00:00.000Z',
          notes: notes_(old && old.notes, item)
        };
        if (!old) Tasks.Tasks.insert(desired, listId);
        else if (old.title !== desired.title || (old.due || '').slice(0, 10) !== item.date || old.notes !== desired.notes) {
          Tasks.Tasks.patch(desired, listId, old.id);
        }
      } else {
        const old = eventMap[item.key];
        const desired = {
          summary: item.title,
          description: notes_(old && old.description, item),
          start: {date: item.date}, end: {date: nextDate_(item.date)},
          extendedProperties: {private: {courseSync: OS.namespace, itemKey: item.key}}
        };
        if (!old) Calendar.Events.insert(desired, calendarId);
        else if (old.summary !== desired.summary || old.start.date !== item.date ||
          old.end.date !== desired.end.date || old.description !== desired.description) {
          Calendar.Events.patch(desired, calendarId, old.id);
        }
      }
    }
    const warning = '\nSchedule notice: This item is no longer listed. Verify with course staff.\n';
    for (const [key, task] of Object.entries(taskMap)) {
      if (!wanted.has(key) && !task.notes.includes('Schedule notice:')) {
        Tasks.Tasks.patch({notes: task.notes.replace(end_(), warning + end_())}, listId, task.id);
      }
    }
    for (const [key, event] of Object.entries(eventMap)) {
      if (!wanted.has(key) && !(event.description || '').includes('Schedule notice:')) {
        Calendar.Events.patch({description: (event.description || '').replace(end_(), warning + end_())}, calendarId, event.id);
      }
    }
    console.log('Sync succeeded: ' + items.filter(x => x.type === 'task').length +
      ' assignments, ' + items.filter(x => x.type === 'event').length + ' quizzes/exams.');
  } finally {
    lock.releaseLock();
  }
}

function resolveList_() {
  if (OS.taskListId) return OS.taskListId;
  const matches = pages_(token => Tasks.Tasklists.list({maxResults: 100,
    ...(token ? {pageToken: token} : {})})).filter(x => x.title === OS.taskListName);
  if (matches.length > 1) throw new Error('Multiple Operating Systems task lists. Set OS.taskListId.');
  return matches.length ? matches[0].id : Tasks.Tasklists.insert({title: OS.taskListName}).id;
}

function resolveCalendar_() {
  if (OS.calendarId) return OS.calendarId;
  const matches = pages_(token => Calendar.CalendarList.list({maxResults: 250,
    ...(token ? {pageToken: token} : {})})).filter(x =>
      (x.summaryOverride || x.summary) === OS.calendarName);
  if (matches.length !== 1) throw new Error('Expected one Operating Systems calendar. Set OS.calendarId to its Calendar ID in Calendar settings.');
  if (!['owner', 'writer'].includes(matches[0].accessRole)) throw new Error('Calendar is not writable.');
  return matches[0].id;
}

function pages_(fetchPage) {
  let token;
  const items = [];
  do {
    const page = fetchPage(token);
    items.push(...(page.items || []));
    token = page.nextPageToken;
  } while (token);
  return items;
}

function index_(items, keyFn) {
  const result = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    if (result[key]) throw new Error('Duplicate sync identity: ' + key + '. Resolve duplicates before syncing.');
    result[key] = item;
  }
  return result;
}

function begin_(key) { return '[' + OS.namespace + ':' + key + ']'; }
function end_() { return '[/' + OS.namespace + ']'; }
function taskKey_(notes) {
  const prefix = '[' + OS.namespace + ':';
  const start = notes.indexOf(prefix);
  if (start < 0) return null;
  const finish = notes.indexOf(']', start);
  return finish < 0 ? null : notes.slice(start + prefix.length, finish);
}

function notes_(previous, item) {
  const start = begin_(item.key);
  const block = [start, item.link ? 'Assignment/materials: ' + item.link :
    'Assignment link not yet published; it will be added automatically.',
    'Schedule: ' + OS.scheduleUrl, 'Scheduled date: ' + item.date,
    item.detail, end_()].filter(Boolean).join('\n');
  const text = previous || '';
  const a = text.indexOf(start);
  const b = text.indexOf(end_(), a);
  if (a >= 0 && b >= 0) return text.slice(0, a) + block + text.slice(b + end_().length);
  return text ? text + '\n\n' + block : block;
}

function fetchHtml_(url) {
  const response = UrlFetchApp.fetch(url, {muteHttpExceptions: true, followRedirects: true});
  if (response.getResponseCode() !== 200) throw new Error('Cannot fetch ' + url + ': HTTP ' + response.getResponseCode());
  return response.getContentText();
}

function loadSchedule_() {
  return parseSchedule_(fetchHtml_(OS.scheduleUrl), fetchHtml_(OS.labsUrl));
}

function clean_(html) {
  return html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(del|s|strike)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
}

function text_(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;|&mdash;/gi, '-').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/\s+/g, ' ').trim();
}

function links_(html) {
  const result = [];
  const re = /<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) result.push({href: text_(m[1] || m[2] || m[3]), label: text_(m[4])});
  return result;
}

function absolute_(href) {
  const base = OS.scheduleUrl.slice(0, OS.scheduleUrl.lastIndexOf('/') + 1);
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith('//')) return 'https:' + href;
  if (href.startsWith('/')) return 'https://cs.nyu.edu' + href;
  if (/^[a-z]+:/i.test(href)) throw new Error('Unsupported link scheme.');
  const parts = (base + href).split('/');
  const out = [];
  for (const part of parts) {
    if (part === '..') out.pop();
    else if (part !== '.') out.push(part);
  }
  return out.join('/');
}

function nextDate_(date) {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function parseSchedule_(source, labSource) {
  const html = clean_(source);
  const table = (html.match(/<table\b[^>]*class\s*=\s*["'][^"']*\bschedule\b[^"']*["'][^>]*>([\s\S]*?)<\/table>/i) || [])[1];
  if (!table) throw new Error('Schedule table missing. No changes made.');
  const headers = [...table.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map(m => text_(m[1]));
  if (headers.length !== 6 || headers[1] !== 'Topics' || headers[2] !== 'Quizzes' || headers[4] !== 'Homework') {
    throw new Error('Schedule columns changed. Update the parser before syncing.');
  }
  const assignmentLinks = {};
  for (const link of links_(html + clean_(labSource || ''))) {
    const m = link.href.match(/\/(hw|lab)(\d+)\.(?:html|pdf)(?:[?#]|$)/i);
    if (m) assignmentLinks[m[1].toLowerCase() + '-' + Number(m[2])] = absolute_(link.href);
    if (/^Lab Setup$/i.test(link.label)) assignmentLinks['lab-0'] = absolute_(link.href);
  }
  const items = {};
  function add(item) {
    if (items[item.key] && items[item.key].date !== item.date) throw new Error('Conflicting dates for ' + item.key);
    items[item.key] = item;
  }
  for (const row of table.matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[2].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m => m[1]);
    if (cells.length < 2) continue;
    const dateMatch = text_(cells[0]).match(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2})\/(\d{1,2})$/i);
    if (!dateMatch) throw new Error('Unrecognized schedule date: ' + text_(cells[0]));
    if (cells.length !== 6) throw new Error('Unexpected schedule row layout.');
    const date = OS.year + '-' + dateMatch[1].padStart(2, '0') + '-' + dateMatch[2].padStart(2, '0');
    const parsed = new Date(date + 'T00:00:00Z');
    if (isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new Error('Invalid date: ' + date);
    const topic = text_(cells[1]);
    const dueText = [cells[1], cells[4], cells[5]].map(text_).join(' ');
    for (const m of dueText.matchAll(/\b(HW|Homework|Lab)\s*#?\s*(\d+)\s+DUE\b/gi)) {
      const kind = /^lab$/i.test(m[1]) ? 'lab' : 'hw';
      const key = kind + '-' + Number(m[2]);
      add({key, type: 'task', date, title: (kind === 'hw' ? 'HW ' : 'Lab ') + Number(m[2]),
        link: assignmentLinks[key] || '', detail: 'Course deadline: ' + dueText.trim()});
    }
    const quizzes = text_(cells[2]);
    let quizFound = false;
    for (const m of quizzes.matchAll(/\b(?:Quiz\s*#?\s*|Q)(\d+)\b/gi)) {
      quizFound = true;
      const n = Number(m[1]);
      const link = links_(cells[2]).find(x => /\b(?:Q|Quiz\s*)0*\d+\b/i.test(x.label));
      add({key: 'quiz-' + n, type: 'event', date, title: 'Quiz ' + n,
        link: link ? absolute_(link.href) : OS.scheduleUrl, detail: topic});
    }
    if (quizzes && !quizFound && !/^(none|no quiz|[-–])$/i.test(quizzes)) throw new Error('Unrecognized quiz entry: ' + quizzes);
    if (!/\breview\b/i.test(topic) && /\b(midterm|final)(?:\s+exam)?\b|\bexam\s*\d+\b/i.test(topic)) {
      const m = topic.match(/\b(midterm|final)(?:\s+exam)?(?:\s+(\d+))?|\bexam\s*(\d+)\b/i);
      const kind = m[1] ? m[1].toLowerCase() : 'exam';
      const key = kind + (m[2] || m[3] ? '-' + (m[2] || m[3]) : '');
      add({key, type: 'event', date, title: topic, link: OS.scheduleUrl, detail: ''});
    }
  }
  const result = Object.values(items).sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
  if (!result.some(x => x.type === 'task') || !result.some(x => x.type === 'event')) throw new Error('No assignments or assessments found. No changes made.');
  return result;
}
