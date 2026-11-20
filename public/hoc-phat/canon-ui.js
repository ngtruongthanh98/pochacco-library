'use strict';

const canonIndex = new Map();
const canonPageSize = 30;
const canonLanguageNames = {vi:'Tiếng Việt',pli:'Pāli',en:'Tiếng Anh',th:'Tiếng Thái',my:'Tiếng Miến'};
const scOrigin = 'https://suttacentral.net';
const entryAt = {
  id:0, code:1, pali:2, vietnamese:3, english:4, group:5, subgroup:6, editions:7,
};

const canonSection = (area,section) => area?.group === 'Tam tạng' && !!section;
const canonUnit = (area) => area.id === 'tang-kinh' ? 'bài hoặc nhóm bài' :
  area.id === 'tang-luat' ? 'điều học hoặc mục' : 'đơn vị văn bản';

function canonHref(area,section,query,entryId) {
  const params=new URLSearchParams(query);
  params.delete('vb');
  if (entryId) params.set('vb',entryId);
  params.set('tab','van-ban');
  return researchHref(area,section)+'?'+params.toString();
}
function loadCanonIndex(sectionId) {
  if (!canonIndex.has(sectionId)) {
    const loading = fetch('canon/'+encodeURIComponent(sectionId)+'.json.gz')
      .then(async response=>{
        if (!response.ok) throw new Error('Không tải được mục lục');
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
          const data = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
          return new Response(data).json();
        }
        return JSON.parse(new TextDecoder().decode(bytes));
      }).catch(error=>{
        canonIndex.delete(sectionId);
        throw error;
      });
    canonIndex.set(sectionId,loading);
  }
  return canonIndex.get(sectionId);
}
const canonName = entry => entry[entryAt.vietnamese] || entry[entryAt.pali] || entry[entryAt.english] || entry[entryAt.code];
const canonAlternateNames = entry => [entry[entryAt.pali],entry[entryAt.english]]
  .filter((value,index,list)=>value && value!==canonName(entry) && list.indexOf(value)===index);

function canonCodeParts(value) {
  const match=normalize(value).trim().match(/^([a-z][a-z ]*?)\s*(\d+(?:\.\d+)*)(?:\s*[-–—]\s*(\d+(?:\.\d+)*))?$/);
  if(!match) return null;
  return {family:match[1].replace(/\s+/g,''),start:match[2].split('.').map(Number),end:match[3]?.split('.').map(Number)};
}
function canonCodeContains(wanted,code) {
  const candidate=canonCodeParts(code);
  if(!candidate || candidate.family!==wanted.family || candidate.start.length!==wanted.start.length) return false;
  if (wanted.end) return candidate.start.join('.')===wanted.start.join('.') && candidate.end?.join('.')===wanted.end.join('.');
  const first=candidate.start.at(-1);
  const last=candidate.end?.at(-1) ?? first;
  const matchesGroup=arraysMatch(wanted.start.slice(0,-1),candidate.start.slice(0,-1));
  return matchesGroup && wanted.start.at(-1)>=first && wanted.start.at(-1)<=last;
}
const arraysMatch=(a,b)=>a.length===b.length && a.every((value,index)=>value===b[index]);

