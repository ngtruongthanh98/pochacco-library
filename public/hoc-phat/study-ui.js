const readingHref = id => '#/doc?bai='+encodeURIComponent(id);
const projectHref = (id, tab = 'outline') => '#/de-tai?de-tai='+encodeURIComponent(id)+'&muc='+tab;
const readingById = id => state.readings.find(item => item.id === id) ||
  (Object.hasOwn(courses,id) ? {...courses[id], id, course:id, builtIn:true} : null);
const projectById = id => state.projects.find(item => item.id === id);
const activeProject = () => projectById(route().id);
const studyMatches = (query, ...parts) => normalize(parts.join(' ')).includes(normalize(query.trim()));
const studyEmpty = text => '<p class="empty">'+text+'</p>';
const studySource = (link, label) => {
  const url = externalLink(link);
  return url ? '<a class="text-button study-source" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+label+'</a>' : '';
};
const studyButton = (label, action, value, kind = 'secondary') =>
  '<button type="button" class="btn '+kind+'" data-action="study-'+action+'" data-value="'+esc(value)+'" aria-label="'+esc(label)+'">'+label+'</button>';
const studyOption = (value, text, selected) =>
  '<option value="'+esc(value)+'"'+(value === selected ? ' selected' : '')+'>'+esc(text)+'</option>';
const studySelect = (label, name, entries, selected) =>
  '<label>'+label+'<select name="'+name+'">'+entries.map(([value,text])=>studyOption(value,text,selected)).join('')+'</select></label>';
const studyChoices = values => values.map(value => [value,value]);
const studyUpdated = iso => iso && Number.isFinite(Date.parse(iso))
  ? '<span class="meta">'+new Date(iso).toLocaleDateString('vi-VN')+'</span>' : '';
const studyMenu = (label, id, actions) =>
  '<details class="study-menu"><summary aria-label="Tùy chọn '+esc(label)+'" title="Tùy chọn">⋯</summary>'+
  '<div class="study-menu-items">'+actions.map(([text, action])=>studyButton(text,action,id)).join('')+'</div></details>';

const studyView = {readSearch:'', readCourse:'all', projectSearch:'', archive:false};
let studyUndo = null;
let studyImport;

function studyHeader(title, action) {
  return '<div class="page-head head-split"><h1>'+title+'</h1><div class="buttons">'+action+
    studyButton('Sao lưu','backup')+'</div></div>';
}

function studyReadingCards() {
  const items = [...state.readings, ...Object.keys(courses).map(readingById)].filter(item =>
    (studyView.readCourse === 'all' || item.course === studyView.readCourse) &&
    studyMatches(studyView.readSearch,item.title,item.lead,item.text,studyCourses[item.course]));
  return items.map(item => '<article class="panel study-record"><div class="study-record-copy">'+
    '<p class="meta">'+esc(studyCourses[item.course])+(state.progress[item.id]?' · Đã học':'')+'</p>'+
    '<h2><a href="'+readingHref(item.id)+'">'+esc(item.title)+'</a></h2>'+
    '<p class="study-clamp">'+esc(item.lead || item.text || item.url)+'</p>'+studyUpdated(item.updated)+'</div>'+
    '<div class="study-record-actions"><a class="btn secondary" href="'+readingHref(item.id)+'">Đọc bài</a>'+
    (item.builtIn ? '' : studyMenu(item.title,item.id,[['Chỉnh sửa','edit-reading'],['Xóa','delete-reading']]))+
    '</div></article>').join('') || studyEmpty('Không có bài đọc phù hợp.');
}

