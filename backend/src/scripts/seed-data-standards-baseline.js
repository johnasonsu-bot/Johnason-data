const { pool } = require("../config/database");

const CREATED_BY = "data-standards-baseline";

const catalogSpecs = [
  {
    code: "STD.ROOT",
    name: "数据标准",
    type: "root",
    owner: "数据治理委员会",
    description: "承载国家、行业、企业三级标准以及 ODS 字段采标结果的统一目录。",
    sortOrder: 0,
  },
  {
    code: "STD.BASE",
    name: "公共基础标准",
    type: "business_domain",
    parentCode: "STD.ROOT",
    owner: "数据治理委员会",
    description: "跨 ODS 表复用的主键、时间、审计、状态等公共数据元。",
    sortOrder: 10,
  },
  {
    code: "STD.DICT",
    name: "字典代码标准",
    type: "business_domain",
    parentCode: "STD.ROOT",
    owner: "数据治理委员会",
    description: "统一代码表、系统字典表及值域项的代码结构标准。",
    sortOrder: 20,
  },
  {
    code: "STD.PERSON",
    name: "人员主体标准",
    type: "business_domain",
    parentCode: "STD.ROOT",
    owner: "数据治理委员会",
    description: "自然人姓名、证件、国籍、联系方式、地址等主体数据元。",
    sortOrder: 30,
  },
  {
    code: "STD.ORG",
    name: "组织机构标准",
    type: "business_domain",
    parentCode: "STD.ROOT",
    owner: "民政业务数据负责人",
    description: "婚姻登记机构及区划、联系方式、资质、业务范围等数据元。",
    sortOrder: 40,
  },
  {
    code: "STD.PLACE",
    name: "地理位置标准",
    type: "business_domain",
    parentCode: "STD.ROOT",
    owner: "数据治理委员会",
    description: "行政区划、地址、门牌、楼栋、经纬度等位置数据元。",
    sortOrder: 45,
  },
  {
    code: "STD.EVENT",
    name: "事件活动标准",
    type: "business_domain",
    parentCode: "STD.ROOT",
    owner: "数据治理委员会",
    description: "事件、活动、办理、处置、状态和结果等过程性数据元。",
    sortOrder: 55,
  },
  {
    code: "STD.OBJECT",
    name: "物品资产标准",
    type: "business_domain",
    parentCode: "STD.ROOT",
    owner: "数据治理委员会",
    description: "物品、资产、产品、设备、数量、金额和存放位置等数据元。",
    sortOrder: 65,
  },
  {
    code: "STD.OPS",
    name: "技术审计标准",
    type: "technical",
    parentCode: "STD.ROOT",
    owner: "平台数据负责人",
    description: "ODS 技术审计、操作人和作业留痕字段标准。",
    sortOrder: 70,
  },
];

const referenceSpecs = [
  {
    code: "GB_T_19488_1_2004",
    name: "电子政务数据元 第1部分:设计和管理规范",
    type: "national",
    standardNo: "GB/T 19488.1-2004",
    publisher: "中华人民共和国国家质量监督检验检疫总局、中国国家标准化管理委员会",
    effectiveDate: "2004-10-01",
    url: "https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=A581C64689E2FC7981C88B4C3B3CC51F",
    description: "作为标准数据元标识符、对象类、特性、表示词、限定词、值域和版本管理的设计基线。",
  },
  {
    code: "GB_T_19488_2_2008",
    name: "电子政务数据元 第2部分:公共数据元目录",
    type: "national",
    standardNo: "GB/T 19488.2-2008",
    publisher: "中华人民共和国国家质量监督检验检疫总局、中国国家标准化管理委员会",
    effectiveDate: "2008-08-01",
    url: "https://openstd.samr.gov.cn/bzgk/gb/std_list?p.p2=GB%2FT%2019488.2-2008",
    description: "作为人员、机构、地址、联系信息等公共数据元命名和定义的国家标准参考。",
  },
  {
    code: "GB_T_2260_2007",
    name: "中华人民共和国行政区划代码",
    type: "national",
    standardNo: "GB/T 2260-2007",
    publisher: "中华人民共和国国家质量监督检验检疫总局、中国国家标准化管理委员会",
    effectiveDate: "2008-02-01",
    url: "https://openstd.samr.gov.cn/bzgk/gb/newGbInfo?hcno=C9C488FD717AFDCD52157F41C3302C6D",
    description: "作为区划编码、登记地区、机构所属地区等字段的国家标准引用。",
  },
  {
    code: "GB_T_2261_1_2003",
    name: "个人基本信息分类与代码 第1部分:人的性别代码",
    type: "national",
    standardNo: "GB/T 2261.1-2003",
    publisher: "中华人民共和国国家质量监督检验检疫总局",
    effectiveDate: "2003-12-01",
    url: "https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=0FC942D542BC6EE3C707B2647EF81CD8",
    description: "作为人员性别值域的国家标准引用。",
  },
  {
    code: "GB_T_2261_2_2003",
    name: "个人基本信息分类与代码 第2部分:婚姻状况代码",
    type: "national",
    standardNo: "GB/T 2261.2-2003",
    publisher: "中华人民共和国国家质量监督检验检疫总局",
    effectiveDate: "2003-12-01",
    url: "https://openstd.samr.gov.cn/bzgk/gb/std_list?p.p2=GB%2FT%202261.2-2003",
    description: "作为自然人婚姻状况字段的国家标准值域引用。",
  },
  {
    code: "GB_11643_1999",
    name: "公民身份号码",
    type: "national",
    standardNo: "GB 11643-1999",
    publisher: "国家质量技术监督局",
    effectiveDate: "1999-07-01",
    url: "https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=080D6FBF2BB468F9007657F26D60013E",
    description: "作为居民身份证号码长度、格式和校验规则的国家标准引用。",
  },
  {
    code: "GB_T_2659_1_2022",
    name: "世界各国和地区及其行政区划名称代码 第1部分：国家和地区代码",
    type: "national",
    standardNo: "GB/T 2659.1-2022",
    publisher: "国家市场监督管理总局、国家标准化管理委员会",
    effectiveDate: "2023-07-01",
    url: "https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=FBCE39BE204B54F6F944092C209121F2",
    description: "作为国籍/地区代码引用标准。",
  },
  {
    code: "GB_T_3304_1991",
    name: "中国各民族名称的罗马字母拼写法和代码",
    type: "national",
    standardNo: "GB/T 3304-1991",
    publisher: "国家技术监督局",
    effectiveDate: "1992-10-01",
    url: "https://openstd.samr.gov.cn/bzgk/gb/std_list?p.p2=GB%2FT%203304-1991",
    description: "作为民族代码字段的国家标准引用。",
  },
  {
    code: "GB_T_4658_2006",
    name: "学历代码",
    type: "national",
    standardNo: "GB/T 4658-2006",
    publisher: "中华人民共和国国家质量监督检验检疫总局、中国国家标准化管理委员会",
    effectiveDate: "2007-02-01",
    url: "https://openstd.samr.gov.cn/bzgk/gb/std_list?p.p2=GB%2FT%204658-2006",
    description: "作为自然人学历字段的国家标准值域引用。",
  },
  {
    code: "GB_T_6565_2015",
    name: "职业分类与代码",
    type: "national",
    standardNo: "GB/T 6565-2015",
    publisher: "中华人民共和国国家质量监督检验检疫总局、中国国家标准化管理委员会",
    effectiveDate: "2015-10-01",
    url: "https://openstd.samr.gov.cn/bzgk/gb/newGbInfo?hcno=26D453E518AFC7A826331A251E7EB1F9",
    description: "作为自然人职业分类代码字段的国家标准引用。",
  },
  {
    code: "GB_T_7408_1_2023",
    name: "日期和时间 信息交换表示法 第1部分：基本原则",
    type: "national",
    standardNo: "GB/T 7408.1-2023",
    publisher: "国家市场监督管理总局、国家标准化管理委员会",
    effectiveDate: "2024-04-01",
    url: "https://std.samr.gov.cn/gb/search/gbDetailed?id=0DF2F72AE375403DE06397BE0A0A87C4",
    description: "作为日期、日期时间字段的信息交换格式引用。",
  },
  {
    code: "GB_32100_2015",
    name: "法人和其他组织统一社会信用代码编码规则",
    type: "national",
    standardNo: "GB 32100-2015",
    publisher: "中华人民共和国国家质量监督检验检疫总局、中国国家标准化管理委员会",
    effectiveDate: "2015-10-01",
    url: "https://openstd.samr.gov.cn/bzgk/gb/std_list?p.p2=GB%2032100-2015",
    description: "作为法人和其他组织统一社会信用代码格式、结构和校验规则的国家标准引用。",
  },
  {
    code: "GB_T_20091_2021",
    name: "组织机构类型",
    type: "national",
    standardNo: "GB/T 20091-2021",
    publisher: "国家市场监督管理总局、国家标准化管理委员会",
    effectiveDate: "2022-07-01",
    url: "https://openstd.samr.gov.cn/bzgk/gb/std_list?p.p2=GB%2FT%2020091-2021",
    description: "作为组织机构类型字段的国家标准引用。",
  },
  {
    code: "GB_T_12402_2000",
    name: "经济类型分类与代码",
    type: "national",
    standardNo: "GB/T 12402-2000",
    publisher: "国家质量技术监督局",
    effectiveDate: "2001-03-01",
    url: "https://openstd.samr.gov.cn/bzgk/gb/std_list?p.p2=GB%2FT%2012402-2000",
    description: "作为企业经济类型字段的国家标准值域引用。",
  },
  {
    code: "GB_T_4754_2017",
    name: "国民经济行业分类",
    type: "national",
    standardNo: "GB/T 4754-2017",
    publisher: "中华人民共和国国家质量监督检验检疫总局、中国国家标准化管理委员会",
    effectiveDate: "2017-10-01",
    url: "https://openstd.samr.gov.cn/bzgk/gb/newGbInfo?hcno=A703F0E23DD165A5A1318679F312D158",
    description: "作为机构所属国民经济行业分类字段的国家标准引用。",
  },
  {
    code: "GB_T_36104_2018",
    name: "法人和其他组织统一社会信用代码基础数据元",
    type: "national",
    standardNo: "GB/T 36104-2018",
    publisher: "国家市场监督管理总局、中国国家标准化管理委员会",
    effectiveDate: "2018-12-01",
    url: "https://openstd.samr.gov.cn/bzgk/gb/std_list?p.p2=GB%2FT%2036104-2018",
    description: "作为法人和其他组织名称、法定代表人、注册地址等基础数据元参考。",
  },
  {
    code: "GB_T_2261_3_2003",
    name: "个人基本信息分类与代码 第3部分:健康状况代码",
    type: "national",
    standardNo: "GB/T 2261.3-2003",
    publisher: "中华人民共和国国家质量监督检验检疫总局",
    effectiveDate: "2003-12-01",
    url: "https://openstd.samr.gov.cn/bzgk/gb/std_list?p.p2=GB%2FT%202261.3-2003",
    description: "作为自然人健康状况字段的国家标准值域引用。",
  },
  {
    code: "GB_T_2261_4_2003",
    name: "个人基本信息分类与代码 第4部分:从业状况(个人身份)代码",
    type: "national",
    standardNo: "GB/T 2261.4-2003",
    publisher: "中华人民共和国国家质量监督检验检疫总局",
    effectiveDate: "2003-12-01",
    url: "https://openstd.samr.gov.cn/bzgk/gb/std_list?p.p2=GB%2FT%202261.4-2003",
    description: "作为自然人从业状况、个人身份字段的国家标准值域引用。",
  },
  {
    code: "GB_T_4761_2008",
    name: "家庭关系代码",
    type: "national",
    standardNo: "GB/T 4761-2008",
    publisher: "中华人民共和国国家质量监督检验检疫总局、中国国家标准化管理委员会",
    effectiveDate: "2008-11-01",
    url: "https://openstd.samr.gov.cn/bzgk/gb/std_list?p.p2=GB%2FT%204761-2008",
    description: "作为户主关系、家庭成员关系字段的国家标准值域引用。",
  },
  {
    code: "GB_T_4762_1984",
    name: "政治面貌代码",
    type: "national",
    standardNo: "GB/T 4762-1984",
    publisher: "国家标准局",
    effectiveDate: "1985-10-01",
    url: "https://openstd.samr.gov.cn/bzgk/gb/std_list?p.p2=GB%2FT%204762-1984",
    description: "作为自然人政治面貌字段的国家标准值域引用。",
  },
  {
    code: "GB_T_6864_2003",
    name: "中华人民共和国学位代码",
    type: "national",
    standardNo: "GB/T 6864-2003",
    publisher: "中华人民共和国国家质量监督检验检疫总局",
    effectiveDate: "2003-12-01",
    url: "https://openstd.samr.gov.cn/bzgk/gb/std_list?p.p2=GB%2FT%206864-2003",
    description: "作为自然人学位字段的国家标准值域引用。",
  },
  {
    code: "GB_T_10114_2003",
    name: "县级以下行政区划代码编制规则",
    type: "national",
    standardNo: "GB/T 10114-2003",
    publisher: "中华人民共和国国家质量监督检验检疫总局",
    effectiveDate: "2003-12-01",
    url: "https://openstd.samr.gov.cn/bzgk/gb/std_list?p.p2=GB%2FT%2010114-2003",
    description: "作为乡镇、街道、村社等基层区划代码编制规则引用。",
  },
  {
    code: "GB_T_16831_2013",
    name: "基于坐标的地理点位置标准表示法",
    type: "national",
    standardNo: "GB/T 16831-2013",
    publisher: "国家质量监督检验检疫总局、国家标准化管理委员会",
    effectiveDate: "2014-07-15",
    url: "https://openstd.samr.gov.cn/bzgk/gb/std_list?p.p2=GB%2FT%2016831-2013",
    description: "作为经纬度、地理坐标字段的信息表示引用。",
  },
  {
    code: "GB_T_7027_2002",
    name: "信息分类和编码的基本原则与方法",
    type: "national",
    standardNo: "GB/T 7027-2002",
    publisher: "中华人民共和国国家质量监督检验检疫总局",
    effectiveDate: "2002-08-01",
    url: "https://openstd.samr.gov.cn/bzgk/gb/std_list?p.p2=GB%2FT%207027-2002",
    description: "作为事件类型、状态、来源和对象分类编码的设计方法引用。",
  },
  {
    code: "GB_T_12406_2022",
    name: "表示货币的代码",
    type: "national",
    standardNo: "GB/T 12406-2022",
    publisher: "国家市场监督管理总局、国家标准化管理委员会",
    effectiveDate: "2023-07-01",
    url: "https://openstd.samr.gov.cn/bzgk/gb/std_list?p.p2=GB%2FT%2012406-2022",
    description: "作为币种代码、资金金额币种字段的国家标准值域引用。",
  },
  {
    code: "GB_T_17295_2008",
    name: "国际贸易计量单位代码",
    type: "national",
    standardNo: "GB/T 17295-2008",
    publisher: "中华人民共和国国家质量监督检验检疫总局、中国国家标准化管理委员会",
    effectiveDate: "2008-10-01",
    url: "https://openstd.samr.gov.cn/bzgk/gb/std_list?p.p2=GB%2FT%2017295-2008",
    description: "作为数量、重量、长度、面积、体积等计量单位代码引用。",
  },
];

const ethnicGroupItems = [
  ["01", "汉族", "HA"], ["02", "蒙古族", "MG"], ["03", "回族", "HU"], ["04", "藏族", "ZA"],
  ["05", "维吾尔族", "UG"], ["06", "苗族", "MH"], ["07", "彝族", "YI"], ["08", "壮族", "ZH"],
  ["09", "布依族", "BY"], ["10", "朝鲜族", "CS"], ["11", "满族", "MA"], ["12", "侗族", "DO"],
  ["13", "瑶族", "YA"], ["14", "白族", "BA"], ["15", "土家族", "TJ"], ["16", "哈尼族", "HN"],
  ["17", "哈萨克族", "KZ"], ["18", "傣族", "DA"], ["19", "黎族", "LI"], ["20", "傈僳族", "LS"],
  ["21", "佤族", "VA"], ["22", "畲族", "SH"], ["23", "高山族", "GS"], ["24", "拉祜族", "LH"],
  ["25", "水族", "SU"], ["26", "东乡族", "DX"], ["27", "纳西族", "NX"], ["28", "景颇族", "JP"],
  ["29", "柯尔克孜族", "KG"], ["30", "土族", "TU"], ["31", "达斡尔族", "DU"], ["32", "仫佬族", "ML"],
  ["33", "羌族", "QI"], ["34", "布朗族", "BL"], ["35", "撒拉族", "SL"], ["36", "毛南族", "MN"],
  ["37", "仡佬族", "GL"], ["38", "锡伯族", "XB"], ["39", "阿昌族", "AC"], ["40", "普米族", "PM"],
  ["41", "塔吉克族", "TA"], ["42", "怒族", "NU"], ["43", "乌孜别克族", "UZ"], ["44", "俄罗斯族", "RS"],
  ["45", "鄂温克族", "EW"], ["46", "德昂族", "DE"], ["47", "保安族", "BN"], ["48", "裕固族", "YG"],
  ["49", "京族", "GI"], ["50", "塔塔尔族", "TT"], ["51", "独龙族", "DR"], ["52", "鄂伦春族", "OR"],
  ["53", "赫哲族", "HZ"], ["54", "门巴族", "MB"], ["55", "珞巴族", "LB"], ["56", "基诺族", "JN"],
].map(([code, label, alpha], index) => [code, label, code, `GB/T 3304 字母代码：${alpha}`, index + 1]);

