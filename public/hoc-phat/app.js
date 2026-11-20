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
let state = loadStudyState(seed);
function save() {
  try { localStorage.setItem(studyStorageKey,JSON.stringify(state)); return true; }
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
const view = {reader:'compare', group:'all', topic:'all', query:''};
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
  const params = new URLSearchParams(query);
  if (p === '#/doc') return {path:p,id:params.get('bai') || params.get('lo-trinh')};
  if (p === '#/de-tai') {
    const tab = params.get('muc');
    return {path:p,id:params.get('de-tai'),studyTab:researchTabs.some(item=>item.id===tab)?tab:'outline'};
  }
  return {path:p};
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
  const last = studyResumeReading();
  const done = Boolean(last && state.progress[last.id]);
  const resume = last ? readingHref(last.id) : '#/doc';
  const sampleVisible = !sampleReadingHidden('tam-tang');
  return '<div class="page-head"><h1>Hôm nay</h1><p>Đọc tiếp một bài, nghe giảng hoặc quay lại đề tài đang viết.</p></div>'+
    '<div class="intro-grid"><section class="hero"><div class="hero-copy">'+(sampleVisible?'<div class="kicker">LUẬN TẠNG · VI DIỆU PHÁP</div><h2>Bộ Vị Trí<br>và 24 duyên</h2><p>Đọc đối chiếu Pāli, tiếng Việt và tiếng Anh.</p>':'<h2>Bài đọc</h2>')+'<a class="btn light" href="'+resume+'">'+icon('book')+(last?(done?'Đọc lại bài':'Tiếp tục đọc'):'Xem bài đọc')+'</a></div>'+art()+'</section>'+
    '<section class="card queue"><h2>Đang học</h2>'+(last?'<div class="meta">'+(done?'Đã hoàn thành bài gần nhất':'Đang đọc bài gần nhất')+'</div><div class="progress" role="progressbar" aria-label="Tiến độ bài gần nhất" aria-valuenow="'+Number(done)+'" aria-valuemax="1"><span style="width:'+(done?100:0)+'%"></span></div><a href="'+resume+'">'+icon('book')+'<span><strong>'+esc(last.title)+'</strong><small>'+ (done?'Đã học':'Bài đọc đang mở')+'</small></span></a>':'')+'<a href="#/doc">'+icon('mark')+'<span><strong>Từ vựng đã lưu</strong><small>'+state.terms.length+' thuật ngữ</small></span></a></section></div>'+
    '<section><div class="section-head"><h2>Lộ trình học</h2><img class="section-sticker" src="../assets/sticker-divider.webp" width="244" height="75" alt=""></div><div class="path-grid">'+paths.map(p=>'<a class="card path" href="'+(p.href || (sampleReadingHidden(p.course)?'#/doc':readingHref(p.course)))+'"><span class="icon-tile">'+icon(p.icon)+'</span><h3>'+p.title+'</h3><p>'+p.desc+'</p></a>').join('')+'</div></section>'+
    researchCardList()+
    '<section><div class="section-head"><h2>Video và đề tài</h2></div><div class="lower-grid"><a class="card row-link" href="#/video"><span class="icon-tile">'+icon('video')+'</span><div><h3>Kho video</h3><p>Nghe kinh điển và thuyết pháp</p></div></a><a class="card row-link" href="#/de-tai"><span class="icon-tile">'+icon('file')+'</span><div><h3>Đề tài nghiên cứu</h3><p>Mở dàn ý, nguồn và bản thảo</p></div></a></div></section>';
}
function termBlocks() {
  return terms.map(t => {
    const options = {pali:['Pāli',t.pali],vi:['Tiếng Việt',t.vi],en:['English',t.en]};
    const fields = view.reader === 'compare' ? [options.pali,options.vi,options.en] : [options[view.reader]];
    return '<div class="passage">'+fields.map(([label,value])=>'<div class="kicker">'+label+'</div><p>'+value+'</p>').join('')+'</div>';
  }).join('');
}
function render({focus=false}={}) {
  cancelCanonReading();
  const current = route();
  const {path,id,studyTab,area,section} = current;
  if (path === '#/doc' && readingById(id) && !sampleReadingHidden(id) && state.lastReading !== id) {
    state.lastReading = id;
    save();
  }
  document.querySelector('#section-nav').innerHTML = nav.map(n =>
    '<a class="nav-link tab" href="'+n.hash+'"'+(path===n.hash?' aria-current="page"':'')+'>'+icon(n.icon)+'<span>'+n.label+'</span></a>'
  ).join('');
  document.title = (current.catalog ? 'Thư mục Theravāda' : section?.title || area?.title || nav.find(n=>n.hash===path).label)+' · Học Phật | Pochacco Library';
  pageContent.innerHTML = path==='#/doc'?studyReadingPage(id):path==='#/video'?videoPage():path==='#/de-tai'?studyProjectPage(id,studyTab):current.catalog?commentaryPage(current):path===researchBase?workspaceResearch(current):home();
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
window.addEventListener('storage',event=>{
  if (event.key !== studyStorageKey || !event.newValue) return;
  state = loadStudyState(seed);
  if (!state.hiddenSampleReadings.length) studyView.hiddenReadings = false;
  studyUndo = null;
  if (document.activeElement?.id === 'study-draft') {
    const project = activeProject();
    const status = document.querySelector('#study-draft-status');
    if (project) document.activeElement.value = project.draft;
    status.textContent = 'Dữ liệu đã cập nhật từ một thẻ khác.';
    return;
  }
  render();
});
window.addEventListener('hashchange',()=>{
  if (dialog.open) dialog.close();
  render({focus:true});
});
document.addEventListener('keydown',event=>{
  if (event.key !== 'Escape' || dialog.open) return;
  const menu = document.querySelector('.study-menu[open]');
  if (!menu) return;
  menu.open = false;
  menu.querySelector('summary').focus();
});
document.addEventListener('click', event => {
  for (const menu of document.querySelectorAll('.study-menu[open]')) {
    if (!menu.contains(event.target)) menu.open = false;
  }
  const button = event.target.closest('[data-action]');
  if(!button) return;
  const {action,value} = button.dataset;
  if (action === 'close') dialog.close();
  if (action.startsWith('study-')) {
    const menu = button.closest('details.study-menu');
    if (menu) {
      menu.open = false;
      menu.querySelector('summary').focus();
    }
    studyClick(action.slice(6),value,button);
    return;
  }
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
  if(action==='term') selectTerm();
  if(action==='save-term'){
    const exists=state.terms.includes('Hetu-paccaya');
    state.terms=exists?state.terms.filter(t=>t!=='Hetu-paccaya'):[...state.terms,'Hetu-paccaya'];
    persist(exists?'Đã bỏ khỏi danh sách ôn.':'Đã lưu thuật ngữ.');
    dialog.close();
    render();
  }
});
document.addEventListener('input', event=>{
  if(event.target.form?.id==='canon-filters' && event.target.name==='q') updateCanonFilters(event.target.form);
  if(event.target.form?.id==='commentary-filters' && event.target.name==='q') updateCommentaryFilters(event.target.form);
  if(event.target.id==='video-search'){view.query=event.target.value;document.querySelector('#video-grid').innerHTML=filteredVideos();}
  studyInput(event.target);
});
document.addEventListener('change',event=>{
  if(event.target.form?.id==='canon-filters' && event.target.tagName==='SELECT') updateCanonFilters(event.target.form);
  if(event.target.form?.id==='commentary-filters' && event.target.tagName==='SELECT') updateCommentaryFilters(event.target.form);
  if(event.target.id==='topic'){view.topic=event.target.value;document.querySelector('#video-grid').innerHTML=filteredVideos();}
  studyChange(event.target);
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
  } else {
    studySubmit(formElement,field,error);
    return;
  }
  persist(message);
  dialog.close();
  render();
});
render();