function canonFilter(data,query) {
  const group=query.get('nhom-vb');
  const search=query.get('q')||'';
  const code=canonCodeParts(search);
  const words=normalize(search).split(/\s+/).filter(Boolean);
  return data.entries.filter(entry=>{
    if(group && group!==entry[entryAt.group]) return false;
    if(code) return canonCodeContains(code,entry[entryAt.code]) || canonCodeContains(code,entry[entryAt.id]);
    const label = normalize(entry.slice(0,5).join(' '));
    return words.every(word=>label.includes(word));
  });
}
function canonResultPane(data,area,section,query) {
  const matches=canonFilter(data,query);
  const lastPage=Math.max(1,Math.ceil(matches.length/canonPageSize));
  const rawPage=Number.parseInt(query.get('trang')||'1',10);
  const page=Math.max(1,Math.min(lastPage,Number.isFinite(rawPage)?rawPage:1));
  const start=(page-1)*canonPageSize;
  const summary='<p class="meta canon-result-summary" role="status">'+matches.length.toLocaleString('vi-VN')+' '+canonUnit(area)+'</p>';
  const links=matches.slice(start,start+canonPageSize).map(entry=>{
    const code=entry[entryAt.code];
    return '<a class="source-item canon-entry" href="'+esc(canonHref(area,section,query,entry[entryAt.id]))+
      '"><span class="status canon-code">'+esc(code)+'</span><span><strong>'+
      esc(canonName(entry)===code?'Văn bản '+code:canonName(entry))+'</strong>'+
      canonAlternateNames(entry).slice(0,1).map(name=>'<small>'+esc(name)+'</small>').join('')+
      '</span></a>';
  }).join('');
  if (!matches.length) return summary+'<p class="empty">Không tìm thấy văn bản với từ khóa hoặc nhóm đã chọn.</p>';
  const pageLink=(next,label)=>{
    const params=new URLSearchParams(query);
    if(next===1)params.delete('trang');else params.set('trang',String(next));
    return '<a class="btn secondary" href="'+esc(canonHref(area,section,params))+'">'+label+'</a>';
  };
  const paging=lastPage>1?'<div class="buttons canon-paging">'+
    (page>1?pageLink(page-1,'Trang trước'):'')+'<span class="meta">Trang '+page+'/'+lastPage+'</span>'+
    (page<lastPage?pageLink(page+1,'Trang sau'):'')+'</div>':'';
  return summary+'<div class="stack canon-results">'+links+'</div>'+paging;
}
function canonList(data,area,section,query) {
  const groupOptions=Object.entries(data.groups);
  const groupValue=query.get('nhom-vb');
  return '<div class="stack"><div><h2>'+esc(section.title)+'</h2><p class="kicker">'+esc(section.pali)+'</p><p class="meta">'+esc(section.desc)+'</p></div>'+
    '<form class="canon-filters" id="canon-filters" role="search"><label>Tìm mã hoặc tên văn bản<input name="q" type="search" placeholder="Ví dụ MN 118, niệm xứ, Paṭṭhāna" value="'+esc(query.get('q'))+'"></label>'+
    (groupOptions.length>1?'<label>Nhóm văn bản<select name="nhom-vb"><option value="">Mọi nhóm</option>'+
      groupOptions.map(([key,label])=>'<option value="'+esc(key)+'"'+(key===groupValue?' selected':'')+'>'+esc(label)+'</option>').join('')+'</select></label>':'')+
    '</form><div id="canon-list-results">'+canonResultPane(data,area,section,query)+'</div>'+
    (section.id==='vi-tri'?'<div class="buttons"><a class="btn secondary" href="#/doc">Bài đọc mẫu về 24 duyên</a><a class="btn secondary" href="#/de-tai">Đề tài Trưởng lão Tịnh Sự</a></div>':'')+
    '<p class="meta">Mục lục theo <a href="https://suttacentral.net" target="_blank" rel="noopener noreferrer">SuttaCentral</a>. Mã theo dải được giữ nguyên khi ấn bản gộp nhiều bài hoặc điều học trong một mục.</p></div>';
}
function canonEditionLink(id, language, author) {
  return scOrigin+'/'+[id,language,author].map(encodeURIComponent).join('/');
}
function canonDetail(data,area,section,query,id) {
  const index=data.entries.findIndex(entry=>entry[entryAt.id]===id);
  if (index<0) return '<div class="stack"><p class="empty">Không tìm thấy mã trong mục này.</p><div><a class="btn secondary" href="'+esc(canonHref(area,section,query))+'">Về danh sách văn bản</a></div></div>';
  const entry=data.entries[index];
  const [,code,pali,vietnamese,english,group,subgroup,editions]=entry;
  const lookup=canonHref(area,section,query);
  const groupLabel=[data.groups[group],data.sections[subgroup]].filter(Boolean).join(' · ');
  const range=/\d\s*[–-]\s*\d/.test(code) || /\d-\d/.test(id);
  const editionRows=editions.map(([lang,authorId,author])=>'<li>'+
    '<span>'+canonLanguageNames[lang]+'</span><a href="'+esc(canonEditionLink(id,lang,authorId))+'" target="_blank" rel="noopener noreferrer">'+esc(author||authorId)+'</a></li>').join('');
  const neighbor=(other,label)=>other?'<a class="btn secondary" href="'+esc(canonHref(area,section,query,other[entryAt.id]))+'">'+label+' · '+esc(other[entryAt.code])+'</a>':'';
  const root=editions.find(([lang,,,segmented])=>lang==='pli' && segmented);
  const aligned=editions.find(([lang,author,,segmented])=>lang==='en' && segmented && canonAlignedAuthors.has(author));
  const vietnameseEdition=canonVietnameseEdition(editions);
  const inlineRead=canonReaderMarkup(root,aligned,id,vietnameseEdition);
  return '<article class="stack canon-detail"><div><a class="text-button" href="'+esc(lookup)+'">Danh sách '+esc(section.title)+'</a></div>'+
    '<div><span class="status canon-code">'+esc(code)+'</span><h2>'+esc(canonName(entry))+'</h2><p class="meta">'+esc(groupLabel)+'</p></div>'+
    inlineRead+
    '<details class="canon-edition-details"><summary>Thông tin văn bản và các bản dịch</summary><dl class="canon-fields">'+
    (vietnamese?'<div><dt>Tiếng Việt</dt><dd>'+esc(vietnamese)+'</dd></div>':'')+
    (pali?'<div><dt>Pāli</dt><dd>'+esc(pali)+'</dd></div>':'')+
    (english?'<div><dt>Tiếng Anh</dt><dd>'+esc(english)+'</dd></div>':'')+
    '<div><dt>Mã SuttaCentral</dt><dd>'+esc(id)+'</dd></div></dl>'+
    (range?'<p class="meta">Ấn bản nguồn xếp các số trong dải này vào cùng một văn bản.</p>':'')+
    '<ul class="canon-editions">'+editionRows+'</ul>'+
    '<a class="text-button" href="'+scOrigin+'/'+encodeURIComponent(id)+'" target="_blank" rel="noopener noreferrer">Xem mục này trên SuttaCentral</a></details>'+
    '<nav class="buttons canon-neighbors" aria-label="Các văn bản liền kề">'+neighbor(data.entries[index-1],'Mục trước')+neighbor(data.entries[index+1],'Mục sau')+'</nav></article>';
}
async function renderCanonWorkspace(current) {
  const target=document.querySelector('#canon-workspace');
  if (!target || !current.section) return;
  try {
    const data=await loadCanonIndex(current.section.id);
    if (!target.isConnected) return;
    target.canonData=data;
    const id=current.query.get('vb');
    target.innerHTML=id?canonDetail(data,current.area,current.section,current.query,id):
      canonList(data,current.area,current.section,current.query);
    if (id) loadCanonReading();
  } catch {
    if (target.isConnected) target.innerHTML='<p class="empty">Tạm thời chưa tải được danh sách văn bản.</p><button type="button" class="btn secondary" data-action="canon-retry">Thử lại</button>';
  }
}
function updateCanonFilters(formElement) {
  const current=route();
  const data=document.querySelector('#canon-workspace')?.canonData;
  if (!data || current.tab!=='van-ban') return;
  const params=new URLSearchParams();
  for (const [name,value] of new FormData(formElement)) {
    if(value.trim()) params.set(name,value.trim());
  }
  history.replaceState(null,'',canonHref(current.area,current.section,params));
  document.querySelector('#canon-list-results').innerHTML=canonResultPane(data,current.area,current.section,params);
}


