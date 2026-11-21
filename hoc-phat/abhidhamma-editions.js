'use strict';

const abhiVietnameseLibrary = 'https://saigon.com/anson/uni/';
const abhiVietnamesePdf = 'https://vdpzoom.com/trung/library/';
const abhiEnglishLibrary = 'https://www.abhidhamma.org';
const abhiEnglishPdf = abhiEnglishLibrary+'/wp-content/uploads/';
const abhiTinhSu = 'Hòa thượng Tịnh Sự dịch';
const abhidhammaEditions = {
  'phap-tu': {
    vi:['u-vdp1/vdp1-00.htm',abhiTinhSu,'00 Chủ yếu/Bộ Pháp Tụ.pdf'],
    en:['texts/dhammasangani-en.pdf','Caroline A. F. Rhys Davids','dhammasangani-en'],
  },
  'phan-tich': {
    vi:['u-vdp2/vdp21-00.htm',abhiTinhSu,'00 Chủ yếu/Bộ Phân Tích.pdf'],
    en:['2025/05/Vibhanga_en.pdf','Ashin Thiṭṭhila','vibhanga-en'],
  },
  'chat-ngu': {
    vi:['u-vdp3/vdp3-00.htm',abhiTinhSu,'01 Tiếng Việt/Bộ Chất Ngữ.pdf'],
    en:['2025/05/Dhatukatha_PTS.pdf','U Nārada, với sự hỗ trợ của Thein Nyun','dhatukatha-pts'],
  },
  'nhan-che-dinh': {
    vi:['u-vdp4/vdp4-00.htm',abhiTinhSu,'01 Tiếng Việt/Bộ Nhân Chế Định.pdf'],
    en:['texts/puggalapannatti-en.pdf','Bimala Charan Law','puggalapannatti-en'],
  },
  'ngu-tong': {
    vi:['u-vdp5/vdp5-00.htm','Tâm An và Minh Tuệ dịch từ bản tiếng Anh','00 Chủ yếu/Bộ Ngữ Tông - Minh Tuệ.pdf'],
    en:['2025/05/Kathavatthu_en.pdf','Shwe Zan Aung và Caroline A. F. Rhys Davids','kathavatthu-en'],
  },
  'song-doi': {
    vi:['u-vdp6/vdp61-00.htm',abhiTinhSu,'01 Tiếng Việt/Bộ Song Đối.pdf'],
    en:['2025/05/Yamaka_en.pdf','U Nārada, U Nandamedha và U Kumārābhivaṃsa','yamaka-en'],
  },
  'vi-tri': {
    vi:['u-vdp7/vdp7-00.htm',abhiTinhSu,'00 Chủ yếu/Bộ Vị Trí 1-2.pdf'],
    en:['2025/05/Conditional_Relations_1.pdf','U Nārada · Quyển I','conditional-relations-1'],
    viVolumes:['00 Chủ yếu/Bộ Vị Trí 3-4.pdf','00 Chủ yếu/Bộ Vị Trí 5-6.pdf'],
    next:['2025/05/Conditional_Relations_2.pdf','U Nārada · Quyển II','conditional-relations-2'],
  },
};

// The Vietnamese edition groups the 14 naya into four HTML reading pages.
function chatNguVietnamesePage(id) {
  if (/^dt1\.[1-5]$/.test(id)) return '01';
  const naya=Number(id.match(/^dt2\.(\d+)$/)?.[1]);
  if(naya===1)return '01';
  if(naya>=2&&naya<=6)return '02';
  if(naya>=7&&naya<=12)return '03';
  if(naya>=13&&naya<=14)return '04';
  return null;
}

function abhidhammaEdition(sectionId,id,mode) {
  const sources=Object.hasOwn(abhidhammaEditions,sectionId)?abhidhammaEditions[sectionId]:null;
  if(!sources)return null;
  if(['vi','vi-2','vi-3'].includes(mode)) {
    const [index,credit,pdf]=sources.vi;
    const volumes=[pdf,...(sources.viVolumes||[])];
    const selected=['vi','vi-2','vi-3'].indexOf(mode);
    if(!volumes[selected])return null;
    const page=sectionId==='chat-ngu'?chatNguVietnamesePage(id):null;
    const volumeNames=['Quyển 1–2','Quyển 3–4','Quyển 5–6'];
    return {
      url:abhiVietnamesePdf+encodeURI(volumes[selected]),
      index:abhiVietnameseLibrary+(page?'u-vdp3/vdp3-'+page+'.htm':index),
      credit:credit+' · PDF từ VDP Zoom', title:'Bản dịch tiếng Việt (PDF)',
      scope:'PDF mở theo quyển. Dùng mục lục PDF để tìm chương cần đối chiếu.',
      volumes:volumes.length>1?volumes.map((_,i)=>({mode:i===0?'vi':'vi-'+(i+1),label:volumeNames[i],active:i===selected})):[],
    };
  }
  if(mode!=='en'&&mode!=='en-2')return null;
  const edition=mode==='en-2'?sources.next:sources.en;
  if(!edition)return null;
  const [pdf,credit,page]=edition;
  return {
    url:abhiEnglishPdf+pdf, index:abhiEnglishLibrary+'/book/'+page+'/',
    credit:credit+' · Abhidhamma.org', title:'Bản dịch tiếng Anh (PDF)',
    scope:'PDF mở theo quyển. Dùng mục lục PDF để tìm chương cần đối chiếu.',
    volumes:sources.next?['en','en-2'].map((value,i)=>({mode:value,label:i===0?'Quyển I':'Quyển II',active:mode===value})):[],
  };
}