function studyReadingPage(id) {
  const item = readingById(id);
  if (!item) {
    const last = readingById(state.lastReading);
    return studyHeader('Đọc bài',studyButton('Thêm bài đọc','edit-reading',null,'primary'))+
      (last ? '<p class="study-resume"><a class="btn secondary" href="'+readingHref(last.id)+'">Đọc tiếp</a> <span>'+esc(last.title)+'</span></p>' : '')+
      '<div class="filters"><input type="search" id="study-reading-search" aria-label="Tìm bài đọc" placeholder="Tìm bài đọc…" value="'+esc(studyView.readSearch)+'">'+
      '<select id="study-reading-course" aria-label="Lộ trình">'+studyOption('all','Mọi lộ trình',studyView.readCourse)+
      Object.entries(studyCourses).map(([key,label])=>studyOption(key,label,studyView.readCourse)).join('')+'</select></div>'+
      '<div id="study-reading-list" class="stack">'+studyReadingCards()+'</div>';
  }
  const notes = state.notes.filter(note => note.course === id);
  const glossary = item.builtIn && item.course !== 'thien';
  return '<div class="page-head"><a class="text-button" href="#/doc">← Danh sách bài đọc</a>'+
    '<p class="meta">'+esc(item.meta || studyCourses[item.course])+'</p><div class="head-split"><h1>'+esc(item.title)+'</h1>'+
    (item.builtIn ? '' : studyMenu(item.title,id,[['Chỉnh sửa','edit-reading'],['Xóa','delete-reading']]))+'</div>'+
    (item.lead?'<p>'+esc(item.lead)+'</p>':'')+'</div>'+
    '<div class="reader-grid"><article class="panel"><div class="article-section">'+
    (item.builtIn ? '<h2>'+(glossary?'Thuật ngữ đối chiếu':'Ghi chú thực hành')+'</h2><p class="meta">'+esc(item.note)+'</p>' :
      '<h2>Nội dung</h2>'+ (item.text?'<p class="reading-copy study-text" lang="vi">'+esc(item.text)+'</p>':'')+
      studySource(item.url,'Mở nguồn bài đọc'))+
    (glossary ? '<div class="reader-tabs" aria-label="Ngôn ngữ">'+tabs(readerTabs,view.reader,'reader-tab')+
      '</div><div class="parallel">'+termBlocks()+'</div><p class="meta">'+studySource(sourceURL,'Mở nguồn đối chiếu Pāli–Anh')+'</p>' : '')+
    '</div><div class="buttons article-actions">'+studyButton(state.progress[id]?'Đã học ✓':'Đánh dấu đã học','complete',id)+
    (glossary ? studyButton('Lưu trích dẫn','sample-quote',id) : studyButton('Lưu trích dẫn','edit-quote',id))+
    '</div></article><aside class="panel side-panel"><div class="head-split"><h2>Ghi chú</h2>'+
    studyButton('Thêm ghi chú','edit-note')+'</div>'+
    (glossary ? '<button class="text-button" data-action="term">Hetu-paccaya · Nhân duyên</button><p class="meta">'+state.terms.length+' thuật ngữ đã lưu</p>' : '')+
    (notes.length ? '<div class="stack">'+notes.map(note=>'<div class="study-note">'+
      '<p class="note study-text">'+esc(note.text)+'</p>'+studyMenu('ghi chú',note.id,[['Chỉnh sửa','edit-note'],['Xóa','delete-note']])+
      '</div>').join('')+'</div>' : studyEmpty('Chưa có ghi chú.'))+'</aside></div>';
}

function youtubeId(value) {
  const url = externalLink(value);
  if (!url) return '';
  const u = new URL(url);
  const [kind, id] = u.pathname.split('/').filter(Boolean);
  let key;
  if (u.hostname === 'youtu.be') key = kind;
  else if (['www.youtube.com','youtube.com','m.youtube.com','www.youtube-nocookie.com'].includes(u.hostname)) {
    key = kind === 'watch' ? u.searchParams.get('v') : ['embed','shorts','live'].includes(kind) ? id : '';
  }
  return youtubeKey.test(key || '') ? key : '';
}

function videoCard(video) {
  if (!youtubeKey.test(video.id)) return '';
  return '<article class="video-card panel"><button class="video-cover" type="button" data-action="study-play" data-value="'+esc(video.id)+
    '" aria-label="Phát '+esc(video.title)+'">'+
    (video.thumbnail!==false?'<img src="https://i.ytimg.com/vi/'+video.id+'/hqdefault.jpg" alt="" loading="lazy">':'')+
    '<span class="play-circle">'+icon('play')+'</span></button><div class="video-info"><div class="study-video-head">'+
    '<span class="status">'+esc(video.topic)+'</span>'+studyMenu(video.title,video.id,[['Chỉnh sửa','edit-video'],['Sao chép liên kết','copy-video'],['Xóa','delete-video']])+
    '</div><h2>'+esc(video.title)+'</h2><p class="meta">'+esc(studyGroups[video.group])+' · '+esc(video.lang)+'</p>'+
    (video.speaker?'<p class="meta">'+esc(video.speaker)+'</p>':'')+'</div></article>';
}

function filteredVideos() {
  const videos = state.videos.filter(v => (view.group === 'all' || v.group === view.group) &&
    (view.topic === 'all' || v.topic === view.topic) && studyMatches(view.query,v.title,v.topic,v.lang,v.speaker));
  return videos.length ? videos.map(videoCard).join('') :
    studyEmpty(state.videos.length ? 'Không có video phù hợp với bộ lọc.' : 'Chưa có video. Dán liên kết YouTube để bắt đầu.');
}

function videoPage() {
  const topics = [...new Set(state.videos.map(v => v.topic))];
  if (view.topic !== 'all' && !topics.includes(view.topic)) topics.push(view.topic);
  return studyHeader('Video',studyButton('Thêm video','edit-video',null,'primary'))+
    '<div class="tabs" aria-label="Nhóm video">'+tabs([{id:'all',label:'Tất cả'},...Object.entries(studyGroups).map(([id,label])=>({id,label}))],view.group,'video-tab')+
    '</div><div class="filters"><input id="video-search" type="search" placeholder="Tìm tiêu đề, người giảng…" aria-label="Tìm video" value="'+esc(view.query)+'">'+
    '<select id="topic" aria-label="Chủ đề">'+studyOption('all','Mọi chủ đề',view.topic)+topics.map(t=>studyOption(t,t,view.topic)).join('')+
    '</select>'+studyButton('Xóa bộ lọc','reset-videos')+'</div><div class="video-grid" id="video-grid">'+filteredVideos()+'</div>';
}