const educationLevelItems = [
  ["10", "研究生教育", "含博士、硕士及研究生班"],
  ["11", "博士研究生毕业", "博士研究生毕业"],
  ["12", "博士研究生结业", "博士研究生结业"],
  ["13", "博士研究生肄业", "博士研究生肄业"],
  ["14", "硕士研究生毕业", "硕士研究生毕业"],
  ["15", "硕士研究生结业", "硕士研究生结业"],
  ["16", "硕士研究生肄业", "硕士研究生肄业"],
  ["17", "研究生班毕业", "研究生班毕业"],
  ["18", "研究生班结业", "研究生班结业"],
  ["19", "研究生班肄业", "研究生班肄业"],
  ["20", "大学本科/专科教育", "大学本科层次"],
  ["21", "大学本科毕业", "大学本科毕业"],
  ["22", "大学本科结业", "大学本科结业"],
  ["23", "大学本科肄业", "大学本科肄业"],
  ["28", "大学普通班毕业", "大学普通班毕业"],
  ["30", "大学本科/专科教育", "大学专科层次"],
  ["31", "大学专科毕业", "大学专科毕业"],
  ["32", "大学专科结业", "大学专科结业"],
  ["33", "大学专科肄业", "大学专科肄业"],
  ["40", "中等职业教育", "中等职业学校教育"],
  ["41", "中等专科毕业", "中等专科毕业"],
  ["42", "中等专科结业", "中等专科结业"],
  ["43", "中等专科肄业", "中等专科肄业"],
  ["44", "职业高中毕业", "职业高中毕业"],
  ["45", "职业高中结业", "职业高中结业"],
  ["46", "职业高中肄业", "职业高中肄业"],
  ["47", "技工学校毕业", "技工学校毕业"],
  ["48", "技工学校结业", "技工学校结业"],
  ["49", "技工学校肄业", "技工学校肄业"],
  ["60", "普通高级中学教育", "普通高中层次"],
  ["61", "普通高中毕业", "普通高中毕业"],
  ["62", "普通高中结业", "普通高中结业"],
  ["63", "普通高中肄业", "普通高中肄业"],
  ["70", "初级中学教育", "初中层次"],
  ["71", "初中毕业", "初中毕业"],
  ["73", "初中肄业", "初中肄业"],
  ["80", "小学教育", "小学层次"],
  ["81", "小学毕业", "小学毕业"],
  ["83", "小学肄业", "小学肄业"],
  ["90", "其他教育", "其他教育"],
].map(([code, label, meaning], index) => [code, label, code, meaning, index + 1]);

const occupationItems = [
  ["10000", "党的机关、国家机关、群众团体和社会组织、企事业单位负责人"],
  ["20000", "专业技术人员"],
  ["30000", "办事人员和有关人员"],
  ["40000", "社会生产服务和生活服务人员"],
  ["50000", "农、林、牧、渔业生产及辅助人员"],
  ["60000", "生产制造及有关人员"],
  ["70000", "军人"],
  ["80000", "不便分类的其他从业人员"],
].map(([code, label], index) => [code, label, code, "GB/T 6565 职业大类", index + 1]);

const nationalityItems = [
  ["CHN", "中国"], ["HKG", "中国香港"], ["MAC", "中国澳门"], ["TWN", "中国台湾"],
  ["USA", "美国"], ["CAN", "加拿大"], ["GBR", "英国"], ["FRA", "法国"], ["DEU", "德国"],
  ["RUS", "俄罗斯"], ["JPN", "日本"], ["KOR", "韩国"], ["SGP", "新加坡"], ["MYS", "马来西亚"],
  ["THA", "泰国"], ["VNM", "越南"], ["IDN", "印度尼西亚"], ["IND", "印度"], ["AUS", "澳大利亚"],
  ["NZL", "新西兰"], ["BRA", "巴西"], ["ZAF", "南非"], ["ITA", "意大利"], ["ESP", "西班牙"],
  ["NLD", "荷兰"],
].map(([code, label], index) => [code, label, code, "GB/T 2659.1 alpha-3 代码", index + 1]);

const organizationTypeItems = [
  ["1", "法人", "组织机构类型大类"],
  ["11", "营利法人", "法人中类"],
  ["111", "有限责任公司", "依法登记成立的有限责任公司"],
  ["112", "股份有限公司", "依法登记成立的股份有限公司"],
  ["119", "其他企业法人", "其他未列明的营利法人"],
  ["12", "非营利法人", "法人中类"],
  ["121", "事业单位法人", "事业单位法人"],
  ["122", "社会团体法人", "社会团体法人"],
  ["123", "基金会法人", "基金会法人"],
  ["124", "社会服务机构法人", "社会服务机构法人"],
  ["129", "其他非营利法人", "其他未列明的非营利法人"],
  ["13", "特别法人", "法人中类"],
  ["131", "机关法人", "机关法人"],
  ["132", "农村集体经济组织法人", "农村集体经济组织法人"],
  ["133", "城镇农村合作经济组织法人", "城镇农村合作经济组织法人"],
  ["134", "基层群众性自治组织法人", "基层群众性自治组织法人"],
  ["139", "其他特别法人", "其他未列明的特别法人"],
  ["2", "非法人组织", "组织机构类型大类"],
  ["21", "营利性非法人组织", "非法人组织中类"],
  ["211", "个人独资企业", "个人独资企业"],
  ["212", "合伙企业", "合伙企业"],
  ["213", "不具有法人资格的营利性专业服务机构", "营利性专业服务机构"],
  ["219", "其他营利性非法人组织", "其他未列明的营利性非法人组织"],
  ["22", "非营利性非法人组织", "非法人组织中类"],
  ["229", "其他非营利性非法人组织", "其他未列明的非营利性非法人组织"],
].map(([code, label, meaning], index) => [code, label, code, meaning, index + 1]);

const economicTypeItems = [
  ["100", "内资", "经济类型大类"],
  ["110", "国有全资", "内资"],
  ["120", "集体全资", "内资"],
  ["130", "股份合作", "内资"],
  ["140", "联营", "内资"],
  ["141", "国有联营", "联营"],
  ["142", "集体联营", "联营"],
  ["143", "国有与集体联营", "联营"],
  ["149", "其他联营", "联营"],
  ["150", "有限责任（公司）", "内资"],
  ["151", "国有独资（公司）", "有限责任公司"],
  ["159", "其他有限责任（公司）", "有限责任公司"],
  ["160", "股份有限（公司）", "内资"],
  ["170", "私有", "内资"],
  ["171", "私有独资", "私有"],
  ["172", "私有合伙", "私有"],
  ["173", "私营有限责任（公司）", "私有"],
  ["174", "私营股份有限（公司）", "私有"],
  ["175", "个体经营", "私有"],
  ["179", "其他私有", "私有"],
  ["190", "其他内资", "内资"],
  ["200", "港、澳、台投资", "经济类型大类"],
  ["210", "内地和港澳台合资", "港澳台投资"],
  ["220", "内地和港澳台合作", "港澳台投资"],
  ["230", "港澳台独资", "港澳台投资"],
  ["240", "港澳台投资股份有限（公司）", "港澳台投资"],
  ["290", "其他港澳台投资", "港澳台投资"],
  ["300", "国外投资", "经济类型大类"],
  ["310", "中外合资", "国外投资"],
  ["320", "中外合作", "国外投资"],
  ["330", "外资", "国外投资"],
  ["340", "国外投资股份有限（公司）", "国外投资"],
  ["390", "其他国外投资", "国外投资"],
  ["900", "其他", "其他经济类型"],
].map(([code, label, meaning], index) => [code, label, code, meaning, index + 1]);

const industryItems = [
  ["A", "农、林、牧、渔业"], ["B", "采矿业"], ["C", "制造业"],
  ["D", "电力、热力、燃气及水生产和供应业"], ["E", "建筑业"], ["F", "批发和零售业"],
  ["G", "交通运输、仓储和邮政业"], ["H", "住宿和餐饮业"], ["I", "信息传输、软件和信息技术服务业"],
  ["J", "金融业"], ["K", "房地产业"], ["L", "租赁和商务服务业"], ["M", "科学研究和技术服务业"],
  ["N", "水利、环境和公共设施管理业"], ["O", "居民服务、修理和其他服务业"], ["P", "教育"],
  ["Q", "卫生和社会工作"], ["R", "文化、体育和娱乐业"], ["S", "公共管理、社会保障和社会组织"],
  ["T", "国际组织"],
].map(([code, label], index) => [code, label, code, "GB/T 4754 门类代码", index + 1]);

const healthStatusItems = [
  ["1", "健康或良好", "健康或良好"],
  ["2", "一般或较弱", "一般或较弱"],
  ["3", "有慢性病", "有慢性疾病"],
  ["6", "残疾", "残疾"],
  ["10", "健康或良好", "健康或良好"],
  ["20", "一般或较弱", "一般或较弱"],
  ["30", "有慢性病", "有慢性疾病"],
  ["31", "心血管病", "心血管疾病"],
  ["32", "脑血管病", "脑血管疾病"],
  ["33", "慢性呼吸系统病", "慢性呼吸系统疾病"],
  ["34", "慢性消化系统病", "慢性消化系统疾病"],
  ["35", "慢性肾炎", "慢性肾炎"],
  ["36", "结核病", "结核病"],
  ["37", "糖尿病", "糖尿病"],
  ["38", "神经或精神疾病", "神经或精神疾病"],
  ["40", "有慢性病", "有慢性疾病"],
  ["41", "癌症", "癌症"],
  ["49", "其他慢性病", "其他慢性疾病"],
  ["60", "残疾", "残疾"],
  ["61", "视力残疾", "视力残疾"],
  ["62", "听力残疾", "听力残疾"],
  ["63", "言语残疾", "言语残疾"],
  ["64", "肢体残疾", "肢体残疾"],
  ["65", "智力残疾", "智力残疾"],
  ["66", "精神残疾", "精神残疾"],
  ["67", "多重残疾", "多重残疾"],
  ["69", "其他残疾", "其他残疾"],
].map(([code, label, meaning], index) => [code, label, code, meaning, index + 1]);

const employmentStatusItems = [
  ["11", "国家公务员", "国家公务员"],
  ["13", "专业技术人员", "专业技术人员"],
  ["17", "职员", "职员"],
  ["21", "企业管理人员", "企业管理人员"],
  ["24", "工人", "工人"],
  ["27", "农民", "农民"],
  ["31", "学生", "学生"],
  ["37", "现役军人", "现役军人"],
  ["51", "自由职业者", "自由职业者"],
  ["54", "个体经营者", "个体经营者"],
  ["70", "无业人员", "无业人员"],
  ["80", "退（离）休人员", "退（离）休人员"],
  ["90", "其他", "其他个人身份"],
].map(([code, label, meaning], index) => [code, label, code, meaning, index + 1]);

const politicalStatusItems = [
  ["01", "中国共产党党员"],
  ["02", "中国共产党预备党员"],
  ["03", "中国共产主义青年团团员"],
  ["04", "中国国民党革命委员会会员"],
  ["05", "中国民主同盟盟员"],
  ["06", "中国民主建国会会员"],
  ["07", "中国民主促进会会员"],
  ["08", "中国农工民主党党员"],
  ["09", "中国致公党党员"],
  ["10", "九三学社社员"],
  ["11", "台湾民主自治同盟盟员"],
  ["12", "无党派民主人士"],
  ["13", "群众"],
].map(([code, label], index) => [code, label, code, "GB/T 4762 政治面貌代码", index + 1]);

const familyRelationItems = [
  ["0", "本人或户主", "本人或户主"],
  ["1", "配偶", "配偶"],
  ["2", "子", "子"],
  ["3", "女", "女"],
  ["4", "孙子、孙女或外孙子、外孙女", "孙子、孙女或外孙子、外孙女"],
  ["5", "父母", "父母"],
  ["6", "祖父母或外祖父母", "祖父母或外祖父母"],
  ["7", "兄、弟、姐、妹", "兄、弟、姐、妹"],
  ["8", "其他", "其他关系"],
  ["01", "本人", "本人"],
  ["02", "户主", "户主"],
  ["10", "配偶", "配偶"],
  ["11", "夫", "夫"],
  ["12", "妻", "妻"],
  ["20", "子", "子"],
  ["21", "独生子", "独生子"],
  ["22", "长子", "长子"],
  ["23", "次子", "次子"],
  ["24", "三子", "三子"],
  ["25", "四子", "四子"],
  ["26", "五子", "五子"],
  ["27", "养子或继子", "养子或继子"],
  ["28", "女婿", "女婿"],
  ["29", "其他儿子", "其他儿子"],
  ["30", "女", "女"],
  ["31", "独生女", "独生女"],
  ["32", "长女", "长女"],
  ["33", "次女", "次女"],
  ["34", "三女", "三女"],
  ["35", "四女", "四女"],
  ["36", "五女", "五女"],
  ["37", "养女或继女", "养女或继女"],
  ["38", "儿媳", "儿媳"],
  ["39", "其他女儿", "其他女儿"],
  ["40", "孙子、孙女或外孙子、外孙女", "孙子、孙女或外孙子、外孙女"],
  ["41", "孙子", "孙子"],
  ["42", "孙女", "孙女"],
  ["43", "外孙子", "外孙子"],
  ["44", "外孙女", "外孙女"],
  ["45", "孙媳妇或外孙媳妇", "孙媳妇或外孙媳妇"],
  ["46", "孙女婿或外孙女婿", "孙女婿或外孙女婿"],
  ["47", "曾孙子或外曾孙子", "曾孙子或外曾孙子"],
  ["48", "曾孙女或外曾孙女", "曾孙女或外曾孙女"],
  ["49", "其他孙子、孙女或外孙子、外孙女", "其他孙子、孙女或外孙子、外孙女"],
  ["50", "父母", "父母"],
  ["51", "父亲", "父亲"],
  ["52", "母亲", "母亲"],
  ["53", "公公", "公公"],
  ["54", "婆婆", "婆婆"],
  ["55", "岳父", "岳父"],
  ["56", "岳母", "岳母"],
  ["57", "继父或养父", "继父或养父"],
  ["58", "继母或养母", "继母或养母"],
  ["59", "其他父母关系", "其他父母关系"],
  ["60", "祖父母或外祖父母", "祖父母或外祖父母"],
  ["61", "祖父", "祖父"],
  ["62", "祖母", "祖母"],
  ["63", "外祖父", "外祖父"],
  ["64", "外祖母", "外祖母"],
  ["65", "配偶的祖父母或外祖父母", "配偶的祖父母或外祖父母"],
  ["66", "曾祖父", "曾祖父"],
  ["67", "曾祖母", "曾祖母"],
  ["68", "配偶的曾祖父母或外曾祖父母", "配偶的曾祖父母或外曾祖父母"],
  ["69", "其他祖父母或外祖父母", "其他祖父母或外祖父母"],
  ["70", "兄、弟、姐、妹", "兄、弟、姐、妹"],
  ["71", "兄", "兄"],
  ["72", "嫂", "嫂"],
  ["73", "弟", "弟"],
  ["74", "弟媳", "弟媳"],
  ["75", "姐姐", "姐姐"],
  ["76", "姐夫", "姐夫"],
  ["77", "妹妹", "妹妹"],
  ["78", "妹夫", "妹夫"],
  ["79", "其他兄弟姐妹", "其他兄弟姐妹"],
  ["80", "其他亲属", "其他亲属"],
  ["81", "伯父", "伯父"],
  ["82", "伯母", "伯母"],
  ["83", "叔父", "叔父"],
  ["84", "婶母", "婶母"],
  ["85", "舅父", "舅父"],
  ["86", "舅母", "舅母"],
  ["87", "姨父", "姨父"],
  ["88", "姨母", "姨母"],
  ["89", "姑父", "姑父"],
  ["90", "姑母", "姑母"],
  ["91", "堂兄弟、堂姐妹", "堂兄弟、堂姐妹"],
  ["92", "表兄弟、表姐妹", "表兄弟、表姐妹"],
  ["93", "侄子", "侄子"],
  ["94", "侄女", "侄女"],
  ["95", "外甥", "外甥"],
  ["96", "外甥女", "外甥女"],
  ["97", "其他亲属", "其他亲属"],
  ["99", "非亲属", "非亲属"],
].map(([code, label, meaning], index) => [code, label, code, meaning, index + 1]);

