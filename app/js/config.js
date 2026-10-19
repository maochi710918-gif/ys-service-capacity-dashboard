/* =========================================================================
 * 指標、權重、門檻、欄位對應 — 全系統集中設定
 * 預設值皆依 Excel「綜合戰力指數」「指標定義」「服專總覽/出納總覽」公式。
 * 後台「指標與權重設定」頁可覆寫（存於瀏覽器 localStorage）。
 * ========================================================================= */
(function (root) {
  const DEFAULT_CONFIG = {
    version: '2026.10.14 v2',
    // 計分來源：'excel'＝單項／構面PR採附件、系統依權重加權；'system'＝系統由月度明細重算PR
    scoreSource: 'excel',

    /* ---------- 綜合戰力權重（Excel：綜合戰力指數） ---------- */
    weights: {
      SA: { volume: 0.20, revenue: 0.10, retention: 0.10, designate: 0.10, service: 0.20, ops: 0.10, solicit: 0.20 },
      CA: { volume: 0.25, digital: 0.15, service: 0.25, card: 0.10, ops: 0.15, solicit: 0.10 }
    },

    /* ---------- 構面組成（Excel：綜合戰力指數「主要內容」） ----------
     * dir: 1 越高越好；-1 越少越好（PR = 1 − 低於者比例）                */
    dimensions: {
      SA: [
        { key: 'volume',    label: '量能PR',     prKey: 'prVolume',    metrics: [['dailyBase', 1]],                                          desc: '公司基準日均接車（v2 實際公式）' },
        { key: 'revenue',   label: '營收效率PR', prKey: 'prRevenue',   metrics: [['perCar', 1]],                                             desc: '單車產值（鈑噴納入招攬執行PR）' },
        { key: 'retention', label: '返廠促進PR', prKey: 'prRetention', metrics: [['a1', 1], ['a2', 1]],                                       desc: 'A1＋A2準時定保' },
        { key: 'designate', label: '客戶指定PR', prKey: 'prDesignate', metrics: [['app', 1], ['esRedesignate', 1]],                           desc: 'APP預約指定＋ES服專再指定' },
        { key: 'service',   label: '服務品質PR', prKey: 'prService',   metrics: [['csi', 1], ['csiFirst', 1], ['esSelf', 1]],                 desc: 'CSI＋CSI首回＋ES自主滿意度' },
        { key: 'ops',       label: '作業品質PR', prKey: 'prOps',       metrics: [['ngFeePer100', -1], ['ngTimePer100', -1], ['keyPer100', -1]], desc: '每100台收費NG＋時間NG＋解金鑰，越少越好' },
        { key: 'solicit',   label: '招攬執行PR', prKey: 'prSolicit',   metrics: [], desc: '美容、裕信護照、裕日護照每100台、S餐油品、化品OK、NVS、自費鈑噴營收達成率，各1/7' }
      ],
      CA: [
        { key: 'volume',  label: '量能PR',     prKey: 'prVolume',  metrics: [['dailyBase', 1]],                                  desc: '公司基準日均結帳（v2 實際公式）' },
        { key: 'digital', label: '數位流程PR', prKey: 'prDigital', metrics: [['esign', 1]],                                      desc: '電子簽名率' },
        { key: 'service', label: '服務品質PR', prKey: 'prService', metrics: [['csi', 1], ['csiFirst', 1], ['esSelf', 1]],        desc: 'CSI滿意度＋CSI首回滿意度＋ES自主滿意度' },
        { key: 'card',    label: '感心卡PR',   prKey: 'prCard',    metrics: [['card', 1]],                                       desc: '感心卡核卡' },
        { key: 'ops',     label: '作業品質PR', prKey: 'prOps',     metrics: [['ngFeePer100', -1], ['keyPer100', -1]],            desc: '每100張工單收費解說NG＋每100張工單解金鑰次數，越少越好' },
        { key: 'solicit', label: '招攬執行PR', prKey: 'prSolicit', metrics: [],                                                  desc: '裕信、裕日護照每100張結帳工單本數PR，各50%' }
      ]
    },

    /* ---------- 門檻（可調整） ---------- */
    thresholds: {
      // 綜合戰力 / 九宮格（Excel：高≥70、中50–69.99、低<50）
      highPower: 70,
      midPower: 50,
      // 綜合戰力計算所需最低資料完整度（Excel 未明文；依現有結果反推：<50% 者未計分）
      scoreMinCompleteness: 0,
      // 1–9月版 Excel：所有戰力構面皆可計算才計分（不以部分構面重配權重）
      requireAllDims: true,
      // v2：正式排名需 ≥3 有效服務月且必要資料齊備（依 Excel「正式排名資料狀態」）
      minServiceMonths: 3,
      // 升階準備度：資料完整度不足（Excel 公式 AG<70%）
      promoMinCompleteness: 0.7,
      // 升階準備度（Excel 服專 AS／出納 AF 公式）
      promo: {
        seniorCore: { power: 75, service: 0.60, ops: 0.60 },            // MSA／高級出納：核心帶訓候選
        seniorStable: { power: 60 },                                    // MSA／高級出納：高階穩定
        candidate: { power: 70, licensePR: 0.75, service: 0.60, ops: 0.50 }, // SSA/SA/出納專員 升階候選
        near: { power: 60, licensePR: 0.60 },                           // 接近升階
        assistant: { power: 60, years: 0.5 }                            // 服務助理→SA培養候選
      },
      // 高量能（Excel 管理總覽：PR≥75%）
      highVolumePR: 0.75,
      // 高量需改善：量能PR ≥ highVolumePR 且 服務品質PR < 此值（Excel 未列公式，依其人數反推：服專4、出納4 一致）
      highVolNeedQualityPR: 0.50,
      // 異常判斷
      lowQualityPR: 0.40,          // 服務品質PR低於此值視為品質偏低
      goodQualityPR: 0.70,         // 服務品質PR高於此值視為品質佳
      lowVolumePR: 0.50,           // 量能PR低於此值視為量能未釋放
      lowPerCarRatio: 0.90,        // 單車產值 < 全公司平均 × 此比例
      trendDrop: -0.10,            // 近3月趨勢 ≤ −10%
      csiDrop: -10,                // 近3月CSI變化 ≤ −10 點
      ngHighPR: 0.25,              // 作業品質PR ≤ 25% 視為NG偏高
      licenseGap: -10,             // 證照戰力落差 ≤ −10 分
      topPR: 0.75,                 // 低年資但進入前段：同職務排名PR ≥ 75%
      lowCompleteness: 0.70,       // 資料完整度不足
      minValidMonths: 6,           // 有效月份不足
      loadHighRatio: 1.2,          // 服務廠人均負荷 > 全公司平均 × 此比例 → 配置提醒
      csiMinSurveys: 10,           // 服專問卷排名最低問卷份數
      // KPI 紅黃綠
      kpiYellowPct: -0.05,         // 增減率介於 −5%~0 為黃
      completenessGreen: 0.90,
      completenessYellow: 0.70
    },

    labels: { noReview: '不盤點／資料不足' },

    /* ---------- 排除於服務廠管理指標之據點（保留於後台資料層供稽核） ---------- */
    excludedPlants: ['撫遠鈑噴廠', '撫遠廠', '未辨識'],

    /* ---------- 服專標準量能（接車量能達成率） ----------
     * 標準量能＝實際工作日 × perDay；workdays 依月份填入（系統內「指標與權重設定」可編輯）。
     * 目前 Excel 未提供工作日／出勤日資料，未填月份之達成率顯示「資料未提供」。 */
    capacity: { perDay: 11.5, workdays: {} },

    /* ---------- 服專稼動率分級（稼動率＝接車 ÷ 工作天數 × perDay） ---------- */
    utilization: { over: 1.20, high: 1.00, low: 0.80 },

    /* ---------- 顧客保留率（CRM 查詢結果） ----------
     * 保留＝最近回廠距查詢日 ≤ days；流失風險＝ riskDays < 未回廠天數 ≤ days；已流失＝ > days */
    retention: { days: 365, riskDays: 270, goodRate: 0.90, warnRate: 0.80, minCustomers: 10 },

    /* ---------- 年資群（Excel AU 公式） ---------- */
    tenureGroups: [
      { label: '<1年', max: 1 },
      { label: '1–3年', max: 3 },
      { label: '3–5年', max: 5 },
      { label: '5–10年', max: 10 },
      { label: '10年以上', max: Infinity }
    ],

    /* ---------- 九宮格（Excel：人才九宮格） ---------- */
    grid: {
      maturities: ['高成熟', '中成熟', '發展期'],
      bands: ['低戰力', '中戰力', '高戰力'],
      types: {
        '高成熟': ['資深戰力落差', '資深穩定', '核心／帶訓'],
        '中成熟': ['重點輔導', '穩定成長', '升階候選'],
        '發展期': ['基礎養成', '加速培育', '高潛力新星']
      }
    },

    /* ---------- 人才梯隊 ---------- */
    ladder: {
      SA: ['服務助理', 'SA級服務專員', 'SSA級服務專員', 'MSA級服務專員'],
      CA: ['出納專員', '高級出納專員']
    },

    /* ---------- 構面短板 → 建議培訓項目（管理參考，可調整） ---------- */
    training: {
      volume: '工作量承接與派工節奏（接車／結帳流程效率）',
      revenue: '維修建議與附加銷售話術、自費鈑噴招攬',
      retention: '定保召回與返廠預約管理（A1／A2）',
      designate: 'APP預約推廣與顧客關係經營',
      service: 'CSI服務流程與顧客溝通（首回滿意、ES自主）',
      ops: '收費解說、時間管理與金鑰作業SOP',
      digital: '電子簽名／雙螢幕結帳流程落實',
      card: '感心卡推廣與服務關懷執行'
    },

    /* ---------- 人員類型（1–9月版 Excel 管理總覽「現職人才類型」：依人才類型分組） ---------- */
    personGroups: [
      { type: '核心／帶訓', talents: ['核心／帶訓'] },
      { type: '升階候選', talents: ['升階候選'] },
      { type: '高潛力新星', talents: ['高潛力新星'] },
      { type: '資深穩定／穩定成長', talents: ['資深穩定', '穩定成長'] },
      { type: '輔導／落差／基礎養成', talents: ['重點輔導', '資深戰力落差', '基礎養成'], coach: true },
      { type: '加速培育／資料不足', talents: ['加速培育', '不盤點／資料不足', '資料不足'] }
    ],

    /* ---------- 帳號登入（與「售服績效戰情中心」共用 Supabase 帳號；publishable key 為瀏覽器端公開金鑰） ---------- */
    auth: { supabaseUrl: 'https://lhkdnfrareofawkdmunz.supabase.co', publishableKey: 'sb_publishable_eSEri2_WtVda1a7BbzZzgg_2BpFZJDu', emailDomain: '@yuxin.internal', idleMinutes: 30, appName: '服專出納服務量能儀表板' },
    adminPages: ['quality', 'import', 'settings', 'perms'],

    /* ---------- 權限（系統角色） ---------- */
    permissions: {
      '服務部主管': { scope: 'all', pages: '*' },
      'HRBP': { scope: 'all', pages: ['audit', 'solicit', 'board', 'overview', 'sa', 'utilization', 'ca', 'person', 'retention', 'power', 'grid', 'ladder', 'rank', 'quality'] },
      '廠長': { scope: 'plant', pages: ['audit', 'solicit', 'board', 'overview', 'plants', 'revenue', 'sa', 'utilization', 'ca', 'person', 'monthly', 'carage', 'retention', 'power', 'grid', 'ladder', 'rank', 'quality'] },
      '個人': { scope: 'self', pages: ['audit', 'person', 'monthly', 'retention', 'utilization'] },
      '系統管理員': { scope: 'all', pages: '*' }
    }
  };

  /* ---------- Excel 欄位對應表（工作表 → 欄位名稱 → 系統欄位） ---------- */
  const FIELD_MAP = {
    '服專總覽': {
      role: 'SA', headerKey: '廠別', required: ['廠別', '姓名', '證照', '年資', '累積接車台數', '人員狀態'],
      cols: {
        '廠別': 'plant', '姓名': 'name', '證照': 'license', '年資': 'years', '有效月份': 'validMonths',
        '累積接車台數': 'totalCars', '月均接車台數': 'avgCars', '累積業績': 'totalRevenue', '月均業績': 'avgRevenue',
        '單車產值': 'perCar', '3年內佔比': 'age3', '3–8年佔比': 'age38', '8年以上佔比': 'age8', '車齡資料完整度': 'ageComplete',
        'APP預約指定': 'app', 'A1準時定保達成': 'a1', 'A2準時定保達成': 'a2', '自費鈑噴達成': 'bodyPaint',
        'CSI滿意度': 'csi', 'CSI首回滿意度': 'csiFirst', 'ES自主滿意度': 'esSelf', 'ES服專再指定': 'esRedesignate',
        '收費解說NG': 'ngFee', '時間管理NG': 'ngTime', '解金鑰次數': 'keyUnlock',
        '每100台收費NG': 'ngFeePer100', '每100台時間NG': 'ngTimePer100', '每100台解金鑰': 'keyPer100',
        '近3月接車趨勢': 'trendCars', '近3月業績趨勢': 'trendRevenue', '近3月CSI變化(點)': 'trendCsi', '接車波動度': 'volatility',
        '資料完整度': 'completeness', '量能PR': 'prVolume', '營收效率PR': 'prRevenue', '返廠促進PR': 'prRetention',
        '客戶指定PR': 'prDesignate', '服務品質PR': 'prService', '作業品質PR': 'prOps', '綜合戰力指數': 'power', '排名': 'rank',
        '同證照PR': 'prLicense', '同年資PR': 'prTenure', '證照戰力落差(分)': 'licenseGap', '升階準備度': 'promotion',
        '人才類型': 'talentType', '年資群': 'tenureGroup', '人才成熟度': 'maturity', '人員狀態': 'status', '現職': 'position', '管理建議': 'advice'
      }
    },
    '出納總覽': {
      role: 'CA', headerKey: '廠別', required: ['廠別', '姓名', '證照', '年資', '累積結帳工單', '人員狀態'],
      cols: {
        '廠別': 'plant', '姓名': 'name', '證照': 'license', '年資': 'years', '有效月份': 'validMonths',
        '累積結帳工單': 'totalOrders', '月均結帳工單': 'avgOrders', '電子簽名率': 'esign', '感心卡核卡(平均)': 'card',
        'CSI滿意度': 'csi', 'CSI首回滿意度': 'csiFirst', 'ES自主滿意度': 'esSelf', '所屬廠CSI樣本達成率': 'plantCsiSample',
        '收費解說NG': 'ngFee', '解金鑰次數': 'keyUnlock', '每100張工單收費NG': 'ngFeePer100', '每100張工單解金鑰': 'keyPer100',
        '近3月結帳量趨勢': 'trendOrders', '近3月CSI變化(點)': 'trendCsi', '結帳量波動度': 'volatility', '資料完整度': 'completeness',
        '量能PR': 'prVolume', '數位流程PR': 'prDigital', '感心卡PR': 'prCard', '服務品質PR': 'prService', '作業品質PR': 'prOps',
        '綜合戰力指數': 'power', '排名': 'rank', '同證照PR': 'prLicense', '同年資PR': 'prTenure', '證照戰力落差(分)': 'licenseGap',
        '升階準備度': 'promotion', '人才類型': 'talentType', '年資群': 'tenureGroup', '人才成熟度': 'maturity',
        '人員狀態': 'status', '現職': 'position', '管理建議': 'advice'
      }
    },
    '服專月度明細': {
      role: 'SA', headerKey: '月份', required: ['月份', '最新廠別', '實際廠別', '服專', '人員狀態'],
      cols: {
        '月份': 'month', '最新廠別': 'latestPlant', '實際廠別': 'actualPlant', '服專': 'name', '人員狀態': 'status',
        '個人業績': 'revenue', '接車台數': 'cars', '3年內台數': 'cars3', '3–8年台數': 'cars38', '8年以上台數': 'cars8',
        '車齡資料完整度': 'ageComplete', 'APP預約指定': 'app', 'A1準時定保達成': 'a1', 'A2準時定保達成': 'a2',
        '自費鈑噴達成': 'bodyPaint', 'CSI滿意度': 'csi', 'CSI首回滿意度': 'csiFirst', 'ES自主滿意度': 'esSelf',
        'ES服專再指定': 'esRedesignate', '收費解說NG': 'ngFee', '時間管理NG': 'ngTime', '解金鑰次數': 'keyUnlock'
      }
    },
    '出納月度明細': {
      role: 'CA', headerKey: '月份', required: ['月份', '最新廠別', '實際廠別', '出納', '人員狀態'],
      cols: {
        '月份': 'month', '最新廠別': 'latestPlant', '實際廠別': 'actualPlant', '出納': 'name', '人員狀態': 'status',
        '結帳工單數': 'orders', '電子簽名率': 'esign', '感心卡核卡': 'card', 'CSI滿意度': 'csi', 'CSI首回滿意度': 'csiFirst',
        'ES自主滿意度': 'esSelf', '所屬廠CSI樣本達成率': 'plantCsiSample', '收費解說NG': 'ngFee', '解金鑰次數': 'keyUnlock'
      }
    },
    '服務廠量能': {
      headerKey: '服務廠', required: ['服務廠', '現行服專', '現行出納'],
      cols: {
        '服務廠': 'plant', '現行服專': 'saCount', '現行出納': 'caCount', '服專月均接車': 'saAvgCars', '服專月均業績': 'saAvgRevenue',
        '服專單車產值': 'saPerCar', 'APP預約指定': 'app', '服專CSI': 'saCsi', '服專平均戰力指數': 'saPower',
        '出納月均結帳': 'caAvgOrders', '電子簽名率': 'esign', '出納CSI': 'caCsi', '出納平均戰力指數': 'caPower', '配置提醒': 'note'
      }
    },
    '廠別月度量能': {
      headerKey: '月份', required: ['月份', '實際廠別'],
      cols: { '月份': 'month', '實際廠別': 'plant', '接車台數': 'cars', '服專業績': 'revenue', '結帳工單': 'orders', 'APP預約指定平均': 'app', '電子簽名率平均': 'esign' }
    },
    '招攬總覽': {
      optional: true, headerKey: '職務', required: ['職務', '姓名'],
      cols: { '職務': 'roleName', '最新廠別': 'plant', '姓名': 'name', '人員狀態': 'status', '服務有效月數': 'serviceMonths', '美容資料月數': 'beautyMonths', '裕信資料月數': 'ysMonths', '裕日資料月數': 'yrMonths', '油品有效月數': 'oilMonths', '化品有效月數': 'chemMonths', 'NVS有效月數': 'nvsMonths', '裕日配對工作量': 'yrBase', '裕信配對工作量': 'ysBase', '裕信有目標月實績': 'ysPA', '美容月平均': 'beautyAvg', '裕信月平均本數': 'ysAvg', '裕日月平均本數': 'yrAvg', 'NVS月平均實績': 'nvsAvg', 'NVS去重定保台數': 'nvsCars', 'NVS單台': 'nvsPerCar', '美容累積實績': 'beauty', '美容配對實績': 'beautyPA', '美容配對目標': 'beautyPT', '美容達成率': 'beautyRate',
        '裕信累積本數': 'ysBooks', '裕信累積目標': 'ysTarget', '裕信達成率': 'ysRate', '裕日累積本數': 'yrBooks', '裕日每100件本數': 'yrPer100', '裕信每100件本數': 'ysPer100', 'S餐使用台數': 'oilUsed', 'S餐對象台數': 'oilBase', '累積S餐使用率': 'oilRate',
        '化品OK台數': 'chemOk', '化品對象台數': 'chemBase', '累積化品OK率': 'chemRate', 'NVS累積實績': 'nvs', 'NVS累積目標': 'nvsTarget', 'NVS達成率': 'nvsRate', '鈑噴達成率': 'bodyRate', '招攬PR': 'prSolicit', '招攬資料狀態': 'solicitStatus', '候選資格': 'candidate',
        '美容PR': 'prBeauty', '裕信PR': 'prYs', '裕日PR': 'prYr', '油品PR': 'prOil', '化品PR': 'prChem', 'NVSPR': 'prNvs', '鈑噴PR': 'prBody', '資料涵蓋月份': 'coverage' }
    },
    '月度戰力': {
      optional: true, headerKey: '月份', required: ['月份', '職務', '姓名', '綜合戰力'],
      cols: { '月份': 'month', '職務': 'roleName', '最新廠別': 'plant', '姓名': 'name', '綜合戰力': 'power', '當月排名': 'rank', '資料狀態': 'status', '量能PR': 'prVolume', '營收效率PR': 'prRevenue', '返廠促進PR': 'prRetention', '客戶指定PR': 'prDesignate',
        '服務品質PR': 'prService', '作業品質PR': 'prOps', '招攬PR': 'prSolicit', '電子簽名PR': 'prDigital', '感心卡PR': 'prCard', '基準日均量': 'dailyBase', '期間服務月數': 'serviceMonths',
        '日均量原值': 'dailyRaw', '單車產值': 'perCar', 'CSI': 'csi', '首回CSI': 'csiFirst', 'ES自主': 'esSelf', '電子簽名率': 'esign', '感心卡核卡': 'card', '候選資格': 'candidate', '戰力數值有效': 'powerValid' }
    },
    '廠內負荷分擔': {
      optional: true, headerKey: '月份', required: ['月份', '姓名'],
      cols: { '月份': 'month', '實際服務廠': 'plant', '服務業務': 'roleName', '姓名': 'name', '現職／人員狀態': 'position', '承接工作量': 'work', '廠內同業務個人量': 'plantTotal', '負荷分擔比例': 'share', '支援標示': 'tag', '歸屬說明': 'note' }
    },
    '資料檢核': {
      headerKey: '層級', required: ['層級', '檢核項目', '發現', '本次處理'],
      cols: { '層級': 'level', '檢核項目': 'item', '發現': 'finding', '本次處理': 'handling' }
    },
    '指標定義': {
      headerKey: '角色', required: ['角色', '指標'],
      cols: { '角色': 'role', '指標': 'metric', '定義／來源': 'definition', '管理意義': 'meaning', '是否納入綜合戰力': 'inPower' }
    },
    '資料來源': {
      headerKey: '類別', required: ['類別', '檔案'],
      cols: { '類別': 'category', '檔案': 'file', '用途': 'usage' }
    }
  };

  /* 欄位別名／新增欄位（新版 Excel 改名或新增時，舊版欄位仍可讀） */
  const FIELD_ALIASES = {
    '服專總覽': { '現職職務': 'position', '同證照戰力PR': 'prLicense', '同年資戰力PR': 'prTenure', '同證照戰力差（分）': 'licenseGap', '公司基準日均接車台數': 'dailyBase', '月度戰力平均（參考）': 'monthlyPowerAvg', '招攬執行PR': 'prSolicit', '公司基準日均接車PR': 'prCars', '月均業績PR（參考）': 'prRev', '美容達成率': 'beautyRate', '裕信護照達成率': 'ysRate', '裕日護照每100台接車本數': 'yrPer100', 'S餐油品使用率': 'oilRate', '化學品OK率': 'chemRate', 'NVS達成率': 'nvsRate', '8月鈑噴達成率（單月）': 'bodyPaintLast', '美容達成率PR': 'prBeauty', '裕信護照達成率PR': 'prYs', '裕日護照密度PR': 'prYr', 'S餐油品使用率PR': 'prOil', '化學品OK率PR': 'prChem', 'NVS達成率PR': 'prNvs', '招攬來源資料狀態': 'solicitStatus', '現職滿3服務月': 'has3', '日均量有效': 'dailyValid', '招攬PR有效': 'solicitValid', '招攬PR': 'prSolicit', '公司基準日均量': 'dailyBase', '月度戰力平均': 'monthlyPowerAvg', '正式排名資料狀態': 'rankStatus', '8月鈑噴營收達成率': 'bodyPaintLast', '接車PR': 'prCars', '業績PR': 'prRev', '單車產值PR': 'prPerCar', '鈑噴達成PR': 'prBody', 'A1PR': 'prA1', 'A2PR': 'prA2', 'APPPR': 'prApp', 'ES再指定PR': 'prEsR', 'CSIPR': 'prCsi', '首回CSIPR': 'prCsiFirst', 'ES自主PR': 'prEsSelf', '收費NG反向PR': 'prNgFee', '時間NG反向PR': 'prNgTime', '解金鑰反向PR': 'prKeyInv', '任職／實績月數': 'employMonths', '>3且<8年佔比': 'age38', '≥8年佔比': 'age8', '自費鈑噴營收達成率': 'bodyPaint', 'CSI均值差(6–8比3–5月)': 'trendCsi',
      '到職日': 'hireDate', '平均計算依據': 'avgBasis', '資料涵蓋月份': 'coverage', '已知任職月數': 'knownMonths', '接車有效月份': 'carMonths', '業績有效月份': 'revMonths', 'CSI有效月份': 'csiMonths', '盤點資料狀態': 'reviewStatus' },
    '出納總覽': { '現職職務': 'position', '同證照戰力PR': 'prLicense', '同年資戰力PR': 'prTenure', '同證照戰力差（分）': 'licenseGap', '公司基準日均結帳張數': 'dailyBase', '月度戰力平均（參考）': 'monthlyPowerAvg', '招攬執行PR': 'prSolicit', '9月電子簽名率（單月）': 'esignLast', '裕信護照累積本數': 'ysBooks', '裕信護照月均本數': 'ysAvg', '裕信護照每100張工單本數': 'ysPer100', '裕日護照累積本數': 'yrBooks', '裕日護照月均本數': 'yrAvg', '裕日護照每100張工單本數': 'yrPer100', '所屬廠CSI樣本指標（廠級背景）': 'plantCsiSample', '公司基準日均結帳PR': 'prOrders', '裕信護照密度PR': 'prYs', '裕日護照密度PR': 'prYr', '招攬來源資料狀態': 'solicitStatus', '現職滿3服務月': 'has3', '日均量有效': 'dailyValid', '招攬PR有效': 'solicitValid', '招攬PR': 'prSolicit', '公司基準日均量': 'dailyBase', '月度戰力平均': 'monthlyPowerAvg', '正式排名資料狀態': 'rankStatus', '結帳PR': 'prOrders', '電子簽名PR': 'prEsign', 'CSIPR': 'prCsi', '首回CSIPR': 'prCsiFirst', 'ES自主PR': 'prEsSelf', '收費NG反向PR': 'prNgFee', '解金鑰反向PR': 'prKeyInv', '任職／實績月數': 'employMonths', '月平均電子簽名率': 'esign', 'CSI均值差(6–8比3–5月)': 'trendCsi',
      '到職日': 'hireDate', '平均計算依據': 'avgBasis', '資料涵蓋月份': 'coverage', '已知任職月數': 'knownMonths', '結帳有效月份': 'orderMonths', 'CSI有效月份': 'csiMonths', '盤點資料狀態': 'reviewStatus', '9月電子簽名率': 'esignLast' },
    '服專月度明細': { '>3且<8年台數': 'cars38', '≥8年台數': 'cars8', '自費鈑噴營收達成率': 'bodyPaint', 'APP指定次數': 'appCount', 'APP同來源接車數': 'appBase', '跨廠支援／實際分布': 'support',
      '廠工作天數': 'workdays', '公司基準工作日': 'workdays', '公司基準日均服務量': 'daily', '量能配對基準工作日': 'workdaysPair', '工作量數值有效': 'workValid', '日均接車(廠工作日)': 'daily', '標準量能達成率': 'capRate', '資料涵蓋說明': 'coverNote', '任職月份旗標': 'employedFlag', '業績來源廠別': 'revPlant' },
    '出納月度明細': { '跨廠支援／實際分布': 'support', '公司基準工作日': 'workdays', '公司基準日均服務量': 'daily', '量能配對基準工作日': 'workdaysPair', '工作量數值有效': 'workValid', '廠工作天數': 'workdays', '日均結帳(廠工作日)': 'daily', '標準量能達成率': 'capRate', '資料涵蓋說明': 'coverNote', '任職月份旗標': 'employedFlag', '9月電子簽名數': 'esignCount', '9月簽名對象數': 'esignBase' },
    '服務廠量能': { '9月營收目標(元)': 'revTarget', '9月營收實績(元)': 'revActual', '9月營收達成率': 'revRate', '9月廠工作天數': 'workdays', '9月去重接車台數': 'carsDedup', '9月去重結帳工單': 'ordersDedup',
      '8–9月累積廠營收目標': 'cumTarget', '8–9月累積廠營收實績': 'cumActual', '8–9月累積達成率': 'cumRate', '廠营收資料涵蓋': 'revNote', '廠營收資料涵蓋': 'revNote',
      '1–9月累積廠營收目標': 'cumTarget', '1–9月累積已提供實績': 'cumActual', '1–9月累積達成率（配對月份）': 'cumRate', '目標資料月數（含0）': 'targetMonths', '實績資料月數（含0）': 'actualMonths', '目標資料月平均(元)': 'targetAvg', '實績資料月平均(元)': 'actualAvg',
      '配對營運月數': 'pairMonths', '配對累積目標': 'pairTarget', '配對累積實績': 'pairActual', '配對累積差額': 'pairDiff', '營收與量能觀察': 'revObs', '特殊主管負荷分擔人數': 'specialN', '特殊主管期間接車台數': 'specialCars', '專職與特殊主管基準日均量': 'dailyBase', '服專專職基準負荷': 'saLoad', '出納專職基準負荷': 'caLoad',
      'Q1營收目標': 'q1T', 'Q1已提供實績': 'q1A', 'Q1配對達成率': 'q1R', 'Q2營收目標': 'q2T', 'Q2已提供實績': 'q2A', 'Q2配對達成率': 'q2R', 'Q3營收目標': 'q3T', 'Q3已提供實績': 'q3A', 'Q3配對達成率': 'q3R', 'Q3較Q2變化(pp)': 'q3vq2' },
    '廠別月度量能': { '廠別': 'plant', '廠營收目標(元)': 'revTarget', '廠營收實績(元)': 'revActual', '廠營收達成率': 'revRate', '廠工作天數': 'workdays', '跨服專重複數': 'dupSA', '跨出納重複數': 'dupCA', '日均接車(廠工作日)': 'dailyCars', '日均結帳(廠工作日)': 'dailyOrders', '來源說明': 'note', 'APP指定次數': 'appCount', 'APP同來源接車數': 'appBase',
      '目標數值有效': 'tValid', '實績數值有效': 'aValid', '目標實績配對': 'paired', '配對目標': 'pT', '配對實績': 'pA', '當月配對差額': 'pDiff', '季度': 'quarter', '營收資料狀態': 'revStatus', '營收適用月份': 'revApplicable', '原表營收目標': 'origT', '原表营收實績': 'origA' }
  };

  // 月度明細需計入「資料完整度」的欄位（Excel：服專13項、出納9項／月）
  const COMPLETENESS_FIELDS = {
    SA: ['revenue', 'cars', 'app', 'a1', 'a2', 'bodyPaint', 'csi', 'csiFirst', 'esSelf', 'esRedesignate', 'ngFee', 'ngTime', 'keyUnlock'],
    CA: ['orders', 'esign', 'card', 'csi', 'csiFirst', 'esSelf', 'plantCsiSample', 'ngFee', 'keyUnlock']
  };

  const api = { DEFAULT_CONFIG, FIELD_MAP, FIELD_ALIASES, COMPLETENESS_FIELDS };
  root.APP_CONFIG = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