function player(id) {
  const video = state.videos.find(item => item.id === id);
  if (!video || !youtubeKey.test(id)) return;
  const url = 'https://www.youtube.com/watch?v='+id;
  modal(esc(video.title),'<iframe class="video-frame" title="'+esc(video.title)+'" src="https://www.youtube-nocookie.com/embed/'+id+
    '" allow="encrypted-media; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>'+
    studySource(url,'Mở trên YouTube'));
}

function studyProjectCards() {
  return state.projects.filter(p => Boolean(p.archived) === studyView.archive &&
    studyMatches(studyView.projectSearch,p.title,p.question,p.detail,p.status)).map(p =>
    '<article class="panel study-record"><div class="study-record-copy"><p class="meta">'+esc(p.status)+'</p>'+
    '<h2><a href="'+projectHref(p.id)+'">'+esc(p.title)+'</a></h2>'+
    '<p class="study-clamp">'+esc(p.question || p.detail)+'</p>'+studyUpdated(p.updated)+'</div><div class="study-record-actions">'+
    '<a class="btn secondary" href="'+projectHref(p.id)+'">Mở đề tài</a>'+
    studyMenu(p.title,p.id,[['Chỉnh sửa','edit-project'],[p.archived?'Khôi phục':'Lưu trữ',p.archived?'restore-project':'archive-project']])+
    '</div></article>').join('') || studyEmpty(studyView.archive?'Chưa có đề tài phù hợp trong kho lưu trữ.':'Chưa có đề tài phù hợp.');
}

function studyCitationCard(citation, project, showActions = true) {
  const outline = project.outline.find(o => o.id === citation.outline);
  return '<article class="source-item"><div class="head-split"><p class="study-text">'+esc(citation.text)+'</p>'+
    (showActions?studyMenu('trích dẫn',citation.id,[['Chỉnh sửa','edit-quote'],['Xóa','delete-quote']]):'')+
    '</div><p class="meta">'+esc([citation.sourceTitle,citation.location].filter(Boolean).join(' · '))+'</p>'+
    studySource(citation.url,'Mở nguồn')+(showActions?'<label class="study-citation-assignment">Luận điểm<select aria-label="Luận điểm cho trích dẫn" data-study-assign="'+esc(citation.id)+'">'+
    studyOption('','Chưa gắn',outline?.id || '')+project.outline.map(o=>studyOption(o.id,o.title,outline?.id)).join('')+'</select></label>':'')+'</article>';
}

function studyProjectOutline(project) {
  return '<div class="head-split"><h2>Dàn ý</h2>'+studyButton('Thêm mục','edit-outline')+'</div><div class="stack">'+
    (project.outline.map((item,index)=>'<article class="source-item"><div class="head-split"><div><h3>'+esc(item.title)+
      '</h3><p class="study-text">'+esc(item.detail)+'</p></div>'+
      studyMenu(item.title,item.id,[['Chỉnh sửa','edit-outline'],...(index>0?[['Chuyển lên','up-outline']]:[]),
        ...(index<project.outline.length-1?[['Chuyển xuống','down-outline']]:[]),['Xóa','delete-outline']])+'</div>'+
      '<p class="meta">'+project.citations.filter(c=>c.outline===item.id).length+' trích dẫn</p></article>').join('') ||
      studyEmpty('Chưa có mục dàn ý.'))+'</div>';
}

function studyProjectSources(project) {
  return '<div class="head-split"><h2>Nguồn</h2>'+studyButton('Thêm nguồn','edit-source')+'</div><div class="stack">'+
    (project.sources.map(source=>'<article class="source-item"><div class="head-split"><h3>'+esc(source.title)+'</h3>'+
      studyMenu(source.title,source.id,[['Chỉnh sửa','edit-source'],['Xóa','delete-source']])+'</div>'+
      '<p class="study-text">'+esc(source.detail)+'</p><p class="meta">'+esc(source.location)+'</p>'+
      studySource(source.url,'Mở nguồn')+'</article>').join('') || studyEmpty('Chưa có nguồn.'))+'</div>';
}