const canonReadingPageSize = 100;
const canonAlignedAuthors = new Set(['sujato','brahmali']);
const canonReaderCache = new Map();
const canonMaxResponseBytes = 16*1024*1024;
const canonMaxSegments = 35000;
let canonReadingSize = 1;
let canonReadingRequest;

const canonVietnameseEdition = editions =>
  editions.find(([lang,,,segmented])=>lang==='vi' && segmented) || editions.find(([lang])=>lang==='vi');

function canonReaderMarkup(root,aligned,id,vietnameseEdition) {
  if (!root && !vietnameseEdition) return '<p class="empty">Ấn bản này có thể đọc tại <a class="text-button" href="'+
    esc(scOrigin+'/'+encodeURIComponent(id))+'" target="_blank" rel="noopener noreferrer">SuttaCentral</a>.</p>';
  return '<section class="canon-inline" id="canon-inline" data-size="'+canonReadingSize+'" aria-labelledby="canon-reader-title">'+
    '<div class="canon-reader-toolbar"><h3 id="canon-reader-title">Chánh văn</h3><div class="buttons canon-reader-options">'+
    (vietnameseEdition?'<button class="btn secondary" type="button" data-action="canon-reading" data-value="vi" aria-pressed="true">Tiếng Việt</button>':'')+
    (root?'<button class="btn secondary" type="button" data-action="canon-reading" data-value="pli" aria-pressed="'+!vietnameseEdition+'">Pāli</button>':'')+
    (aligned?'<button class="btn secondary" type="button" data-action="canon-reading" data-value="parallel" aria-pressed="false">Pāli–Anh</button>':'')+
    '<button class="btn secondary canon-font" type="button" data-action="canon-size" data-value="-1" aria-label="Giảm cỡ chữ"'+(canonReadingSize===0?' disabled':'')+'>A−</button>'+
    '<button class="btn secondary canon-font" type="button" data-action="canon-size" data-value="1" aria-label="Tăng cỡ chữ"'+(canonReadingSize===3?' disabled':'')+'>A+</button>'+
    '</div></div><div id="canon-body" aria-busy="true"><p class="meta" role="status">Đang tải chánh văn…</p></div></section>';
}

