'use strict';

const vihara = 'https://budsas.panha.vn/uni/';
const canon = 'https://84000.org/tipitaka/english/';
const dhammatalks = 'https://www.dhammatalks.org/suttas/';
const reference = (title, url, detail, kind = 'Văn bản gốc / bản dịch') => ({title, url, detail, kind});
const chapter = (id, title, pali, desc, contents = [], sources = []) => ({
  id, title, pali, desc, contents, sources,
});
const breath = reference('MN 118 · Kinh Nhập tức Xuất tức niệm', dhammatalks+'MN/MN118.html', 'Ṭhānissaro Bhikkhu dịch tiếng Anh · Ānāpānasati Sutta');
const mindfulness = reference('MN 10 · Kinh Niệm xứ', 'https://origin.dhammatalks.org/suttas/MN/MN10.html', 'Ṭhānissaro Bhikkhu dịch tiếng Anh · Satipaṭṭhāna Sutta');
const tandem = reference('AN 4.170 · Kinh Cặp Đôi', dhammatalks+'AN/AN4_170.html', 'Ṭhānissaro Bhikkhu dịch tiếng Anh · Yuganaddha Sutta');
const aggregates = reference('SN 22.59 · Kinh Vô ngã tướng', dhammatalks+'SN/SN22_59.html', 'Ṭhānissaro Bhikkhu dịch tiếng Anh · Pañca Sutta theo tiêu đề trên nguồn');
const paliEdition = reference('Tam tạng Pāli · Mục lục 45 quyển', canon, 'Ấn bản Thái Lan · Dùng mã văn bản để đối chiếu cách chia quyển giữa các ấn bản');
const vietnameseCanon = reference('Liệt kê Tam tạng và các bản dịch tiếng Việt', 'https://www.budsas.org/uni/1-bai/phap012.htm', 'Bình Anson · BuddhaSasana', 'Thư mục / khảo cứu');
const vinayaIntro = reference('Giới thiệu về Tạng Luật', vihara+'u-luat-ptg/luat-intro.html', 'Tỳ khưu Indacanda · Tổng quan về cấu trúc và thuật ngữ', 'Thư mục / khảo cứu');
const vinayaTranslations = reference('Bản dịch Pāli–Việt của Tỳ khưu Indacanda', 'https://budsas.panha.vn/sach/index.html', 'Danh mục Phân tích giới, Đại Phẩm, Tiểu Phẩm và Tập Yếu');
const abhiIndex = reference('Mục lục Vi diệu pháp', vihara+'u-vdp/vdp-index.html', 'BuddhaSasana · Có tên dịch giả theo từng bộ và mục luận giải riêng', 'Thư mục / khảo cứu');
const patthana = reference('Paṭṭhāna · Bộ Vị Trí', vihara+'u-vdp7/vdp7-00.html', 'Hòa thượng Tịnh Sự dịch · Bản tiếng Việt');
const conditions = reference('Paṭṭhāna · The 24 Conditions', 'https://www.abhidhamma.com/tab_Patthana_24_en.pdf', 'Bảng đối chiếu thuật ngữ Pāli–Anh', 'Thư mục / khảo cứu');