function studyProjectPage(id, tab) {
  const project = projectById(id);
  if (!project) return studyHeader('Đề tài',studyButton('Tạo đề tài','edit-project',null,'primary'))+
    '<div class="tabs" aria-label="Trạng thái lưu trữ">'+tabs([{id:'active',label:'Đang làm'},{id:'archive',label:'Lưu trữ'}],
      studyView.archive?'archive':'active','study-project-filter')+'</div><div class="filters">'+
    '<input type="search" id="study-project-search" aria-label="Tìm đề tài" placeholder="Tìm đề tài…" value="'+esc(studyView.projectSearch)+'"></div>'+
    '<div id="study-project-list" class="stack">'+studyProjectCards()+'</div>';
  const tabContent = {
    outline:()=>studyProjectOutline(project),
    sources:()=>studyProjectSources(project),
    citations:()=>'<div class="head-split"><h2>Trích dẫn</h2>'+studyButton('Thêm trích dẫn','edit-quote')+'</div><div class="stack">'+
      (project.citations.map(c=>studyCitationCard(c,project)).join('') || studyEmpty('Chưa có trích dẫn.'))+'</div>',
    draft:()=>'<h2><label for="study-draft">Bản thảo</label></h2><textarea id="study-draft" class="draft" maxlength="100000" placeholder="Viết đoạn đầu tiên…">'+
      esc(project.draft)+'</textarea><p class="meta" id="study-draft-status" aria-live="polite">Tự lưu trên trình duyệt</p>',
  };
  return '<div class="page-head"><a class="text-button" href="#/de-tai">← Danh sách đề tài</a>'+
    '<p class="meta">'+esc(project.status)+(project.archived?' · Đã lưu trữ':'')+'</p><div class="head-split"><h1>'+esc(project.title)+'</h1>'+
    studyMenu(project.title,id,[['Chỉnh sửa','edit-project'],[project.archived?'Khôi phục':'Lưu trữ',project.archived?'restore-project':'archive-project']])+
    '</div><p>'+esc(project.detail)+'</p></div><div class="research-grid"><section class="panel study-work-panel">'+
    '<nav class="tabs" aria-label="Các phần của đề tài">'+researchTabs.map(t=>'<a class="tab" href="'+projectHref(id,t.id)+'"'+
     (t.id===tab?' aria-current="page"':'')+'>'+t.label+'</a>').join('')+'</nav>'+tabContent[tab]()+'</section>'+
    '<aside class="panel side-panel"><h2>Câu hỏi nghiên cứu</h2><p class="study-text">'+esc(project.question||'Chưa có câu hỏi nghiên cứu.')+
    '</p><h3>Tư liệu</h3><p class="meta">'+project.sources.length+' nguồn · '+project.citations.length+
    ' trích dẫn</p><a class="text-button" href="'+projectHref(id,'sources')+'">Xem nguồn</a>'+
    '<a class="text-button" href="'+projectHref(id,'citations')+'">Xem trích dẫn</a></aside></div>';
}

function studyForm(title, kind, item, fields, context = '') {
  const record = '<input type="hidden" name="record-id" value="'+esc(item.id)+'">'+context;
  modal(title,'<form class="form study-form" id="study-'+kind+'-form">'+record+fields+
    '<div class="form-error" role="alert"></div><div class="buttons study-form-actions">'+
    '<button class="btn" type="submit">Lưu</button>'+btn('Hủy','close')+'</div></form>');
}

function studyEditVideo(id) {
  const item = state.videos.find(v => v.id === id) || {};
  const url = item.id ? 'https://www.youtube.com/watch?v='+item.id : '';
  const topics = [...new Set(state.videos.map(v => v.topic))];
  studyForm(item.id?'Chỉnh sửa video':'Thêm video YouTube','video',item,
    formField('Đường dẫn YouTube','url',url,{required:true,type:'url',max:2000})+
    '<div id="study-video-preview" class="study-video-preview" aria-live="polite"></div>'+
    formField('Tiêu đề','title',item.title,{required:true})+
    formField('Người giảng','speaker',item.speaker,{max:100})+
    studySelect('Nhóm','group',Object.entries(studyGroups),item.group || (view.group==='all'?'talk':view.group))+
    '<label>Chủ đề<input name="topic" required maxlength="80" list="study-video-topics" value="'+esc(item.topic || (view.topic==='all'?'':view.topic))+'"></label>'+
    '<datalist id="study-video-topics">'+topics.map(topic=>studyOption(topic,topic)).join('')+'</datalist>'+
    studySelect('Ngôn ngữ','lang',studyChoices(studyLanguages),item.lang || 'Tiếng Việt'));
  updateStudyVideoPreview(dialog.querySelector('form'));
}

function updateStudyVideoPreview(formElement) {
  const id = youtubeId(formElement.elements.url.value.trim());
  const target = formElement.querySelector('#study-video-preview');
  const duplicate = state.videos.find(v=>v.id === id && v.id !== formElement.elements['record-id'].value);
  target.innerHTML = !id ? '' : duplicate ?
    '<p>Video đã có trong kho.</p>'+studyButton('Mở video đã lưu','play',id) :
    '<img src="https://i.ytimg.com/vi/'+id+'/hqdefault.jpg" alt="" loading="lazy"><span>Xem trước ảnh bìa</span>';
}