const readerElement = (tag, className, content) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (content !== undefined) element.textContent = content;
  return element;
};

function canonSourceLink(url) {
  const link=readerElement('a','text-button canon-source-link','Mở bản gốc trên SuttaCentral');
  link.href=url;
  link.target='_blank';
  link.rel='noopener noreferrer';
  return link;
}

function sizeCanonReader(change) {
  const reader=document.querySelector('#canon-inline');
  if (!reader) return;
  canonReadingSize=Math.max(0,Math.min(3,canonReadingSize+change));
  reader.dataset.size=String(canonReadingSize);
  for(const button of reader.querySelectorAll('[data-action="canon-size"]')) {
    button.disabled=button.dataset.value==='-1'?canonReadingSize===0:canonReadingSize===3;
  }
}

function renderCanonReaderPage(target, page, moveToText=false) {
  const reading=target.reading;
  if (!reading) return;
  const {segments,mode,credit,sourceUrl}=reading;
  const parallel=mode==='parallel';
  const pageCount=Math.ceil(segments.length/canonReadingPageSize);
  const activePage=Math.max(1,Math.min(pageCount,page));
  const start=(activePage-1)*canonReadingPageSize;
  const end=Math.min(segments.length,start+canonReadingPageSize);
  const sheet=readerElement('div','canon-sheet');
  const passage=readerElement('div','canon-segments');
  for (const [key,root,translation,kind] of segments.slice(start,end)) {
    const segment=readerElement('div','canon-segment');
    const row=readerElement('div',parallel?'canon-parallel':'');
    const mainText=readerElement(kind||'p','',mode==='vi'?translation.normalize('NFC'):root);
    mainText.lang=mode==='vi'?'vi':'pi';
    row.append(mainText);
    if (parallel) {
      const english=readerElement('p','',translation);
      english.lang='en';
      row.append(english);
    }
    if (key) segment.append(readerElement('small','',key));
    segment.append(row);
    passage.append(segment);
  }

  const source=readerElement('div','canon-source');
  source.append(readerElement('p','meta canon-text-credit',credit),canonSourceLink(sourceUrl));
  const pageInfo=readerElement('p','meta canon-page-range','Đoạn '+(start+1)+'–'+end+' / '+segments.length);
  sheet.append(source,pageInfo,passage);
  if (pageCount>1) {
    const nav=readerElement('nav','buttons canon-reader-pages');
    nav.setAttribute('aria-label','Phân trang chánh văn');
    const addPageButton=(label,next) => {
      const button=readerElement('button','btn secondary',label);
      button.type='button';
      button.dataset.action='canon-page';
      button.dataset.value=String(next);
      nav.append(button);
    };
    if(activePage>1)addPageButton('Trang trước',activePage-1);
    nav.append(readerElement('span','meta','Trang '+activePage+' / '+pageCount));
    if(activePage<pageCount)addPageButton('Trang sau',activePage+1);
    sheet.append(nav);
  }
  target.replaceChildren(sheet);
  target.setAttribute('aria-busy','false');
  if(moveToText) {
    target.closest('section').scrollIntoView({block:'start'});
    target.tabIndex=-1;
    target.focus({preventScroll:true});
  }
}

