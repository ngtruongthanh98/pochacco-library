/* Bộ 24 bài học Paṭṭhāna – chú giải biên soạn mới, không phải nguyên văn dịch Tịnh Sự.
   Pāli: trích một câu tiêu biểu mỗi duyên từ Paccayaniddesa; đọc toàn văn tại nguồn.
   Tham khảo: https://sachphatphap.vn/24-duyen-tong-thuyet
   Đối chiếu: https://www.palikanon.com/english/sangaha/chapter_8.htm
*/
const ptGroups = [
  "Căn gốc, cảnh và tiếp nối",
  "Cùng sinh, nương tựa và thứ tự",
  "Nghiệp, quả và những chức năng",
  "Danh–sắc, hiện hữu và diệt"
];
const ptSourceLinks = [
 {label:"24 Duyên Tổng Thuyết · bản dịch Trưởng lão Tịnh Sự",url:"https://sachphatphap.vn/24-duyen-tong-thuyet"},
 {label:"Bản giải Siêu lý Cao học · Trưởng lão Tịnh Sự",url:"https://phatgiaonguyenthuy.com/article/abhidhamma/ban-giai-sieu-ly-cao-hoc.html"},
 {label:"Abhidhammattha Saṅgaha · chương duyên hệ",url:"https://www.palikanon.com/english/sangaha/chapter_8.htm"}
];
const ptLessons = [
  {
    "id": "hetu",
    "vi": "Nhân duyên",
    "pali": "Hetu-paccaya",
    "en": "Root condition",
    "group": 0,
    "paliText": "Hetū hetusampayuttakānaṃ dhammānaṃ taṃsamuṭṭhānānañca rūpānaṃ hetupaccayena paccayo.",
    "viText": "Những căn tâm làm điều kiện cho các pháp tương ưng với chúng và cho sắc do những pháp ấy làm phát sinh.",
    "enText": "Mental roots condition their associated states and the matter produced by those states.",
    "explain": "Nhân duyên chỉ sáu căn gốc: tham, sân, si, vô tham, vô sân, vô si. Đây không phải khái niệm «nguyên nhân» theo nghĩa bao quát.",
    "terms": [
      "hetu: căn gốc của tâm",
      "hetusampayutta: pháp tương ưng với nhân",
      "taṃsamuṭṭhāna-rūpa: sắc được sinh từ pháp ấy"
    ],
    "from": "Sáu căn tâm (hetu)",
    "to": "Danh pháp tương ưng và sắc do chúng sinh",
    "mechanism": "Căn gốc làm chỗ bám và hỗ trợ tính chất của các pháp đồng sinh.",
    "example": "Khi tâm từ bi có mặt, vô sân là căn thiện trợ các tâm sở tương ưng.",
    "care": "Không đồng nhất Nhân duyên với mọi loại nguyên nhân; tâm vô nhân không có Nhân duyên.",
    "compare": "Phân biệt Nghiệp duyên (13): nghiệp chú trọng tác ý (cetanā), không phải sáu căn.",
    "kinds": [
      "Ba căn bất thiện: tham, sân, si",
      "Ba căn thiện/tịnh hảo: vô tham, vô sân, vô si"
    ]
  },
  {
    "id": "arammana",
    "vi": "Cảnh duyên",
    "pali": "Ārammaṇa-paccaya",
    "en": "Object condition",
    "group": 0,
    "paliText": "Rūpāyatanaṃ cakkhuviññāṇadhātuyā taṃsampayuttakānañca dhammānaṃ ārammaṇapaccayena paccayo.",
    "viText": "Sắc được thấy làm điều kiện đối tượng cho nhãn thức và các tâm sở tương ưng của nhãn thức ấy.",
    "enText": "Visible form serves as the object condition for eye-consciousness and its associated factors.",
    "explain": "Tâm luôn biết một cảnh. Cảnh có thể là sắc, thanh, hương, vị, xúc, pháp; đối tượng của ý thức còn có thể là ký ức hoặc khái niệm.",
    "terms": [
      "ārammaṇa: cảnh/đối tượng được biết",
      "rūpāyatana: sắc xứ",
      "cakkhuviññāṇa: nhãn thức"
    ],
    "from": "Cảnh (thí dụ: sắc xứ)",
    "to": "Tâm biết cảnh và tâm sở tương ưng",
    "mechanism": "Đối tượng cung cấp cái được nhận biết cho sát-na tâm tương ứng.",
    "example": "Nhìn bìa sách: sắc của bìa là cảnh duyên cho nhãn thức; ý nghĩ về sách là cảnh của ý thức.",
    "care": "Cảnh duyên không nhất thiết là vật bên ngoài và không tự nó quyết định tâm thiện hay bất thiện.",
    "compare": "Trưởng duyên (3) có loại cảnh trưởng: cảnh được xem trọng đặc biệt.",
    "kinds": [
      "Cảnh của năm giác quan",
      "Cảnh pháp của ý thức"
    ]
  },
  {
    "id": "adhipati",
    "vi": "Trưởng duyên",
    "pali": "Adhipati-paccaya",
    "en": "Predominance condition",
    "group": 0,
    "paliText": "Chandādhipati chandasampayuttakānaṃ dhammānaṃ taṃsamuṭṭhānānañca rūpānaṃ adhipatipaccayena paccayo.",
    "viText": "Dục trưởng làm điều kiện nổi trội cho các pháp tương ưng và những sắc do chúng phát sinh.",
    "enText": "Predominant desire-to-act conditions its associated states and the matter arising from them.",
    "explain": "Một pháp giữ vai trò chủ đạo trong nhóm pháp đồng sinh, hoặc một cảnh được đặc biệt coi trọng, có thể là Trưởng duyên.",
    "terms": [
      "adhipati: ưu thắng/chủ đạo",
      "chanda: dục, ý muốn làm",
      "vīriya: cần, tinh tấn",
      "vīmaṃsā: thẩm, sự khảo xét"
    ],
    "from": "Một yếu tố chủ đạo hoặc cảnh được coi trọng",
    "to": "Các pháp nhận sự chi phối nổi trội",
    "mechanism": "Sức trội làm cho đối tượng hoặc yếu tố ấy có vai trò chi phối.",
    "example": "Khi nghiên cứu giáo pháp, sự khảo xét có thể giữ vai trò thẩm trưởng trong tâm phù hợp.",
    "care": "Không phải bất cứ mong muốn mạnh nào cũng là câu sanh trưởng duyên; phải xét đúng loại tâm.",
    "compare": "Quyền duyên (16) là chức năng chủ quản đặc thù, không đồng nghĩa với vai trò trưởng.",
    "kinds": [
      "Cảnh trưởng (ārammaṇādhipati)",
      "Câu sanh trưởng: dục, cần, tâm, thẩm"
    ]
  },
  {
    "id": "anantara",
    "vi": "Vô gián duyên",
    "pali": "Anantara-paccaya",
    "en": "Contiguity condition",
    "group": 0,
    "paliText": "Cakkhuviññāṇadhātu taṃsampayuttakā ca dhammā manodhātuyā taṃsampayuttakānañca dhammānaṃ anantarapaccayena paccayo.",
    "viText": "Nhãn thức và các tâm sở tương ưng, khi đã diệt, làm điều kiện cho ý giới và các tâm sở tiếp theo.",
    "enText": "Eye-consciousness and its factors condition the immediately succeeding mind element and factors.",
    "explain": "Tâm và tâm sở vừa diệt trợ cho sát-na tâm tiếp theo mà không có sát-na tâm khác xen giữa.",
    "terms": [
      "anantara: không có khoảng cách chen vào",
      "citta: tâm",
      "cetasika: tâm sở"
    ],
    "from": "Sát-na tâm A vừa diệt",
    "to": "Sát-na tâm B kế tiếp",
    "mechanism": "Mở đường cho dòng tâm tiếp nối tức thời.",
    "example": "Trong lộ trình thấy, nhãn thức diệt rồi các sát-na tâm tiếp theo sinh đúng tiến trình.",
    "care": "Không có một cái tâm thường tồn di chuyển từ A sang B; đó là các pháp sinh diệt.",
    "compare": "Đẳng vô gián (5), Vô hữu (22) và Ly khứ (23) xét chính dòng tâm kế tiếp ở khía cạnh khác.",
    "kinds": [
      "Tâm trước → tâm sau trong lộ trình tâm"
    ]
  },
  {
    "id": "samanantara",
    "vi": "Đẳng vô gián duyên",
    "pali": "Samanantara-paccaya",
    "en": "Immediate succession condition",
    "group": 0,
    "paliText": "Cakkhuviññāṇadhātu taṃsampayuttakā ca dhammā manodhātuyā taṃsampayuttakānañca dhammānaṃ samanantarapaccayena paccayo.",
    "viText": "Nhãn thức vừa diệt trợ cho ý giới kế tiếp theo sự tiếp nối đúng thứ lớp.",
    "enText": "The just-ceased eye-consciousness conditions the ordered immediate succession of the next mind element.",
    "explain": "Cũng là sự liên tục của các sát-na danh pháp; tên gọi nhấn mạnh tính kế tiếp có thứ tự.",
    "terms": [
      "samanantara: liền kề, tiếp nối đúng thứ lớp",
      "manodhātu: ý giới"
    ],
    "from": "Danh pháp vừa diệt",
    "to": "Danh pháp sinh kế tiếp theo thứ lớp",
    "mechanism": "Bảo đảm trật tự kế tiếp của các sát-na tâm trong tiến trình.",
    "example": "Sau nhãn thức, tâm tiếp theo không xuất hiện tùy tiện mà theo thứ lớp của lộ trình.",
    "care": "Không hiểu là đồng thời: tâm trước phải diệt rồi tâm sau mới sinh.",
    "compare": "Cùng phạm vi cốt lõi với Vô gián duyên (4), khác trọng tâm diễn đạt.",
    "kinds": [
      "Liên tiếp duyên: cách dịch thuật ngữ khác trong một số tài liệu"
    ]
  },
  {
    "id": "sahajata",
    "vi": "Câu sanh duyên",
    "pali": "Sahajāta-paccaya",
    "en": "Co-nascence condition",
    "group": 1,
    "paliText": "Cattāro khandhā arūpino aññamaññaṃ sahajātapaccayena paccayo.",
    "viText": "Bốn uẩn phi sắc làm điều kiện cho nhau vì cùng sinh khởi.",
    "enText": "The four immaterial aggregates condition one another by arising together.",
    "explain": "Những pháp sinh cùng một thời điểm trợ nhau; bao gồm quan hệ giữa tâm và tâm sở, tứ đại chủng và một số quan hệ danh–sắc.",
    "terms": [
      "saha: cùng",
      "jāta: sinh khởi",
      "arūpino khandhā: các uẩn phi sắc"
    ],
    "from": "Danh pháp/sắc pháp đồng sinh",
    "to": "Pháp liên hệ sinh cùng sát-na",
    "mechanism": "Đồng sinh trở thành một phương thức nâng đỡ, không đòi hỏi cái trước tạo cái sau.",
    "example": "Một sát-na tâm thiện và các tâm sở xúc, thọ, tưởng, tư cùng sinh khởi.",
    "care": "Không phải mọi cặp pháp cùng sinh đều có quan hệ hỗ tương hai chiều.",
    "compare": "Hỗ tương duyên (7) nhấn mạnh giúp đỡ qua lại; Câu sanh nhấn mạnh thời điểm đồng sinh.",
    "kinds": [
      "Danh–danh đồng sinh",
      "Sắc–sắc đồng sinh",
      "Danh–sắc đồng sinh trong trường hợp thích hợp"
    ]
  },
  {
    "id": "annamanna",
    "vi": "Hỗ tương duyên",
    "pali": "Aññamañña-paccaya",
    "en": "Mutuality condition",
    "group": 1,
    "paliText": "Cattāro mahābhūtā aññamaññapaccayena paccayo.",
    "viText": "Bốn đại chủng làm điều kiện nâng đỡ qua lại cho nhau.",
    "enText": "The four great elements mutually condition one another.",
    "explain": "Hai hay nhiều pháp làm điều kiện cho nhau theo cả hai chiều, trong các trường hợp được luận nêu.",
    "terms": [
      "aññamañña: lẫn nhau",
      "mahābhūta: bốn đại chủng"
    ],
    "from": "Pháp A ↔ pháp B",
    "to": "Mỗi pháp vừa trợ vừa được trợ",
    "mechanism": "Tác động hỗ tương trong một nhóm pháp có quan hệ xác định.",
    "example": "Địa, thủy, hỏa, phong trong cùng một nhóm sắc nương nhau.",
    "care": "Không suy rộng thành mọi sự vật trong thế giới đều hỗ tương theo nghĩa kỹ thuật của duyên này.",
    "compare": "Câu sanh (6) có phạm vi rộng hơn; không phải mọi đồng sinh đều hỗ tương.",
    "kinds": [
      "Bốn danh uẩn",
      "Bốn đại chủng",
      "Danh–sắc lúc tái tục (theo trường hợp của luận)"
    ]
  },
  {
    "id": "nissaya",
    "vi": "Y chỉ duyên",
    "pali": "Nissaya-paccaya",
    "en": "Dependence condition",
    "group": 1,
    "paliText": "Cakkhāyatanaṃ cakkhuviññāṇadhātuyā taṃsampayuttakānañca dhammānaṃ nissayapaccayena paccayo.",
    "viText": "Nhãn xứ làm chỗ nương cho nhãn thức và các pháp tương ưng với nhãn thức.",
    "enText": "The eye-base is a supporting basis for eye-consciousness and its associated states.",
    "explain": "Một pháp là nền/chỗ nương cho pháp khác. Có câu sanh y chỉ và tiền sanh y chỉ tùy mối quan hệ.",
    "terms": [
      "nissaya: sự nương tựa",
      "āyatana: xứ",
      "vatthu: vật/chỗ nương vật chất"
    ],
    "from": "Pháp làm nền (thí dụ nhãn căn)",
    "to": "Pháp nương nền đó (nhãn thức)",
    "mechanism": "Cung cấp nền tảng vật chất hoặc quan hệ đồng sinh cho pháp được trợ.",
    "example": "Cần có nhãn căn phù hợp để nhãn thức sinh khởi.",
    "care": "Một pháp làm nền chưa chắc là yếu tố quyết định mạnh theo Cận y.",
    "compare": "Cận y duyên (9) là nâng đỡ đặc biệt mạnh, không đơn thuần là làm chỗ nương.",
    "kinds": [
      "Câu sanh y chỉ",
      "Vật tiền sanh y chỉ"
    ]
  },
  {
    "id": "upanissaya",
    "vi": "Cận y duyên",
    "pali": "Upanissaya-paccaya",
    "en": "Decisive support condition",
    "group": 1,
    "paliText": "Purimā purimā akusalā dhammā pacchimānaṃ pacchimānaṃ kusalānaṃ dhammānaṃ kesañci upanissayapaccayena paccayo.",
    "viText": "Có trường hợp pháp bất thiện sinh trước trở thành điều kiện nâng đỡ mạnh cho pháp thiện sinh về sau.",
    "enText": "In certain cases earlier unwholesome states strongly support subsequent wholesome states.",
    "explain": "Một điều kiện có sức nâng đỡ đặc biệt mạnh; gồm cảnh cận y, vô gián cận y và thường cận y.",
    "terms": [
      "upa: gần/mạnh",
      "nissaya: nương tựa",
      "pakatūpanissaya: thường cận y"
    ],
    "from": "Cảnh trọng yếu / tâm liền trước / điều kiện mạnh",
    "to": "Danh pháp được điều kiện ấy nâng đỡ",
    "mechanism": "Sức hỗ trợ quyết định có thể đến từ đối tượng, tiếp nối tâm hoặc môi trường và kinh nghiệm.",
    "example": "Một lần nóng giận dẫn đến hậu quả xấu; ký ức về hậu quả ấy về sau thúc đẩy người đó học cách giữ giới.",
    "care": "Thí dụ trải nghiệm cuộc sống chỉ gần với thường cận y; không thay cho phân tích chi pháp và thời điểm sinh diệt.",
    "compare": "Y chỉ duyên (8) là chỗ nương; Trưởng duyên (3) là yếu tố nổi trội.",
    "kinds": [
      "Cảnh cận y",
      "Vô gián cận y",
      "Thường cận y"
    ]
  },
  {
    "id": "purejata",
    "vi": "Tiền sanh duyên",
    "pali": "Purejāta-paccaya",
    "en": "Pre-nascence condition",
    "group": 1,
    "paliText": "Cakkhāyatanaṃ cakkhuviññāṇadhātuyā taṃsampayuttakānañca dhammānaṃ purejātapaccayena paccayo.",
    "viText": "Nhãn căn đã sinh trước và còn hiện hữu trợ cho nhãn thức sinh sau.",
    "enText": "The previously arisen eye-base conditions subsequently arising eye-consciousness.",
    "explain": "Một sắc pháp sinh trước nhưng chưa diệt, có chức năng trợ cho danh pháp sinh sau.",
    "terms": [
      "pure: trước",
      "jāta: đã sinh",
      "cakkhāyatana: nhãn xứ"
    ],
    "from": "Sắc pháp đã sinh trước, đang còn",
    "to": "Danh pháp phát sinh sau",
    "mechanism": "Sự hiện diện của sắc căn hoặc cảnh sinh trước làm duyên khi thức xuất hiện.",
    "example": "Nhãn căn tồn tại trước sát-na nhãn thức và là tiền sanh duyên cho nhãn thức.",
    "care": "Sinh trước nhưng đã diệt thì không phải tiền sanh duyên cho tâm sau theo nghĩa này.",
    "compare": "Hậu sanh duyên (11) có thứ tự phát sinh đảo chiều của pháp trợ và pháp được trợ.",
    "kinds": [
      "Vật tiền sanh",
      "Cảnh tiền sanh"
    ]
  },
  {
    "id": "pacchajata",
    "vi": "Hậu sanh duyên",
    "pali": "Pacchājāta-paccaya",
    "en": "Post-nascence condition",
    "group": 1,
    "paliText": "Pacchājātā cittacetasikā dhammā purejātassa imassa kāyassa pacchājātapaccayena paccayo.",
    "viText": "Tâm và tâm sở sinh sau trợ cho thân sắc đã sinh trước và vẫn đang tồn tại.",
    "enText": "Later-arisen mind and mental factors sustain the body that arose earlier.",
    "explain": "Danh pháp sinh sau có thể nâng đỡ sắc thân đã sinh trước mà vẫn còn hiện hữu.",
    "terms": [
      "pacchā: sau",
      "jāta: sinh",
      "purejāta-kāya: thân đã sinh trước"
    ],
    "from": "Tâm/tâm sở sinh sau",
    "to": "Sắc thân sinh trước nhưng chưa diệt",
    "mechanism": "Ủng hộ sự duy trì của sắc đã có; không tạo lại quá khứ.",
    "example": "Các sát-na tâm phát sinh trong đời sống trợ giúp một số sắc thân đang hiện hữu.",
    "care": "Không phải tương lai tác động ngược thời gian; hai pháp cùng hiện hữu trong lúc trợ duyên.",
    "compare": "Tiền sanh (10) xét sắc có trước trợ danh có sau.",
    "kinds": [
      "Danh sinh sau → sắc sinh trước đang còn"
    ]
  },
  {
    "id": "asevana",
    "vi": "Trùng dụng duyên",
    "pali": "Āsevana-paccaya",
    "en": "Repetition condition",
    "group": 1,
    "paliText": "Purimā purimā kusalā dhammā pacchimānaṃ pacchimānaṃ kusalānaṃ dhammānaṃ āsevanapaccayena paccayo.",
    "viText": "Các pháp thiện trong sát-na đổng lực trước trợ cho các pháp thiện trong sát-na đổng lực tiếp theo bằng sự lặp lại.",
    "enText": "Earlier wholesome impulsions condition subsequent wholesome impulsions through repetition.",
    "explain": "Các sát-na đổng lực (javana) kế tiếp cùng loại được củng cố nhờ lặp lại trong một tiến trình tâm.",
    "terms": [
      "āsevana: thường hành/lặp lại",
      "javana: đổng lực",
      "kiriyā: tâm duy tác"
    ],
    "from": "Đổng lực (javana) trước",
    "to": "Đổng lực cùng loại kế tiếp",
    "mechanism": "Củng cố tác dụng của các đổng lực sau trong chuỗi có điều kiện.",
    "example": "Trong một chuỗi đổng lực thiện liên tiếp, sát-na trước trợ sát-na sau theo trùng dụng duyên.",
    "care": "Đừng đánh đồng trực tiếp với việc luyện một kỹ năng qua nhiều tháng; đó chỉ là phép ví dụ xa.",
    "compare": "Vô gián (4) xét sự kế tiếp rộng hơn, không riêng tác dụng lặp lại của đổng lực.",
    "kinds": [
      "Đổng lực thiện",
      "Đổng lực bất thiện",
      "Đổng lực duy tác phù hợp"
    ]
  },
  {
    "id": "kamma",
    "vi": "Nghiệp duyên (Dị thời nghiệp duyên)",
    "pali": "Kamma-paccaya",
    "en": "Kamma condition",
    "group": 2,
    "paliText": "Kusalākusalaṃ kammaṃ vipākānaṃ khandhānaṃ kaṭattā ca rūpānaṃ kammapaccayena paccayo.",
    "viText": "Nghiệp thiện hoặc bất thiện trợ cho các uẩn quả và sắc do nghiệp tạo thành.",
    "enText": "Wholesome and unwholesome kamma conditions resultant aggregates and kamma-produced matter.",
    "explain": "Tư tâm sở (cetanā) giữ chức năng tạo tác; vừa có nghiệp đồng sinh vừa có nghiệp trổ quả ở thời điểm khác.",
    "terms": [
      "kamma: nghiệp/hành động có tác ý",
      "cetanā: tư tâm sở, tác ý",
      "vipāka: quả dị thục"
    ],
    "from": "Tư tâm sở hiện tại hoặc nghiệp đã tạo",
    "to": "Pháp đồng sinh hoặc pháp quả ở thời khác",
    "mechanism": "Tác ý trợ các pháp đi cùng và có thể làm nhân cho quả nghiệp phát sinh sau.",
    "example": "Tác ý thiện khi bố thí là nghiệp thiện; quả nghiệp, nếu có, phát sinh khi đủ các duyên thích hợp.",
    "care": "Tránh quy mọi điều xảy ra cho một người hoàn toàn về nghiệp quá khứ.",
    "compare": "Nhân duyên (1) nói về sáu căn, Dị thục quả duyên (14) xét chính pháp quả.",
    "kinds": [
      "Câu sanh nghiệp duyên",
      "Dị thời nghiệp duyên"
    ]
  },
  {
    "id": "vipaka",
    "vi": "Dị thục quả duyên",
    "pali": "Vipāka-paccaya",
    "en": "Resultant condition",
    "group": 2,
    "paliText": "Vipākā cattāro khandhā arūpino aññamaññaṃ vipākapaccayena paccayo.",
    "viText": "Bốn uẩn phi sắc thuộc quả nghiệp trợ giúp lẫn nhau bằng dị thục quả duyên.",
    "enText": "The four immaterial resultant aggregates mutually condition one another as resultants.",
    "explain": "Những danh pháp quả nghiệp (vipāka) trợ nhau nhờ tính chất quả dị thục; không phải chính việc tạo nghiệp.",
    "terms": [
      "vipāka: quả chín của nghiệp",
      "vipāka-citta: tâm quả",
      "khandha: uẩn"
    ],
    "from": "Các tâm quả và tâm sở quả",
    "to": "Các pháp quả tương ưng với chúng",
    "mechanism": "Những pháp có bản chất quả trợ nhau trong khi cùng hiện hữu.",
    "example": "Nhãn thức là một loại tâm quả; các tâm sở quả đi cùng có quan hệ dị thục quả duyên.",
    "care": "Không nhầm tính chất quả nghiệp với toàn bộ các kết quả đời thường.",
    "compare": "Nghiệp duyên (13) xét tác ý tạo nghiệp; duyên này xét tính chất quả của pháp đã sinh.",
    "kinds": [
      "Quan hệ giữa các danh uẩn quả"
    ]
  },
  {
    "id": "ahara",
    "vi": "Vật thực duyên",
    "pali": "Āhāra-paccaya",
    "en": "Nutriment condition",
    "group": 2,
    "paliText": "Kabaḷīkāro āhāro imassa kāyassa āhārapaccayena paccayo.",
    "viText": "Đoàn thực, tức dưỡng chất vật chất, làm điều kiện nuôi dưỡng sắc thân.",
    "enText": "Material nutriment supports the physical body as nutriment condition.",
    "explain": "Có một sắc vật thực và ba danh vật thực: xúc, tư niệm và thức. «Vật thực» không chỉ là thức ăn ăn uống.",
    "terms": [
      "āhāra: vật thực/chất nuôi dưỡng",
      "kabaḷīkāra: đoàn thực",
      "phassa: xúc",
      "manosañcetanā: tư niệm",
      "viññāṇa: thức"
    ],
    "from": "Dưỡng chất vật chất hoặc ba danh thực",
    "to": "Sắc thân hay các pháp tương ưng",
    "mechanism": "Nuôi dưỡng, hỗ trợ sự duy trì các pháp thuộc phạm vi tương ứng.",
    "example": "Thực phẩm cung cấp dinh dưỡng cho cơ thể; về danh pháp, xúc và thức có vai trò trợ duyên khác.",
    "care": "Không diễn giải ba danh thực như ba loại đồ ăn vật chất.",
    "compare": "Quyền duyên (16) là chủ quản chức năng; vật thực duyên là nuôi dưỡng.",
    "kinds": [
      "Đoàn thực",
      "Xúc thực",
      "Tư niệm thực",
      "Thức thực"
    ]
  },
  {
    "id": "indriya",
    "vi": "Quyền duyên",
    "pali": "Indriya-paccaya",
    "en": "Faculty condition",
    "group": 2,
    "paliText": "Cakkhundriyaṃ cakkhuviññāṇadhātuyā taṃsampayuttakānañca dhammānaṃ indriyapaccayena paccayo.",
    "viText": "Nhãn quyền thực hiện chức năng chủ quản làm duyên cho nhãn thức và tâm sở tương ưng.",
    "enText": "The eye faculty governs its corresponding eye-consciousness and associated mental factors.",
    "explain": "Các quyền có vai trò chủ quản trong phạm vi đặc thù: căn giác quan, mạng quyền và các danh quyền.",
    "terms": [
      "indriya: quyền/chức năng chủ quản",
      "cakkhundriya: nhãn quyền",
      "jīvitindriya: mạng quyền"
    ],
    "from": "Quyền tương ứng (ví dụ: nhãn quyền)",
    "to": "Các pháp thuộc chức năng được chủ quản",
    "mechanism": "Giữ vai trò điều phối đặc thù thay vì chỉ là yếu tố nổi trội.",
    "example": "Nhãn quyền trợ cho nhãn thức; tín quyền trợ sự vận hành của những danh pháp tương ưng trong tâm.",
    "care": "Quyền không có nghĩa có một cái tôi đang chỉ huy các pháp.",
    "compare": "Trưởng duyên (3) là tính trội, còn Quyền duyên gắn với phận sự chủ quản riêng.",
    "kinds": [
      "Tiền sanh quyền",
      "Câu sanh quyền",
      "Sắc mạng quyền"
    ]
  },
  {
    "id": "jhana",
    "vi": "Thiền-na duyên",
    "pali": "Jhāna-paccaya",
    "en": "Jhāna condition",
    "group": 2,
    "paliText": "Jhānaṅgāni jhānasampayuttakānaṃ dhammānaṃ taṃsamuṭṭhānānañca rūpānaṃ jhānapaccayena paccayo.",
    "viText": "Các chi thiền trợ cho pháp tương ưng với chi thiền và sắc do các pháp ấy tạo nên.",
    "enText": "Jhāna factors condition associated states and the matter originated by them.",
    "explain": "Các chi thiền làm nhiệm vụ hướng đến, giữ và thấm nhuần cảnh; không đồng nghĩa chỉ với chứng đắc thiền.",
    "terms": [
      "jhāna: thiền-na",
      "jhānaṅga: chi thiền",
      "vitakka: tầm",
      "vicāra: tứ",
      "ekaggatā: nhất tâm"
    ],
    "from": "Các chi thiền hiện diện",
    "to": "Tâm sở liên hệ và sắc do tâm tạo",
    "mechanism": "Hỗ trợ cách tâm tập trung hoặc giữ lấy đối tượng.",
    "example": "Trong tâm có tầm, tứ và nhất tâm phù hợp, chúng trợ cho các pháp đồng sinh bằng chức năng chi thiền.",
    "care": "Thiền-na duyên có phạm vi rộng hơn trải nghiệm định sâu; cần phân biệt với phẩm chất đạo đức của tâm.",
    "compare": "Đồ đạo duyên (18) liên quan các chi đạo dẫn dắt tâm theo hướng tương ứng.",
    "kinds": [
      "Tầm",
      "Tứ",
      "Hỷ",
      "Lạc hoặc ưu theo loại tâm",
      "Nhất tâm"
    ]
  },
  {
    "id": "magga",
    "vi": "Đồ đạo duyên",
    "pali": "Magga-paccaya",
    "en": "Path condition",
    "group": 2,
    "paliText": "Maggaṅgāni maggasampayuttakānaṃ dhammānaṃ taṃsamuṭṭhānānañca rūpānaṃ maggapaccayena paccayo.",
    "viText": "Các chi đạo làm duyên cho các pháp tương ưng và sắc do những pháp ấy phát sinh.",
    "enText": "Path factors condition their associated states and mind-originated matter.",
    "explain": "Chi đạo (*maggaṅga*) là yếu tố dẫn dắt tâm theo một hướng; có chi đạo thiện, bất thiện hoặc vô ký tùy trường hợp.",
    "terms": [
      "magga: con đường",
      "maggaṅga: chi đạo",
      "sammādiṭṭhi: chánh kiến",
      "micchādiṭṭhi: tà kiến"
    ],
    "from": "Chi đạo như chánh kiến, tà kiến, tinh tấn",
    "to": "Các pháp tương ưng và sắc do chúng tạo",
    "mechanism": "Định hướng tiến trình danh pháp bằng chức năng của các chi đạo.",
    "example": "Chánh kiến có thể trợ các danh pháp tương ưng theo hướng thiện; tà kiến có thể trợ tâm bất thiện.",
    "care": "Không đồng nhất mọi Đồ đạo duyên với Bát Chánh Đạo siêu thế.",
    "compare": "Thiền-na duyên (17) nói về chức năng chi thiền đối với đối tượng.",
    "kinds": [
      "Chi đạo chánh",
      "Chi đạo tà theo loại tâm"
    ]
  },
  {
    "id": "sampayutta",
    "vi": "Tương ưng duyên",
    "pali": "Sampayutta-paccaya",
    "en": "Association condition",
    "group": 3,
    "paliText": "Cattāro khandhā arūpino aññamaññaṃ sampayuttapaccayena paccayo.",
    "viText": "Bốn uẩn phi sắc trợ giúp qua lại vì cùng tương ưng.",
    "enText": "The four immaterial aggregates mutually condition one another through association.",
    "explain": "Tâm và tâm sở tương ưng đồng sinh, đồng diệt, cùng cảnh và cùng sở y vật khi thích hợp.",
    "terms": [
      "sampayutta: tương ưng",
      "nāma: danh pháp",
      "citta–cetasika: tâm–tâm sở"
    ],
    "from": "Tâm và các tâm sở tương ưng",
    "to": "Các danh pháp đồng sinh liên hệ",
    "mechanism": "Sự hòa hợp giữa các danh pháp theo các đặc trưng tương ưng.",
    "example": "Tâm thiện và các tâm sở thiện đi kèm có thể làm tương ưng duyên cho nhau.",
    "care": "Sắc pháp không trở thành tương ưng với danh pháp theo nghĩa chuyên biệt này.",
    "compare": "Bất tương ưng duyên (20) bàn quan hệ hỗ trợ giữa danh và sắc.",
    "kinds": [
      "Danh–danh tương ưng"
    ]
  },
  {
    "id": "vippayutta",
    "vi": "Bất tương ưng duyên",
    "pali": "Vippayutta-paccaya",
    "en": "Dissociation condition",
    "group": 3,
    "paliText": "Rūpino dhammā arūpīnaṃ dhammānaṃ vippayuttapaccayena paccayo.",
    "viText": "Các sắc pháp trợ các danh pháp theo cách bất tương ưng.",
    "enText": "Material phenomena condition immaterial phenomena through dissociation.",
    "explain": "Danh pháp và sắc pháp có thể hỗ trợ nhau mà không đồng sinh/đồng cảnh theo tiêu chuẩn tương ưng của các danh pháp.",
    "terms": [
      "vippayutta: bất tương ưng",
      "rūpa: sắc pháp",
      "arūpa: danh pháp/phi sắc"
    ],
    "from": "Danh pháp hoặc sắc pháp",
    "to": "Sắc pháp hoặc danh pháp tương ứng trường hợp",
    "mechanism": "Trợ giúp qua sự khác biệt loại thực tại giữa danh và sắc.",
    "example": "Nhãn căn là sắc pháp trợ nhãn thức là danh pháp, nhưng không tương ưng như hai danh pháp.",
    "care": "Bất tương ưng không đồng nghĩa đối kháng hay làm trở ngại nhau.",
    "compare": "Tương ưng (19) chỉ quan hệ giữa các danh pháp thỏa điều kiện.",
    "kinds": [
      "Câu sanh bất tương ưng",
      "Tiền sanh bất tương ưng",
      "Hậu sanh bất tương ưng"
    ]
  },
  {
    "id": "atthi",
    "vi": "Hiện hữu duyên",
    "pali": "Atthi-paccaya",
    "en": "Presence condition",
    "group": 3,
    "paliText": "Cattāro khandhā arūpino aññamaññaṃ atthipaccayena paccayo.",
    "viText": "Bốn uẩn phi sắc đang hiện hữu có thể trợ giúp lẫn nhau.",
    "enText": "The four immaterial aggregates condition one another through their presence.",
    "explain": "Pháp năng duyên đang có mặt và do chính sự hiện hữu đó mà trợ cho pháp sở duyên.",
    "terms": [
      "atthi: có mặt/hiện hữu",
      "paccaya: điều kiện",
      "paccayuppanna: pháp được trợ"
    ],
    "from": "Pháp năng duyên đang hiện hữu",
    "to": "Pháp cùng thời có thể nhận trợ giúp",
    "mechanism": "Sự có mặt trở thành điều kiện nâng đỡ trong những quan hệ được luận xác định.",
    "example": "Nhãn căn đang hiện hữu trợ cho nhãn thức khi đủ các duyên khác.",
    "care": "Không có nghĩa mọi thứ đang tồn tại đều là hiện hữu duyên cho mọi pháp khác.",
    "compare": "Bất ly duyên (24) cùng xét pháp chưa diệt; khác nhấn mạnh diễn đạt.",
    "kinds": [
      "Câu sanh hiện hữu",
      "Tiền sanh hiện hữu",
      "Hậu sanh hiện hữu",
      "Vật thực và quyền hiện hữu"
    ]
  },
  {
    "id": "natthi",
    "vi": "Vô hữu duyên",
    "pali": "Natthi-paccaya",
    "en": "Absence condition",
    "group": 3,
    "paliText": "Samanantaraniruddhā cittacetasikā dhammā paṭuppannānaṃ cittacetasikānaṃ dhammānaṃ natthipaccayena paccayo.",
    "viText": "Tâm và tâm sở vừa diệt trợ cho tâm và tâm sở sinh kế tiếp bằng sự vắng mặt của chính chúng.",
    "enText": "Just-ceased mental states condition the next mental states by their absence.",
    "explain": "Sự không còn hiện hữu của danh pháp vừa diệt trở thành điều kiện cho danh pháp kế tiếp.",
    "terms": [
      "natthi: không còn",
      "niruddha: đã diệt",
      "samanantara: kế tiếp tức thì"
    ],
    "from": "Danh pháp A vừa diệt",
    "to": "Danh pháp B kế tiếp",
    "mechanism": "Sự vắng mặt của sát-na trước mở đường cho sát-na tâm tiếp theo.",
    "example": "Một sát-na tâm đã chấm dứt, để sát-na tâm kế tiếp xuất hiện.",
    "care": "Không phải mọi khoảng trống hoặc cái không tồn tại đều là Vô hữu duyên.",
    "compare": "Ly khứ (23) nhấn mạnh đã biến mất; Vô gián (4) nhấn mạnh tiếp nối không xen hở.",
    "kinds": [
      "Danh pháp vừa diệt → danh pháp kế tiếp"
    ]
  },
  {
    "id": "vigata",
    "vi": "Ly khứ duyên",
    "pali": "Vigata-paccaya",
    "en": "Disappearance condition",
    "group": 3,
    "paliText": "Samanantaravigatā cittacetasikā dhammā paṭuppannānaṃ cittacetasikānaṃ dhammānaṃ vigatapaccayena paccayo.",
    "viText": "Tâm và tâm sở vừa biến mất trợ cho tâm và tâm sở mới sinh liền kề.",
    "enText": "Immediately vanished mental states condition the subsequently arising mental states.",
    "explain": "Xét danh pháp vừa diệt dưới khía cạnh đã biến mất và trợ cho sát-na danh pháp kế tiếp.",
    "terms": [
      "vigata: đã đi khỏi/đã diệt",
      "cittacetasika: tâm và tâm sở"
    ],
    "from": "Danh pháp vừa biến mất",
    "to": "Danh pháp sinh kế tiếp",
    "mechanism": "Việc diệt mất sát-na trước là điều kiện cho sự tiếp diễn của dòng tâm.",
    "example": "Sau khi sát-na tâm trước diệt, sát-na tâm sau sinh theo tiến trình.",
    "care": "Không hiểu «ly khứ» là di chuyển trong không gian.",
    "compare": "Vô hữu duyên (22) nói về không còn có mặt; cặp duyên này đồng phạm vi chủ yếu.",
    "kinds": [
      "Danh pháp vừa diệt → danh pháp kế tiếp"
    ]
  },
  {
    "id": "avigata",
    "vi": "Bất ly duyên",
    "pali": "Avigata-paccaya",
    "en": "Non-disappearance condition",
    "group": 3,
    "paliText": "Cattāro khandhā arūpino aññamaññaṃ avigatapaccayena paccayo.",
    "viText": "Bốn uẩn phi sắc khi chưa diệt có thể trợ giúp lẫn nhau.",
    "enText": "The four immaterial aggregates condition one another while not yet vanished.",
    "explain": "Pháp năng duyên chưa diệt, vẫn có mặt để nâng đỡ pháp sở duyên.",
    "terms": [
      "avigata: chưa biến mất",
      "atthi: hiện hữu",
      "paccayadhamma: pháp năng duyên"
    ],
    "from": "Pháp trợ duyên chưa diệt",
    "to": "Pháp được nâng đỡ khi pháp kia còn",
    "mechanism": "Chính trạng thái chưa diệt cho phép sự hỗ trợ trong hiện tại.",
    "example": "Nhãn căn chưa diệt đang trợ cho nhãn thức ở điều kiện tương ứng.",
    "care": "Không có nghĩa pháp tồn tại vĩnh viễn; «bất ly» chỉ là chưa diệt ở thời điểm xét.",
    "compare": "Hiện hữu duyên (21) đồng phạm vi cơ bản, nhấn mạnh sự có mặt.",
    "kinds": [
      "Câu sanh bất ly",
      "Tiền sanh bất ly",
      "Hậu sanh bất ly",
      "Vật thực và quyền bất ly"
    ]
  }
].map((item,index)=>({...item,number:index+1}));