const degreeItems = [
  ["1", "名誉博士", "名誉博士学位"],
  ["2", "博士", "博士学位"],
  ["201", "哲学博士学位", "哲学博士学位"],
  ["202", "经济学博士学位", "经济学博士学位"],
  ["203", "法学博士学位", "法学博士学位"],
  ["204", "教育学博士学位", "教育学博士学位"],
  ["205", "文学博士学位", "文学博士学位"],
  ["206", "历史学博士学位", "历史学博士学位"],
  ["207", "理学博士学位", "理学博士学位"],
  ["208", "工学博士学位", "工学博士学位"],
  ["209", "农学博士学位", "农学博士学位"],
  ["210", "医学博士学位", "医学博士学位"],
  ["211", "军事学博士学位", "军事学博士学位"],
  ["212", "管理学博士学位", "管理学博士学位"],
  ["245", "临床医学博士专业学位", "临床医学博士专业学位"],
  ["248", "兽医博士专业学位", "兽医博士专业学位"],
  ["250", "口腔医学博士专业学位", "口腔医学博士专业学位"],
  ["3", "硕士", "硕士学位"],
  ["301", "哲学硕士学位", "哲学硕士学位"],
  ["302", "经济学硕士学位", "经济学硕士学位"],
  ["303", "法学硕士学位", "法学硕士学位"],
  ["304", "教育学硕士学位", "教育学硕士学位"],
  ["305", "文学硕士学位", "文学硕士学位"],
  ["306", "历史学硕士学位", "历史学硕士学位"],
  ["307", "理学硕士学位", "理学硕士学位"],
  ["308", "工学硕士学位", "工学硕士学位"],
  ["309", "农学硕士学位", "农学硕士学位"],
  ["310", "医学硕士学位", "医学硕士学位"],
  ["311", "军事学硕士学位", "军事学硕士学位"],
  ["312", "管理学硕士学位", "管理学硕士学位"],
  ["341", "法律硕士专业学位", "法律硕士专业学位"],
  ["342", "教育硕士专业学位", "教育硕士专业学位"],
  ["343", "工程硕士专业学位", "工程硕士专业学位"],
  ["344", "建筑学硕士专业学位", "建筑学硕士专业学位"],
  ["345", "临床医学硕士专业学位", "临床医学硕士专业学位"],
  ["346", "工商管理硕士专业学位", "工商管理硕士专业学位"],
  ["347", "农业推广硕士专业学位", "农业推广硕士专业学位"],
  ["348", "兽医硕士专业学位", "兽医硕士专业学位"],
  ["349", "公共管理硕士专业学位", "公共管理硕士专业学位"],
  ["350", "口腔医学硕士专业学位", "口腔医学硕士专业学位"],
  ["351", "公共卫生硕士专业学位", "公共卫生硕士专业学位"],
  ["352", "军事硕士专业学位", "军事硕士专业学位"],
  ["4", "学士", "学士学位"],
  ["401", "哲学学士学位", "哲学学士学位"],
  ["402", "经济学学士学位", "经济学学士学位"],
  ["403", "法学学士学位", "法学学士学位"],
  ["404", "教育学学士学位", "教育学学士学位"],
  ["405", "文学学士学位", "文学学士学位"],
  ["406", "历史学学士学位", "历史学学士学位"],
  ["407", "理学学士学位", "理学学士学位"],
  ["408", "工学学士学位", "工学学士学位"],
  ["409", "农学学士学位", "农学学士学位"],
  ["410", "医学学士学位", "医学学士学位"],
  ["411", "军事学学士学位", "军事学学士学位"],
  ["412", "管理学学士学位", "管理学学士学位"],
  ["444", "建筑学学士专业学位", "建筑学学士专业学位"],
].map(([code, label, meaning], index) => [code, label, code, meaning, index + 1]);

const currencyItems = [
  ["CNY", "人民币"], ["USD", "美元"], ["EUR", "欧元"], ["HKD", "港币"], ["MOP", "澳门元"],
  ["TWD", "新台币"], ["JPY", "日元"], ["GBP", "英镑"], ["AUD", "澳大利亚元"], ["CAD", "加拿大元"],
  ["SGD", "新加坡元"], ["KRW", "韩元"],
].map(([code, label], index) => [code, label, code, "GB/T 12406 三字母货币代码", index + 1]);

const measureUnitItems = [
  ["C62", "个", "数量单位"],
  ["SET", "套", "成套数量单位"],
  ["H87", "件", "件数单位"],
  ["KGM", "千克", "质量单位"],
  ["TNE", "吨", "质量单位"],
  ["MTR", "米", "长度单位"],
  ["MTK", "平方米", "面积单位"],
  ["MTQ", "立方米", "体积单位"],
  ["LTR", "升", "容量单位"],
  ["HUR", "小时", "时间单位"],
  ["DAY", "日", "时间单位"],
].map(([code, label, meaning], index) => [code, label, code, meaning, index + 1]);

const eventTypeItems = [
  ["01", "登记备案", "登记备案类事件"],
  ["02", "申请受理", "申请受理类事件"],
  ["03", "审核审批", "审核审批类事件"],
  ["04", "变更更正", "变更或更正类事件"],
  ["05", "注销终止", "注销或终止类事件"],
  ["06", "检查巡查", "检查巡查类事件"],
  ["07", "投诉举报", "投诉举报类事件"],
  ["08", "应急处置", "应急处置类事件"],
  ["99", "其他", "其他事件"],
].map(([code, label, meaning], index) => [code, label, code, meaning, index + 1]);

const eventStatusItems = [
  ["01", "待受理", "事件待受理"],
  ["02", "处理中", "事件正在处理"],
  ["03", "已办结", "事件已办结"],
  ["04", "已终止", "事件已终止"],
  ["05", "已撤销", "事件已撤销"],
].map(([code, label, meaning], index) => [code, label, code, meaning, index + 1]);

const eventSourceItems = [
  ["01", "窗口", "线下窗口受理"],
  ["02", "电话", "电话渠道"],
  ["03", "网站", "网站渠道"],
  ["04", "移动端", "移动应用渠道"],
  ["05", "系统交换", "系统接口或数据交换"],
  ["99", "其他", "其他来源"],
].map(([code, label, meaning], index) => [code, label, code, meaning, index + 1]);

const priorityItems = [
  ["1", "低", "低优先级"],
  ["2", "中", "中优先级"],
  ["3", "高", "高优先级"],
  ["4", "紧急", "紧急优先级"],
].map(([code, label, meaning], index) => [code, label, code, meaning, index + 1]);

const severityItems = [
  ["1", "一般", "一般程度"],
  ["2", "较大", "较大程度"],
  ["3", "重大", "重大程度"],
  ["4", "特别重大", "特别重大程度"],
].map(([code, label, meaning], index) => [code, label, code, meaning, index + 1]);

const objectTypeItems = [
  ["01", "实物资产", "实物类资产或物品"],
  ["02", "电子文档", "电子文档或电子资料"],
  ["03", "证照", "证照或证件材料"],
  ["04", "设备", "设备设施"],
  ["05", "车辆", "车辆"],
  ["06", "房屋", "房屋或空间"],
  ["99", "其他", "其他物品资产"],
].map(([code, label, meaning], index) => [code, label, code, meaning, index + 1]);

const administrativeLevelItems = [
  ["10", "国家级", "国家级"],
  ["20", "省级", "省、自治区、直辖市级"],
  ["30", "地市级", "设区市、自治州级"],
  ["40", "区县级", "县、区、县级市级"],
  ["50", "乡镇街道级", "乡、镇、街道级"],
  ["60", "村社级", "村、社区级"],
  ["99", "其他", "其他层级"],
].map(([code, label, meaning], index) => [code, label, code, meaning, index + 1]);

const domainSpecs = [
  {
    code: "VD.YES_NO_10",
    name: "是否标志值域",
    type: "enumeration",
    valueType: "number",
    dataType: "integer",
    referenceCode: "GB_T_19488_1_2004",
    description: "通用是否标志。1 表示是，0 表示否。",
    items: [
      ["1", "是", "1", "肯定值", 1],
      ["0", "否", "0", "否定值", 2],
    ],
  },
  {
    code: "VD.ENABLED_10",
    name: "启停状态值域",
    type: "enumeration",
    valueType: "number",
    dataType: "integer",
    referenceCode: "GB_T_19488_1_2004",
    description: "字典项、代码项启停状态。1 表示启用，0 表示停用。",
    items: [
      ["1", "启用", "1", "代码项可用", 1],
      ["0", "停用", "0", "代码项不可用", 2],
    ],
  },
  {
    code: "VD.GB_SEX_CODE",
    name: "人的性别代码值域",
    type: "enumeration",
    valueType: "number",
    dataType: "integer",
    referenceCode: "GB_T_2261_1_2003",
    referenceClause: "人的性别代码",
    description: "性别代码值域，同时兼容当前 ODS 中 0、1、2 的存量编码。",
    items: [
      ["0", "未知的性别", "0", "未知或未采集", 1],
      ["1", "男性", "1", "男", 2],
      ["2", "女性", "2", "女", 3],
      ["9", "未说明的性别", "9", "未说明", 4],
    ],
  },
  {
    code: "VD.MARITAL_STATUS_CODE",
    name: "婚姻状况代码值域",
    type: "enumeration",
    valueType: "string",
    dataType: "varchar(2)",
    referenceCode: "GB_T_2261_2_2003",
    referenceClause: "婚姻状况代码",
    description: "自然人婚姻状况代码值域。",
    items: [
      ["10", "未婚", "10", "未婚", 10],
      ["20", "已婚", "20", "已婚", 20],
      ["21", "初婚", "21", "初婚", 21],
      ["22", "再婚", "22", "再婚", 22],
      ["23", "复婚", "23", "复婚", 23],
      ["30", "丧偶", "30", "丧偶", 30],
      ["40", "离婚", "40", "离婚", 40],
      ["90", "未说明的婚姻状况", "90", "未说明", 90],
    ],
  },
  {
    code: "VD.ETHNIC_GROUP_CODE",
    name: "民族代码值域",
    type: "reference",
    valueType: "string",
    dataType: "varchar(2)",
    referenceCode: "GB_T_3304_1991",
    description: "民族字段采用 GB/T 3304 规定的民族代码。",
    items: ethnicGroupItems,
  },
  {
    code: "VD.EDUCATION_LEVEL_CODE",
    name: "学历代码值域",
    type: "reference",
    valueType: "string",
    dataType: "varchar(2)",
    referenceCode: "GB_T_4658_2006",
    description: "学历字段采用 GB/T 4658 规定的学历代码。",
    items: educationLevelItems,
  },
  {
    code: "VD.OCCUPATION_CODE",
    name: "职业大类代码值域",
    type: "reference",
    valueType: "string",
    dataType: "varchar(8)",
    referenceCode: "GB_T_6565_2015",
    description: "内置 GB/T 6565 职业大类代码；完整中类、小类、细类代码应通过标准字典导入维护。",
    items: occupationItems,
  },
  {
    code: "VD.CERT_TYPE_MARRIAGE",
    name: "身份证件类型值域",
    type: "enumeration",
    valueType: "string",
    dataType: "varchar(2)",
    referenceCode: "GB_T_19488_2_2008",
    description: "自然人身份证件类型的通用代码集。",
    items: [
      ["01", "居民身份证", "01", "中华人民共和国居民身份证", 1],
      ["02", "港澳居民来往内地通行证", "02", "港澳居民来往内地通行证", 2],
      ["03", "台湾居民来往大陆通行证", "03", "台湾居民来往大陆通行证", 3],
      ["04", "护照", "04", "有效护照", 4],
      ["99", "其他有效证件", "99", "法律法规认可的其他有效身份证件", 99],
    ],
  },
  {
    code: "VD.REGION_CODE_CN",
    name: "中国行政区划代码值域",
    type: "regex",
    valueType: "string",
    dataType: "varchar(6)",
    regexPattern: "^[0-9]{6}$",
    formatPattern: "6位数字",
    referenceCode: "GB_T_2260_2007",
    description: "县级及县级以上行政区划的 6 位数字代码。",
  },
  {
    code: "VD.ID_CARD_NO_CN",
    name: "居民身份证号码值域",
    type: "regex",
    valueType: "string",
    dataType: "varchar(18)",
    regexPattern: "^[1-9][0-9]{5}(18|19|20)[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[0-9]{3}[0-9Xx]$",
    formatPattern: "18位居民身份号码",
    referenceCode: "GB_11643_1999",
    description: "居民身份证号码长度与结构校验。",
  },
  {
    code: "VD.MOBILE_PHONE_CN",
    name: "中国大陆手机号码值域",
    type: "regex",
    valueType: "string",
    dataType: "varchar(11)",
    regexPattern: "^1[3-9][0-9]{9}$",
    formatPattern: "11位手机号码",
    referenceCode: "GB_T_19488_2_2008",
    description: "联系电话字段的手机号码格式约束。",
  },
  {
    code: "VD.FIXED_PHONE_CN",
    name: "固定电话号码值域",
    type: "regex",
    valueType: "string",
    dataType: "varchar(32)",
    regexPattern: "^(0[0-9]{2,3}-?)?[0-9]{7,8}(-[0-9]{1,6})?$",
    formatPattern: "区号-号码-分机",
    referenceCode: "GB_T_19488_2_2008",
    description: "机构联系电话、办公电话等固定电话格式约束。",
  },
  {
    code: "VD.EMAIL",
    name: "电子邮箱值域",
    type: "regex",
    valueType: "string",
    dataType: "varchar(128)",
    regexPattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$",
    formatPattern: "local@domain",
    referenceCode: "GB_T_19488_2_2008",
    description: "机构联系邮箱格式约束。",
  },
  {
    code: "VD.POSTAL_CODE_CN",
    name: "邮政编码值域",
    type: "regex",
    valueType: "string",
    dataType: "varchar(6)",
    regexPattern: "^[0-9]{6}$",
    formatPattern: "6位数字",
    referenceCode: "GB_T_19488_2_2008",
    description: "中国大陆邮政编码格式约束。",
  },
  {
    code: "VD.DATE_ISO",
    name: "日期格式值域",
    type: "regex",
    valueType: "date",
    dataType: "date",
    regexPattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$",
    formatPattern: "yyyy-MM-dd",
    referenceCode: "GB_T_7408_1_2023",
    description: "ODS 日期字段统一采用 yyyy-MM-dd 交换格式。",
  },
  {
    code: "VD.DATETIME_SECOND",
    name: "日期时间格式值域",
    type: "regex",
    valueType: "datetime",
    dataType: "datetime",
    regexPattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}$",
    formatPattern: "yyyy-MM-dd HH:mm:ss",
    referenceCode: "GB_T_7408_1_2023",
    description: "ODS 日期时间字段统一精确到秒。",
  },
  {
    code: "VD.NATIONALITY_CODE",
    name: "常用国家和地区代码值域",
    type: "reference",
    valueType: "string",
    dataType: "varchar(3)",
    referenceCode: "GB_T_2659_1_2022",
    description: "内置常用 GB/T 2659.1 alpha-3 代码；完整国家和地区代码表建议通过外部标准字典同步维护。",
    items: nationalityItems,
  },
  {
    code: "VD.SOCIAL_CREDIT_CODE",
    name: "统一社会信用代码值域",
    type: "regex",
    valueType: "string",
    dataType: "varchar(18)",
    regexPattern: "^[0-9A-HJ-NPQRTUWXY]{2}[0-9]{6}[0-9A-HJ-NPQRTUWXY]{10}$",
    formatPattern: "18位统一社会信用代码",
    referenceCode: "GB_32100_2015",
    description: "法人和其他组织统一社会信用代码格式约束。",
  },
  {
    code: "VD.ORG_TYPE_CODE",
    name: "组织机构类型代码值域",
    type: "reference",
    valueType: "string",
    dataType: "varchar(4)",
    referenceCode: "GB_T_20091_2021",
    description: "组织机构类型字段采用 GB/T 20091 规定的分类代码。",
    items: organizationTypeItems,
  },
  {
    code: "VD.ECONOMIC_TYPE_CODE",
    name: "经济类型代码值域",
    type: "reference",
    valueType: "string",
    dataType: "varchar(3)",
    referenceCode: "GB_T_12402_2000",
    description: "企业经济类型字段采用 GB/T 12402 规定的分类代码。",
    items: economicTypeItems,
  },
  {
    code: "VD.INDUSTRY_CODE",
    name: "国民经济行业门类代码值域",
    type: "reference",
    valueType: "string",
    dataType: "varchar(4)",
    referenceCode: "GB_T_4754_2017",
    description: "内置 GB/T 4754 门类代码；完整大类、中类、小类代码应通过标准字典导入维护。",
    items: industryItems,
  },
  {
    code: "VD.HEALTH_STATUS_CODE",
    name: "健康状况代码值域",
    type: "enumeration",
    valueType: "string",
    dataType: "varchar(2)",
    referenceCode: "GB_T_2261_3_2003",
    description: "自然人健康状况代码值域，包含 GB/T 2261.3 的一位和二位代码。",
    items: healthStatusItems,
  },
  {
    code: "VD.EMPLOYMENT_STATUS_CODE",
    name: "从业状况代码值域",
    type: "enumeration",
    valueType: "string",
    dataType: "varchar(2)",
    referenceCode: "GB_T_2261_4_2003",
    description: "自然人从业状况或个人身份代码值域。",
    items: employmentStatusItems,
  },
  {
    code: "VD.POLITICAL_STATUS_CODE",
    name: "政治面貌代码值域",
    type: "reference",
    valueType: "string",
    dataType: "varchar(2)",
    referenceCode: "GB_T_4762_1984",
    description: "政治面貌字段采用 GB/T 4762 规定的代码。",
    items: politicalStatusItems,
  },
  {
    code: "VD.FAMILY_RELATION_CODE",
    name: "家庭关系代码值域",
    type: "reference",
    valueType: "string",
    dataType: "varchar(2)",
    referenceCode: "GB_T_4761_2008",
    description: "家庭成员、户主关系字段采用 GB/T 4761 规定的代码。",
    items: familyRelationItems,
  },
  {
    code: "VD.DEGREE_CODE",
    name: "学位代码值域",
    type: "reference",
    valueType: "string",
    dataType: "varchar(3)",
    referenceCode: "GB_T_6864_2003",
    description: "学位字段采用 GB/T 6864 规定的代码。",
    items: degreeItems,
  },
  {
    code: "VD.LOCAL_REGION_CODE",
    name: "基层区划代码值域",
    type: "regex",
    valueType: "string",
    dataType: "varchar(12)",
    regexPattern: "^[0-9]{9,12}$",
    formatPattern: "9至12位数字",
    referenceCode: "GB_T_10114_2003",
    description: "乡镇、街道、村社等县级以下行政区划代码格式。",
  },
  {
    code: "VD.LONGITUDE",
    name: "经度值域",
    type: "range",
    valueType: "number",
    dataType: "decimal(10,6)",
    minValue: -180,
    maxValue: 180,
    unit: "度",
    referenceCode: "GB_T_16831_2013",
    description: "地理点经度，取值范围为 -180 至 180。",
  },
  {
    code: "VD.LATITUDE",
    name: "纬度值域",
    type: "range",
    valueType: "number",
    dataType: "decimal(10,6)",
    minValue: -90,
    maxValue: 90,
    unit: "度",
    referenceCode: "GB_T_16831_2013",
    description: "地理点纬度，取值范围为 -90 至 90。",
  },
  {
    code: "VD.EVENT_TYPE_CODE",
    name: "事件类型代码值域",
    type: "enumeration",
    valueType: "string",
    dataType: "varchar(2)",
    referenceCode: "GB_T_7027_2002",
    description: "按信息分类编码原则设计的通用事件类型代码集。",
    items: eventTypeItems,
  },
  {
    code: "VD.EVENT_STATUS_CODE",
    name: "事件状态代码值域",
    type: "enumeration",
    valueType: "string",
    dataType: "varchar(2)",
    referenceCode: "GB_T_7027_2002",
    description: "事件生命周期状态代码集。",
    items: eventStatusItems,
  },
  {
    code: "VD.EVENT_SOURCE_CODE",
    name: "事件来源代码值域",
    type: "enumeration",
    valueType: "string",
    dataType: "varchar(2)",
    referenceCode: "GB_T_7027_2002",
    description: "事件来源渠道代码集。",
    items: eventSourceItems,
  },
  {
    code: "VD.PRIORITY_CODE",
    name: "优先级代码值域",
    type: "enumeration",
    valueType: "string",
    dataType: "varchar(1)",
    referenceCode: "GB_T_7027_2002",
    description: "通用优先级代码集。",
    items: priorityItems,
  },
  {
    code: "VD.SEVERITY_CODE",
    name: "严重程度代码值域",
    type: "enumeration",
    valueType: "string",
    dataType: "varchar(1)",
    referenceCode: "GB_T_7027_2002",
    description: "事件、风险或问题严重程度代码集。",
    items: severityItems,
  },
  {
    code: "VD.OBJECT_TYPE_CODE",
    name: "物品资产类型代码值域",
    type: "enumeration",
    valueType: "string",
    dataType: "varchar(2)",
    referenceCode: "GB_T_7027_2002",
    description: "物品、资产、产品、设备等对象类型代码集。",
    items: objectTypeItems,
  },
  {
    code: "VD.CURRENCY_CODE",
    name: "常用货币代码值域",
    type: "reference",
    valueType: "string",
    dataType: "varchar(3)",
    referenceCode: "GB_T_12406_2022",
    description: "内置常用 GB/T 12406 三字母货币代码；完整货币代码表建议通过外部标准字典同步维护。",
    items: currencyItems,
  },
  {
    code: "VD.MEASURE_UNIT_CODE",
    name: "常用计量单位代码值域",
    type: "reference",
    valueType: "string",
    dataType: "varchar(8)",
    referenceCode: "GB_T_17295_2008",
    description: "内置常用 GB/T 17295 计量单位代码；完整计量单位代码表建议通过外部标准字典同步维护。",
    items: measureUnitItems,
  },
  {
    code: "VD.ADMINISTRATIVE_LEVEL_CODE",
    name: "行政层级代码值域",
    type: "enumeration",
    valueType: "string",
    dataType: "varchar(2)",
    referenceCode: "GB_T_2260_2007",
    description: "行政管理层级代码集。",
    items: administrativeLevelItems,
  },
  {
    code: "VD.URL",
    name: "网址值域",
    type: "regex",
    valueType: "string",
    dataType: "varchar(255)",
    regexPattern: "^https?://[^\\s]+$",
    formatPattern: "http(s)://domain/path",
    referenceCode: "GB_T_19488_2_2008",
    description: "网站、网页和资源链接字段的格式约束。",
  },
];