const canonObject = value => value && typeof value==='object' && !Array.isArray(value);
function canonSegmentScope(id) {
  const range=id.match(/^(.*?)(\d+)-(\d+)$/);
  return key=>{
    const separator=key.indexOf(':');
    if(separator<1)return false;
    const uid=key.slice(0,separator);
    if(uid===id)return true;
    if(!range||!uid.startsWith(range[1]))return false;
    const member=uid.slice(range[1].length);
    return /^\d+$/.test(member)&&Number(member)>=Number(range[2])&&Number(member)<=Number(range[3]);
  };
}
function extractCanonSegments(payload,id) {
  const root=payload?.root_text;
  if (!canonObject(root)) throw new Error('Thiếu nguyên văn');
  const translation=canonObject(payload.translation_text)?payload.translation_text:{};
  const keys=Array.isArray(payload.keys_order)?payload.keys_order:Object.keys(root);
  if (keys.length>canonMaxSegments) throw new Error('Quá nhiều đoạn');
  const inScope=canonSegmentScope(id);
  const seen=new Set();
  const rows=[];
  for (const key of keys) {
    if (typeof key!=='string'||key.length>140||!inScope(key)||seen.has(key)) continue;
    seen.add(key);
    const text=(Object.hasOwn(root,key)&&typeof root[key]==='string')?root[key]:'';
    const translated=(Object.hasOwn(translation,key)&&typeof translation[key]==='string')?translation[key]:'';
    if (text.length>60000||translated.length>60000) throw new Error('Đoạn văn quá lớn');
    if(text.trim())rows.push([key,text,translated]);
  }
  if(!rows.length)throw new Error('Văn bản trống');
  return rows;
}

const skippedCanonTags = new Set(['head','title','meta','link','script','style','svg','math','template','noscript','iframe','object','embed','img','audio','video','form','button','input','select','textarea']);
const canonBlockTags = new Set(['p','div','section','article','header','footer','blockquote','li','dt','dd','td','th','pre','h1','h2','h3','h4','h5','h6']);

function extractCanonVietnamese(payload,id,author) {
  const text=payload?.translation;
  if(text?.uid!==id||text.lang!=='vi'||text.author_uid!==author||typeof text.text!=='string') throw new Error('Thiếu bản dịch');
  // Template nodes stay inert. Only plain text and locally chosen paragraph styles reach the reader.
  const template=document.createElement('template');
  template.innerHTML=text.text;
  const rows=[];
  let buffer=[];
  const flush=kind=>{
    const value=buffer.join('').replace(/[^\S\r\n]+/g,' ').replace(/ *\n */g,'\n').trim();
    buffer=[];
    if(value) rows.push(['','',value,kind]);
  };
  function visit(node,kind='p') {
    if(node.nodeType===3) {
      buffer.push(node.textContent.replace(/\s+/g,' '));
      return;
    }
    if(node.nodeType!==1) return;
    const name=node.localName;
    if(skippedCanonTags.has(name)||node.hasAttribute('hidden')) return;
    if(name==='br') {buffer.push('\n');return;}
    const block=canonBlockTags.has(name);
    if(block) flush(kind);
    const nextKind=/^h[1-6]$/.test(name)?'h4':name==='blockquote'?'blockquote':kind;
    for(const child of node.childNodes) visit(child,nextKind);
    if(block) flush(nextKind);
  }
  for(const child of template.content.childNodes) visit(child);
  flush('p');
  if(!rows.length||rows.length>canonMaxSegments)throw new Error('Bản dịch không có nội dung đọc được');
  return rows;
}

