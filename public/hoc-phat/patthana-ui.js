/* Paṭṭhāna – 24 interactive lessons; keeps progress separate from other Học Phật records. */
const ptProgressKey = "pochacco-library:hoc-phat:patthana:v1";
const ptView = {tab:"vi",query:""};
function ptProgress() {
  try {
    const raw=JSON.parse(localStorage.getItem(ptProgressKey)||"[]");
    return Array.isArray(raw)?raw.filter(id=>ptLessons.some(item=>item.id===id)):[];
  } catch { return []; }
}
function ptHref(id) {return "#/24-duyen?bai="+encodeURIComponent(id);}
function ptSourceLink(item) {
  return '<a href="'+esc(item.url)+'" target="_blank" rel="noopener noreferrer">'+esc(item.label)+' ↗</a>';
}
function ptList(active) {
  const q=normalize(ptView.query.trim()), done=new Set(ptProgress());
  const entries=ptLessons.filter(l=>!q||normalize([l.vi,l.pali,l.en,l.explain,String(l.number),...l.terms].join(" ")).includes(q));
  const html=entries.map(l=>
    '<a href="'+ptHref(l.id)+'" class="pt-entry'+(l.id===active?" selected":"")+'"'+(l.id===active?' aria-current="page"':'')+'>'+
      '<span class="pt-number">'+String(l.number).padStart(2,"0")+'</span>'+
      '<span class="pt-entry-label"><strong>'+esc(l.vi)+'</strong><small>'+esc(l.pali)+'</small></span>'+
      (done.has(l.id)?'<span aria-label="Đã học" class="pt-complete-symbol">✓</span>':'')+
    '</a>').join("");
  return {count:entries.length,html:html||'<p class="empty">Không tìm thấy duyên phù hợp.</p>'};
}
function ptLanguageTabs() {
  const tabs=[["vi","Tiếng Việt"],["pali","Pāḷi"],["en","English"],["tinh-su","Bản dịch Tịnh Sự"]];
  return '<div class="tabs pt-tabs" role="group" aria-label="Chọn văn bản đối chiếu">'+
   tabs.map(([id,label])=>'<button type="button" class="tab" aria-pressed="'+(ptView.tab===id)+'" data-action="pt-tab" data-value="'+id+'">'+label+'</button>').join("")+
   '</div>';
}
function ptLanguageContent(l) {
  if(ptView.tab==="pali") return '<div class="pt-text-source"><p class="kicker">PACCAYANIDDESA · CÂU PĀḶI TIÊU BIỂU</p>'+
    '<blockquote lang="pi" class="pt-pali">'+esc(l.paliText)+'</blockquote>'+
    '<p class="pt-source-note">Một đoạn tiêu biểu để học thuật ngữ, không phải toàn bộ nguyên văn của duyên này. Xin đối chiếu văn bản Pāḷi chuẩn trước khi trích dẫn nghiên cứu.</p></div>';
  if(ptView.tab==="en") return '<div class="pt-text-source" lang="en"><p class="kicker">ENGLISH · STUDY TRANSLATION</p>'+
    '<p class="pt-translation">'+esc(l.enText)+'</p><p class="pt-source-note">Editorial study translation; not quoted from another English edition.</p></div>';
  if(ptView.tab==="tinh-su") return '<div class="pt-text-source"><p class="kicker">NGUỒN DỊCH THUẬT · TRƯỞNG LÃO TỊNH SỰ</p>'+
    '<p>Đối chiếu mục <strong>'+esc(l.pali)+'</strong> trong <em>24 Duyên Tổng Thuyết</em>. Bản dịch lịch sử được giữ ở nguồn gốc, không sao chép toàn văn lên trang.</p>'+
    '<p class="pt-source-note">Phần dịch nghĩa trong tab Tiếng Việt là bản biên soạn mới, không phải trích dẫn nguyên văn lời dịch của Trưởng lão.</p>'+
    '<div class="pt-source-links">'+ptSourceLink(ptSourceLinks[0])+'</div></div>';
  return '<div class="pt-text-source"><p class="kicker">VIỆT DỊCH DIỄN NGHĨA · BIÊN SOẠN MỚI</p>'+
    '<p class="pt-translation">'+esc(l.viText)+'</p>'+
    '<p class="pt-source-note">Để nghiên cứu cách dịch thuật ngữ của Trưởng lão Tịnh Sự, mở tab “Bản dịch Tịnh Sự” để đối chiếu tài liệu nguồn.</p></div>';
}
function ptRelation(l) {
 return '<div class="pt-relationship" role="img" aria-label="'+esc("Sơ đồ: "+l.from+" trợ duyên cho "+l.to+" bằng "+l.vi)+'">'+
   '<div class="pt-node"><small>PHÁP NĂNG DUYÊN</small><strong>'+esc(l.from)+'</strong></div>'+
   '<div class="pt-relation-arrow"><span aria-hidden="true">↓</span><small>'+esc(l.vi)+'</small></div>'+
   '<div class="pt-node"><small>PHÁP SỞ DUYÊN</small><strong>'+esc(l.to)+'</strong></div></div>';
}
function ptLesson(l) {
  const idx=l.number-1,prev=ptLessons[idx-1],next=ptLessons[idx+1],done=ptProgress().includes(l.id);
  return '<article class="pt-lesson">'+
    '<header class="pt-lesson-head"><p class="kicker">BÀI '+String(l.number).padStart(2,"0")+' / 24 · '+esc(ptGroups[l.group])+'</p>'+
    '<h1>'+esc(l.vi)+'</h1><p class="pt-pali-title" lang="pi">'+esc(l.pali)+'</p>'+
    '<p class="pt-lead">'+esc(l.explain)+'</p>'+
    '<button type="button" data-action="pt-complete" data-value="'+esc(l.id)+'" class="btn '+(done?"secondary":"")+'" aria-pressed="'+done+'">'+
    (done?"✓ Đã học · Bỏ đánh dấu":"✓ Đánh dấu đã học")+'</button></header>'+
    '<section class="panel pt-section"><h2>1. Nguyên văn và dịch thuật</h2><p class="muted">Câu Pāḷi tiêu biểu, Việt dịch diễn nghĩa, English và liên kết đối chiếu bản dịch Tịnh Sự.</p>'+
    ptLanguageTabs()+'<div id="pt-language-content">'+ptLanguageContent(l)+'</div></section>'+
    '<section class="panel pt-section"><h2>2. Giải thích thuật ngữ</h2><ul class="pt-term-list">'+l.terms.map(t=>'<li>'+esc(t)+'</li>').join("")+'</ul></section>'+
    '<section class="panel pt-section"><h2>3. Quan hệ trợ duyên và sơ đồ</h2>'+
    '<dl class="pt-analysis"><div><dt>Pháp năng duyên</dt><dd>'+esc(l.from)+'</dd></div>'+
    '<div><dt>Pháp sở duyên</dt><dd>'+esc(l.to)+'</dd></div>'+
    '<div><dt>Cách trợ giúp</dt><dd>'+esc(l.mechanism)+'</dd></div></dl>'+
    ptRelation(l)+'<div class="pt-ref"><h3>Những dạng hoặc phạm vi cần nhớ</h3><ul>'+l.kinds.map(t=>'<li>'+esc(t)+'</li>').join("")+'</ul></div></section>'+
    '<section class="panel pt-section"><h2>4. Ví dụ thực tiễn</h2><p>'+esc(l.example)+'</p>'+
    '<div class="pt-note"><strong>Giới hạn của ví dụ:</strong> '+esc(l.care)+'</div></section>'+
    '<section class="panel pt-section"><h2>5. Phân biệt các duyên</h2><p>'+esc(l.compare)+'</p>'+
    '<details class="pt-review"><summary>Tự kiểm tra: Pháp năng duyên của bài này là gì?</summary><p>'+esc(l.from)+'. Cần xét thêm thời điểm và phạm vi trợ giúp cụ thể.</p></details></section>'+
    '<section class="panel pt-section"><h2>6. Tư liệu và phương pháp đối chiếu</h2>'+
    '<p class="muted">Phân biệt nguyên văn Pāḷi, bản dịch lịch sử và phần chú giải biên soạn mới. Sơ đồ khái quát không thay thế bảng liệt kê chi pháp trong Paṭṭhāna. Đọc nguồn gốc trước khi trích dẫn học thuật.</p>'+
    '<div class="pt-source-links">'+ptSourceLinks.map(ptSourceLink).join("")+'</div></section>'+
    '<nav class="pt-next" aria-label="Chuyển bài">'+
    (prev?'<a class="btn secondary" href="'+ptHref(prev.id)+'">← '+esc(prev.vi)+'</a>':'<span></span>')+
    (next?'<a class="btn" href="'+ptHref(next.id)+'">'+esc(next.vi)+' →</a>':'<a class="btn" href="#/24-duyen">Quay về đầu lộ trình</a>')+'</nav>'+
    '</article>';
}
function renderPatthanaPage(id) {
  const current=ptLessons.find(l=>l.id===id)||ptLessons[0],finished=ptProgress().length,list=ptList(current.id);
  return '<div class="page-head"><p class="kicker">TAM TẠNG · LUẬN TẠNG · BỘ VỊ TRÍ</p>'+
    '<h1>24 duyên trong Paṭṭhāna</h1>'+
    '<p>Lộ trình chuyên sâu gồm 24 bài, theo hệ thống Pāḷi và cách gọi Việt ngữ được dùng trong công trình của Trưởng lão Tịnh Sự.</p></div>'+
    '<section class="pt-summary card" aria-label="Tiến độ 24 bài"><div><strong>'+finished+' / 24</strong> bài đã học</div>'+
    '<div class="progress" role="progressbar" aria-label="Tiến độ 24 bài" aria-valuemin="0" aria-valuemax="24" aria-valuenow="'+finished+'"><span style="width:'+(finished/24*100)+'%"></span></div></section>'+
    '<div class="pt-layout"><aside class="card pt-aside" aria-label="Danh mục 24 bài"><h2>Danh mục 24 duyên</h2>'+
    '<label class="pt-search-label" for="pt-search">Tìm theo thuật ngữ Pāḷi hoặc tiếng Việt</label>'+
    '<input id="pt-search" type="search" autocomplete="off" placeholder="Ví dụ: Cận y, upanissaya..." value="'+esc(ptView.query)+'">'+
    '<p id="pt-match-count" class="meta" aria-live="polite">'+list.count+' / 24 duyên</p>'+
    '<nav id="pt-lesson-list" aria-label="Chọn bài 24 duyên">'+list.html+'</nav></aside>'+
    ptLesson(current)+'</div>';
}
function ptClick(action,value) {
  if(action==="pt-tab"){
    if(!["vi","pali","en","tinh-su"].includes(value))return;
    ptView.tab=value;
    document.querySelectorAll(".pt-tabs [data-action=pt-tab]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.value===value)));
    const l=ptLessons.find(x=>x.id===route().id)||ptLessons[0],target=document.querySelector("#pt-language-content");
    if(target)target.innerHTML=ptLanguageContent(l);
  }
  if(action==="pt-complete"){
    if(!ptLessons.some(l=>l.id===value))return;
    const done=new Set(ptProgress());
    if(done.has(value))done.delete(value);else done.add(value);
    try{localStorage.setItem(ptProgressKey,JSON.stringify([...done]));}catch{notify("Trình duyệt chưa cho lưu tiến độ.");return;}
    render();
  }
}
function ptSearch(query){
  ptView.query=query;
  const list=ptList(route().id),target=document.querySelector("#pt-lesson-list"),count=document.querySelector("#pt-match-count");
  if(target)target.innerHTML=list.html;
  if(count)count.textContent=list.count+" / 24 duyên";
}