const elementCodePrefixes = {
  national: "GB",
  industry: "HB",
  enterprise: "QB",
};
const elementCodeCounters = {
  national: 0,
  industry: 0,
  enterprise: 0,
};

function inferElementStandardType() {
  return "national";
}

function nextSeedElementCode(standardType) {
  const type = elementCodePrefixes[standardType] ? standardType : "national";
  elementCodeCounters[type] += 1;
  return `${elementCodePrefixes[type]}${String(elementCodeCounters[type]).padStart(4, "0")}`;
}

function extraElement(identifier, nameCn, nameEn, catalogCode, objectClass, propertyName, representationTerm, definition, dataType, options = {}) {
  return e(`STD.${identifier}`, identifier, nameCn, nameEn, catalogCode, objectClass, propertyName, representationTerm, [], definition, dataType, options);
}

function buildAdditionalNationalElementSpecs() {
  return [
    extraElement("PERSON.FAMILY_NAME", "姓氏", "FamilyName", "STD.PERSON", "自然人", "姓氏", "名称", "自然人的姓氏。", "string", { maxLength: 64, referenceCode: "GB_T_19488_2_2008", tags: ["人员主体", "姓名"] }),
    extraElement("PERSON.GIVEN_NAME", "名字", "GivenName", "STD.PERSON", "自然人", "名字", "名称", "自然人的名字。", "string", { maxLength: 64, referenceCode: "GB_T_19488_2_2008", tags: ["人员主体", "姓名"] }),
    extraElement("PERSON.FORMER_NAME", "曾用名", "FormerName", "STD.PERSON", "自然人", "曾用名", "名称", "自然人曾经使用过的姓名。", "string", { maxLength: 64, referenceCode: "GB_T_19488_2_2008", tags: ["人员主体", "姓名"] }),
    extraElement("PERSON.PINYIN_NAME", "姓名拼音", "NamePinyin", "STD.PERSON", "自然人", "姓名拼音", "名称", "自然人姓名的汉语拼音表示。", "string", { maxLength: 128, referenceCode: "GB_T_19488_2_2008", tags: ["人员主体", "姓名"] }),
    extraElement("PERSON.HEALTH_STATUS_CODE", "健康状况代码", "HealthStatusCode", "STD.PERSON", "自然人", "健康状况", "代码", "自然人的健康状况代码。", "string", { maxLength: 2, valueDomainCode: "VD.HEALTH_STATUS_CODE", referenceCode: "GB_T_2261_3_2003", tags: ["人员主体", "值域"] }),
    extraElement("PERSON.EMPLOYMENT_STATUS_CODE", "从业状况代码", "EmploymentStatusCode", "STD.PERSON", "自然人", "从业状况", "代码", "自然人的从业状况或个人身份代码。", "string", { maxLength: 2, valueDomainCode: "VD.EMPLOYMENT_STATUS_CODE", referenceCode: "GB_T_2261_4_2003", tags: ["人员主体", "值域"] }),
    extraElement("PERSON.POLITICAL_STATUS_CODE", "政治面貌代码", "PoliticalStatusCode", "STD.PERSON", "自然人", "政治面貌", "代码", "自然人的政治面貌代码。", "string", { maxLength: 2, valueDomainCode: "VD.POLITICAL_STATUS_CODE", referenceCode: "GB_T_4762_1984", tags: ["人员主体", "值域"] }),
    extraElement("PERSON.HOUSEHOLD_RELATION_CODE", "户主关系代码", "HouseholdRelationCode", "STD.PERSON", "自然人", "户主关系", "代码", "自然人与户主之间的家庭关系代码。", "string", { maxLength: 2, valueDomainCode: "VD.FAMILY_RELATION_CODE", referenceCode: "GB_T_4761_2008", tags: ["人员主体", "家庭关系", "值域"] }),
    extraElement("PERSON.DEGREE_CODE", "学位代码", "DegreeCode", "STD.PERSON", "自然人", "学位", "代码", "自然人取得的最高或当前学位代码。", "string", { maxLength: 3, valueDomainCode: "VD.DEGREE_CODE", referenceCode: "GB_T_6864_2003", tags: ["人员主体", "教育", "值域"] }),
    extraElement("PERSON.WORK_UNIT_NAME", "工作单位名称", "WorkUnitName", "STD.PERSON", "自然人", "工作单位", "名称", "自然人当前工作单位的规范名称。", "string", { maxLength: 128, referenceCode: "GB_T_36104_2018", tags: ["人员主体", "组织机构"] }),
    extraElement("PERSON.WORK_UNIT_CODE", "工作单位统一社会信用代码", "WorkUnitUnifiedSocialCreditCode", "STD.PERSON", "自然人", "工作单位统一社会信用代码", "代码", "自然人当前工作单位的统一社会信用代码。", "string", { maxLength: 18, valueDomainCode: "VD.SOCIAL_CREDIT_CODE", referenceCode: "GB_32100_2015", tags: ["人员主体", "组织机构", "值域"] }),
    extraElement("PERSON.PERMANENT_REGION_CODE", "户籍地区划代码", "PermanentResidenceRegionCode", "STD.PERSON", "自然人", "户籍地区划", "代码", "自然人户籍所在地行政区划代码。", "string", { maxLength: 6, valueDomainCode: "VD.REGION_CODE_CN", referenceCode: "GB_T_2260_2007", tags: ["人员主体", "区划", "值域"] }),
    extraElement("PERSON.PERMANENT_REGION_NAME", "户籍地区划名称", "PermanentResidenceRegionName", "STD.PERSON", "自然人", "户籍地区划", "名称", "自然人户籍所在地行政区划名称。", "string", { maxLength: 128, referenceCode: "GB_T_2260_2007", tags: ["人员主体", "区划"] }),
    extraElement("PERSON.PERMANENT_ADDRESS", "户籍详细地址", "PermanentResidenceAddress", "STD.PERSON", "自然人", "户籍地址", "文本", "自然人户籍所在地详细地址。", "string", { maxLength: 255, referenceCode: "GB_T_19488_2_2008", tags: ["人员主体", "地址"] }),
    extraElement("PERSON.CURRENT_REGION_CODE", "现住地区划代码", "CurrentResidenceRegionCode", "STD.PERSON", "自然人", "现住地区划", "代码", "自然人现居住地行政区划代码。", "string", { maxLength: 6, valueDomainCode: "VD.REGION_CODE_CN", referenceCode: "GB_T_2260_2007", tags: ["人员主体", "区划", "值域"] }),
    extraElement("PERSON.CURRENT_ADDRESS", "现住详细地址", "CurrentResidenceAddress", "STD.PERSON", "自然人", "现住地址", "文本", "自然人现居住地详细地址。", "string", { maxLength: 255, referenceCode: "GB_T_19488_2_2008", tags: ["人员主体", "地址"] }),
    extraElement("PERSON.EMERGENCY_CONTACT_NAME", "紧急联系人姓名", "EmergencyContactName", "STD.PERSON", "自然人", "紧急联系人", "名称", "自然人的紧急联系人姓名。", "string", { maxLength: 64, referenceCode: "GB_T_19488_2_2008", tags: ["人员主体", "联系人"] }),
    extraElement("PERSON.EMERGENCY_CONTACT_PHONE", "紧急联系人电话", "EmergencyContactPhone", "STD.PERSON", "自然人", "紧急联系人电话", "号码", "自然人的紧急联系人电话号码。", "string", { maxLength: 32, referenceCode: "GB_T_19488_2_2008", tags: ["人员主体", "联系方式"] }),
    extraElement("PERSON.GUARDIAN_NAME", "监护人姓名", "GuardianName", "STD.PERSON", "自然人", "监护人", "名称", "自然人的监护人姓名。", "string", { maxLength: 64, referenceCode: "GB_T_19488_2_2008", tags: ["人员主体", "监护人"] }),
    extraElement("PERSON.GUARDIAN_ID_NO", "监护人身份证件号码", "GuardianIdentityDocumentNumber", "STD.PERSON", "自然人", "监护人身份证件号码", "号码", "自然人监护人的身份证件号码；居民身份证号码应符合 GB 11643。", "string", { maxLength: 18, valueDomainCode: "VD.ID_CARD_NO_CN", referenceCode: "GB_11643_1999", tags: ["人员主体", "监护人", "敏感个人信息"] }),

    extraElement("PLACE.REGION_CODE", "行政区划代码", "AdministrativeRegionCode", "STD.PLACE", "行政区划", "区划代码", "代码", "县级及县级以上行政区划代码。", "string", { maxLength: 6, valueDomainCode: "VD.REGION_CODE_CN", referenceCode: "GB_T_2260_2007", tags: ["地理位置", "区划", "值域"] }),
    extraElement("PLACE.REGION_NAME", "行政区划名称", "AdministrativeRegionName", "STD.PLACE", "行政区划", "区划名称", "名称", "县级及县级以上行政区划名称。", "string", { maxLength: 128, referenceCode: "GB_T_2260_2007", tags: ["地理位置", "区划"] }),
    extraElement("PLACE.PROVINCE_CODE", "省级区划代码", "ProvinceRegionCode", "STD.PLACE", "行政区划", "省级区划", "代码", "省、自治区、直辖市级行政区划代码。", "string", { maxLength: 6, valueDomainCode: "VD.REGION_CODE_CN", referenceCode: "GB_T_2260_2007", tags: ["地理位置", "区划", "值域"] }),
    extraElement("PLACE.PROVINCE_NAME", "省级区划名称", "ProvinceRegionName", "STD.PLACE", "行政区划", "省级区划", "名称", "省、自治区、直辖市级行政区划名称。", "string", { maxLength: 128, referenceCode: "GB_T_2260_2007", tags: ["地理位置", "区划"] }),
    extraElement("PLACE.CITY_CODE", "地市级区划代码", "CityRegionCode", "STD.PLACE", "行政区划", "地市级区划", "代码", "设区市、自治州等地市级行政区划代码。", "string", { maxLength: 6, valueDomainCode: "VD.REGION_CODE_CN", referenceCode: "GB_T_2260_2007", tags: ["地理位置", "区划", "值域"] }),
    extraElement("PLACE.CITY_NAME", "地市级区划名称", "CityRegionName", "STD.PLACE", "行政区划", "地市级区划", "名称", "设区市、自治州等地市级行政区划名称。", "string", { maxLength: 128, referenceCode: "GB_T_2260_2007", tags: ["地理位置", "区划"] }),
    extraElement("PLACE.COUNTY_CODE", "区县级区划代码", "CountyRegionCode", "STD.PLACE", "行政区划", "区县级区划", "代码", "县、区、县级市等区县级行政区划代码。", "string", { maxLength: 6, valueDomainCode: "VD.REGION_CODE_CN", referenceCode: "GB_T_2260_2007", tags: ["地理位置", "区划", "值域"] }),
    extraElement("PLACE.COUNTY_NAME", "区县级区划名称", "CountyRegionName", "STD.PLACE", "行政区划", "区县级区划", "名称", "县、区、县级市等区县级行政区划名称。", "string", { maxLength: 128, referenceCode: "GB_T_2260_2007", tags: ["地理位置", "区划"] }),
    extraElement("PLACE.TOWNSHIP_CODE", "乡镇街道代码", "TownshipRegionCode", "STD.PLACE", "行政区划", "乡镇街道", "代码", "乡、镇、街道等县级以下行政区划代码。", "string", { maxLength: 12, valueDomainCode: "VD.LOCAL_REGION_CODE", referenceCode: "GB_T_10114_2003", tags: ["地理位置", "基层区划", "值域"] }),
    extraElement("PLACE.TOWNSHIP_NAME", "乡镇街道名称", "TownshipRegionName", "STD.PLACE", "行政区划", "乡镇街道", "名称", "乡、镇、街道等县级以下行政区划名称。", "string", { maxLength: 128, referenceCode: "GB_T_10114_2003", tags: ["地理位置", "基层区划"] }),
    extraElement("PLACE.VILLAGE_CODE", "村社区代码", "VillageRegionCode", "STD.PLACE", "行政区划", "村社区", "代码", "村、社区等基层治理单元代码。", "string", { maxLength: 12, valueDomainCode: "VD.LOCAL_REGION_CODE", referenceCode: "GB_T_10114_2003", tags: ["地理位置", "基层区划", "值域"] }),
    extraElement("PLACE.VILLAGE_NAME", "村社区名称", "VillageRegionName", "STD.PLACE", "行政区划", "村社区", "名称", "村、社区等基层治理单元名称。", "string", { maxLength: 128, referenceCode: "GB_T_10114_2003", tags: ["地理位置", "基层区划"] }),
    extraElement("PLACE.ADDRESS_FULL_NAME", "详细地址", "FullAddress", "STD.PLACE", "地址", "详细地址", "文本", "用于定位自然人、组织、事件或物品的完整详细地址。", "string", { maxLength: 255, referenceCode: "GB_T_19488_2_2008", tags: ["地理位置", "地址"] }),
    extraElement("PLACE.STREET_ROAD_NAME", "街路巷名称", "StreetRoadName", "STD.PLACE", "地址", "街路巷", "名称", "地址中的街、路、巷、弄等名称。", "string", { maxLength: 128, referenceCode: "GB_T_19488_2_2008", tags: ["地理位置", "地址"] }),
    extraElement("PLACE.DOORPLATE_NO", "门牌号码", "DoorplateNumber", "STD.PLACE", "地址", "门牌", "号码", "地址中的门牌号码。", "string", { maxLength: 32, referenceCode: "GB_T_19488_2_2008", tags: ["地理位置", "地址"] }),
    extraElement("PLACE.BUILDING_NO", "楼栋号", "BuildingNumber", "STD.PLACE", "建筑物", "楼栋", "号码", "建筑物或院落中的楼栋编号。", "string", { maxLength: 32, referenceCode: "GB_T_19488_2_2008", tags: ["地理位置", "建筑物"] }),
    extraElement("PLACE.UNIT_NO", "单元号", "UnitNumber", "STD.PLACE", "建筑物", "单元", "号码", "建筑物中的单元编号。", "string", { maxLength: 32, referenceCode: "GB_T_19488_2_2008", tags: ["地理位置", "建筑物"] }),
    extraElement("PLACE.ROOM_NO", "房间号", "RoomNumber", "STD.PLACE", "建筑物", "房间", "号码", "建筑物中的房间或户室编号。", "string", { maxLength: 32, referenceCode: "GB_T_19488_2_2008", tags: ["地理位置", "建筑物"] }),
    extraElement("PLACE.LONGITUDE", "经度", "Longitude", "STD.PLACE", "地理点", "经度", "数量", "地理点位置的经度值。", "decimal", { precision: 10, scale: 6, valueDomainCode: "VD.LONGITUDE", unit: "度", referenceCode: "GB_T_16831_2013", tags: ["地理位置", "坐标", "值域"] }),
    extraElement("PLACE.LATITUDE", "纬度", "Latitude", "STD.PLACE", "地理点", "纬度", "数量", "地理点位置的纬度值。", "decimal", { precision: 10, scale: 6, valueDomainCode: "VD.LATITUDE", unit: "度", referenceCode: "GB_T_16831_2013", tags: ["地理位置", "坐标", "值域"] }),

    extraElement("EVENT.ID", "事件标识符", "EventIdentifier", "STD.EVENT", "事件", "标识符", "标识符", "唯一标识一个事件、活动、办理或处置过程的标识符。", "string", { maxLength: 64, referenceCode: "GB_T_19488_1_2004", tags: ["事件活动", "主键"] }),
    extraElement("EVENT.CODE", "事件编码", "EventCode", "STD.EVENT", "事件", "编码", "代码", "在业务范围内唯一标识事件的编码。", "string", { maxLength: 64, referenceCode: "GB_T_19488_1_2004", tags: ["事件活动", "编码"] }),
    extraElement("EVENT.NAME", "事件名称", "EventName", "STD.EVENT", "事件", "名称", "名称", "事件、活动、办理或处置事项的名称。", "string", { maxLength: 128, referenceCode: "GB_T_19488_2_2008", tags: ["事件活动", "名称"] }),
    extraElement("EVENT.TYPE_CODE", "事件类型代码", "EventTypeCode", "STD.EVENT", "事件", "类型", "代码", "事件分类或业务类型代码。", "string", { maxLength: 2, valueDomainCode: "VD.EVENT_TYPE_CODE", referenceCode: "GB_T_7027_2002", tags: ["事件活动", "值域"] }),
    extraElement("EVENT.STATUS_CODE", "事件状态代码", "EventStatusCode", "STD.EVENT", "事件", "状态", "代码", "事件生命周期或办理状态代码。", "string", { maxLength: 2, valueDomainCode: "VD.EVENT_STATUS_CODE", referenceCode: "GB_T_7027_2002", tags: ["事件活动", "状态", "值域"] }),
    extraElement("EVENT.START_TIME", "开始时间", "StartTime", "STD.EVENT", "事件", "开始时间", "日期时间", "事件开始发生、开始办理或开始执行的时间。", "datetime", { valueDomainCode: "VD.DATETIME_SECOND", referenceCode: "GB_T_7408_1_2023", tags: ["事件活动", "时间"] }),
    extraElement("EVENT.END_TIME", "结束时间", "EndTime", "STD.EVENT", "事件", "结束时间", "日期时间", "事件结束、办结或停止执行的时间。", "datetime", { valueDomainCode: "VD.DATETIME_SECOND", referenceCode: "GB_T_7408_1_2023", tags: ["事件活动", "时间"] }),
    extraElement("EVENT.OCCUR_DATE", "发生日期", "OccurrenceDate", "STD.EVENT", "事件", "发生日期", "日期", "事件实际发生日期。", "date", { valueDomainCode: "VD.DATE_ISO", referenceCode: "GB_T_7408_1_2023", tags: ["事件活动", "日期"] }),
    extraElement("EVENT.OCCUR_REGION_CODE", "发生地区划代码", "OccurrenceRegionCode", "STD.EVENT", "事件", "发生地区划", "代码", "事件发生地所属行政区划代码。", "string", { maxLength: 6, valueDomainCode: "VD.REGION_CODE_CN", referenceCode: "GB_T_2260_2007", tags: ["事件活动", "区划", "值域"] }),
    extraElement("EVENT.OCCUR_ADDRESS", "发生详细地址", "OccurrenceAddress", "STD.EVENT", "事件", "发生地址", "文本", "事件发生地的详细地址。", "string", { maxLength: 255, referenceCode: "GB_T_19488_2_2008", tags: ["事件活动", "地址"] }),
    extraElement("EVENT.REPORT_TIME", "上报时间", "ReportTime", "STD.EVENT", "事件", "上报时间", "日期时间", "事件被上报、登记或提交的时间。", "datetime", { valueDomainCode: "VD.DATETIME_SECOND", referenceCode: "GB_T_7408_1_2023", tags: ["事件活动", "时间"] }),
    extraElement("EVENT.REPORTER_NAME", "上报人姓名", "ReporterName", "STD.EVENT", "事件", "上报人", "名称", "事件上报人、登记人或提交人的姓名。", "string", { maxLength: 64, referenceCode: "GB_T_19488_2_2008", tags: ["事件活动", "人员"] }),
    extraElement("EVENT.REPORTER_PHONE", "上报人联系电话", "ReporterContactPhone", "STD.EVENT", "事件", "上报人联系电话", "号码", "事件上报人、登记人或提交人的联系电话。", "string", { maxLength: 32, referenceCode: "GB_T_19488_2_2008", tags: ["事件活动", "联系方式"] }),
    extraElement("EVENT.RESPONSIBLE_ORG_CODE", "责任机构代码", "ResponsibleOrganizationCode", "STD.EVENT", "事件", "责任机构", "代码", "负责办理、处置或管理事件的组织机构代码。", "string", { maxLength: 18, referenceCode: "GB_32100_2015", tags: ["事件活动", "组织机构"] }),
    extraElement("EVENT.RESPONSIBLE_ORG_NAME", "责任机构名称", "ResponsibleOrganizationName", "STD.EVENT", "事件", "责任机构", "名称", "负责办理、处置或管理事件的组织机构名称。", "string", { maxLength: 128, referenceCode: "GB_T_36104_2018", tags: ["事件活动", "组织机构"] }),
    extraElement("EVENT.PRIORITY_CODE", "优先级代码", "PriorityCode", "STD.EVENT", "事件", "优先级", "代码", "事件处理优先级代码。", "string", { maxLength: 1, valueDomainCode: "VD.PRIORITY_CODE", referenceCode: "GB_T_7027_2002", tags: ["事件活动", "值域"] }),
    extraElement("EVENT.SEVERITY_CODE", "严重程度代码", "SeverityCode", "STD.EVENT", "事件", "严重程度", "代码", "事件、风险或问题的严重程度代码。", "string", { maxLength: 1, valueDomainCode: "VD.SEVERITY_CODE", referenceCode: "GB_T_7027_2002", tags: ["事件活动", "值域"] }),
    extraElement("EVENT.SOURCE_CODE", "事件来源代码", "EventSourceCode", "STD.EVENT", "事件", "来源", "代码", "事件来源渠道代码。", "string", { maxLength: 2, valueDomainCode: "VD.EVENT_SOURCE_CODE", referenceCode: "GB_T_7027_2002", tags: ["事件活动", "值域"] }),
    extraElement("EVENT.DESCRIPTION", "事件描述", "EventDescription", "STD.EVENT", "事件", "描述", "文本", "对事件背景、事实、经过或诉求的文字描述。", "text", { maxLength: 2000, referenceCode: "GB_T_19488_1_2004", tags: ["事件活动", "说明"] }),
    extraElement("EVENT.RESULT_DESCRIPTION", "处理结果描述", "ResultDescription", "STD.EVENT", "事件", "处理结果", "文本", "对事件办理、处置或执行结果的文字描述。", "text", { maxLength: 2000, referenceCode: "GB_T_19488_1_2004", tags: ["事件活动", "结果"] }),

    extraElement("OBJECT.ID", "物品标识符", "ObjectIdentifier", "STD.OBJECT", "物品资产", "标识符", "标识符", "唯一标识一个物品、资产、产品或设备的标识符。", "string", { maxLength: 64, referenceCode: "GB_T_19488_1_2004", tags: ["物品资产", "主键"] }),
    extraElement("OBJECT.CODE", "物品编码", "ObjectCode", "STD.OBJECT", "物品资产", "编码", "代码", "在业务范围内唯一标识物品、资产、产品或设备的编码。", "string", { maxLength: 64, referenceCode: "GB_T_19488_1_2004", tags: ["物品资产", "编码"] }),
    extraElement("OBJECT.NAME", "物品名称", "ObjectName", "STD.OBJECT", "物品资产", "名称", "名称", "物品、资产、产品或设备的规范名称。", "string", { maxLength: 128, referenceCode: "GB_T_19488_2_2008", tags: ["物品资产", "名称"] }),
    extraElement("OBJECT.TYPE_CODE", "物品资产类型代码", "ObjectTypeCode", "STD.OBJECT", "物品资产", "类型", "代码", "物品、资产、产品或设备的类型代码。", "string", { maxLength: 2, valueDomainCode: "VD.OBJECT_TYPE_CODE", referenceCode: "GB_T_7027_2002", tags: ["物品资产", "值域"] }),
    extraElement("OBJECT.CATEGORY_CODE", "物品分类代码", "ObjectCategoryCode", "STD.OBJECT", "物品资产", "分类", "代码", "物品、资产、产品或设备的分类代码。", "string", { maxLength: 32, referenceCode: "GB_T_7027_2002", tags: ["物品资产", "分类"] }),
    extraElement("OBJECT.MODEL", "型号", "Model", "STD.OBJECT", "物品资产", "型号", "文本", "物品、资产、产品或设备的型号。", "string", { maxLength: 128, referenceCode: "GB_T_19488_2_2008", tags: ["物品资产", "规格"] }),
    extraElement("OBJECT.SPECIFICATION", "规格", "Specification", "STD.OBJECT", "物品资产", "规格", "文本", "物品、资产、产品或设备的规格描述。", "string", { maxLength: 255, referenceCode: "GB_T_19488_2_2008", tags: ["物品资产", "规格"] }),
    extraElement("OBJECT.BRAND_NAME", "品牌名称", "BrandName", "STD.OBJECT", "物品资产", "品牌", "名称", "物品、资产、产品或设备的品牌名称。", "string", { maxLength: 128, referenceCode: "GB_T_19488_2_2008", tags: ["物品资产", "品牌"] }),
    extraElement("OBJECT.SERIAL_NO", "序列号", "SerialNumber", "STD.OBJECT", "物品资产", "序列号", "号码", "生产、登记或管理时赋予物品资产的序列号。", "string", { maxLength: 128, referenceCode: "GB_T_19488_1_2004", tags: ["物品资产", "号码"] }),
    extraElement("OBJECT.BARCODE", "条码", "Barcode", "STD.OBJECT", "物品资产", "条码", "代码", "物品、资产、产品或设备的一维码、二维码或其他条码。", "string", { maxLength: 128, referenceCode: "GB_T_19488_1_2004", tags: ["物品资产", "代码"] }),
    extraElement("OBJECT.PRODUCTION_DATE", "生产日期", "ProductionDate", "STD.OBJECT", "物品资产", "生产日期", "日期", "物品、资产、产品或设备的生产日期。", "date", { valueDomainCode: "VD.DATE_ISO", referenceCode: "GB_T_7408_1_2023", tags: ["物品资产", "日期"] }),
    extraElement("OBJECT.EXPIRY_DATE", "有效期至", "ExpiryDate", "STD.OBJECT", "物品资产", "有效期至", "日期", "物品、资产、产品或证照的有效截止日期。", "date", { valueDomainCode: "VD.DATE_ISO", referenceCode: "GB_T_7408_1_2023", tags: ["物品资产", "日期"] }),
    extraElement("OBJECT.MEASURE_UNIT_CODE", "计量单位代码", "MeasureUnitCode", "STD.OBJECT", "物品资产", "计量单位", "代码", "物品数量、重量、长度、面积或体积的计量单位代码。", "string", { maxLength: 8, valueDomainCode: "VD.MEASURE_UNIT_CODE", referenceCode: "GB_T_17295_2008", tags: ["物品资产", "值域"] }),
    extraElement("OBJECT.QUANTITY", "数量", "Quantity", "STD.OBJECT", "物品资产", "数量", "数量", "物品、资产、产品或设备的数量。", "decimal", { precision: 18, scale: 4, referenceCode: "GB_T_19488_1_2004", tags: ["物品资产", "数量"] }),
    extraElement("OBJECT.AMOUNT", "金额", "Amount", "STD.OBJECT", "物品资产", "金额", "金额", "物品、资产、产品或设备对应的金额。", "decimal", { precision: 18, scale: 2, unit: "元", referenceCode: "GB_T_19488_1_2004", tags: ["物品资产", "金额"] }),
    extraElement("OBJECT.CURRENCY_CODE", "币种代码", "CurrencyCode", "STD.OBJECT", "物品资产", "币种", "代码", "金额对应的币种代码。", "string", { maxLength: 3, valueDomainCode: "VD.CURRENCY_CODE", referenceCode: "GB_T_12406_2022", tags: ["物品资产", "金额", "值域"] }),
    extraElement("OBJECT.OWNER_PERSON_NAME", "持有人姓名", "OwnerPersonName", "STD.OBJECT", "物品资产", "持有人", "名称", "物品、资产、产品或证照持有人的姓名。", "string", { maxLength: 64, referenceCode: "GB_T_19488_2_2008", tags: ["物品资产", "人员"] }),
    extraElement("OBJECT.OWNER_ORG_NAME", "权属机构名称", "OwnerOrganizationName", "STD.OBJECT", "物品资产", "权属机构", "名称", "物品、资产、产品或设备权属组织机构的名称。", "string", { maxLength: 128, referenceCode: "GB_T_36104_2018", tags: ["物品资产", "组织机构"] }),
    extraElement("OBJECT.STORAGE_REGION_CODE", "存放地区划代码", "StorageRegionCode", "STD.OBJECT", "物品资产", "存放地区划", "代码", "物品、资产、产品或设备存放地所属行政区划代码。", "string", { maxLength: 6, valueDomainCode: "VD.REGION_CODE_CN", referenceCode: "GB_T_2260_2007", tags: ["物品资产", "区划", "值域"] }),
    extraElement("OBJECT.STORAGE_ADDRESS", "存放详细地址", "StorageAddress", "STD.OBJECT", "物品资产", "存放地址", "文本", "物品、资产、产品或设备存放地的详细地址。", "string", { maxLength: 255, referenceCode: "GB_T_19488_2_2008", tags: ["物品资产", "地址"] }),

    extraElement("ORG.REGISTRATION_AUTHORITY_NAME", "登记机关名称", "RegistrationAuthorityName", "STD.ORG", "法人和其他组织", "登记机关", "名称", "负责法人和其他组织登记的机关名称。", "string", { maxLength: 128, referenceCode: "GB_T_36104_2018", tags: ["组织机构", "登记"] }),
    extraElement("ORG.REGISTRATION_AUTHORITY_CODE", "登记机关代码", "RegistrationAuthorityCode", "STD.ORG", "法人和其他组织", "登记机关", "代码", "负责法人和其他组织登记的机关代码。", "string", { maxLength: 18, referenceCode: "GB_32100_2015", tags: ["组织机构", "登记"] }),
    extraElement("ORG.APPROVAL_AUTHORITY_NAME", "批准机关名称", "ApprovalAuthorityName", "STD.ORG", "法人和其他组织", "批准机关", "名称", "批准法人和其他组织设立、变更或许可的机关名称。", "string", { maxLength: 128, referenceCode: "GB_T_36104_2018", tags: ["组织机构", "许可"] }),
    extraElement("ORG.PARENT_ORG_CODE", "上级机构代码", "ParentOrganizationCode", "STD.ORG", "法人和其他组织", "上级机构", "代码", "上级法人或其他组织的机构代码。", "string", { maxLength: 18, referenceCode: "GB_32100_2015", tags: ["组织机构", "层级"] }),
    extraElement("ORG.PARENT_ORG_NAME", "上级机构名称", "ParentOrganizationName", "STD.ORG", "法人和其他组织", "上级机构", "名称", "上级法人或其他组织的规范名称。", "string", { maxLength: 128, referenceCode: "GB_T_36104_2018", tags: ["组织机构", "层级"] }),
    extraElement("ORG.FOUNDING_DATE", "设立日期", "FoundingDate", "STD.ORG", "法人和其他组织", "设立日期", "日期", "法人和其他组织依法设立或成立的日期。", "date", { valueDomainCode: "VD.DATE_ISO", referenceCode: "GB_T_7408_1_2023", tags: ["组织机构", "日期"] }),
    extraElement("ORG.CANCEL_DATE", "注销日期", "CancellationDate", "STD.ORG", "法人和其他组织", "注销日期", "日期", "法人和其他组织注销、撤销或终止的日期。", "date", { valueDomainCode: "VD.DATE_ISO", referenceCode: "GB_T_7408_1_2023", tags: ["组织机构", "日期"] }),
    extraElement("ORG.OPERATION_START_DATE", "经营期限自", "OperationStartDate", "STD.ORG", "法人和其他组织", "经营期限自", "日期", "法人和其他组织经营期限的起始日期。", "date", { valueDomainCode: "VD.DATE_ISO", referenceCode: "GB_T_7408_1_2023", tags: ["组织机构", "日期"] }),
    extraElement("ORG.OPERATION_END_DATE", "经营期限至", "OperationEndDate", "STD.ORG", "法人和其他组织", "经营期限至", "日期", "法人和其他组织经营期限的截止日期。", "date", { valueDomainCode: "VD.DATE_ISO", referenceCode: "GB_T_7408_1_2023", tags: ["组织机构", "日期"] }),
    extraElement("ORG.REGISTERED_CAPITAL_AMOUNT", "注册资本金额", "RegisteredCapitalAmount", "STD.ORG", "法人和其他组织", "注册资本", "金额", "法人和其他组织登记注册资本的金额。", "decimal", { precision: 18, scale: 2, referenceCode: "GB_T_36104_2018", tags: ["组织机构", "金额"] }),
    extraElement("ORG.REGISTERED_CAPITAL_CURRENCY_CODE", "注册资本币种代码", "RegisteredCapitalCurrencyCode", "STD.ORG", "法人和其他组织", "注册资本币种", "代码", "法人和其他组织注册资本金额对应的币种代码。", "string", { maxLength: 3, valueDomainCode: "VD.CURRENCY_CODE", referenceCode: "GB_T_12406_2022", tags: ["组织机构", "金额", "值域"] }),
    extraElement("ORG.EMPLOYEE_COUNT", "从业人数", "EmployeeCount", "STD.ORG", "法人和其他组织", "从业人数", "数量", "法人和其他组织当前从业人员数量。", "integer", { precision: 10, referenceCode: "GB_T_36104_2018", tags: ["组织机构", "人员"] }),
    extraElement("ORG.CONTACT_PERSON_NAME", "联系人姓名", "ContactPersonName", "STD.ORG", "法人和其他组织", "联系人", "名称", "法人和其他组织对外或业务联系人的姓名。", "string", { maxLength: 64, referenceCode: "GB_T_36104_2018", tags: ["组织机构", "联系人"] }),
    extraElement("ORG.CONTACT_PERSON_PHONE", "联系人电话", "ContactPersonPhone", "STD.ORG", "法人和其他组织", "联系人电话", "号码", "法人和其他组织对外或业务联系人的电话号码。", "string", { maxLength: 32, referenceCode: "GB_T_36104_2018", tags: ["组织机构", "联系方式"] }),
    extraElement("ORG.CONTACT_ADDRESS", "联系地址", "ContactAddress", "STD.ORG", "法人和其他组织", "联系地址", "文本", "法人和其他组织用于联系、通信或业务办理的地址。", "string", { maxLength: 255, referenceCode: "GB_T_36104_2018", tags: ["组织机构", "地址"] }),
    extraElement("ORG.WEBSITE_URL", "网站地址", "WebsiteUrl", "STD.ORG", "法人和其他组织", "网站地址", "统一资源定位符", "法人和其他组织官方网站或互联网服务入口地址。", "string", { maxLength: 255, valueDomainCode: "VD.URL", referenceCode: "GB_T_19488_2_2008", tags: ["组织机构", "互联网", "值域"] }),
    extraElement("ORG.BUSINESS_LICENSE_NO", "营业执照号码", "BusinessLicenseNumber", "STD.ORG", "法人和其他组织", "营业执照号码", "号码", "法人和其他组织营业执照或登记证照号码。", "string", { maxLength: 64, referenceCode: "GB_T_36104_2018", tags: ["组织机构", "证照"] }),
    extraElement("ORG.ORG_CERTIFICATE_NO", "组织机构证书号码", "OrganizationCertificateNumber", "STD.ORG", "法人和其他组织", "组织机构证书号码", "号码", "法人和其他组织登记、资格或资质证书号码。", "string", { maxLength: 64, referenceCode: "GB_T_36104_2018", tags: ["组织机构", "证照"] }),
    extraElement("ORG.TAXPAYER_ID_NO", "纳税人识别号", "TaxpayerIdentificationNumber", "STD.ORG", "法人和其他组织", "纳税人识别号", "号码", "法人和其他组织纳税人识别号。", "string", { maxLength: 32, referenceCode: "GB_T_36104_2018", tags: ["组织机构", "税务"] }),
    extraElement("ORG.ADMINISTRATIVE_LEVEL_CODE", "行政层级代码", "AdministrativeLevelCode", "STD.ORG", "法人和其他组织", "行政层级", "代码", "组织机构所属行政管理层级代码。", "string", { maxLength: 2, valueDomainCode: "VD.ADMINISTRATIVE_LEVEL_CODE", referenceCode: "GB_T_2260_2007", tags: ["组织机构", "区划", "值域"] }),
  ];
}

