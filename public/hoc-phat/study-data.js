const studyStorageKey = 'pochacco-library:hoc-phat:v1';
const sampleProjectId = 'tinh-su-bo-vi-tri';
const studyCourses = {
  pali:'Pāli', english:'Tiếng Anh Phật pháp', 'tam-tang':'Tam tạng',
  'thien-chi':'Thiền chỉ', 'thien-quan':'Thiền quán', thien:'Thiền', other:'Khác',
};
const studyStatuses = ['Chuẩn bị', 'Đang nghiên cứu', 'Đang viết', 'Hoàn thành'];
const studyLanguages = ['Tiếng Việt', 'Pāli', 'Tiếng Anh', 'Tiếng Thái', 'Tiếng Miến', 'Khác'];
const studyGroups = {chant:'Nghe kinh điển', talk:'Nghe thuyết pháp'};
const youtubeKey = /^[A-Za-z0-9_-]{11}$/;
const studyKey = /^[A-Za-z0-9_-]{1,100}$/;
const studyTime = () => new Date().toISOString();

function loadStudyState(defaults) {
  let previous;
  try { previous = JSON.parse(localStorage.getItem(studyStorageKey) || '{}'); }
  catch { previous = {}; }
  const current = {...structuredClone(defaults), ...previous};
  const migrating = !Array.isArray(current.projects);
  if (migrating) {
    current.projects = [{
      id:sampleProjectId, title:'Trưởng lão Tịnh Sự và Bộ Vị Trí',
      detail:'Công trình phiên dịch và việc giới thiệu lý thuyết 24 duyên.',
      question:'Bản dịch Bộ Vị Trí trình bày các thuật ngữ về duyên như thế nào trong tiếng Việt?',
      status:studyStatuses[0], outline:current.outline,
      sources:[{id:'patthana-24', title:'Paṭṭhāna · The 24 Conditions', detail:'Bảng thuật ngữ Pāli–Anh · PDF',
        url:'https://www.abhidhamma.com/tab_Patthana_24_en.pdf'}],
      citations:current.citations.map(c => ({...c, id:newRecordId(), sourceTitle:'Bộ Vị Trí · Bảng thuật ngữ mẫu',
        url:'https://www.abhidhamma.com/tab_Patthana_24_en.pdf'})),
      draft:current.draft,
    }];
  }
  current.notes = current.notes.map(note => note.id ? note : {...note, id:newRecordId()});
  current.readings ??= [];
  current.progress ??= current.complete ? {'tam-tang':true} : {};
  current.lastReading ??= 'tam-tang';
  delete current.outline;
  delete current.citations;
  delete current.draft;
  delete current.complete;
  if (migrating && Array.isArray(previous?.outline)) {
    try { localStorage.setItem(studyStorageKey,JSON.stringify(current)); } catch {}
  }
  return current;
}

const studyBackupFields = ['readings','notes','videos','projects','terms','progress','lastReading'];
const studyBackupLimit = 8_000_000;

function makeStudyBackup() {
  const data = Object.fromEntries(studyBackupFields.map(key => [key,state[key]]));
  return JSON.stringify({app:'pochacco-hoc-phat', version:1, exportedAt:studyTime(), data}, null, 2);
}

function parseStudyBackup(raw) {
  const invalid = () => { throw new Error('Tệp không đúng định dạng bản sao Học Phật.'); };
  const {app, version, data} = JSON.parse(raw) || {};
  if (app !== 'pochacco-hoc-phat' || version !== 1 || !data || typeof data !== 'object') invalid();
  const text = (value, max, required = false) => {
    if (value == null && !required) return '';
    if (typeof value !== 'string' || value.length > max || (required && !value.trim())) invalid();
    return value;
  };
  const id = (value, pattern = studyKey) => {
    if (typeof value !== 'string' || !pattern.test(value) || ['__proto__','prototype','constructor'].includes(value)) invalid();
    return value;
  };
  const url = value => {
    const rawUrl = text(value, 2000);
    const safeUrl = externalLink(rawUrl);
    if (rawUrl && !safeUrl) invalid();
    return safeUrl;
  };
  const choice = (value, choices) => {
    if (!choices.includes(value)) invalid();
    return value;
  };
  const records = (values, convert) => {
    if (!Array.isArray(values) || values.length > 5000) invalid();
    const seen = new Set();
    return values.map(value => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
      const record = convert(value);
      if (seen.has(record.id)) invalid();
      seen.add(record.id);
      return record;
    });
  };
  const readings = records(data.readings, r => ({
    id:id(r.id), title:text(r.title,160,true), course:choice(r.course,Object.keys(studyCourses)),
    text:text(r.text,18000), url:url(r.url), updated:text(r.updated,40),
  }));
  const readingIds = [...Object.keys(courses), ...readings.map(r => r.id)];
  const notes = records(data.notes, n => ({
    id:id(n.id), course:choice(n.course,readingIds), text:text(n.text,3000,true), updated:text(n.updated,40),
  }));
  const videos = records(data.videos, v => ({
    id:id(v.id,youtubeKey), title:text(v.title,160,true), speaker:text(v.speaker,100),
    group:choice(v.group,Object.keys(studyGroups)), topic:text(v.topic,80,true),
    lang:choice(v.lang,studyLanguages), thumbnail:v.thumbnail !== false, updated:text(v.updated,40),
  }));
  const projects = records(data.projects, p => {
    const outline = records(p.outline, o => ({
      id:id(o.id), title:text(o.title,160,true), detail:text(o.detail,2000),
    }));
    const citations = records(p.citations, c => ({
      id:id(c.id), text:text(c.text,5000,true), sourceTitle:text(c.sourceTitle,240),
      location:text(c.location,240), url:url(c.url),
      outline:outline.some(o => o.id === c.outline) ? c.outline : null,
    }));
    const sources = records(p.sources, s => ({
      id:id(s.id), title:text(s.title,160,true), detail:text(s.detail,2000),
      location:text(s.location,240), url:url(s.url),
    }));
    return {id:id(p.id), title:text(p.title,160,true), detail:text(p.detail,2000),
      question:text(p.question,2000), status:choice(p.status,studyStatuses), archived:p.archived === true,
      draft:text(p.draft,2500000), outline, sources, citations, updated:text(p.updated,40)};
  });
  if (!Array.isArray(data.terms) || data.terms.length > 5000 || !data.progress ||
      typeof data.progress !== 'object' || Array.isArray(data.progress)) invalid();
  const progress = Object.fromEntries(Object.entries(data.progress).map(([key,value]) => {
    if (typeof value !== 'boolean') invalid();
    return [choice(key,readingIds),value];
  }));
  return {readings, notes, videos, projects, progress, terms:data.terms.map(term => text(term,160,true)),
    lastReading:choice(data.lastReading,readingIds)};
}

function mergeStudyBackup(incoming) {
  const merged = {};
  const counts = {};
  for (const key of ['readings','notes','videos','projects']) {
    const existing = new Set(state[key].map(record => record.id));
    const added = incoming[key].filter(record => !existing.has(record.id));
    merged[key] = [...state[key], ...added];
    counts[key] = added.length;
  }
  merged.progress = {...incoming.progress, ...state.progress};
  merged.terms = [...new Set([...state.terms, ...incoming.terms])];
  merged.lastReading = state.lastReading || incoming.lastReading;
  return {merged, counts};
}