function studyEditReading(id) {
  const item = state.readings.find(r => r.id === id) || {};
  studyForm(item.id?'Chỉnh sửa bài đọc':'Thêm bài đọc','reading',item,
    formField('Tiêu đề','title',item.title,{required:true})+
    studySelect('Lộ trình','course',Object.entries(studyCourses),item.course || (studyView.readCourse==='all'?'other':studyView.readCourse))+
    formField('Đường dẫn nguồn','url',item.url,{type:'url',max:2000})+
    formField('Nội dung bài đọc','text',item.text,{textarea:true,max:18000}));
}

function studyEditProject(id) {
  const item = projectById(id) || {};
  studyForm(item.id?'Chỉnh sửa đề tài':'Tạo đề tài','project',item,
    formField('Tên đề tài','title',item.title,{required:true})+
    formField('Mô tả','detail',item.detail,{textarea:true,max:2000})+
    formField('Câu hỏi nghiên cứu','question',item.question,{textarea:true,max:2000})+
    studySelect('Trạng thái','status',studyChoices(studyStatuses),item.status || studyStatuses[0]));
}

function studyQuoteForm(item = {}, {project = activeProject(), choices = false} = {}) {
  const projects = project ? [project] : state.projects.filter(p=>!p.archived);
  if (!projects.length) {
    modal('Lưu trích dẫn',studyEmpty('Hãy tạo một đề tài để lưu trích dẫn.')+
      '<a class="btn" data-action="close" href="#/de-tai">Đến danh sách đề tài</a>');
    return;
  }
  const fields = (choices ? studySelect('Thuật ngữ','term',terms.map((term,index)=>[index,term.pali+' · '+term.vi]),'0') :
    formField('Nội dung trích dẫn','text',item.text,{required:true,textarea:true,max:5000}))+
    formField('Tên nguồn hoặc bản dịch','sourceTitle',item.sourceTitle,{max:240})+
    formField('Vị trí đoạn, số trang hoặc mốc thời gian','location',item.location,{max:240})+
    formField('Đường dẫn nguồn','url',item.url,{type:'url',max:2000})+
    studySelect('Đề tài','project',projects.map(p=>[p.id,p.title]),project?.id)+
    (project ? studySelect('Luận điểm','outline',[['','Chưa gắn'],...project.outline.map(o=>[o.id,o.title])],item.outline || '') : '');
  studyForm(item.id?'Chỉnh sửa trích dẫn':'Lưu trích dẫn','quote',item,fields);
}

function quoteFromReading(id, sample = false) {
  const item = readingById(id);
  if (!item) return;
  const selected = window.getSelection();
  const article = document.querySelector('.reader-grid article');
  const text = selected && article?.contains(selected.anchorNode) && article.contains(selected.focusNode)
    ? selected.toString().trim().slice(0,5000) : '';
  studyQuoteForm({text,sourceTitle:item.title,url:sample?sourceURL:item.url},{choices:sample && !text});
}

function studyEditNote(id) {
  const reading = readingById(route().id);
  if (!reading) return;
  const item = state.notes.find(n=>n.id===id && n.course===reading.id) || {};
  studyForm(item.id?'Chỉnh sửa ghi chú':'Thêm ghi chú','note',item,
    formField('Nội dung ghi chú','text',item.text,{required:true,textarea:true,max:3000}),
    '<input type="hidden" name="course" value="'+esc(reading.id)+'">');
}

function studyEditProjectItem(kind, id) {
  const project = activeProject();
  if (!project) return;
  if (kind === 'quote') {
    studyQuoteForm(project.citations.find(item=>item.id===id),{project});
    return;
  }
  const isSource = kind==='source';
  const item = (isSource?project.sources:project.outline).find(row=>row.id===id) || {};
  const heading = (item.id?'Chỉnh sửa ':'Thêm ')+(isSource?'nguồn':'mục dàn ý');
  studyForm(heading,kind,item,formField(isSource?'Tên tài liệu':'Tên luận điểm','title',item.title,{required:true})+
    formField(isSource?'Tác giả, dịch giả, ấn bản hoặc ghi chú':'Mô tả','detail',item.detail,{textarea:true,max:2000})+
    (isSource?formField('Mã văn bản hoặc số trang','location',item.location,{max:240})+
      formField('Đường dẫn','url',item.url,{type:'url',max:2000}):''),
    '<input type="hidden" name="project" value="'+esc(project.id)+'">');
}

function studySaved(message) {
  if (!save()) {
    studyUndo = null;
    notify('Đã cập nhật trong lượt xem này. Trình duyệt chưa lưu được dữ liệu.');
    return false;
  }
  notify(message);
  return true;
}

function studyRemove(items, id, message, cleanup = () => () => {}) {
  const position = items.findIndex(item=>item.id===id);
  if (position < 0) return;
  const [item] = items.splice(position,1);
  const undoRelated = cleanup();
  studyUndo = () => {
    if (items.some(existing=>existing.id === id)) return false;
    items.splice(Math.min(position,items.length),0,item);
    undoRelated();
    return true;
  };
  if (studySaved(message)) {
    const undo = readerElement('button','btn light','Hoàn tác');
    undo.type = 'button';
    undo.dataset.action = 'study-undo';
    toast.append(' ',undo);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.classList.remove('visible');studyUndo = null; },10000);
  }
  render();
}