const elementSpecs = [
  e("STD.BASE.ID", "BASE.ID", "主键ID", "ID", "STD.BASE", "公共实体", "主键", "标识符", [], "ODS 表内记录主键，保证表内唯一。", "integer", {
    precision: 20,
    referenceCode: "GB_T_19488_1_2004",
    tags: ["ODS", "公共字段", "主键"],
  }),
  e("STD.BASE.CODE", "BASE.CODE", "通用编码", "CommonCode", "STD.BASE", "公共实体", "编码", "代码", [], "跨模块可复用的业务对象编码。", "string", {
    maxLength: 64,
    referenceCode: "GB_T_19488_2_2008",
    tags: ["公共基础", "编码"],
  }),
  e("STD.BASE.NAME", "BASE.NAME", "通用名称", "CommonName", "STD.BASE", "公共实体", "名称", "名称", [], "跨模块可复用的业务对象中文名称。", "string", {
    maxLength: 128,
    referenceCode: "GB_T_19488_2_2008",
    tags: ["公共基础", "名称"],
  }),
  e("STD.BASE.SHORT_NAME", "BASE.SHORT_NAME", "通用简称", "CommonShortName", "STD.BASE", "公共实体", "简称", "名称", [], "业务对象在展示或交换中使用的简称。", "string", {
    maxLength: 64,
    referenceCode: "GB_T_19488_2_2008",
    tags: ["公共基础", "名称"],
  }),
  e("STD.BASE.DESCRIPTION", "BASE.DESCRIPTION", "通用描述", "CommonDescription", "STD.BASE", "公共实体", "描述", "文本", [], "对业务对象用途、范围或口径的说明。", "text", {
    maxLength: 2000,
    referenceCode: "GB_T_19488_1_2004",
    tags: ["公共基础", "说明"],
  }),
  e("STD.BASE.CREATED_AT", "BASE.CREATED_AT", "创建时间", "CreatedAt", "STD.BASE", "公共实体", "创建时间", "日期时间", [], "记录首次创建或进入 ODS 的时间，精确到秒。", "datetime", {
    valueDomainCode: "VD.DATETIME_SECOND",
    referenceCode: "GB_T_7408_1_2023",
    tags: ["ODS", "公共字段", "审计"],
  }),
  e("STD.BASE.UPDATED_AT", "BASE.UPDATED_AT", "更新时间", "UpdatedAt", "STD.BASE", "公共实体", "更新时间", "日期时间", [], "记录最近一次业务或技术更新的时间，精确到秒。", "datetime", {
    valueDomainCode: "VD.DATETIME_SECOND",
    referenceCode: "GB_T_7408_1_2023",
    tags: ["ODS", "公共字段", "审计"],
  }),
  e("STD.BASE.SORT_NO", "BASE.SORT_NO", "排序号", "SortNo", "STD.BASE", "公共实体", "排序", "序号", [], "同一业务范围内用于展示或处理顺序的数字序号。", "integer", {
    precision: 10,
    referenceCode: "GB_T_19488_1_2004",
    tags: ["ODS", "公共字段"],
  }),
  e("STD.BASE.ENABLED_FLAG", "BASE.ENABLED_FLAG", "启用标志", "EnabledFlag", "STD.BASE", "公共实体", "启用状态", "标志", [], "标识记录或配置项是否处于启用状态。", "integer", {
    precision: 1,
    valueDomainCode: "VD.ENABLED_10",
    referenceCode: "GB_T_19488_1_2004",
    tags: ["公共基础", "状态", "值域"],
  }),
  e("STD.BASE.DELETED_FLAG", "BASE.DELETED_FLAG", "删除标志", "DeletedFlag", "STD.BASE", "公共实体", "删除状态", "标志", [], "标识记录是否被逻辑删除。", "integer", {
    precision: 1,
    valueDomainCode: "VD.YES_NO_10",
    referenceCode: "GB_T_19488_1_2004",
    tags: ["公共基础", "状态", "值域"],
  }),
  e("STD.BASE.EFFECTIVE_DATE", "BASE.EFFECTIVE_DATE", "生效日期", "EffectiveDate", "STD.BASE", "公共实体", "生效日期", "日期", [], "业务对象、标准或配置开始生效的日期。", "date", {
    valueDomainCode: "VD.DATE_ISO",
    referenceCode: "GB_T_7408_1_2023",
    tags: ["公共基础", "日期"],
  }),
  e("STD.BASE.EXPIRE_DATE", "BASE.EXPIRE_DATE", "失效日期", "ExpireDate", "STD.BASE", "公共实体", "失效日期", "日期", [], "业务对象、标准或配置停止生效的日期。", "date", {
    valueDomainCode: "VD.DATE_ISO",
    referenceCode: "GB_T_7408_1_2023",
    tags: ["公共基础", "日期"],
  }),
  e("STD.BASE.VERSION_NO", "BASE.VERSION_NO", "版本号", "VersionNumber", "STD.BASE", "公共实体", "版本", "号码", [], "记录、标准或配置的版本序号。", "integer", {
    precision: 10,
    referenceCode: "GB_T_19488_1_2004",
    tags: ["公共基础", "版本"],
  }),
  e("STD.BASE.SOURCE_SYSTEM_CODE", "BASE.SOURCE_SYSTEM_CODE", "来源系统编码", "SourceSystemCode", "STD.BASE", "公共实体", "来源系统", "代码", [], "产生或提供当前数据记录的来源系统编码。", "string", {
    maxLength: 64,
    referenceCode: "GB_T_19488_1_2004",
    tags: ["公共基础", "来源"],
  }),
  e("STD.BASE.REMARK", "BASE.REMARK", "备注", "Remark", "STD.BASE", "公共实体", "备注", "文本", [], "对记录补充说明的自由文本。", "text", {
    maxLength: 1000,
    referenceCode: "GB_T_19488_1_2004",
    tags: ["公共基础", "说明"],
  }),
  e("STD.OPS.CREATE_BY", "OPS.CREATE_BY", "创建人", "CreatedBy", "STD.OPS", "技术审计", "创建人", "标识符", [], "创建记录的业务人员、营业厅工号或系统账号。", "string", {
    maxLength: 64,
    referenceCode: "GB_T_19488_1_2004",
    tags: ["ODS", "审计"],
  }),
  e("STD.OPS.OPERATOR_ID", "OPS.OPERATOR_ID", "操作人工号", "OperatorId", "STD.OPS", "技术审计", "操作人", "标识符", [], "最后操作人 ID 或工号。", "string", {
    maxLength: 64,
    referenceCode: "GB_T_19488_1_2004",
    tags: ["ODS", "审计"],
  }),
  e("STD.OPS.OPERATOR_NAME", "OPS.OPERATOR_NAME", "操作人姓名", "OperatorName", "STD.OPS", "技术审计", "操作人", "名称", [], "最后操作人的姓名或显示名称。", "string", {
    maxLength: 64,
    referenceCode: "GB_T_19488_1_2004",
    tags: ["ODS", "审计", "人员"],
  }),
  e("STD.DICT.CODE_TYPE", "DICT.CODE_TYPE", "代码类型", "CodeType", "STD.DICT", "字典代码", "代码类型", "代码", [], "区分不同代码集或字典域的类型编码。", "string", {
    maxLength: 64,
    referenceCode: "GB_T_19488_1_2004",
    tags: ["ODS", "字典"],
  }),
  e("STD.DICT.CODE_VALUE", "DICT.CODE_VALUE", "代码值", "CodeValue", "STD.DICT", "字典代码", "代码值", "代码", [], "代码集中的具体编码值。", "string", {
    maxLength: 128,
    referenceCode: "GB_T_19488_1_2004",
    tags: ["ODS", "字典", "值域"],
  }),
  e("STD.DICT.CODE_NAME", "DICT.CODE_NAME", "代码名称", "CodeName", "STD.DICT", "字典代码", "代码名称", "名称", [], "代码值对应的中文显示名称。", "string", {
    maxLength: 128,
    referenceCode: "GB_T_19488_1_2004",
    tags: ["ODS", "字典"],
  }),
  e("STD.DICT.IS_ENABLED", "DICT.IS_ENABLED", "代码启用标志", "CodeEnabledFlag", "STD.DICT", "字典代码", "启用状态", "标志", [], "标识代码项是否启用。", "integer", {
    precision: 1,
    valueDomainCode: "VD.ENABLED_10",
    referenceCode: "GB_T_19488_1_2004",
    tags: ["ODS", "字典", "值域"],
  }),
  e("STD.PERSON.NAME", "PERSON.NAME", "自然人姓名", "PersonName", "STD.PERSON", "自然人", "姓名", "名称", ["当事人", "用户", "经办人"], "自然人在业务场景中的姓名。", "string", {
    maxLength: 64,
    referenceCode: "GB_T_19488_1_2004",
    tags: ["ODS", "人员主体"],
    aliases: ["男方姓名", "女方姓名", "用户姓名", "负责人姓名"],
  }),
  e("STD.PERSON.ID_TYPE", "PERSON.ID_TYPE", "身份证件类型", "IdentityDocumentType", "STD.PERSON", "自然人", "身份证件类型", "代码", ["婚姻登记当事人"], "自然人办理业务时提交的身份证件类型。", "string", {
    maxLength: 2,
    valueDomainCode: "VD.CERT_TYPE_MARRIAGE",
    referenceCode: "GB_T_19488_2_2008",
    tags: ["ODS", "人员主体", "值域"],
  }),
  e("STD.PERSON.ID_NO", "PERSON.ID_NO", "身份证件号码", "IdentityDocumentNumber", "STD.PERSON", "自然人", "身份证件号码", "号码", ["实名登记", "婚姻登记当事人"], "自然人身份证件号码；居民身份证号码应符合 GB 11643。", "string", {
    maxLength: 18,
    valueDomainCode: "VD.ID_CARD_NO_CN",
    referenceCode: "GB_11643_1999",
    tags: ["ODS", "人员主体", "敏感个人信息"],
    aliases: ["居民身份证号码", "证件号码"],
  }),
  e("STD.PERSON.BIRTH_DATE", "PERSON.BIRTH_DATE", "出生日期", "BirthDate", "STD.PERSON", "自然人", "出生日期", "日期", ["婚姻登记当事人"], "自然人的出生日期。", "date", {
    valueDomainCode: "VD.DATE_ISO",
    referenceCode: "GB_T_7408_1_2023",
    tags: ["ODS", "人员主体"],
  }),
  e("STD.PERSON.NATIONALITY", "PERSON.NATIONALITY", "国籍/地区", "Nationality", "STD.PERSON", "自然人", "国籍地区", "代码", ["婚姻登记当事人"], "自然人的国籍或地区信息。", "string", {
    maxLength: 3,
    valueDomainCode: "VD.NATIONALITY_CODE",
    referenceCode: "GB_T_2659_1_2022",
    tags: ["ODS", "人员主体", "值域"],
  }),
  e("STD.PERSON.PHONE", "PERSON.PHONE", "联系电话", "ContactPhone", "STD.PERSON", "自然人", "联系电话", "号码", ["当事人", "用户"], "自然人的联系电话或手机号码。", "string", {
    maxLength: 11,
    valueDomainCode: "VD.MOBILE_PHONE_CN",
    referenceCode: "GB_T_19488_2_2008",
    tags: ["ODS", "人员主体", "联系方式"],
    aliases: ["手机号码", "联系电话"],
  }),
  e("STD.PERSON.ADDRESS", "PERSON.ADDRESS", "联系地址", "ContactAddress", "STD.PERSON", "自然人", "联系地址", "文本", ["当事人", "用户"], "自然人的现住址或联系地址。", "string", {
    maxLength: 255,
    referenceCode: "GB_T_19488_1_2004",
    tags: ["ODS", "人员主体", "地址"],
  }),
  e("STD.PERSON.HUKOU_ADDRESS", "PERSON.HUKOU_ADDRESS", "户籍地址", "HouseholdRegisterAddress", "STD.PERSON", "自然人", "户籍地址", "文本", ["婚姻登记当事人"], "自然人的户籍登记地址。", "string", {
    maxLength: 255,
    referenceCode: "GB_T_19488_2_2008",
    tags: ["ODS", "人员主体", "地址"],
  }),
  e("STD.PERSON.GENDER", "PERSON.GENDER", "性别代码", "GenderCode", "STD.PERSON", "自然人", "性别", "代码", [], "自然人的性别代码。", "integer", {
    precision: 1,
    valueDomainCode: "VD.GB_SEX_CODE",
    referenceCode: "GB_T_2261_1_2003",
    tags: ["ODS", "人员主体", "值域"],
  }),
  e("STD.PERSON.ETHNIC_GROUP", "PERSON.ETHNIC_GROUP", "民族代码", "EthnicGroupCode", "STD.PERSON", "自然人", "民族", "代码", [], "自然人的民族代码。", "string", {
    maxLength: 2,
    valueDomainCode: "VD.ETHNIC_GROUP_CODE",
    referenceCode: "GB_T_3304_1991",
    tags: ["人员主体", "值域"],
  }),
  e("STD.PERSON.MARITAL_STATUS", "PERSON.MARITAL_STATUS", "婚姻状况代码", "MaritalStatusCode", "STD.PERSON", "自然人", "婚姻状况", "代码", [], "自然人的婚姻状况代码。", "string", {
    maxLength: 2,
    valueDomainCode: "VD.MARITAL_STATUS_CODE",
    referenceCode: "GB_T_2261_2_2003",
    tags: ["人员主体", "值域"],
  }),
  e("STD.PERSON.EDUCATION_LEVEL", "PERSON.EDUCATION_LEVEL", "学历代码", "EducationLevelCode", "STD.PERSON", "自然人", "学历", "代码", [], "自然人最高或当前学历代码。", "string", {
    maxLength: 2,
    valueDomainCode: "VD.EDUCATION_LEVEL_CODE",
    referenceCode: "GB_T_4658_2006",
    tags: ["人员主体", "值域"],
  }),
  e("STD.PERSON.OCCUPATION_CODE", "PERSON.OCCUPATION_CODE", "职业分类代码", "OccupationCode", "STD.PERSON", "自然人", "职业", "代码", [], "自然人职业分类代码。", "string", {
    maxLength: 8,
    valueDomainCode: "VD.OCCUPATION_CODE",
    referenceCode: "GB_T_6565_2015",
    tags: ["人员主体", "值域"],
  }),
  e("STD.PERSON.EMAIL", "PERSON.EMAIL", "电子邮箱", "EmailAddress", "STD.PERSON", "自然人", "电子邮箱", "电子邮件地址", [], "自然人的电子邮箱地址。", "string", {
    maxLength: 128,
    valueDomainCode: "VD.EMAIL",
    referenceCode: "GB_T_19488_2_2008",
    tags: ["人员主体", "联系方式"],
  }),
  e("STD.PERSON.POSTAL_CODE", "PERSON.POSTAL_CODE", "邮政编码", "PostalCode", "STD.PERSON", "自然人", "邮政编码", "代码", [], "自然人联系地址对应的邮政编码。", "string", {
    maxLength: 6,
    valueDomainCode: "VD.POSTAL_CODE_CN",
    referenceCode: "GB_T_19488_2_2008",
    tags: ["人员主体", "地址", "值域"],
  }),
  e("STD.PERSON.RESIDENCE_REGION_CODE", "PERSON.RESIDENCE_REGION_CODE", "居住地区划代码", "ResidenceRegionCode", "STD.PERSON", "自然人", "居住地区划", "代码", [], "自然人现居住地所属行政区划代码。", "string", {
    maxLength: 6,
    valueDomainCode: "VD.REGION_CODE_CN",
    referenceCode: "GB_T_2260_2007",
    tags: ["人员主体", "区划", "值域"],
  }),
  e("STD.PERSON.RESIDENCE_REGION_NAME", "PERSON.RESIDENCE_REGION_NAME", "居住地区划名称", "ResidenceRegionName", "STD.PERSON", "自然人", "居住地区划", "名称", [], "自然人现居住地所属行政区划名称。", "string", {
    maxLength: 128,
    referenceCode: "GB_T_2260_2007",
    tags: ["人员主体", "区划"],
  }),
  e("STD.PERSON.AGE", "PERSON.AGE", "年龄", "Age", "STD.PERSON", "自然人", "年龄", "数量", [], "自然人在统计时点的周岁年龄。", "integer", {
    precision: 3,
    referenceCode: "GB_T_19488_2_2008",
    tags: ["人员主体", "人口统计"],
  }),
  e("STD.ORG.OFFICE_CODE", "ORG.OFFICE_CODE", "组织机构代码", "OrganizationCode", "STD.ORG", "法人和其他组织", "机构代码", "代码", [], "法人和其他组织在业务系统或数据交换中的机构代码。", "string", {
    maxLength: 32,
    referenceCode: "GB_T_36104_2018",
    tags: ["ODS", "组织机构", "主数据"],
  }),
  e("STD.ORG.UNIFIED_SOCIAL_CREDIT_CODE", "ORG.UNIFIED_SOCIAL_CREDIT_CODE", "统一社会信用代码", "UnifiedSocialCreditCode", "STD.ORG", "法人和其他组织", "统一社会信用代码", "代码", [], "法人和其他组织的统一社会信用代码。", "string", {
    maxLength: 18,
    valueDomainCode: "VD.SOCIAL_CREDIT_CODE",
    referenceCode: "GB_32100_2015",
    tags: ["组织机构", "主数据", "值域"],
    aliases: ["社会信用代码"],
  }),
  e("STD.ORG.OFFICE_NAME", "ORG.OFFICE_NAME", "组织机构名称", "OrganizationName", "STD.ORG", "法人和其他组织", "机构名称", "名称", [], "法人和其他组织的规范中文名称。", "string", {
    maxLength: 128,
    referenceCode: "GB_T_36104_2018",
    tags: ["ODS", "组织机构", "主数据"],
  }),
  e("STD.ORG.ORG_SHORT_NAME", "ORG.ORG_SHORT_NAME", "组织机构简称", "OrganizationShortName", "STD.ORG", "法人和其他组织", "机构简称", "名称", [], "法人和其他组织在业务办理或展示中的简称。", "string", {
    maxLength: 64,
    referenceCode: "GB_T_36104_2018",
    tags: ["组织机构", "主数据"],
  }),
  e("STD.ORG.ORG_TYPE", "ORG.ORG_TYPE", "组织机构类型代码", "OrganizationTypeCode", "STD.ORG", "法人和其他组织", "机构类型", "代码", [], "法人和其他组织的机构类型代码。", "string", {
    maxLength: 4,
    valueDomainCode: "VD.ORG_TYPE_CODE",
    referenceCode: "GB_T_20091_2021",
    tags: ["组织机构", "值域"],
  }),
  e("STD.ORG.LEGAL_REPRESENTATIVE_NAME", "ORG.LEGAL_REPRESENTATIVE_NAME", "法定代表人姓名", "LegalRepresentativeName", "STD.ORG", "法人和其他组织", "法定代表人", "名称", [], "法人或其他组织登记的法定代表人姓名。", "string", {
    maxLength: 64,
    referenceCode: "GB_T_36104_2018",
    tags: ["组织机构", "人员"],
  }),
  e("STD.ORG.REGION_CODE", "ORG.REGION_CODE", "所属行政区划代码", "RegionCode", "STD.ORG", "行政区划", "区划代码", "代码", [], "机构或业务登记地所属县级及以上行政区划代码。", "string", {
    maxLength: 6,
    valueDomainCode: "VD.REGION_CODE_CN",
    referenceCode: "GB_T_2260_2007",
    tags: ["ODS", "区划", "值域"],
  }),
  e("STD.ORG.REGION_NAME", "ORG.REGION_NAME", "所属行政区划名称", "RegionName", "STD.ORG", "行政区划", "区划名称", "名称", [], "机构或业务登记地所属行政区划名称。", "string", {
    maxLength: 128,
    referenceCode: "GB_T_2260_2007",
    tags: ["ODS", "区划"],
  }),
  e("STD.ORG.LEVEL", "ORG.LEVEL", "机构层级", "OrganizationLevel", "STD.ORG", "法人和其他组织", "机构层级", "代码", [], "组织机构在管理体系或服务体系中的层级。", "string", {
    maxLength: 2,
    referenceCode: "GB_T_36104_2018",
    tags: ["ODS", "组织机构", "值域"],
  }),
  e("STD.ORG.ADDRESS", "ORG.ADDRESS", "机构详细地址", "OrganizationAddress", "STD.ORG", "法人和其他组织", "详细地址", "文本", [], "组织机构登记、办公或服务地址。", "string", {
    maxLength: 255,
    referenceCode: "GB_T_36104_2018",
    tags: ["ODS", "组织机构", "地址"],
  }),
  e("STD.ORG.PHONE", "ORG.PHONE", "机构联系电话", "OrganizationPhone", "STD.ORG", "法人和其他组织", "联系电话", "号码", [], "组织机构对外联系电话。", "string", {
    maxLength: 32,
    referenceCode: "GB_T_36104_2018",
    tags: ["ODS", "组织机构", "联系方式"],
  }),
  e("STD.ORG.EMAIL", "ORG.EMAIL", "机构联系邮箱", "OrganizationEmail", "STD.ORG", "法人和其他组织", "联系邮箱", "电子邮件地址", [], "组织机构对外联系电子邮箱。", "string", {
    maxLength: 128,
    valueDomainCode: "VD.EMAIL",
    referenceCode: "GB_T_36104_2018",
    tags: ["ODS", "组织机构", "联系方式"],
  }),
  e("STD.ORG.POSTAL_CODE", "ORG.POSTAL_CODE", "机构邮政编码", "OfficePostalCode", "STD.ORG", "法人和其他组织", "邮政编码", "代码", [], "机构通信地址对应的邮政编码。", "string", {
    maxLength: 6,
    valueDomainCode: "VD.POSTAL_CODE_CN",
    referenceCode: "GB_T_36104_2018",
    tags: ["组织机构", "地址", "值域"],
  }),
  e("STD.ORG.INDUSTRY_CODE", "ORG.INDUSTRY_CODE", "所属行业代码", "IndustryCode", "STD.ORG", "法人和其他组织", "所属行业", "代码", [], "机构所属国民经济行业分类代码。", "string", {
    maxLength: 4,
    valueDomainCode: "VD.INDUSTRY_CODE",
    referenceCode: "GB_T_4754_2017",
    tags: ["组织机构", "行业", "值域"],
  }),
  e("STD.ORG.ECONOMIC_TYPE", "ORG.ECONOMIC_TYPE", "经济类型代码", "EconomicTypeCode", "STD.ORG", "法人和其他组织", "经济类型", "代码", [], "机构登记经济类型分类代码。", "string", {
    maxLength: 3,
    valueDomainCode: "VD.ECONOMIC_TYPE_CODE",
    referenceCode: "GB_T_12402_2000",
    tags: ["组织机构", "值域"],
  }),
  e("STD.ORG.REGISTER_DATE", "ORG.REGISTER_DATE", "成立登记日期", "RegistrationDate", "STD.ORG", "法人和其他组织", "成立登记日期", "日期", [], "机构依法登记成立的日期。", "date", {
    valueDomainCode: "VD.DATE_ISO",
    referenceCode: "GB_T_36104_2018",
    tags: ["组织机构", "日期"],
  }),
  e("STD.ORG.LEADER_NAME", "ORG.LEADER_NAME", "机构负责人姓名", "OrganizationLeaderName", "STD.ORG", "法人和其他组织", "负责人姓名", "名称", [], "组织机构负责人姓名。", "string", {
    maxLength: 64,
    referenceCode: "GB_T_36104_2018",
    tags: ["ODS", "组织机构", "人员"],
  }),
  e("STD.ORG.FOREIGN_QUALIFICATION", "ORG.FOREIGN_QUALIFICATION", "特殊业务资质标志", "SpecialBusinessQualificationFlag", "STD.ORG", "法人和其他组织", "特殊业务资质", "标志", [], "标识机构是否具备特定业务办理资质。", "integer", {
    precision: 1,
    valueDomainCode: "VD.YES_NO_10",
    referenceCode: "GB_T_36104_2018",
    tags: ["ODS", "组织机构", "资质", "值域"],
  }),
  e("STD.ORG.BUSINESS_SCOPE", "ORG.BUSINESS_SCOPE", "机构业务范围", "OrganizationBusinessScope", "STD.ORG", "法人和其他组织", "业务范围", "文本", [], "组织机构可提供服务或可办理业务的范围。", "string", {
    maxLength: 255,
    referenceCode: "GB_T_36104_2018",
    tags: ["ODS", "组织机构"],
  }),
  e("STD.ORG.STATUS", "ORG.STATUS", "机构状态", "OrganizationStatus", "STD.ORG", "法人和其他组织", "机构状态", "代码", [], "组织机构当前登记、运营或服务状态。", "string", {
    maxLength: 16,
    referenceCode: "GB_T_36104_2018",
    tags: ["ODS", "组织机构", "状态"],
  }),
  ...buildAdditionalNationalElementSpecs(),
];

