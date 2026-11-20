'use strict';

const researchBase = '#/nghien-cuu';
const sourceTypes = ['Văn bản gốc / bản dịch','Chú giải / luận giải','Phụ chú giải · Ṭīkā','Nissaya · Đối dịch Pāli–Miến','Thư mục / khảo cứu','Hướng dẫn thực hành','Bài giảng / video'];
const externalLink = (url) => {
  try {
    const result = new URL(url);
    return ['https:', 'http:'].includes(result.protocol) && !result.username && !result.password ? result.href : '';
  } catch {
    return '';
  }
};
const areaById = id => researchAreas.find(area => area.id === id);
const chapterById = (area, id) => area.chapters.find(ch => ch.id === id);
function researchHref(area, section, tab) {
  return researchBase + (area ? '/' + area.id : '') +
    (section ? '/' + section.id : '') + (tab && (tab !== 'muc-luc' || canonSection(area,section)) ? '?tab=' + tab : '');
}
function researchRoute(path, query) {
  const parts = path.split('/').slice(2);
  const area = areaById(parts[0]);
  const section = area ? chapterById(area, parts[1]) : undefined;
  const params = new URLSearchParams(query);
  const tabKey = params.get('tab');
  const groupKey = params.get('nhom');
  const group = groupKey === 'tam-tang' ? 'Tam tạng' : groupKey === 'thien' ? 'Thiền' : '';
  const tab = area && researchTabsByArea(area,section).some(item => item.id === tabKey) ? tabKey : canonSection(area,section) ? 'van-ban' : 'muc-luc';
  return {area,section,tab,group,query:params};
}
function researchLanding(group) {
  const groups = group ? [group] : ['Tam tạng','Thiền'];
  return '<div class="page-head head-split"><div><h1>Nghiên cứu Phật giáo Nam tông</h1><p>Mở mảng đang làm để tra mục lục, lưu tư liệu và ghi chép theo từng chủ đề.</p></div>'+
    '<a class="btn secondary" href="'+commentaryBase+'">'+icon('book')+'Thư mục Theravāda</a></div>' +
    (group ? '<a class="text-button" href="'+researchBase+'">Xem cả năm mảng</a>' : '')+
    groups.map(group => '<section class="area-group"><div class="section-head"><h2>'+group+'</h2></div><div class="area-grid">'+
      researchAreas.filter(area => area.group === group).map(area =>
        '<a class="card area-card" href="'+researchHref(area)+'"><span class="icon-tile">'+icon(area.icon)+'</span><div><h3>'+area.title+'</h3><p class="kicker">'+area.pali+'</p><p class="meta">'+area.desc+'</p></div></a>'
      ).join('')+'</div></section>').join('');
}
function researchCardList() {
  return '<section><div class="section-head"><h2>Mảng nghiên cứu</h2><a href="'+researchBase+'">Xem các mảng</a></div><div class="area-grid home-areas">'+
    researchAreas.map(area => '<a class="card area-card" href="'+researchHref(area)+'"><span class="icon-tile">'+icon(area.icon)+'</span><div><h3>'+area.title+'</h3><p class="kicker">'+area.pali+'</p></div></a>').join('')+'</div></section>';
}
function scopedResearchItems(items, area, section) {
  return items.filter(item => item.area === area.id && (!section || item.section === section.id));
}
function referenceCard(item, area) {
  const userAdded = !!item.id;
  const url = externalLink(item.url);
  const category = userAdded ? chapterById(area,item.section)?.title : '';
  return '<article class="source-item research-record"><div><span class="status">'+esc(item.kind)+'</span>' +
    (category ? '<span class="meta"> · '+esc(category)+'</span>' : '')+
    '<h3>'+esc(item.title)+'</h3><p class="meta">'+esc(item.detail)+'</p>'+
    (item.location ? '<p class="meta">Vị trí · '+esc(item.location)+'</p>' : '')+
    (item.note ? '<p class="note">'+esc(item.note)+'</p>' : '')+
    (url ? '<a class="text-button" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">Mở nguồn</a>' : '')+
    '</div>'+ (userAdded ? '<button class="text-button edit-record" data-action="research-source" data-value="'+esc(item.id)+'">Sửa</button>' : '')+'</article>';
}
function researchSources(area, section) {
  const defaults = section ? section.sources : area.sources;
  const added = scopedResearchItems(state.researchSources,area,section);
  const extra = !section && area.extra?.length ?
    '<div class="source-list"><h3>Chú giải và luận giải</h3>'+area.extra.map(item => referenceCard(item, area)).join('')+'</div>' : '';
  return '<div class="stack"><div class="head-split"><h2>Tài liệu</h2>'+btn('Thêm nguồn','research-source','', 'plus')+'</div>'+
    '<div class="source-list"><h3>Tư liệu tham khảo</h3>'+(defaults.length ? defaults.map(item => referenceCard(item, area)).join('') : '<p class="empty">Chưa có tài liệu gợi ý cho chủ đề này.</p>')+'</div>'+extra+commentarySection(area,section)+
    '<div class="source-list"><h3>Nguồn của bạn</h3>'+(added.length ? added.map(item => referenceCard(item, area)).join('') : '<p class="empty">Chưa có nguồn tự thêm.</p>')+'</div></div>';
}
function journalCards(area,section) {
  const meditation = area.group === 'Thiền';
  const entries = scopedResearchItems(state.researchJournal,area,section)
    .sort((a,b) => b.date.localeCompare(a.date) || b.updated.localeCompare(a.updated));
  return '<div class="head-split"><h2>'+(meditation?'Nhật ký thực hành':'Ghi chú nghiên cứu')+'</h2>'+
    btn(meditation?'Thêm buổi thực hành':'Thêm ghi chú','research-journal','', 'plus')+'</div>'+
    '<p class="meta" style="margin:8px 0 13px">'+(meditation?'Nhật ký thuộc mảng '+area.title+' và lưu trên trình duyệt này.':'Ghi nhận cách đọc, câu hỏi và điểm cần kiểm chứng trong mảng này.')+'</p><div class="stack">'+
    (entries.length ? entries.map(entry => {
      const topic = chapterById(area,entry.section)?.title;
      const duration = entry.minutes ? entry.minutes+' phút' : '';
      const date = entry.date.split('-').reverse().join('/');
      return '<article class="source-item research-record"><div><h3>'+esc(entry.title)+'</h3><p class="meta">'+
        [date,topic,duration].filter(Boolean).map(esc).join(' · ')+'</p>'+
        (entry.reference ? '<p class="meta">Nguồn hoặc hướng dẫn · '+esc(entry.reference)+'</p>' : '')+
        '<p class="note">'+esc(entry.note)+'</p>'+
        (entry.question ? '<p class="meta research-question"><strong>Câu hỏi cần kiểm chứng</strong><br>'+esc(entry.question)+'</p>' : '')+
        '</div><button class="text-button edit-record" data-action="research-journal" data-value="'+esc(entry.id)+'">Sửa</button></article>';
    }).join('') : '<p class="empty">Chưa có ghi chép cho mục này.</p>')+'</div>';
}
function researchContents(area,section) {
  if (section) {
    return '<div class="stack"><div><h2>'+section.title+'</h2><p class="kicker">'+section.pali+'</p><p class="meta">'+section.desc+'</p></div>'+
      (section.contents.length ? '<ul class="research-list">'+section.contents.map(item => '<li>'+item+'</li>').join('')+'</ul>' : '')+
      '<div class="buttons"><a class="btn secondary" href="'+researchHref(area,section,'tai-lieu')+'">Xem tài liệu</a><a class="btn secondary" href="'+researchHref(area,section,'nhat-ky')+'">'+
      (area.group === 'Thiền' ? 'Xem nhật ký' : 'Xem ghi chú')+'</a></div>'+
      (section.id === 'vi-tri' ? '<div class="buttons"><a class="btn" href="#/doc">Đọc bài mẫu về 24 duyên</a><a class="btn secondary" href="#/de-tai">Mở đề tài Trưởng lão Tịnh Sự</a></div>' : '')+'</div>';
  }
  return '<div class="stack"><h2>'+(area.group === 'Thiền' ? 'Chủ đề nghiên cứu' : 'Mục lục')+'</h2>'+
    area.chapters.map(ch => '<a class="source-item research-chapter" href="'+researchHref(area,ch)+'"><h3>'+ch.title+'</h3><p class="kicker">'+ch.pali+'</p><p class="meta">'+ch.desc+'</p></a>').join('')+'</div>';
}
function workspaceResearch({area,section,tab,group,query}) {
  if (!area) return researchLanding(group);
  const links = researchTabsByArea(area,section).map(item => '<a class="tab" href="'+researchHref(area,section,item.id)+'"'+
    (tab === item.id?' aria-current="page"':'')+'>'+item.label+'</a>').join('');
  const chapterLinks = area.chapters.map(ch => '<a href="'+researchHref(area,ch,tab)+'"'+
    (section?.id === ch.id?' aria-current="page"':'')+'>'+ch.title+'</a>').join('');
  const content = tab === 'van-ban' ? '<div id="canon-workspace"><p class="meta" role="status">Đang tải danh sách văn bản…</p></div>' :
    tab === 'tai-lieu' ? researchSources(area,section) : tab === 'nhat-ky' ? journalCards(area,section) : researchContents(area,section);
  return '<div class="page-head"><a class="text-button" href="'+researchBase+'">Các mảng nghiên cứu</a><h1>'+area.title+'</h1><p class="kicker">'+area.pali+'</p><p>'+area.desc+'</p></div>'+
    '<div class="research-grid'+(tab==='van-ban'&&query?.has('vb')?' canon-reading-layout':'')+'"><section class="panel"><nav class="tabs workspace-tabs" aria-label="'+area.title+'">'+links+'</nav>'+
    (tab !== 'muc-luc' && tab !== 'van-ban' && section ? '<p class="meta workspace-scope">Đang xem · '+section.title+'</p>' : '')+content+'</section>'+
    '<aside class="panel side-panel area-aside"><h2>'+(area.group === 'Thiền'?'Chủ đề':'Các mục trong tạng')+'</h2><nav aria-label="Mục con '+area.title+'"><a href="'+researchHref(area,null,tab)+'"'+(!section?' aria-current="page"':'')+'>Toàn mảng</a>'+chapterLinks+'</nav><p class="area-tip">'+area.focus+'</p><a class="text-button" href="'+commentaryHref(area,section)+'">Thư mục chú giải</a></aside></div>';
}
function formField(label, name, value, {required=false, type='text', max=160, textarea=false}={}) {
  return '<label>'+label+(textarea ? '<textarea name="'+name+'" rows="4" maxlength="'+max+'"'+(required?' required':'')+'>'+esc(value)+'</textarea>' :
    '<input name="'+name+'" type="'+type+'" value="'+esc(value)+'"'+((type==='text'||type==='url')?' maxlength="'+max+'"':'')+(required?' required':'')+'>')+'</label>';
}
function researchSectionField(area,section) {
  return '<label>Mục con<select name="section"><option value="">Toàn mảng</option>'+
    area.chapters.map(ch=>'<option value="'+ch.id+'"'+(ch.id === section?' selected':'')+'>'+ch.title+'</option>').join('')+'</select></label>';
}
function todayLocal() {
  const d = new Date();
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
}
function openResearchForm(action,id) {
  const {area,section} = route();
  if (!area) return;
  const isSource = action === 'research-source';
  const items = isSource ? state.researchSources : state.researchJournal;
  const existing = id ? items.find(item => item.id === id && item.area === area.id) : undefined;
  const item = existing || {};
  const heading = isSource ? (existing?'Sửa nguồn':'Thêm nguồn') : area.group === 'Thiền' ? (existing?'Sửa buổi thực hành':'Thêm buổi thực hành') : (existing?'Sửa ghi chú':'Thêm ghi chú');
  const hidden = '<input type="hidden" name="record-id" value="'+esc(item.id)+'">';
  const scope = researchSectionField(area, existing ? item.section : section?.id);
  if (isSource) {
    modal(heading,form(hidden+formField('Tên tài liệu','title',item.title,{required:true})+
      '<label>Loại tài liệu<select name="kind">'+sourceTypes.map(kind => '<option'+(item.kind===kind?' selected':'')+'>'+kind+'</option>').join('')+'</select></label>'+
      scope+formField('Tác giả, dịch giả hoặc ấn bản','detail',item.detail,{max:240})+
      formField('Mã văn bản, số trang hoặc mốc thời gian','location',item.location)+formField('Đường dẫn','url',item.url,{type:'url'})+
      formField('Ghi chú về nguồn','note',item.note,{textarea:true,max:2000}),'Lưu nguồn','research-source-form'));
    return;
  }
  const meditation = area.group === 'Thiền';
  modal(heading,form(hidden+formField(meditation?'Đề mục hoặc phương pháp':'Tiêu đề ghi chú','title',item.title,{required:true})+
    scope+formField('Ngày','date',item.date || todayLocal(),{type:'date',required:true})+
    (meditation?'<label>Số phút<input name="minutes" type="number" min="1" max="1440" step="1" value="'+esc(item.minutes)+'"></label>':'')+
    formField('Nguồn, người hướng dẫn hoặc vị trí đọc','reference',item.reference,{max:240})+
    formField(meditation?'Điều quan sát được':'Nội dung ghi nhận','note',item.note,{required:true,textarea:true,max:3000})+
    formField('Câu hỏi cần kiểm chứng','question',item.question,{textarea:true,max:2000}),'Lưu ghi chép','research-journal-form'));
}
function saveResearchForm(formElement, field, error) {
  const {area} = route();
  if (!area) return '';
  const isSource = formElement.id === 'research-source-form';
  const items = isSource ? state.researchSources : state.researchJournal;
  const current = field('record-id');
  const position = current ? items.findIndex(item => item.id === current && item.area === area.id) : -1;
  if (current && position === -1) { error('Không tìm thấy bản ghi để cập nhật.'); return ''; }
  if (!field('title')) { error('Hãy nhập tiêu đề.'); return ''; }
  const item = {
    id: current || newRecordId(),
    area: area.id,
    section: chapterById(area,field('section'))?.id || '',
    title: field('title'),
    note: field('note'),
    updated: new Date().toISOString(),
  };
  if (isSource) {
    const url = externalLink(field('url'));
    if (field('url') && !url) { error('Hãy dùng đường dẫn HTTP hoặc HTTPS hợp lệ.'); return ''; }
    Object.assign(item,{url,kind:field('kind'),detail:field('detail'),location:field('location')});
  } else {
    if (!field('date') || !item.note) { error('Hãy nhập ngày và nội dung ghi nhận.'); return ''; }
    Object.assign(item,{date:field('date'),minutes:field('minutes'),reference:field('reference'),question:field('question')});
  }
  if (position === -1) items.push(item);
  else items[position] = item;
  return isSource ? 'Đã lưu nguồn.' : 'Đã lưu ghi chép.';
}