function studyDeleteReading(id) {
  const item = state.readings.find(reading=>reading.id===id);
  if (!item) return;
  const hasNotes = state.notes.some(note=>note.course===id);
  modal('Xóa bài đọc', '<p>'+esc(item.title)+(hasNotes?' và ghi chú của bài sẽ bị xóa.':' sẽ bị xóa.')+
    '</p><div class="buttons study-form-actions">'+studyButton('Xóa bài đọc','confirm-delete-reading',id,'primary')+
    btn('Hủy','close')+'</div>');
}

function studyRemoveReading(id) {
  const inReading = route().id === id;
  dialog.close();
  studyRemove(state.readings,id,'Đã xóa bài đọc.',()=>{
    const notes = state.notes.filter(note=>note.course===id);
    for (let i=state.notes.length-1;i>=0;i--) if (state.notes[i].course===id) state.notes.splice(i,1);
    const progress = state.progress[id];
    delete state.progress[id];
    const wasLast = state.lastReading === id;
    if (wasLast) state.lastReading = 'tam-tang';
    return () => {
      state.notes.push(...notes);
      if (progress !== undefined) state.progress[id] = progress;
      if (wasLast && state.lastReading === 'tam-tang') state.lastReading = id;
    };
  });
  if (inReading) location.hash = '#/doc';
}

function studyMoveOutline(project, id, step) {
  const index = project.outline.findIndex(item=>item.id===id);
  if (index < 0 || !project.outline[index+step]) return;
  [project.outline[index],project.outline[index+step]] = [project.outline[index+step],project.outline[index]];
  project.updated = studyTime();
  studySaved('Đã đổi thứ tự dàn ý.');
  render();
}

async function studyCopyVideo(id) {
  if (!youtubeKey.test(id)) return;
  const url = 'https://www.youtube.com/watch?v='+id;
  try {
    await navigator.clipboard.writeText(url);
    notify('Đã sao chép liên kết.');
  } catch {
    modal('Liên kết YouTube',formField('Sao chép đường dẫn','url',url));
    dialog.querySelector('input').select();
  }
}

function studyBackupDialog() {
  studyImport = undefined;
  modal('Sao lưu Học Phật','<div class="stack study-backup">'+
    '<p class="meta">Bản sao gồm bài đọc, ghi chú, video, đề tài và tiến độ trên trình duyệt này.</p>'+
    '<div>'+studyButton('Xuất bản sao JSON','export')+'</div>'+
    '<label>Nhập bản sao<input type="file" id="study-import" accept=".json,application/json"></label>'+
    '<div id="study-import-preview" aria-live="polite"></div></div>');
}