const mappingSpecs = [
  m("ods_dict_mobile_code", "id", "STD.BASE.ID"),
  m("ods_dict_mobile_code", "code_type", "STD.DICT.CODE_TYPE"),
  m("ods_dict_mobile_code", "code_value", "STD.DICT.CODE_VALUE"),
  m("ods_dict_mobile_code", "code_name", "STD.DICT.CODE_NAME"),
  m("ods_dict_mobile_code", "sort_no", "STD.BASE.SORT_NO"),
  m("ods_dict_mobile_code", "is_enabled", "STD.DICT.IS_ENABLED"),
  m("ods_dict_mobile_code", "created_at", "STD.BASE.CREATED_AT"),
  m("ods_sys_code", "code_type", "STD.DICT.CODE_TYPE"),
  m("ods_sys_code", "code_value", "STD.DICT.CODE_VALUE"),
  m("ods_sys_code", "code_name", "STD.DICT.CODE_NAME"),

  m("ods_marriage_office", "id", "STD.BASE.ID"),
  m("ods_marriage_office", "office_code", "STD.ORG.OFFICE_CODE"),
  m("ods_marriage_office", "office_name", "STD.ORG.OFFICE_NAME"),
  m("ods_marriage_office", "region_code", "STD.ORG.REGION_CODE"),
  m("ods_marriage_office", "region_name", "STD.ORG.REGION_NAME"),
  m("ods_marriage_office", "level", "STD.ORG.LEVEL"),
  m("ods_marriage_office", "address", "STD.ORG.ADDRESS"),
  m("ods_marriage_office", "phone", "STD.ORG.PHONE"),
  m("ods_marriage_office", "email", "STD.ORG.EMAIL"),
  m("ods_marriage_office", "leader_name", "STD.ORG.LEADER_NAME"),
  m("ods_marriage_office", "is_foreign", "STD.ORG.FOREIGN_QUALIFICATION"),
  m("ods_marriage_office", "business_scope", "STD.ORG.BUSINESS_SCOPE"),
  m("ods_marriage_office", "status", "STD.ORG.STATUS"),
  m("ods_marriage_office", "created_at", "STD.BASE.CREATED_AT"),
  m("ods_marriage_office", "updated_at", "STD.BASE.UPDATED_AT"),

  m("ods_mobile_user_reg", "phone_num", "STD.PERSON.PHONE"),
  m("ods_mobile_user_reg", "id_card_num", "STD.PERSON.ID_NO"),
  m("ods_mobile_user_reg", "gender", "STD.PERSON.GENDER"),
  m("ods_mobile_user_reg", "user_name", "STD.PERSON.NAME"),
  m("ods_mobile_user_reg", "contact_address", "STD.PERSON.ADDRESS"),
  m("ods_mobile_user_reg", "create_by", "STD.OPS.CREATE_BY"),
  m("ods_mobile_user_reg", "create_time", "STD.BASE.CREATED_AT"),
  m("ods_mobile_user_reg", "update_time", "STD.BASE.UPDATED_AT"),

  m("ods_marriage_registration", "id", "STD.BASE.ID"),
  m("ods_marriage_registration", "male_name", "STD.PERSON.NAME", 0.96, ["限定词：男方"]),
  m("ods_marriage_registration", "male_id_type", "STD.PERSON.ID_TYPE", 0.96, ["限定词：男方"]),
  m("ods_marriage_registration", "male_id_no", "STD.PERSON.ID_NO", 0.96, ["限定词：男方"]),
  m("ods_marriage_registration", "male_birth_date", "STD.PERSON.BIRTH_DATE", 0.96, ["限定词：男方"]),
  m("ods_marriage_registration", "male_nationality", "STD.PERSON.NATIONALITY", 0.96, ["限定词：男方"]),
  m("ods_marriage_registration", "male_phone", "STD.PERSON.PHONE", 0.96, ["限定词：男方"]),
  m("ods_marriage_registration", "male_addr", "STD.PERSON.ADDRESS", 0.96, ["限定词：男方"]),
  m("ods_marriage_registration", "male_hukou_addr", "STD.PERSON.HUKOU_ADDRESS", 0.96, ["限定词：男方"]),
  m("ods_marriage_registration", "female_name", "STD.PERSON.NAME", 0.96, ["限定词：女方"]),
  m("ods_marriage_registration", "female_id_type", "STD.PERSON.ID_TYPE", 0.96, ["限定词：女方"]),
  m("ods_marriage_registration", "female_id_no", "STD.PERSON.ID_NO", 0.96, ["限定词：女方"]),
  m("ods_marriage_registration", "female_birth_date", "STD.PERSON.BIRTH_DATE", 0.96, ["限定词：女方"]),
  m("ods_marriage_registration", "female_nationality", "STD.PERSON.NATIONALITY", 0.96, ["限定词：女方"]),
  m("ods_marriage_registration", "female_phone", "STD.PERSON.PHONE", 0.96, ["限定词：女方"]),
  m("ods_marriage_registration", "female_addr", "STD.PERSON.ADDRESS", 0.96, ["限定词：女方"]),
  m("ods_marriage_registration", "female_hukou_addr", "STD.PERSON.HUKOU_ADDRESS", 0.96, ["限定词：女方"]),
  m("ods_marriage_registration", "office_code", "STD.ORG.OFFICE_CODE"),
  m("ods_marriage_registration", "operator_id", "STD.OPS.OPERATOR_ID"),
  m("ods_marriage_registration", "operator_name", "STD.OPS.OPERATOR_NAME"),
  m("ods_marriage_registration", "created_at", "STD.BASE.CREATED_AT"),
  m("ods_marriage_registration", "updated_at", "STD.BASE.UPDATED_AT"),
];

