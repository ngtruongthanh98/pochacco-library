'use strict';

const commentaryBase = researchBase+'/thu-muc';
const commentaryAreaOptions = Object.fromEntries(researchAreas.map(area => [area.id,area.title]));
const catalogFilters = [
  {name:'loai',label:'Lớp văn bản',options:commentaryTypes,empty:'Mọi lớp văn bản'},
  {name:'ngon-ngu',label:'Ngôn ngữ',options:commentaryLanguages,empty:'Mọi ngôn ngữ'},
  {name:'chu',label:'Chữ viết',options:commentaryScripts,empty:'Mọi chữ viết'},
  {name:'mang',label:'Mảng nghiên cứu',options:commentaryAreaOptions,empty:'Mọi mảng'},
];
const commentaryHref = (area,section) => {
  const params = new URLSearchParams();
  if (area) params.set('mang',area.id);
  if (section) params.set('muc',section.id);
  const query = params.toString();
  return commentaryBase + (query?'?'+query:'');
};
function commentaryPills(labels) {
  return labels.map(label=>'<span class="status">'+esc(label)+'</span>').join('');
}
function commentaryCard(item) {
  const isDraftTranslation = item.id === 'pa-auk-vis-tika';
  return '<article class="source-item commentary-card">'+
    '<div class="commentary-tags">'+commentaryPills(item.types.map(type=>commentaryTypes[type]))+
    '<span class="status'+(isDraftTranslation?' warn':'')+'">'+esc(item.access)+'</span></div>'+
    '<h3>'+esc(item.title)+'</h3><p class="meta">'+esc(item.provider)+'</p>'+
    '<p class="meta">'+item.languages.map(lang=>commentaryLanguages[lang]).join(' / ')+' · '+item.scripts.map(script=>commentaryScripts[script]).join(' / ')+'</p>'+
    '<p>'+esc(item.note)+'</p><a class="text-button" href="'+esc(externalLink(item.url))+'" target="_blank" rel="noopener noreferrer">Mở nguồn</a></article>';
}
function curatedForWorkspace(area,section) {
  const matches = commentaryCatalog.filter(item=>item.scope.includes(area.id));
  if (section) {
    const specific = matches.filter(item=>item.chapters.includes(section.id));
    if (specific.length) return specific.slice(0,4);
  }
  const priority = ['vri-roman','thai-commentary-index','myanmar-winmetta-tika','pts-index','vn-atthasalini',
    'myanmar-loc','pts-vinaya','thai-dn22','abhi-vis-tika','vn-vis','vn-host-vis-tika'];
  return matches.filter(item=>priority.includes(item.id)).slice(0,4);
}
function commentarySection(area,section) {
  return '<section class="source-list"><div class="head-split"><h3>Chú giải và phụ chú giải</h3>'+
    '<a class="text-button" href="'+commentaryHref(area,section)+'">Mở thư mục và bộ lọc</a></div>'+
    curatedForWorkspace(area,section).map(commentaryCard).join('')+'</section>';
}
function matchingCommentaries(query) {
  const kind=query.get('loai');
  const language=query.get('ngon-ngu');
  const script=query.get('chu');
  const area=query.get('mang');
  const section=query.get('muc');
  const search=normalize(query.get('q')||'').trim().split(/\s+/).filter(Boolean);
  const matches=commentaryCatalog.filter(item=>{
    if ((kind && !item.types.includes(kind)) || (language && !item.languages.includes(language)) ||
        (script && !item.scripts.includes(script)) || (area && !item.scope.includes(area))) return false;
    const haystack=normalize([item.title,item.provider,item.note,...item.types.map(type=>commentaryTypes[type])].join(' '));
    return search.every(word=>haystack.includes(word));
  });
  return section ? matches.sort((a,b)=>Number(b.chapters.includes(section))-Number(a.chapters.includes(section))) : matches;
}
function commentaryResults(query) {
  const matches=matchingCommentaries(query);
  return matches.length ? matches.map(commentaryCard).join('') : '<p class="empty">Không tìm thấy nguồn với bộ lọc này.</p>';
}
function commentaryPage({query}) {
  const options = catalogFilters.map(({name,label,empty,options})=>
    '<label>'+label+'<select name="'+name+'"><option value="">'+empty+'</option>'+
    Object.entries(options).map(([key,value])=>'<option value="'+key+'"'+(query.get(name)===key?' selected':'')+'>'+value+'</option>').join('')+'</select></label>'
  ).join('');
  const currentArea=areaById(query.get('mang'));
  const currentSection=currentArea && chapterById(currentArea,query.get('muc'));
  return '<div class="page-head"><a class="text-button" href="'+researchBase+'">Các mảng nghiên cứu</a><h1>Thư mục Theravāda</h1>'+
    '<p>Tra chú giải, phụ chú giải, bản đối dịch và ấn bản đối chiếu theo từng mảng.</p></div>'+
    '<section class="panel commentary-filters"><form id="commentary-filters" role="search"><label class="commentary-search">Tìm tài liệu'+
    '<input name="q" type="search" value="'+esc(query.get('q')||'')+'" placeholder="Ví dụ Paṭṭhāna, Atthasālinī, Nissaya"></label>'+
    '<div class="commentary-selects">'+options+'</div></form>'+
    '<p class="meta">Bộ lọc <strong>Ngôn ngữ</strong> và <strong>Chữ viết</strong> hoạt động độc lập. Ví dụ, Pāli viết bằng chữ Miến là nguyên văn Pāli.</p></section>'+
    (currentSection ? '<p class="meta commentary-initial-scope">Ưu tiên tài liệu liên quan trực tiếp đến '+currentSection.title+'.</p>' : '')+
    '<div class="section-head"><h2>Nguồn tra cứu</h2><span class="meta" id="commentary-count" role="status">'+matchingCommentaries(query).length+' nguồn</span></div>'+
    '<div class="commentary-grid" id="commentary-results">'+commentaryResults(query)+'</div>';
}
function updateCommentaryFilters(formElement) {
  const prior = route();
  if (!prior.catalog) return;
  const query = new URLSearchParams();
  for (const [name,value] of new FormData(formElement)) {
    if (value.trim()) query.set(name,value.trim());
  }
  if (prior.query.get('muc') && query.get('mang')===prior.query.get('mang')) query.set('muc',prior.query.get('muc'));
  else document.querySelector('.commentary-initial-scope')?.remove();
  history.replaceState(null,'',commentaryBase+(query.size?'?'+query:''));
  document.querySelector('#commentary-count').textContent=matchingCommentaries(query).length+' nguồn';
  document.querySelector('#commentary-results').innerHTML=commentaryResults(query);
}
