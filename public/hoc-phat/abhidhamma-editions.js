'use strict';

const abhiVietnameseLibrary = 'https://saigon.com/anson/uni/';
const abhiEnglishLibrary = 'https://www.abhidhamma.org';
const abhiEnglishPdf = abhiEnglishLibrary+'/wp-content/uploads/';
const abhiTinhSu = 'Hòa thượng Tịnh Sự dịch';
const abhidhammaEditions = {
  'phap-tu': {
    vi:['u-vdp1/vdp1-00.htm',abhiTinhSu],
    en:['texts/dhammasangani-en.pdf','Caroline A. F. Rhys Davids','dhammasangani-en'],
  },
  'phan-tich': {
    vi:['u-vdp2/vdp21-00.htm',abhiTinhSu],
    en:['2025/05/Vibhanga_en.pdf','Ashin Thiṭṭhila','vibhanga-en'],
  },
  'chat-ngu': {
    vi:['u-vdp3/vdp3-00.htm',abhiTinhSu],
    en:['2025/05/Dhatukatha_PTS.pdf','U Nārada, với sự hỗ trợ của Thein Nyun','dhatukatha-pts'],
  },
  'nhan-che-dinh': {
    vi:['u-vdp4/vdp4-00.htm',abhiTinhSu],
    en:['texts/puggalapannatti-en.pdf','Bimala Charan Law','puggalapannatti-en'],
  },
  'ngu-tong': {
    vi:['u-vdp5/vdp5-00.htm','Tâm An và Minh Tuệ dịch từ bản tiếng Anh'],
    en:['2025/05/Kathavatthu_en.pdf','Shwe Zan Aung và Caroline A. F. Rhys Davids','kathavatthu-en'],
  },
  'song-doi': {
    vi:['u-vdp6/vdp61-00.htm',abhiTinhSu],
    en:['2025/05/Yamaka_en.pdf','U Nārada, U Nandamedha và U Kumārābhivaṃsa','yamaka-en'],
  },
  'vi-tri': {
    vi:['u-vdp7/vdp7-00.htm',abhiTinhSu],
    en:['2025/05/Conditional_Relations_1.pdf','U Nārada · Quyển I','conditional-relations-1'],
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
  if(mode==='vi') {
    const [index,credit]=sources.vi;
    const page=sectionId==='chat-ngu'?chatNguVietnamesePage(id):null;
    return {
      url:abhiVietnameseLibrary+(page?'u-vdp3/vdp3-'+page+'.htm':index), index:abhiVietnameseLibrary+index,
      credit:credit+' · BuddhaSasana', title:'Bản dịch tiếng Việt',
      scope:page?'Bản Việt gộp nhiều mục Pāli trong một trang.':'Bản Việt mở ở mục lục của bộ. Chọn chương ngay trong khung đọc.',
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
    mode:mode==='en-2'?'en':'en-2', volume:sources.next?(mode==='en-2'?'Quyển I':'Quyển II'):null,
  };
}