function e(identifier, code, nameCn, nameEn, catalogCode, objectClass, propertyName, representationTerm, qualifiers, definition, dataType, options = {}) {
  const standardType = options.standardType || inferElementStandardType(options.referenceCode);
  const normalizedIdentifier = String(options.identifier || identifier || "").replace(/^STD\./i, "");
  const normalizedCode = /^(GB|HB|QB)[0-9]{4}$/i.test(String(code || ""))
    ? String(code).toUpperCase()
    : nextSeedElementCode(standardType);
  return {
    identifier: normalizedIdentifier,
    legacyIdentifier: identifier,
    legacyCode: code,
    code: normalizedCode,
    standardType,
    nameCn,
    nameEn,
    catalogCode,
    objectClass,
    propertyName,
    representationTerm,
    qualifiers,
    definition,
    dataType,
    maxLength: options.maxLength ?? null,
    numericPrecision: options.precision ?? null,
    numericScale: options.scale ?? null,
    datetimePrecision: options.datetimePrecision || (dataType === "datetime" ? "second" : null),
    formatPattern: options.formatPattern || null,
    unit: options.unit || null,
    valueDomainCode: options.valueDomainCode || null,
    referenceCode: options.referenceCode || "GB_T_19488_1_2004",
    referenceClause: options.referenceClause || null,
    aliases: options.aliases || [],
    tags: options.tags || [],
    ownerName: options.ownerName || "数据治理委员会",
    stewardName: options.stewardName || "数据标准管理员",
  };
}

