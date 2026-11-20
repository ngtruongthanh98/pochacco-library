const icons = {
  book: '<path d="M12 7c-2.8-2.4-6.5-2.7-9-2v14c3-.8 6.5-.4 9 2 2.5-2.4 6-2.8 9-2V5c-2.5-.7-6.2-.4-9 2Zm0 0v14"/>',
  home: '<path d="m3 11 9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  play: '<path d="m9 5 11 7-11 7z"/>',
  video: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3z"/>',
  file: '<path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6"/>',
  lang: '<path d="M3 6h12M9 3v3m3 0c-.4 4-3 7-8 9m2-7c1 2.8 3.8 5 6 6m0 7 4-10 4 10m-6.5-3h5"/>',
  leaf: '<path d="M4 19c0-8 6-13 16-14 0 8-4 13-11 13H4Zm0 0 9-8"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  mark: '<path d="M6 4h12v16l-6-4-6 4z"/>',
};
const icon = name => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + icons[name] + '</svg>';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize = value => value.toLowerCase().normalize('NFD').replace(/\p{M}/gu,'').replace(/[đð]/g,'d');
const newRecordId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)),
  byte => byte.toString(16).padStart(2,'0')).join('');
const clone = value => structuredClone(value);
const seed = {
  complete: false, citations: [], terms: [], notes: [], draft: '',
  researchSources: [], researchJournal: [],
  outline: [
    {id:'ctx',title:'Bối cảnh và câu hỏi nghiên cứu',detail:'Xác định phạm vi khảo sát công trình phiên dịch.'},
    {id:'term',title:'Đối chiếu thuật ngữ về các duyên',detail:'So sánh cách diễn đạt Pāli, tiếng Việt và tiếng Anh.'},
    {id:'role',title:'Vai trò của bản dịch trong việc giới thiệu 24 duyên',detail:'Đối chiếu nguồn trước khi viết nhận định.'},
  ],
  videos: [
    {id:'9P4N5izrCXI',title:'The Paṭṭhāna · Buddhist Chanting',group:'chant',topic:'Vi diệu pháp',lang:'Pāli',thumbnail:true},
    {id:'yuk_ZpMNe3U',title:'Paṭṭhāna: Conditional Relations',group:'talk',topic:'Vi diệu pháp',lang:'Tiếng Anh',thumbnail:true},
  ],
};
let state = clone(seed);
try { state = {...state,...JSON.parse(localStorage.getItem('pochacco-library:hoc-phat:v1') || '{}')}; } catch {}
function save() {
  try { localStorage.setItem('pochacco-library:hoc-phat:v1',JSON.stringify(state)); return true; }
  catch { return false; }
}
const nav = [
  {hash:'#/',label:'Hôm nay',icon:'home'},
  {hash:'#/doc',label:'Đọc bài',icon:'book'},
  {hash:'#/video',label:'Video',icon:'video'},
  {hash:researchBase,label:'Nghiên cứu',icon:'layers'},
  {hash:'#/de-tai',label:'Đề tài',icon:'file'},
];
const paths = [
  {title:'Pāli',desc:'Thuật ngữ và đọc hiểu',icon:'lang',course:'pali'},
  {title:'Tiếng Anh Phật pháp',desc:'Đọc và nghe học thuật',icon:'book',course:'english'},
  {title:'Tam tạng',desc:'Kinh · Luật · Luận',icon:'layers',href:researchBase+'?nhom=tam-tang'},
  {title:'Thiền',desc:'Thiền chỉ và thiền quán',icon:'leaf',href:researchBase+'?nhom=thien'},
];
const courses = {
  pali:{title:'Thuật ngữ Pāli trong Bộ Vị Trí',meta:'Pāli · Đọc thuật ngữ',lead:'Đọc từng thành tố của một thuật ngữ, rồi đối chiếu với cách dịch trong ngữ cảnh của bài.',note:'Chọn thẻ hetu-paccaya để lưu cụm từ vào danh sách ôn.'},
  english:{title:'Đọc tiếng Anh Phật pháp',meta:'Tiếng Anh Phật pháp · Bài mẫu',lead:'Đối chiếu root condition và object condition với thuật ngữ Pāli, rồi thử tóm tắt hai cách gọi bằng một câu tiếng Anh.',note:'Dùng ngăn ghi chú để lưu câu tóm tắt của bạn.'},
  'tam-tang':{title:'Bộ Vị Trí và 24 duyên',meta:'Tam tạng · Luận tạng · Vi diệu pháp',lead:'Bộ Vị Trí (Paṭṭhāna) trình bày 24 loại duyên. Bài đọc mẫu tập trung vào hai thuật ngữ đầu để bạn thử cách đọc đối chiếu và lưu trích dẫn.',note:'Chọn một cách hiển thị bên dưới để xem thuật ngữ theo từng ngôn ngữ.'},
  thien:{title:'Thiền chỉ và thiền quán',meta:'Thiền · Bài mẫu',lead:'Giao diện dành chỗ cho mục tiêu bài học, nguồn đọc và ghi chú thực hành theo hai lộ trình thiền chỉ và thiền quán.',note:'Mở ngăn ghi chú để ghi lại một câu hỏi muốn tra cứu thêm.'},
};
const terms = [
  {pali:'Hetu-paccaya',vi:'Nhân duyên',en:'Root condition'},
  {pali:'Ārammaṇa-paccaya',vi:'Cảnh duyên',en:'Object condition'},
];
const readerTabs = [
  {id:'compare',label:'Đối chiếu'}, {id:'pali',label:'Pāli'}, {id:'vi',label:'Tiếng Việt'}, {id:'en',label:'English'},
];
const researchTabs = [
  {id:'outline',label:'Dàn ý'}, {id:'sources',label:'Nguồn'}, {id:'citations',label:'Trích dẫn'}, {id:'draft',label:'Bản thảo'},
];
const sourceURL = 'https://www.abhidhamma.com/tab_Patthana_24_en.pdf';
const view = {reader:'compare', research:'outline', group:'all', topic:'all', query:'', outline:'term'};
const main = document.querySelector('main');
const pageContent = document.querySelector('#page-content');
const dialog = document.querySelector('dialog');
const toast = document.querySelector('.toast');
let toastTimer;
function notify(text) {
  toast.textContent = text;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'),2800);
}
function persist(message) {
  notify(save() ? message : 'Đã cập nhật cho lượt xem này. Trình duyệt hiện không cho lưu dữ liệu.');
}
function route() {
  const [path, query] = (location.hash || '#/').split('?');
  if (path === commentaryBase) return {path:researchBase,catalog:true,query:new URLSearchParams(query)};
  if (path === researchBase || path.startsWith(researchBase+'/')) {
    return {path:researchBase,...researchRoute(path,query)};
  }
  const p = nav.some(n => n.hash === path) ? path : '#/';
  const course = new URLSearchParams(query).get('lo-trinh');
  return {path:p,course:Object.hasOwn(courses,course) ? course : 'tam-tang'};
}
function btn(label,action,kind='secondary',glyph='') {
  return '<button type="button" class="btn '+kind+'" data-action="'+action+'">'+(glyph?icon(glyph):'')+label+'</button>';
}
function tabs(entries,current,action) {
  return entries.map(t => '<button type="button" class="tab" aria-pressed="'+(t.id === current)+'" data-action="'+action+'" data-value="'+t.id+'">'+t.label+'</button>').join('');
}
function art() {
  return '<img class="hero-art" src="manuscript.webp" alt="Minh họa bản lá buông trên nền vải màu vàng đất" width="600" height="445">';
}
function home() {
  return '<div class="page-head"><h1>Hôm nay</h1><p>Đọc tiếp một bài, nghe giảng hoặc quay lại đề tài đang viết.</p></div>'+
    '<div class="intro-grid"><section class="hero"><div class="hero-copy"><div class="kicker">LUẬN TẠNG · VI DIỆU PHÁP</div><h2>Bộ Vị Trí<br>và 24 duyên</h2><p>Đọc đối chiếu Pāli, tiếng Việt và tiếng Anh.</p><a class="btn light" href="#/doc">'+icon('book')+(state.complete?'Đọc lại bài':'Tiếp tục đọc')+'</a></div>'+art()+'</section>'+
    '<section class="card queue"><h2>Đang học</h2><div class="meta">'+(state.complete?'1 trên 1 bài mẫu đã hoàn thành':'0 trên 1 bài mẫu đã hoàn thành')+'</div><div class="progress" role="progressbar" aria-label="Tiến độ bài mẫu" aria-valuenow="'+Number(state.complete)+'" aria-valuemax="1"><span style="width:'+(state.complete?100:0)+'%"></span></div><a href="#/doc">'+icon('book')+'<span><strong>Bộ Vị Trí và 24 duyên</strong><small>'+ (state.complete?'Đã học':'Bài đọc đang mở')+'</small></span></a><a href="#/doc">'+icon('mark')+'<span><strong>Từ vựng đã lưu</strong><small>'+state.terms.length+' thuật ngữ</small></span></a></section></div>'+
    '<section><div class="section-head"><h2>Lộ trình học</h2><img class="section-sticker" src="../assets/sticker-divider.webp" width="244" height="75" alt=""></div><div class="path-grid">'+paths.map(p=>'<a class="card path" href="'+(p.href || '#/doc?lo-trinh='+p.course)+'"><span class="icon-tile">'+icon(p.icon)+'</span><h3>'+p.title+'</h3><p>'+p.desc+'</p></a>').join('')+'</div></section>'+
    researchCardList()+
    '<section><div class="section-head"><h2>Video và đề tài</h2></div><div class="lower-grid"><a class="card row-link" href="#/video"><span class="icon-tile">'+icon('video')+'</span><div><h3>Kho video</h3><p>Nghe kinh điển và thuyết pháp</p></div></a><a class="card row-link" href="#/de-tai"><span class="icon-tile">'+icon('file')+'</span><div><h3>Trưởng lão Tịnh Sự và Bộ Vị Trí</h3><p>Mở dàn ý và tư liệu của đề tài mẫu</p></div></a></div></section>';
}
function termBlocks() {
  return terms.map(t => {
    const options = {pali:['Pāli',t.pali],vi:['Tiếng Việt',t.vi],en:['English',t.en]};
    const fields = view.reader === 'compare' ? [options.pali,options.vi,options.en] : [options[view.reader]];
    return '<div class="passage">'+fields.map(([label,value])=>'<div class="kicker">'+label+'</div><p>'+value+'</p>').join('')+'</div>';
  }).join('');
}
function reader(course) {
  const item = courses[course];
  const meditation = course === 'thien';
  return '<div class="page-head"><div class="kicker">'+item.meta+'</div><h1>'+item.title+'</h1><p>'+item.lead+'</p></div>'+
    '<div class="reader-grid"><article class="panel"><div class="article-section"><h2>'+ (meditation?'Ghi chú thực hành':'Thuật ngữ đối chiếu')+'</h2><p class="meta">'+item.note+'</p>'+
    (meditation?'':'<div class="reader-tabs" aria-label="Ngôn ngữ" style="margin-top:12px">'+tabs(readerTabs,view.reader,'reader-tab')+'</div><div class="parallel">'+termBlocks()+'</div><p class="meta" style="margin-top:13px">Bảng thuật ngữ mẫu · <a href="'+sourceURL+'" target="_blank" rel="noopener"><u>Mở nguồn đối chiếu Pāli–Anh</u></a></p>')+
    '</div><div class="buttons article-actions">'+(meditation?'':btn('Lưu trích dẫn','cite','', 'mark'))+btn('Ghi chú','note','secondary','plus')+
    (course!=='tam-tang'?'':btn(state.complete?'Đã hoàn thành':'Đánh dấu đã học','complete','secondary','check'))+'</div></article>'+
    '<aside class="panel side-panel"><h2>Sổ tay bài học</h2>'+(meditation?'':'<button class="text-button" data-action="term">Hetu-paccaya · Nhân duyên</button><p class="meta">'+state.terms.length+' thuật ngữ đã lưu</p>')+
    '<h3>Ghi chú của bạn</h3>'+(state.notes.filter(n=>n.course===course).map(n=>'<p class="note">'+esc(n.text)+'</p>').join('')||'<p class="meta">Chưa có ghi chú cho bài này.</p>')+
    '<h3>Tư liệu liên quan</h3><a href="#/video">Video về Vi diệu pháp</a><a href="#/de-tai">Đề tài về Trưởng lão Tịnh Sự</a></aside></div>';
}
function videoCard(v) {
  return '<article class="video-card panel" style="padding:0"><button class="video-cover" data-action="play" data-value="'+esc(v.id)+'" aria-label="Phát '+esc(v.title)+'">'+
    (v.thumbnail?'<img src="https://i.ytimg.com/vi/'+esc(v.id)+'/hqdefault.jpg" alt="" loading="lazy">':'')+'<span class="play-circle">'+icon('play')+'</span></button>'+
    '<div class="video-info"><span class="status">'+esc(v.topic)+'</span><h3>'+esc(v.title)+'</h3><p class="meta">'+(v.group==='chant'?'Nghe kinh điển':'Nghe thuyết pháp')+' · '+esc(v.lang)+'</p>'+
    (v.speaker?'<p class="meta">'+esc(v.speaker)+'</p>':'')+'</div></article>';
}
function filteredVideos() {
  const videos = state.videos.filter(v => (view.group==='all'||v.group===view.group) && (view.topic==='all'||v.topic===view.topic) &&
     normalize(v.title+' '+v.topic+' '+v.lang+' '+(v.speaker||'')).includes(normalize(view.query.trim())));
  return videos.length ? videos.map(videoCard).join('') : '<p class="empty">Không có video phù hợp với bộ lọc.</p>';
}
function videoPage() {
  const topics = [...new Set(state.videos.map(v=>v.topic))];
  return '<div class="page-head head-split"><div><h1>Video</h1><p>Nghe kinh điển và xem bài thuyết pháp theo chủ đề.</p></div>'+btn('Thêm video','add-video','', 'plus')+'</div>'+
    '<div class="tabs" aria-label="Nhóm video">'+tabs([{id:'all',label:'Tất cả'},{id:'chant',label:'Nghe kinh điển'},{id:'talk',label:'Nghe thuyết pháp'}],view.group,'video-tab')+'</div>'+
    '<div class="filters"><input id="video-search" type="search" placeholder="Tìm tiêu đề, người giảng…" aria-label="Tìm video" value="'+esc(view.query)+'"><select id="topic" aria-label="Chủ đề"><option value="all">Mọi chủ đề</option>'+topics.map(t=>'<option'+(view.topic===t?' selected':'')+'>'+esc(t)+'</option>').join('')+'</select></div><div class="video-grid" id="video-grid">'+filteredVideos()+'</div>';
}
function citationRows(citations) {
  return citations.map(c=>'<div class="source-item"><strong>'+esc(c.text)+'</strong><p class="meta">Bộ Vị Trí · Bảng thuật ngữ mẫu</p><a class="meta" href="'+sourceURL+'" target="_blank" rel="noopener">Nguồn đối chiếu Pāli–Anh</a></div>').join('') || '<p class="empty">Chưa có trích dẫn. Bạn có thể lưu một đoạn từ màn hình Đọc bài.</p>';
}
function research() {
  const selected = state.outline.find(o=>o.id===view.outline) || state.outline[0];
  let content;
  if (view.research === 'sources') {
    content = '<h2>Nguồn đang đọc</h2><div class="source-list" style="margin-top:12px"><div class="source-item"><h3>Paṭṭhāna · The 24 Conditions</h3><p class="meta">Bảng thuật ngữ Pāli–Anh · PDF</p><a href="'+sourceURL+'" target="_blank" rel="noopener">Mở tài liệu</a></div></div>';
  } else if (view.research === 'citations') {
    content = '<h2>Trích dẫn đã lưu</h2><div class="source-list" style="margin-top:12px">'+citationRows(state.citations)+'</div>';
  } else if (view.research === 'draft') {
    content = '<label for="draft"><h2>Bản thảo</h2></label><p class="meta" style="margin:6px 0">Bản nháp mẫu lưu trên trình duyệt này.</p><textarea class="draft" id="draft" placeholder="Viết đoạn đầu tiên…">'+esc(state.draft)+'</textarea><p class="meta" id="draft-status" aria-live="polite"></p>';
  } else {
    content = '<div class="head-split" style="margin-bottom:12px"><h2>Dàn ý</h2>'+btn('Thêm mục','add-outline','secondary','plus')+'</div><div class="stack">'+state.outline.map(o=>'<div class="outline-row'+(selected.id===o.id?' active':'')+'"><div><button data-action="outline" data-value="'+esc(o.id)+'" aria-pressed="'+(selected.id===o.id)+'">'+esc(o.title)+'</button><small>'+esc(o.detail)+'</small></div><span class="meta">'+state.citations.filter(c=>c.outline===o.id).length+' trích dẫn</span></div>').join('')+'</div>';
  }
  return '<div class="page-head"><div class="kicker">NGHIÊN CỨU PHẬT GIÁO NAM TÔNG</div><h1>Trưởng lão Tịnh Sự và Bộ Vị Trí</h1><p>Công trình phiên dịch và việc giới thiệu lý thuyết 24 duyên.</p></div>'+
   '<div class="research-grid"><section class="panel"><div class="tabs" aria-label="Các phần của đề tài">'+tabs(researchTabs,view.research,'research-tab')+'</div>'+content+'</section>'+
   '<aside class="panel side-panel"><span class="status warn">Đang chuẩn bị tư liệu</span><h3>Câu hỏi nghiên cứu</h3><p>Bản dịch Bộ Vị Trí trình bày các thuật ngữ về duyên như thế nào trong tiếng Việt?</p><h3>Tư liệu gắn với luận điểm</h3><p class="meta">'+esc(selected.title)+'</p><div class="source-list" style="margin-top:8px">'+citationRows(state.citations.filter(c=>c.outline===selected.id))+'</div><div style="margin-top:10px">'+btn('Gắn trích dẫn','attach','secondary','plus')+'</div></aside></div>';
}
function render({focus=false}={}) {
  cancelCanonReading();
  const current = route();
  const {path,course,area,section} = current;
  document.querySelector('#section-nav').innerHTML = nav.map(n =>
    '<a class="nav-link tab" href="'+n.hash+'"'+(path===n.hash?' aria-current="page"':'')+'>'+icon(n.icon)+'<span>'+n.label+'</span></a>'
  ).join('');
  document.title = (current.catalog ? 'Thư mục Theravāda' : section?.title || area?.title || nav.find(n=>n.hash===path).label)+' · Học Phật | Pochacco Library';
  pageContent.innerHTML = path==='#/doc'?reader(course):path==='#/video'?videoPage():path==='#/de-tai'?research():current.catalog?commentaryPage(current):path===researchBase?workspaceResearch(current):home();
  if(current.tab==='van-ban') renderCanonWorkspace(current);
  if(focus){main.focus({preventScroll:true});if(current.tab==='van-ban')main.scrollIntoView();else window.scrollTo(0,0);}
}
function modal(title,body) {
  document.querySelector('#dialog-content').innerHTML = '<div class="dialog-head"><h2 id="dialog-title">'+title+'</h2><button type="button" class="close" data-action="close" aria-label="Đóng">'+icon('close')+'</button></div>'+body;
  if(!dialog.open) dialog.showModal();
}
function form(body,label,id) {
  return '<form class="form" id="'+id+'">'+body+'<div class="form-error" role="alert"></div><div><button class="btn" type="submit">'+label+'</button></div></form>';
}
function youtubeId(value) {
  try {
    const u = new URL(value);
    if (!['https:','http:'].includes(u.protocol)) return '';
    const parts = u.pathname.split('/').filter(Boolean);
    let id;
    if (u.hostname === 'youtu.be') id = parts[0];
    else if (['www.youtube.com','youtube.com','m.youtube.com','www.youtube-nocookie.com'].includes(u.hostname))
      id = parts[0] === 'watch' ? u.searchParams.get('v') : ['embed','shorts','live'].includes(parts[0]) ? parts[1] : '';
    return /^[\w-]{11}$/.test(id || '') ? id : '';
  } catch { return ''; }
}
function player(id) {
  const v = state.videos.find(item=>item.id===id);
  if (!v) return;
  modal(esc(v.title),'<iframe class="video-frame" title="'+esc(v.title)+'" src="https://www.youtube-nocookie.com/embed/'+v.id+'" allow="encrypted-media; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe><a class="btn secondary" href="https://www.youtube.com/watch?v='+v.id+'" target="_blank" rel="noopener">Mở trên YouTube</a>');
}
function selectTerm() {
  modal('Hetu-paccaya','<div class="stack" style="margin-top:12px"><p><strong>Tiếng Việt</strong> · Nhân duyên</p><p><strong>English</strong> · Root condition</p><div>'+btn(state.terms.includes('Hetu-paccaya')?'Bỏ khỏi danh sách ôn':'Lưu để ôn','save-term','', 'mark')+'</div></div>');
}
function updateSelection(button,active,selector,replacement) {
  const container = button.parentElement;
  for(const el of container.querySelectorAll('[data-value]')) el.setAttribute('aria-pressed',String(active===el.dataset.value));
  document.querySelector(selector).innerHTML = replacement;
}
document.querySelector('.skip').addEventListener('click', event => {
  event.preventDefault();
  main.focus({preventScroll:true});
  main.scrollIntoView();
});
window.addEventListener('hashchange',()=>render({focus:true}));
document.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if(!button) return;
  const {action,value} = button.dataset;
  if(action==='close') dialog.close();
  if(action==='canon-retry') renderCanonWorkspace(route());
  if(action==='canon-reading') loadCanonReading(value);
  if(action==='canon-size') sizeCanonReader(Number(value));
  if(action==='canon-page') {
    const target=document.querySelector('#canon-body');
    if(target)renderCanonReaderPage(target,Number(value),true);
  }
  if(action==='research-source'||action==='research-journal') openResearchForm(action,value);
  if(action==='reader-tab'){view.reader=value;updateSelection(button,value,'.parallel',termBlocks());}
  if(action==='video-tab'){view.group=value;updateSelection(button,value,'#video-grid',filteredVideos());}
  if(action==='research-tab'){view.research=value;render();main.querySelector('[data-value="'+value+'"]')?.focus();}
  if(action==='outline'){view.outline=value;render();main.querySelector('[data-value="'+value+'"]')?.focus();}
  if(action==='play') player(value);
  if(action==='term') selectTerm();
  if(action==='save-term'){
    const exists=state.terms.includes('Hetu-paccaya');
    state.terms=exists?state.terms.filter(t=>t!=='Hetu-paccaya'):[...state.terms,'Hetu-paccaya'];
    persist(exists?'Đã bỏ khỏi danh sách ôn.':'Đã lưu thuật ngữ.');
    dialog.close();
    render();
  }
  if(action==='complete'){state.complete=!state.complete;persist(state.complete?'Đã đánh dấu hoàn thành.':'Đã bỏ đánh dấu.');render();}
  if(action==='cite'){
    modal('Lưu trích dẫn',form('<label>Thuật ngữ<select name="term"><option value="0">Hetu-paccaya · Nhân duyên</option><option value="1">Ārammaṇa-paccaya · Cảnh duyên</option></select></label>','Lưu','cite-form'));
  }
  if(action==='attach'){
    modal('Gắn vào luận điểm',state.citations.length?form('<label>Trích dẫn<select name="citation">'+state.citations.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.text)+'</option>').join('')+'</select></label><label>Luận điểm<select name="outline">'+state.outline.map(o=>'<option value="'+esc(o.id)+'"'+(o.id===view.outline?' selected':'')+'>'+esc(o.title)+'</option>').join('')+'</select></label>','Gắn','attach-form'):'<p class="empty">Bạn cần lưu một trích dẫn từ màn hình Đọc bài.</p><a class="btn" href="#/doc" data-action="close">Đến bài đọc</a>');
  }
  if(action==='note') modal('Ghi chú bài học',form('<label>Nội dung<textarea name="note" rows="5" required maxlength="2000"></textarea></label>','Lưu ghi chú','note-form'));
  if(action==='add-outline') modal('Thêm mục dàn ý',form('<label>Tên mục<input name="title" required maxlength="100"></label><label>Mô tả<textarea name="detail" rows="3" maxlength="400"></textarea></label>','Thêm mục','outline-form'));
  if(action==='add-video') modal('Thêm video YouTube',form('<label>Đường dẫn YouTube<input name="url" required type="url" placeholder="https://www.youtube.com/watch?v=…"></label><label>Tiêu đề<input name="title" required maxlength="130"></label><label>Người giảng<input name="speaker" maxlength="100"></label><label>Nhóm<select name="group"><option value="chant">Nghe kinh điển</option><option value="talk">Nghe thuyết pháp</option></select></label><label>Chủ đề<input name="topic" required maxlength="60" placeholder="Ví dụ: Thiền quán"></label><label>Ngôn ngữ<select name="lang"><option>Tiếng Việt</option><option>Pāli</option><option>Tiếng Anh</option><option>Khác</option></select></label>','Thêm video','video-form'));
});
document.addEventListener('input', event=>{
  if(event.target.form?.id==='canon-filters' && event.target.name==='q') updateCanonFilters(event.target.form);
  if(event.target.form?.id==='commentary-filters' && event.target.name==='q') updateCommentaryFilters(event.target.form);
  if(event.target.id==='video-search'){view.query=event.target.value;document.querySelector('#video-grid').innerHTML=filteredVideos();}
  if(event.target.id==='draft'){state.draft=event.target.value;document.querySelector('#draft-status').textContent=save()?'Đã lưu trên trình duyệt.':'Chỉ lưu trong lượt xem này.';}
});
document.addEventListener('change',event=>{
  if(event.target.form?.id==='canon-filters' && event.target.tagName==='SELECT') updateCanonFilters(event.target.form);
  if(event.target.form?.id==='commentary-filters' && event.target.tagName==='SELECT') updateCommentaryFilters(event.target.form);
  if(event.target.id==='topic'){view.topic=event.target.value;document.querySelector('#video-grid').innerHTML=filteredVideos();}
});
document.addEventListener('submit',event=>{
  if(['commentary-filters','canon-filters'].includes(event.target.id)){event.preventDefault();return;}
  if(!dialog.contains(event.target)) return;
  event.preventDefault();
  const formElement=event.target;
  const data=new FormData(formElement);
  const field=name=>String(data.get(name)||'').trim();
  const error=message=>formElement.querySelector('.form-error').textContent=message;
  let message;
  if (formElement.id==='research-source-form' || formElement.id==='research-journal-form') {
    message=saveResearchForm(formElement,field,error);
    if(!message) return;
  } else if(formElement.id==='video-form'){
    const id=youtubeId(field('url'));
    if(!id){error('Hãy nhập đường dẫn video YouTube hợp lệ.');return;}
    if(state.videos.some(v=>v.id===id)){error('Video này đã có trong danh sách.');return;}
    if(!field('title')||!field('topic')){error('Hãy nhập tiêu đề và chủ đề.');return;}
    state.videos.push({id,title:field('title'),speaker:field('speaker'),topic:field('topic'),group:field('group'),lang:field('lang'),thumbnail:false});
    view.group='all';view.topic='all';view.query='';
    message='Đã thêm video.';
  } else if(formElement.id==='note-form'){
    if(!field('note')){error('Hãy nhập nội dung ghi chú.');return;}
    state.notes.push({course:route().course,text:field('note')});
    message='Đã lưu ghi chú.';
  } else if(formElement.id==='outline-form'){
    if(!field('title')){error('Hãy nhập tên mục.');return;}
    view.outline=newRecordId();
    state.outline.push({id:view.outline,title:field('title'),detail:field('detail')});
    message='Đã thêm mục dàn ý.';
  } else if(formElement.id==='cite-form'){
    const term=terms[Number(field('term'))];
    const id=term.pali;
    if(state.citations.some(c=>c.id===id)){error('Thuật ngữ này đã nằm trong Trích dẫn của đề tài.');return;}
    state.citations.push({id,text:term.pali+' · '+term.vi+' · '+term.en,outline:null});
    message='Đã lưu vào Trích dẫn của đề tài.';
  } else if(formElement.id==='attach-form'){
    const citation=state.citations.find(c=>c.id===field('citation'));
    if(!citation) return;
    citation.outline=field('outline');
    view.outline=citation.outline;
    message='Đã gắn trích dẫn vào luận điểm.';
  } else return;
  persist(message);
  dialog.close();
  render();
});
render();