function studyExportBackup() {
  const blob = new Blob([makeStudyBackup()],{type:'application/json'});
  const url = URL.createObjectURL(blob);
  const link = readerElement('a');
  link.href = url;
  link.download = 'pochacco-hoc-phat-'+todayLocal()+'.json';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

async function studyPreviewBackup(input) {
  const file = input.files[0];
  const preview = dialog.querySelector('#study-import-preview');
  if (!file || !preview) return;
  studyImport = undefined;
  preview.textContent = 'Đang kiểm tra bản sao…';
  try {
    if (file.size > studyBackupLimit) throw new Error('Tệp vượt quá 8 MB.');
    const data = parseStudyBackup(await file.text());
    if (!preview.isConnected || input.files[0] !== file || !dialog.open) return;
    studyImport = data;
    const {counts} = mergeStudyBackup(data);
    const summary = counts.readings+' bài đọc, '+counts.notes+' ghi chú, '+counts.videos+' video, '+counts.projects+' đề tài.';
    const total = data.readings.length+' bài đọc, '+data.notes.length+' ghi chú, '+data.videos.length+' video, '+data.projects.length+' đề tài.';
    preview.innerHTML = '<p>Bản sao có '+total+'</p><p>Nhập thêm được '+summary+'</p><div class="buttons study-form-actions">'+
      studyButton('Nhập thêm','import-add',null,'primary')+studyButton('Khôi phục từ tệp','import-restore')+'</div>';
  } catch (error) {
    if (preview.isConnected && input.files[0] === file) preview.textContent = error instanceof SyntaxError ? 'Tệp JSON không đọc được.' : error.message;
  }
}

function studyImportBackup(replace) {
  if (!studyImport) return;
  if (replace) {
    modal('Khôi phục từ bản sao','<p>Bài đọc, ghi chú, video, đề tài và tiến độ hiện tại sẽ được thay bằng dữ liệu trong tệp.</p>'+
      '<div class="buttons study-form-actions">'+studyButton('Sao lưu dữ liệu hiện tại','export')+
      studyButton('Xác nhận khôi phục','confirm-restore',null,'primary')+studyButton('Quay lại','backup')+'</div>');
    return;
  }
  applyStudyBackup(mergeStudyBackup(studyImport).merged);
}

function applyStudyBackup(data) {
  if (!data) return;
  const previous = state;
  state = {...state,...data};
  if (!save()) {
    state = previous;
    notify('Chưa nhập được bản sao vì trình duyệt không lưu được dữ liệu.');
    return;
  }
  studyUndo = null;
  studyImport = undefined;
  dialog.close();
  notify('Đã nhập bản sao Học Phật.');
  render();
}

function studyClick(action, value, button) {
  const project = activeProject();
  switch (action) {
    case 'edit-video': studyEditVideo(value); break;
    case 'play': player(value); break;
    case 'copy-video': studyCopyVideo(value); break;
    case 'delete-video': studyRemove(state.videos,value,'Đã xóa video.'); break;
    case 'reset-videos':
      Object.assign(view,{group:'all',topic:'all',query:''});
      render();
      document.querySelector('#video-search')?.focus();
      break;
    case 'edit-reading': studyEditReading(value); break;
    case 'delete-reading': studyDeleteReading(value); break;
    case 'confirm-delete-reading': studyRemoveReading(value); break;
    case 'edit-note': studyEditNote(value); break;
    case 'delete-note': studyRemove(state.notes,value,'Đã xóa ghi chú.'); break;
    case 'complete':
      if (!readingById(value)) break;
      state.progress[value] = !state.progress[value];
      button.textContent = state.progress[value]?'Đã học ✓':'Đánh dấu đã học';
      studySaved(state.progress[value]?'Đã đánh dấu đã học.':'Đã cập nhật tiến độ.');
      break;
    case 'edit-project': studyEditProject(value); break;
    case 'project-filter':
      studyView.archive = value === 'archive';
      updateSelection(button,value,'#study-project-list',studyProjectCards());
      break;
    case 'archive-project':
    case 'restore-project': {
      const item = projectById(value);
      if (!item) break;
      item.archived = action === 'archive-project';
      item.updated = studyTime();
      studySaved(item.archived?'Đã đưa đề tài vào Lưu trữ.':'Đã khôi phục đề tài.');
      studyView.archive = item.archived;
      if (project) location.hash = '#/de-tai';
      else render();
      break;
    }
    case 'edit-outline': studyEditProjectItem('outline',value); break;
    case 'edit-source': studyEditProjectItem('source',value); break;
    case 'edit-quote':
      if (project) studyEditProjectItem('quote',value);
      else quoteFromReading(value);
      break;
    case 'sample-quote': quoteFromReading(value,true); break;
    case 'canon-quote': {
      const target = document.querySelector('#canon-body');
      const [key, root, translation] = target?.reading?.segments[Number(value)] || [];
      if (!target?.reading || key === undefined) break;
      const {mode, credit, sourceUrl} = target.reading;
      const id = route().query?.get('vb');
      const text = mode === 'vi' ? translation : mode === 'parallel' && translation ? root+'\n'+translation : root;
      studyQuoteForm({text:text.normalize('NFC').slice(0,5000),
        sourceTitle:(id+' · '+credit).slice(0,240),location:key || 'Đoạn '+(Number(value)+1),url:sourceUrl});
      break;
    }
    case 'up-outline':
    case 'down-outline':
      if (project) studyMoveOutline(project,value,action==='up-outline'?-1:1);
      break;
    case 'delete-outline':
      if (project) studyRemove(project.outline,value,'Đã xóa mục. Trích dẫn đã chuyển về Chưa gắn.',()=>{
        const affected = project.citations.filter(c=>c.outline===value);
        for (const c of affected) c.outline = null;
        return () => { for (const c of affected) if (!c.outline) c.outline = value; };
      });
      break;
    case 'delete-source':
      if (project) studyRemove(project.sources,value,'Đã xóa nguồn.');
      break;
    case 'delete-quote':
      if (project) studyRemove(project.citations,value,'Đã xóa trích dẫn.');
      break;
    case 'undo': {
      const restored = studyUndo?.();
      studyUndo = null;
      if (restored) {
        studySaved('Đã hoàn tác.');
        render();
      }
      break;
    }
    case 'backup': studyBackupDialog(); break;
    case 'export': studyExportBackup(); break;
    case 'import-add': studyImportBackup(false); break;
    case 'import-restore': studyImportBackup(true); break;
    case 'confirm-restore': applyStudyBackup(studyImport); break;
  }
}

function studyInput(target) {
  if (target.id === 'study-reading-search') {
    studyView.readSearch = target.value;
    document.querySelector('#study-reading-list').innerHTML = studyReadingCards();
  } else if (target.id === 'study-project-search') {
    studyView.projectSearch = target.value;
    document.querySelector('#study-project-list').innerHTML = studyProjectCards();
  } else if (target.id === 'study-draft') {
    const project = activeProject();
    if (!project) return;
    project.draft = target.value;
    project.updated = studyTime();
    document.querySelector('#study-draft-status').textContent = save()?'Đã lưu trên trình duyệt.':'Trình duyệt chưa lưu được bản thảo.';
  } else if (target.form?.id === 'study-video-form' && target.name === 'url') {
    updateStudyVideoPreview(target.form);
  }
}

function studyChange(target) {
  if (target.id === 'study-reading-course') {
    studyView.readCourse = target.value;
    document.querySelector('#study-reading-list').innerHTML = studyReadingCards();
  } else if (target.id === 'study-import') {
    studyPreviewBackup(target);
  } else if (target.hasAttribute('data-study-assign')) {
    const project = activeProject();
    const citation = project?.citations.find(item=>item.id===target.dataset.studyAssign);
    if (!citation || (target.value && !project.outline.some(o=>o.id===target.value))) return;
    citation.outline = target.value || null;
    project.updated = studyTime();
    studySaved(citation.outline?'Đã gắn trích dẫn.':'Đã gỡ khỏi luận điểm.');
  }
}

function studySubmit(formElement, field, error) {
  const kind = formElement.id.slice(6,-5);
  const id = field('record-id');
  const title = field('title');
  const rawUrl = field('url');
  const url = externalLink(rawUrl);
  const project = projectById(field('project'));
  if (rawUrl && !url) return error('Hãy nhập đường dẫn HTTP hoặc HTTPS hợp lệ.');
  let items;
  let record;
  let next;
  let message;
  switch (kind) {
    case 'video': {
      const key = youtubeId(rawUrl);
      if (!key) return error('Hãy nhập đường dẫn video YouTube hợp lệ.');
      if (state.videos.some(v=>v.id===key && v.id!==id)) return error('Video này đã có trong danh sách.');
      if (!title || !field('topic')) return error('Hãy nhập tiêu đề và chủ đề.');
      record = {id:key,title,speaker:field('speaker'),topic:field('topic'),group:field('group'),
        lang:field('lang'),thumbnail:true,updated:studyTime()};
      items = state.videos;
      message = id?'Đã sửa video.':'Đã thêm video.';
      break;
    }
    case 'reading':
      if (!title || (!field('text') && !url)) return error('Nhập tiêu đề cùng nội dung hoặc đường dẫn nguồn.');
      record = {id:id||newRecordId(),title,course:field('course'),text:field('text'),url,updated:studyTime()};
      items = state.readings;
      message = id?'Đã sửa bài đọc.':'Đã thêm bài đọc.';
      if (!id) next = readingHref(record.id);
      break;
    case 'note':
      if (!field('text')) return error('Hãy nhập nội dung ghi chú.');
      if (field('course') !== route().id || !readingById(field('course'))) return error('Hãy mở lại bài đọc.');
      record = {id:id||newRecordId(),course:field('course'),text:field('text'),updated:studyTime()};
      items = state.notes;
      message = 'Đã lưu ghi chú.';
      break;
    case 'project': {
      if (!title) return error('Hãy nhập tên đề tài.');
      record = {...(projectById(id)||{id:newRecordId(),outline:[],sources:[],citations:[],draft:''}),
        title,detail:field('detail'),question:field('question'),status:field('status'),updated:studyTime()};
      items = state.projects;
      message = id?'Đã sửa đề tài.':'Đã tạo đề tài.';
      if (!id) next = projectHref(record.id);
      break;
    }
    case 'outline':
    case 'source':
      if (!project || !title) return error('Hãy nhập tiêu đề trong một đề tài đang mở.');
      record = {id:id||newRecordId(),title,detail:field('detail')};
      if (kind==='source') Object.assign(record,{url,location:field('location')});
      items = kind==='source'?project.sources:project.outline;
      message = kind==='source'?'Đã lưu nguồn.':'Đã lưu mục dàn ý.';
      break;
    case 'quote': {
      if (!project) return error('Hãy chọn một đề tài.');
      const term = field('term') ? terms[Number(field('term'))] : null;
      const text = term ? [term.pali,term.vi,term.en].join(' · ') : field('text');
      if (!text) return error('Hãy nhập nội dung trích dẫn.');
      record = {id:id||newRecordId(),text,sourceTitle:field('sourceTitle'),location:field('location'),url,
        outline:project.outline.some(item=>item.id===field('outline')) ? field('outline') : null};
      items = project.citations;
      message = 'Đã lưu trích dẫn vào «'+project.title+'».';
      break;
    }
    default: return;
  }

  const position = id ? items.findIndex(item=>item.id===id) : -1;
  if (id && position < 0) return error('Không tìm thấy mục cần sửa.');
  if (position < 0) items.unshift(record);
  else items[position] = record;
  if (project) project.updated = studyTime();

  studySaved(message);
  dialog.close();
  if (next) location.hash = next;
  else if (kind !== 'quote' || activeProject()) {
    const previousScroll = window.scrollY;
    render();
    if (kind === 'video') window.scrollTo(0,previousScroll);
  }
}