const researchAreas = [
  {
    id:'tang-kinh', title:'Tạng Kinh', pali:'Sutta Piṭaka', icon:'book', group:'Tam tạng',
    desc:'Tra cứu theo bộ, phẩm và mã bài kinh để đối chiếu bản dịch và ghi chú.',
    focus:'Khi lưu một đoạn kinh, ghi mã bài, dịch giả và đoạn hoặc trang theo bản đang dùng.',
    sources:[paliEdition,vietnameseCanon],
    chapters:[
      chapter('truong-bo','Trường Bộ','Dīgha Nikāya · DN','Duyệt theo ba phẩm của Trường Bộ.',
        ['Sīlakkhandhavagga · Phẩm Giới uẩn','Mahāvagga · Đại phẩm','Pāthikavagga · Phẩm Pāthika'],
        [reference('Dīghanikāya · Dẫn nhập và cách dẫn', 'https://suttacentral.net/edition/dn/en/sujato/introduction?lang=en','Bhikkhu Sujato · SuttaCentral','Thư mục / khảo cứu')]),
      chapter('trung-bo','Trung Bộ','Majjhima Nikāya · MN','Duyệt theo ba nhóm năm mươi. Dùng mã MN để chỉ bài cụ thể.',
        ['Mūlapaṇṇāsa · Năm mươi bài đầu','Majjhimapaṇṇāsa · Năm mươi bài giữa','Uparipaṇṇāsa · Năm mươi bài cuối'],
        [reference('Trung Bộ · Mục lục và hướng dẫn đọc','https://budsas.panha.vn/dlpp/bai48/index.html','BuddhaSasana · Có liên kết bản dịch của Hòa thượng Thích Minh Châu','Thư mục / khảo cứu'),mindfulness,breath]),
      chapter('tuong-ung-bo','Tương Ưng Bộ','Saṃyutta Nikāya · SN','Tra cứu theo nhóm chủ đề, rồi theo mã tương ưng và số kinh.',
        ['Sagāthāvagga · Thiên Có Kệ','Nidānavagga · Thiên Nhân Duyên','Khandhavagga · Thiên Uẩn','Saḷāyatanavagga · Thiên Sáu Xứ','Mahāvagga · Đại Thiên'],
        [reference('Tương Ưng Bộ · Giới thiệu và mục lục','https://budsas.org/uni/u-kinh-tuongungbo/tu-00.htm','BuddhaSasana · Mục lục tiếng Việt','Thư mục / khảo cứu'),aggregates]),
      chapter('tang-chi-bo','Tăng Chi Bộ','Aṅguttara Nikāya · AN','Tra cứu theo chương số pháp và mã bài kinh.',
        ['Một Pháp','Hai Pháp','Ba Pháp','Bốn Pháp','Năm Pháp','Sáu Pháp','Bảy Pháp','Tám Pháp','Chín Pháp','Mười Pháp','Mười Một Pháp'],
        [reference('Tăng Chi Bộ · Mục lục tổng quát',vihara+'u-kinh-tangchibo/tangchi00.html','BuddhaSasana · Mục lục tiếng Việt','Thư mục / khảo cứu'),tandem]),
      chapter('tieu-bo','Tiểu Bộ','Khuddaka Nikāya · KN','Các tập nền để bắt đầu tra cứu. Khi gặp khác biệt về phạm vi Tiểu Bộ, ghi rõ truyền thống ấn bản đang dùng.',
        ['Khuddakapāṭha · Tiểu Tụng','Dhammapada · Pháp Cú','Udāna · Phật Tự Thuyết','Itivuttaka · Như Thị Ngữ','Suttanipāta · Kinh Tập','Vimānavatthu · Thiên Cung Sự','Petavatthu · Ngạ Quỷ Sự','Theragāthā · Trưởng Lão Tăng Kệ','Therīgāthā · Trưởng Lão Ni Kệ','Jātaka · Bổn Sinh','Niddesa · Đại Diễn Giải và Tiểu Diễn Giải','Paṭisambhidāmagga · Phân Tích Đạo','Apadāna · Thánh Nhân Ký Sự','Buddhavaṃsa · Phật Sử','Cariyāpiṭaka · Hạnh Tạng'],
        [vietnameseCanon,paliEdition]),
    ],
  },
  {
    id:'tang-luat', title:'Tạng Luật', pali:'Vinaya Piṭaka', icon:'file', group:'Tam tạng',
    desc:'Tra cứu điều học, bối cảnh chế định, quy định và thủ tục của Tăng đoàn.',
    focus:'Phân biệt lời văn điều học, duyên khởi, phần giải thích và cách áp dụng được nguồn mô tả.',
    sources:[vinayaIntro,vinayaTranslations,paliEdition],
    chapters:[
      chapter('phan-tich-gioi','Phân tích giới bổn','Suttavibhaṅga','Tra cứu phần phân tích điều học của tỳ-khưu và tỳ-khưu-ni.',
        ['Bhikkhuvibhaṅga · Phân tích giới Tỳ-khưu','Bhikkhunīvibhaṅga · Phân tích giới Tỳ-khưu-ni'],
        [vinayaIntro,vinayaTranslations]),
      chapter('hop-phan','Hợp phần','Khandhaka','Theo dõi các chương về sinh hoạt và thủ tục của Tăng đoàn.',
        ['Mahāvagga · Đại Phẩm','Cullavagga · Tiểu Phẩm'],[vinayaIntro,vinayaTranslations]),
      chapter('tap-yeu','Tập Yếu','Parivāra','Tổng hợp điều học và các nhóm chủ đề trong Luật.',
        ['Phân loại điều học','Câu hỏi và bảng tổng hợp'],
        [vinayaTranslations,reference('Parivāra · Dẫn nhập','https://suttacentral.net/edition/pli-tv-vi/en/brahmali/pvr-introduction','Bhikkhu Brahmali · SuttaCentral','Thư mục / khảo cứu')]),
    ],
  },
  {
    id:'vi-dieu-phap', title:'Tạng Vi diệu pháp', pali:'Abhidhamma Piṭaka', icon:'layers', group:'Tam tạng',
    desc:'Tra cứu bảy bộ và theo dõi cách dịch thuật ngữ Pāli sang tiếng Việt, tiếng Anh.',
    focus:'Ghi riêng tên nguyên bản, bản dịch và luận giải. Với bản tiếng Việt, đối chiếu tên dịch giả từng bộ.',
    sources:[abhiIndex,conditions],
    chapters:[
      chapter('phap-tu','Bộ Pháp Tụ','Dhammasaṅgaṇī','Khảo sát các nhóm pháp và cách phân loại trong bộ.',
        ['Mẫu đề','Chương Tâm','Chương Sắc','Các phần toát yếu và trích yếu'],[reference('Bộ Pháp Tụ · Mục lục',vihara+'u-vdp1/vdp1-00.html','Hòa thượng Tịnh Sự dịch')]),
      chapter('phan-tich','Bộ Phân Tích','Vibhaṅga','Đối chiếu các chương phân tích theo chủ đề.',
        ['Uẩn','Xứ','Giới','Các chương phân tích tiếp theo'],[reference('Bộ Phân Tích · Mục lục',vihara+'u-vdp2/vdp21-00.html','Hòa thượng Tịnh Sự dịch')]),
      chapter('chat-ngu','Bộ Chất Ngữ','Dhātukathā','Theo dõi các câu hỏi về quan hệ giữa uẩn, xứ và giới.',
        ['Giới · dhātu','Các nhóm câu hỏi đối chiếu'],[reference('Bộ Chất Ngữ · Mục lục',vihara+'u-vdp3/vdp3-00.html','Hòa thượng Tịnh Sự dịch')]),
      chapter('nhan-che-dinh','Bộ Nhân Chế Định','Puggalapaññatti','Tra cứu cách phân loại các hạng người.',
        ['Các nhóm theo số','Thuật ngữ chế định'],[reference('Bộ Nhân Chế Định · Mục lục',vihara+'u-vdp4/vdp4-00.html','Hòa thượng Tịnh Sự dịch')]),
      chapter('ngu-tong','Bộ Ngữ Tông','Kathāvatthu','Theo dõi vấn đề tranh luận, lập luận và cách dịch các thuật ngữ.',
        ['Các luận đề','Bảng đối chiếu câu hỏi – đáp'],[reference('Bộ Ngữ Tông · Mục lục',vihara+'u-vdp5/vdp5-00.html','Tâm An và Minh Tuệ dịch từ bản Anh ngữ, theo mục lục BuddhaSasana')]),
      chapter('song-doi','Bộ Song Đối','Yamaka','Đọc cấu trúc các cặp câu hỏi và kiểm tra phạm vi thuật ngữ.',
        ['Các cặp về căn','Các cặp về uẩn','Các cặp về xứ và giới'],[reference('Bộ Song Đối · Mục lục',vihara+'u-vdp6/vdp61-00.html','Hòa thượng Tịnh Sự dịch')]),
      chapter('vi-tri','Bộ Vị Trí','Paṭṭhāna','Đối chiếu 24 duyên và cách chuyển dịch thuật ngữ trong bản Việt.',
        ['Danh mục 24 duyên','Đối chiếu Pāli–Việt–Anh','Ghi chú công trình phiên dịch của Trưởng lão Tịnh Sự'],[patthana,conditions]),
    ],
    extra:[reference('Thắng Pháp Tập Yếu Luận · Mục luận giải',vihara+'u-vdp/vdp-index.html','Abhidhammatthasaṅgaha · Xem phần luận giải để chọn bản dịch','Chú giải / luận giải')],
  },
  {
    id:'thien-chi', title:'Thiền chỉ', pali:'Samatha', icon:'leaf', group:'Thiền',
    desc:'Tập hợp kinh văn, khảo cứu và ghi chép thực hành về sự an tĩnh, đề mục và định.',
    focus:'Khi ghi chép, nêu đề mục, nguồn hoặc lời hướng dẫn và điều đã quan sát trong buổi thực hành.',
    sources:[breath,tandem],
    chapters:[
      chapter('de-muc','Đề mục thực hành','Kammaṭṭhāna','Bắt đầu với hơi thở khi đọc MN 118. Ghi nguồn riêng cho từng đề mục hoặc cách hướng dẫn.',
        ['Hơi thở','Đề mục khác theo tài liệu hoặc người hướng dẫn'],[breath]),
      chapter('trien-cai','Năm triền cái','Nīvaraṇa','Đọc đoạn về triền cái và lưu câu hỏi về cách nhận diện từng trạng thái.',
        ['Tham dục','Sân','Hôn trầm–thụy miên','Trạo cử–hối quá','Nghi'],[mindfulness]),
      chapter('dinh','Định và các tầng thiền','Samādhi · Jhāna','So sánh cách mô tả trong kinh, luận giải và tài liệu hướng dẫn theo từng truyền thống.',
        ['Thuật ngữ về định','Các tầng thiền trong nguồn đang đọc'],[reference('Trung Bộ · Các bài đọc về thiền',dhammatalks+'MN/MN_syllabus.html','Thư mục đọc theo chủ đề · Xem nhóm Meditation 2','Thư mục / khảo cứu')]),
      chapter('chi-quan','Quan hệ giữa chỉ và quán','Samatha–vipassanā','Dùng AN 4.170 làm điểm đọc chung cho cả hai mảng thiền.',
        ['Các trình tự được trình bày trong kinh','Cách diễn giải của từng nguồn'],[tandem]),
    ],
  },
  {
    id:'thien-quan', title:'Thiền quán', pali:'Vipassanā', icon:'leaf', group:'Thiền',
    desc:'Tập hợp kinh văn, khảo cứu và ghi chép thực hành về niệm xứ và tuệ quán.',
    focus:'Khi ghi chép, tách điều quan sát được, phần diễn giải và câu hỏi muốn hỏi người hướng dẫn.',
    sources:[mindfulness,aggregates,tandem],
    chapters:[
      chapter('niem-xu','Bốn niệm xứ','Satipaṭṭhāna','Theo dõi các phần quán trong MN 10 và ghi vị trí đoạn đang nghiên cứu.',
        ['Thân','Thọ','Tâm','Pháp'],[mindfulness]),
      chapter('ngu-uan','Năm uẩn và ba đặc tướng','Khandha · Tilakkhaṇa','Đối chiếu ngữ cảnh về vô thường, khổ và vô ngã trong nguồn đang đọc.',
        ['Sắc, thọ, tưởng, hành, thức','Vô thường, khổ, vô ngã'],[aggregates]),
      chapter('phuong-phap','Phương pháp và truyền thống','Vipassanā','Ghi từng nguồn theo thiền sư, truyền thống, thuật ngữ và bối cảnh hướng dẫn.',
        ['Tài liệu hướng dẫn','Khảo cứu so sánh','Ghi nhận cá nhân'],[mindfulness,tandem]),
      chapter('chi-quan','Quan hệ giữa quán và chỉ','Vipassanā–samatha','Đối chiếu cách các nguồn diễn giải AN 4.170.',
        ['Các trình tự được trình bày trong kinh','Câu hỏi thảo luận'],[tandem]),
    ],
  },
];

const researchTabsByArea = (area,section) => [
  ...(canonSection(area,section)?[{id:'van-ban',label:'Văn bản'}]:[]),
  {id:'muc-luc',label:area.group === 'Thiền' ? 'Chủ đề' : 'Mục lục'},
  {id:'tai-lieu',label:'Tài liệu'},
  {id:'nhat-ky',label:area.group === 'Thiền' ? 'Nhật ký thực hành' : 'Ghi chú nghiên cứu'},
];