async function fetchCanonReader(id,author,signal,language='pli',segmented=true) {
  if(!/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/.test(id)||!/^[a-z0-9_-]+$/.test(author)) throw new Error('Mã nguồn không hợp lệ');
  const legacy=language==='vi'&&!segmented;
  const method=legacy?'suttas':'bilarasuttas';
  const query=language==='vi'?'?lang=vi':'';
  const cacheKey=method+'/'+id+'/'+author+query;
  if(canonReaderCache.has(cacheKey)) return canonReaderCache.get(cacheKey);
  const endpoint=scOrigin+'/api/'+cacheKey;
  const response=await fetch(endpoint,{signal,credentials:'omit',redirect:'error',referrerPolicy:'no-referrer'});
  const contentType=(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
  if(!response.ok||contentType!=='application/json') throw new Error('Nguồn không trả dữ liệu văn bản');
  if(Number(response.headers.get('content-length'))>canonMaxResponseBytes||!response.body) throw new Error('Dữ liệu không phù hợp');

  const stream=response.body.getReader();
  const decoder=new TextDecoder();
  let bytes=0;
  const chunks=[];
  for (;;) {
    const {done,value}=await stream.read();
    if (done) break;
    bytes+=value.byteLength;
    if(bytes>canonMaxResponseBytes) {
      await stream.cancel();
      throw new Error('Dữ liệu quá lớn');
    }
    chunks.push(decoder.decode(value,{stream:true}));
  }
  chunks.push(decoder.decode());
  const payload=JSON.parse(chunks.join(''));
  const rows=legacy?extractCanonVietnamese(payload,id,author):extractCanonSegments(payload,id);
  if(canonReaderCache.size>=6)canonReaderCache.delete(canonReaderCache.keys().next().value);
  canonReaderCache.set(cacheKey,rows);
  return rows;
}

function cancelCanonReading() {
  canonReadingRequest?.abort();
  canonReadingRequest=undefined;
}

async function loadCanonReading(mode) {
  const target=document.querySelector('#canon-body');
  const workspace=document.querySelector('#canon-workspace');
  const id=route().query?.get('vb');
  const entry=workspace?.canonData?.entries.find(item=>item[entryAt.id]===id);
  if(!target||!entry)return;
  const editions=entry[entryAt.editions];
  const root=editions.find(([language,,,segmented])=>language==='pli' && segmented);
  const aligned=editions.find(([language,author,,segmented])=>language==='en' && segmented && canonAlignedAuthors.has(author));
  const vietnamese=canonVietnameseEdition(editions);
  const selectedMode=mode||(vietnamese?'vi':'pli');
  const parallel=selectedMode==='parallel'&&!!aligned;
  const edition=parallel?aligned:selectedMode==='vi'&&vietnamese?vietnamese:root;
  if(!edition)return;

  cancelCanonReading();
  const request=new AbortController();
  canonReadingRequest=request;
  const current=()=>target.isConnected&&canonReadingRequest===request;
  const activeMode=parallel?'parallel':edition===vietnamese?'vi':'pli';
  for(const button of workspace.querySelectorAll('[data-action="canon-reading"]')) {
    if(button.hasAttribute('aria-pressed'))button.setAttribute('aria-pressed',String(button.dataset.value===activeMode));
  }
  const modeLabel={pli:'chánh văn Pāli',parallel:'bản đối chiếu Pāli–Anh',vi:'bản tiếng Việt'};
  const status=readerElement('p','meta','Đang tải '+modeLabel[activeMode]+'…');
  status.setAttribute('role','status');
  target.setAttribute('aria-busy','true');
  target.replaceChildren(status);
  try {
    const signal=AbortSignal.any([request.signal,AbortSignal.timeout(18000)]);
    const rows=await fetchCanonReader(id,edition[1],signal,edition[0],edition[3]);
    if(!current())return;
    const segments=activeMode==='vi'?rows.filter(([, ,translation])=>translation.trim()):rows;
    if(!segments.length || (parallel && !rows.some(([, ,translation])=>translation.trim()))) throw new Error('Thiếu bản dịch');
    const sourceName=root?.[2]||root?.[1]||'Nguyên văn Pāli';
    const credit=(activeMode==='vi'?'Bản Việt '+(edition[2]||edition[1]):sourceName+(parallel?' · Bản Anh '+(aligned[2]||aligned[1]):''))+' · Nguồn SuttaCentral';
    target.reading={segments,mode:activeMode,credit,sourceUrl:canonEditionLink(id,edition[0],edition[1])};
    renderCanonReaderPage(target,1);
  } catch {
    if(!current())return;
    const message=readerElement('p','empty','Chưa tải được văn bản từ SuttaCentral.');
    const actions=readerElement('div','buttons');
    const retry=readerElement('button','btn secondary','Thử lại');
    retry.type='button';
    retry.dataset.action='canon-reading';
    retry.dataset.value=activeMode;
    actions.append(retry,canonSourceLink(canonEditionLink(id,edition[0],edition[1])));
    target.replaceChildren(message,actions);
    target.setAttribute('aria-busy','false');
  } finally {
    if(canonReadingRequest===request)canonReadingRequest=undefined;
  }
}