function m(tableName, columnName, elementIdentifier, confidence = 0.95, evidence = []) {
  return { tableName, columnName, elementIdentifier, confidence, evidence };
}

function toNull(value) {
  return value === undefined || value === null || value === "" ? null : value;
}

function json(value) {
  return JSON.stringify(value ?? null);
}

async function one(db, sql, params) {
  const [rows] = await db.query(sql, params);
  return rows[0] || null;
}

function placeholders(values) {
  return values.map(() => "?").join(", ");
}

async function cleanupNonNationalAndDeprecatedSeedData(db) {
  await db.query(
    `DELETE e
     FROM std_data_elements e
     LEFT JOIN std_reference_standards rs ON rs.id = e.reference_standard_id
     LEFT JOIN std_value_domains vd ON vd.id = e.value_domain_id
     LEFT JOIN std_reference_standards vrs ON vrs.id = vd.reference_standard_id
     WHERE e.element_code REGEXP '^(HB|QB)[0-9]{4}$'
        OR rs.standard_type IN ('industry', 'enterprise')
        OR vrs.standard_type IN ('industry', 'enterprise')`
  );

  const expectedCodeByIdentifier = new Map(elementSpecs.map((item) => [item.identifier, item.code]));
  const [seedElementRows] = await db.query(
    `SELECT id, element_identifier, element_code
     FROM std_data_elements
     WHERE created_by = ?`,
    [CREATED_BY]
  );
  const deprecatedElementIds = seedElementRows
    .filter((row) => expectedCodeByIdentifier.get(row.element_identifier) !== row.element_code)
    .map((row) => Number(row.id));
  if (deprecatedElementIds.length > 0) {
    await db.query(
      `DELETE FROM std_data_elements
       WHERE id IN (${placeholders(deprecatedElementIds)})`,
      deprecatedElementIds
    );
  }

  const domainCodes = domainSpecs.map((item) => item.code);
  await db.query(
    `DELETE vd
     FROM std_value_domains vd
     LEFT JOIN std_reference_standards rs ON rs.id = vd.reference_standard_id
     WHERE rs.standard_type IN ('industry', 'enterprise')
        OR (vd.created_by = ? AND vd.domain_code NOT IN (${placeholders(domainCodes)}))`,
    [CREATED_BY, ...domainCodes]
  );

  const referenceCodes = referenceSpecs.map((item) => item.code);
  await db.query(
    `DELETE FROM std_reference_standards
     WHERE standard_type IN ('industry', 'enterprise')
        OR (created_by = ? AND standard_code NOT IN (${placeholders(referenceCodes)}))`,
    [CREATED_BY, ...referenceCodes]
  );

  const catalogCodes = catalogSpecs.map((item) => item.code);
  await db.query(
    `DELETE c
     FROM std_catalogs c
     LEFT JOIN std_data_elements e ON e.catalog_id = c.id AND e.status <> 'deleted'
     LEFT JOIN std_catalogs child ON child.parent_id = c.id AND child.status <> 'deleted'
     WHERE c.created_by = ?
       AND c.catalog_code NOT IN (${placeholders(catalogCodes)})
       AND e.id IS NULL
       AND child.id IS NULL`,
    [CREATED_BY, ...catalogCodes]
  );
}

async function upsertCatalogs(db) {
  const ids = new Map();
  for (const spec of catalogSpecs) {
    const parentId = spec.parentCode ? ids.get(spec.parentCode) : null;
    await db.query(
      `INSERT INTO std_catalogs
        (parent_id, catalog_name, catalog_code, catalog_type, owner_name, description, sort_order, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
       ON DUPLICATE KEY UPDATE
        parent_id = VALUES(parent_id),
        catalog_name = VALUES(catalog_name),
        catalog_type = VALUES(catalog_type),
        owner_name = VALUES(owner_name),
        description = VALUES(description),
        sort_order = VALUES(sort_order),
        status = 'active'`,
      [parentId || null, spec.name, spec.code, spec.type, spec.owner, spec.description, spec.sortOrder, CREATED_BY]
    );
    const row = await one(db, "SELECT id FROM std_catalogs WHERE catalog_code = ?", [spec.code]);
    ids.set(spec.code, Number(row.id));
  }
  return ids;
}

async function upsertReferences(db) {
  const ids = new Map();
  for (const spec of referenceSpecs) {
    await db.query(
      `INSERT INTO std_reference_standards
        (standard_code, standard_name, standard_type, standard_no, publisher, effective_date, standard_url, description, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
       ON DUPLICATE KEY UPDATE
        standard_name = VALUES(standard_name),
        standard_type = VALUES(standard_type),
        standard_no = VALUES(standard_no),
        publisher = VALUES(publisher),
        effective_date = VALUES(effective_date),
        standard_url = VALUES(standard_url),
        description = VALUES(description),
        status = 'active'`,
      [spec.code, spec.name, spec.type, spec.standardNo, spec.publisher, toNull(spec.effectiveDate), spec.url || null, spec.description, CREATED_BY]
    );
    const row = await one(db, "SELECT id FROM std_reference_standards WHERE standard_code = ?", [spec.code]);
    ids.set(spec.code, Number(row.id));
  }
  return ids;
}

async function upsertValueDomains(db, referenceIds) {
  const ids = new Map();
  for (const spec of domainSpecs) {
    const referenceId = spec.referenceCode ? referenceIds.get(spec.referenceCode) : null;
    await db.query(
      `INSERT INTO std_value_domains
        (domain_code, domain_name, domain_type, value_type, data_type, min_value, max_value, regex_pattern,
         format_pattern, unit, reference_standard_id, reference_clause, description, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
       ON DUPLICATE KEY UPDATE
        domain_name = VALUES(domain_name),
        domain_type = VALUES(domain_type),
        value_type = VALUES(value_type),
        data_type = VALUES(data_type),
        min_value = VALUES(min_value),
        max_value = VALUES(max_value),
        regex_pattern = VALUES(regex_pattern),
        format_pattern = VALUES(format_pattern),
        unit = VALUES(unit),
        reference_standard_id = VALUES(reference_standard_id),
        reference_clause = VALUES(reference_clause),
        description = VALUES(description),
        status = 'active'`,
      [
        spec.code,
        spec.name,
        spec.type,
        spec.valueType,
        spec.dataType || null,
        spec.minValue ?? null,
        spec.maxValue ?? null,
        spec.regexPattern || null,
        spec.formatPattern || null,
        spec.unit || null,
        referenceId || null,
        spec.referenceClause || null,
        spec.description,
        CREATED_BY,
      ]
    );

    const row = await one(db, "SELECT id FROM std_value_domains WHERE domain_code = ?", [spec.code]);
    const domainId = Number(row.id);
    ids.set(spec.code, domainId);

    const itemCodes = (spec.items || []).map((item) => item[0]);
    if (itemCodes.length > 0) {
      await db.query(
        `DELETE FROM std_value_domain_items
         WHERE domain_id = ?
           AND item_code NOT IN (${placeholders(itemCodes)})`,
        [domainId, ...itemCodes]
      );
    } else {
      await db.query("DELETE FROM std_value_domain_items WHERE domain_id = ?", [domainId]);
    }

    for (const item of spec.items || []) {
      await db.query(
        `INSERT INTO std_value_domain_items
          (domain_id, item_code, item_label, item_value, item_meaning, sort_order, status)
         VALUES (?, ?, ?, ?, ?, ?, 'active')
         ON DUPLICATE KEY UPDATE
          item_label = VALUES(item_label),
          item_value = VALUES(item_value),
          item_meaning = VALUES(item_meaning),
          sort_order = VALUES(sort_order),
          status = 'active'`,
        [domainId, item[0], item[1], item[2] || item[0], item[3] || null, item[4] || 0]
      );
    }
  }
  return ids;
}

function buildElementSnapshot(spec, catalogId, valueDomainId, referenceId) {
  return {
    standardType: spec.standardType,
    elementIdentifier: spec.identifier,
    elementCode: spec.code,
    elementNameCn: spec.nameCn,
    elementNameEn: spec.nameEn,
    catalogId,
    objectClass: spec.objectClass,
    propertyName: spec.propertyName,
    representationTerm: spec.representationTerm,
    qualifiers: spec.qualifiers,
    definition: spec.definition,
    dataType: spec.dataType,
    maxLength: spec.maxLength,
    numericPrecision: spec.numericPrecision,
    numericScale: spec.numericScale,
    datetimePrecision: spec.datetimePrecision,
    formatPattern: spec.formatPattern,
    unit: spec.unit,
    valueDomainId,
    referenceStandardId: referenceId,
    referenceClause: spec.referenceClause,
    aliases: spec.aliases,
    tags: spec.tags,
    ownerName: spec.ownerName,
    stewardName: spec.stewardName,
    lifecycleStatus: "published",
    status: "active",
  };
}

async function upsertElements(db, catalogIds, domainIds, referenceIds) {
  const ids = new Map();
  for (const spec of elementSpecs) {
    const catalogId = spec.catalogCode ? catalogIds.get(spec.catalogCode) : null;
    const valueDomainId = spec.valueDomainCode ? domainIds.get(spec.valueDomainCode) : null;
    const referenceId = spec.referenceCode ? referenceIds.get(spec.referenceCode) : null;
    if (spec.legacyIdentifier && spec.legacyIdentifier !== spec.identifier) {
      const existingNew = await one(db, "SELECT id FROM std_data_elements WHERE element_identifier = ?", [spec.identifier]);
      if (!existingNew) {
        await db.query(
          `UPDATE std_data_elements
           SET element_identifier = ?, element_code = ?
           WHERE element_identifier = ? OR element_code = ?`,
          [spec.identifier, spec.code, spec.legacyIdentifier, spec.legacyCode]
        );
      }
    }
    await db.query(
      `INSERT INTO std_data_elements
        (element_identifier, element_code, element_name_cn, element_name_en, catalog_id,
         object_class, property_name, representation_term, qualifiers_json, definition,
         data_type, max_length, numeric_precision_value, numeric_scale_value, datetime_precision,
         format_pattern, unit, value_domain_id, reference_standard_id, reference_clause,
         aliases_json, tags_json, owner_name, steward_name, lifecycle_status, current_version_no, status, created_by, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', 1, 'active', ?, NOW())
       ON DUPLICATE KEY UPDATE
        element_code = VALUES(element_code),
        element_name_cn = VALUES(element_name_cn),
        element_name_en = VALUES(element_name_en),
        catalog_id = VALUES(catalog_id),
        object_class = VALUES(object_class),
        property_name = VALUES(property_name),
        representation_term = VALUES(representation_term),
        qualifiers_json = VALUES(qualifiers_json),
        definition = VALUES(definition),
        data_type = VALUES(data_type),
        max_length = VALUES(max_length),
        numeric_precision_value = VALUES(numeric_precision_value),
        numeric_scale_value = VALUES(numeric_scale_value),
        datetime_precision = VALUES(datetime_precision),
        format_pattern = VALUES(format_pattern),
        unit = VALUES(unit),
        value_domain_id = VALUES(value_domain_id),
        reference_standard_id = VALUES(reference_standard_id),
        reference_clause = VALUES(reference_clause),
        aliases_json = VALUES(aliases_json),
        tags_json = VALUES(tags_json),
        owner_name = VALUES(owner_name),
        steward_name = VALUES(steward_name),
        lifecycle_status = 'published',
        current_version_no = GREATEST(current_version_no, 1),
        status = 'active',
        published_at = COALESCE(published_at, VALUES(published_at))`,
      [
        spec.identifier,
        spec.code,
        spec.nameCn,
        spec.nameEn || null,
        catalogId || null,
        spec.objectClass || null,
        spec.propertyName || null,
        spec.representationTerm || null,
        json(spec.qualifiers || []),
        spec.definition || null,
        spec.dataType,
        spec.maxLength,
        spec.numericPrecision,
        spec.numericScale,
        spec.datetimePrecision,
        spec.formatPattern,
        spec.unit,
        valueDomainId || null,
        referenceId || null,
        spec.referenceClause,
        json(spec.aliases || []),
        json(spec.tags || []),
        spec.ownerName,
        spec.stewardName,
        CREATED_BY,
      ]
    );

    const row = await one(db, "SELECT id FROM std_data_elements WHERE element_identifier = ?", [spec.identifier]);
    const elementId = Number(row.id);
    ids.set(spec.identifier, elementId);
    ids.set(spec.code, elementId);
    if (spec.legacyIdentifier) ids.set(spec.legacyIdentifier, elementId);
    if (spec.legacyCode) ids.set(spec.legacyCode, elementId);

    const snapshot = buildElementSnapshot(spec, catalogId || null, valueDomainId || null, referenceId || null);
    await db.query(
      `INSERT INTO std_data_element_versions
        (element_id, version_no, version_status, snapshot_json, change_summary, created_by, published_at)
       VALUES (?, 1, 'published', ?, 'ODS 基线标准发布', ?, NOW())
       ON DUPLICATE KEY UPDATE
        version_status = 'published',
        snapshot_json = VALUES(snapshot_json),
        change_summary = VALUES(change_summary),
        created_by = VALUES(created_by),
        published_at = COALESCE(published_at, VALUES(published_at))`,
      [elementId, json(snapshot), CREATED_BY]
    );
  }
  return ids;
}

function buildFieldSnapshot(row) {
  return {
    resourceId: Number(row.resource_id),
    resourceCode: row.resource_code,
    tableName: row.table_name,
    tableComment: row.table_comment || "",
    resourceCategory: row.resource_category || "",
    columnName: row.column_name,
    ordinalPosition: Number(row.ordinal_position || 0),
    dataType: row.data_type || "",
    columnType: row.column_type || "",
    nullable: Boolean(row.is_nullable),
    primaryKey: Boolean(row.is_primary_key),
    columnDefault: row.column_default ?? null,
    columnComment: row.column_comment || "",
    businessName: row.business_name || "",
  };
}

async function loadOdsFields(db) {
  const tableNames = Array.from(new Set(mappingSpecs.map((item) => item.tableName)));
  const placeholders = tableNames.map(() => "?").join(", ");
  const [rows] = await db.query(
    `SELECT r.id AS resource_id, r.resource_code, r.table_name, r.table_comment, r.resource_category,
            f.column_name, f.ordinal_position, f.data_type, f.column_type, f.is_nullable, f.is_primary_key,
            f.column_default, f.column_comment, f.business_name
     FROM dm_resources r
     JOIN dm_resource_fields f ON f.resource_id = r.id
     WHERE r.status = 'active'
       AND f.status = 'active'
       AND r.table_name IN (${placeholders})`,
    tableNames
  );
  const fieldMap = new Map();
  for (const row of rows) {
    fieldMap.set(`${row.table_name}.${row.column_name}`, row);
  }
  return fieldMap;
}

async function upsertFieldMappings(db, elementIds) {
  const fieldMap = await loadOdsFields(db);
  const missing = [];
  let inserted = 0;
  let updated = 0;

  for (const spec of mappingSpecs) {
    const field = fieldMap.get(`${spec.tableName}.${spec.columnName}`);
    const elementId = elementIds.get(spec.elementIdentifier);
    if (!field || !elementId) {
      missing.push(spec);
      continue;
    }

    const snapshot = buildFieldSnapshot(field);
    const evidence = [
      "ODS 基线规则命中字段名、字段注释和业务场景",
      `来源表：${field.table_name}（${field.table_comment || "无表注释"}）`,
      `字段注释：${field.column_comment || "无字段注释"}`,
      ...spec.evidence,
    ];
    const existing = await one(
      db,
      `SELECT id
       FROM std_field_mappings
       WHERE source_module = 'data_map'
         AND table_name = ?
         AND column_name = ?
         AND element_id = ?
       ORDER BY id ASC
       LIMIT 1`,
      [spec.tableName, spec.columnName, elementId]
    );

    if (existing) {
      await db.query(
        `UPDATE std_field_mappings
         SET resource_id = ?, resource_code = ?, field_snapshot_json = ?, mapping_status = 'approved',
             confidence = ?, evidence_json = ?, reviewed_by = ?, reviewed_at = NOW()
         WHERE id = ?`,
        [field.resource_id, field.resource_code, json(snapshot), spec.confidence, json(evidence), CREATED_BY, existing.id]
      );
      updated += 1;
    } else {
      await db.query(
        `INSERT INTO std_field_mappings
          (element_id, source_module, resource_id, resource_code, table_name, column_name,
           field_snapshot_json, mapping_status, confidence, evidence_json, created_by, reviewed_by, reviewed_at)
         VALUES (?, 'data_map', ?, ?, ?, ?, ?, 'approved', ?, ?, ?, ?, NOW())`,
        [
          elementId,
          field.resource_id,
          field.resource_code,
          spec.tableName,
          spec.columnName,
          json(snapshot),
          spec.confidence,
          json(evidence),
          CREATED_BY,
          CREATED_BY,
        ]
      );
      inserted += 1;
    }
  }

  return { inserted, updated, missing };
}

async function seedBaseline() {
  return {
    skipped: true,
    reason: "数据标准基线种子已禁用。页面删除、编辑的数据以数据库当前状态为准，脚本不再恢复任何目录、数据元、引用标准、值域或映射。",
  };
}

async function main() {
  const result = await seedBaseline();
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error("[seed-data-standards-baseline] failed:", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await pool.end();
    });
}

module.exports = {
  seedBaseline,
};
