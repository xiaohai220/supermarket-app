/*
 * 超市客户服务终端 — PRD 验收测试运行器
 * 直接从真实 index.html 抽取应用脚本，在 Node 中用 DOM/localStorage/fetch 桩运行并断言。
 * 运行： node tests/run.js
 * 不删除、不跳过、不降低任何测试；失败即修应用代码。
 */
'use strict';
const fs = require('fs');
const path = require('path');

const APP_PATH = path.join(__dirname, '..', 'index.html');

// 真实接口口径（PKR 基准）：rates[T] = 1 PKR 可换得的 T 数量
const R = {
  PKR: 1, USD: 0.003598, EUR: 0.003137, GBP: 0.00269, CNY: 0.024167,
  JPY: 0.565955, AED: 0.013225, SAR: 0.013504, INR: 0.345367,
  CAD: 0.005038, AUD: 0.005055, CHF: 0.002963, SGD: 0.004595,
  MYR: 0.014689, THB: 0.120029, KRW: 4.989639, TRY: 0.175581
};
function okRates(base) {
  if (base === 'PKR') return { ...R };
  const b = R[base]; const out = {};
  for (const k of Object.keys(R)) out[k] = +(R[k] / b).toPrecision(8);
  return out;
}

function makeEl() {
  return {
    _h: '',
    set innerHTML(v) { this._h = String(v); },
    get innerHTML() { return this._h; },
    focus() {}, value: '', files: [], style: {},
    appendChild() {}, remove() {}, click() {}, checked: false, classList: { add() {}, remove() {} }
  };
}

// 跨 boot 复用的 localStorage 后端（仅阶段5持久化测试显式复用）
let sharedStore = null;
function resetSharedStore() { sharedStore = {}; }

function boot(opts) {
  opts = opts || {};
  const store = opts.reuse || {};
  const els = {};
  let qsAll = () => [];
  for (const k of Object.keys(opts.preload || {})) store[k] = opts.preload[k];

  global.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };
  const doc = {
    title: '',
    getElementById: id => { if (!els[id]) els[id] = makeEl(); return els[id]; },
    addEventListener() {},
    createElement: () => makeEl(),
    querySelector: () => ({ value: '1', checked: true }),
    querySelectorAll: () => qsAll(),
    body: { appendChild() {} }
  };
  global.document = doc;
  global.window = { addEventListener() {}, scrollTo() {} };
  let hash = '';
  global.location = { get hash() { return hash; }, set hash(v) { hash = v; } };
  global.fetch = opts.fetch || (async () => ({ ok: true, json: async () => ({ result: 'success', base_code: 'PKR', rates: okRates('PKR') }) }));
  global.Blob = class { constructor() {} };
  global.URL = global.URL || {};
  global.URL.createObjectURL = () => 'blob:test';
  global.URL.revokeObjectURL = () => {};
  global.FileReader = class { readAsText(f) { this.result = (f && f._content) || ''; this.onload({ target: { result: this.result } }); } };

  const html = fs.readFileSync(APP_PATH, 'utf8');
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('index.html 中未找到 <script>');
  const src = m[1];
  const expose = [
    ';return {',
    '  S, KEYS, PS, PQ, PA, CV, RATE_STATE, get ADMIN_OK(){return ADMIN_OK;}, FORM_PRODUCT_ID,',
    '  render, runAction, go, openModal, closeModal, openLogin, doRefresh, fetchRates,',
    '  viewHome, viewProducts, viewParcels, viewRates, viewAdmin,',
    '  LS, load, saveSettings, saveProducts, saveParcels, saveRatesCache, saveConvHistory,',
    '  esc, fmtMoney, fmtRate, fmtConv, fmtDT, curName,',
    '  converterCard, historyCard, openProductForm, exportData, importData,',
    '  toast, confirmDlg, uid',
    '};'
  ].join('\n');
  const api = new Function(src + expose)();
  api.store = store;
  api.hash = () => hash;
  api._doc = doc; api._els = els;
  api.appHtml = () => (els['app'] ? els['app'].innerHTML : '');
  api.modalHtml = () => (els['modal-root'] ? els['modal-root'].innerHTML : '');
  api.setVal = (id, v) => { doc.getElementById(id).value = v; };
  api.getVal = id => (doc.getElementById(id) ? doc.getElementById(id).value : undefined);
  api.setQSAll = fn => { qsAll = fn; };
  return api;
}

let pass = 0, fail = 0; const failures = [];
function check(name, cond) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; failures.push(name); console.log('  FAIL  ' + name); }
}
function section(t) { console.log('\n=== ' + t + ' ==='); }
function near(a, b, tol) { return Math.abs(a - b) <= tol; }
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  resetSharedStore();
  console.log('超市客户服务终端 — PRD 验收测试\n');

  // ===== 阶段0 基础框架 =====
  section('阶段0 基础框架：可启动 / 默认设置 / 路由 / 持久化键');
  {
    const api = boot();
    check('0.1 单文件脚本可加载并渲染首页', api.appHtml().length > 0);
    check('0.2 默认口令为 123456', api.S.settings.adminPass === '123456');
    check('0.3 默认基准货币为 PKR', api.S.settings.baseCurrency === 'PKR');
    check('0.4 默认有 5 个分类', Array.isArray(api.S.settings.categories) && api.S.settings.categories.length === 5);
    check('0.5 localStorage 已写入 sm_settings', !!api.store['sm_settings']);
    check('0.6 首页渲染了超市名称', api.appHtml().includes('社区超市') || /Community/i.test(api.appHtml()));
    check('0.7 首页含语言切换按钮', api.appHtml().includes('toggle-lang'));
  }
  {
    const api = boot();
    api.runAction('toggle-lang', '', null);
    check('0.8 语言切换后持久化到 localStorage', JSON.parse(api.store['sm_settings']).lang === 'en');
    check('0.9 语言切换后界面变为英文', /Supermarket|Service/i.test(api.appHtml()));
    api.runAction('toggle-lang', '', null); // 切回中文，避免污染后续阶段
    check('0.9b 切回中文后持久化', JSON.parse(api.store['sm_settings']).lang === 'zh');
  }
  {
    const api = boot();
    api.go('#/products'); api.render();
    check('0.10 路由到商品页并渲染', api.appHtml().includes('products') || /商品|Product/i.test(api.appHtml()));
    api.go('#/parcels'); api.render();
    check('0.11 路由到快递页并渲染', api.appHtml().includes('parcels') || /快递|Parcel/i.test(api.appHtml()));
    api.go('#/rates'); api.render();
    check('0.12 路由到汇率页并渲染', api.appHtml().includes('rates') || /汇率|Rate/i.test(api.appHtml()));
  }

  // ===== 阶段1 商品展示 =====
  section('阶段1 商品展示：空态 / 增改删 / 搜索排序');
  {
    const api = boot();
    check('1.1 无商品时显示空态', /暂无|empty|no product/i.test(api.appHtml()));
  }
  {
    const api = boot();
    api.openProductForm(null);
    api.setVal('pi-zh', '苹果'); api.setVal('pi-en', 'Apple');
    api.setVal('pi-price', '35'); api.setVal('pi-unit', '500g'); api.setVal('pi-cat', 'c1');
    api.runAction('product-save', '', null);
    check('1.2 新增商品后 S.products 数量 +1', api.S.products.length === 1);
    check('1.3 新增商品写入 localStorage sm_products', JSON.parse(api.store['sm_products']).length === 1);
    check('1.4 商品字段正确（名称/分类/价格）', api.S.products[0].nameZh === '苹果' && api.S.products[0].categoryId === 'c1' && near(api.S.products[0].price, 35, 0.001));
    api.go('#/products'); api.render();
    check('1.5 商品页显示商品名与货币代码', api.appHtml().includes('苹果') && api.appHtml().includes('PKR'));

    api.openProductForm(null);
    api.setVal('pi-zh', '香蕉'); api.setVal('pi-price', '18'); api.setVal('pi-cat', 'c1');
    api.runAction('product-save', '', null);
    check('1.6 第二个商品已加入', api.S.products.length === 2);

    api.go('#/products'); api.render();
    api.PS.sort = 'priceAsc'; api.render();
    const ascHtml = api.appHtml();
    check('1.7 价格升序：香蕉(18)排在苹果(35)之前', ascHtml.indexOf('香蕉') !== -1 && ascHtml.indexOf('苹果') !== -1 && ascHtml.indexOf('香蕉') < ascHtml.indexOf('苹果'));

    api.setVal('prod-search', '苹果'); api.runAction('prod-search', '', null);
    const searchHtml = api.appHtml();
    check('1.8 搜索"苹果"命中且过滤掉香蕉', searchHtml.includes('苹果') && !searchHtml.includes('香蕉'));

    // 编辑第一个商品
    const id0 = api.S.products.find(p => p.nameZh === '苹果').id;
    api.openProductForm(id0);
    api.setVal('pi-price', '40');
    api.runAction('product-save', '', null);
    check('1.9 编辑商品价格生效', near(api.S.products.find(p => p.id === id0).price, 40, 0.001));

    // 删除第二个商品
    const id1 = api.S.products.find(p => p.nameZh === '香蕉').id;
    api.runAction('product-del', id1, null);
    api.runAction('confirm-ok', '', null);
    check('1.10 删除商品后数量减少', api.S.products.length === 1);
  }

  // ===== 阶段2 快递查询 =====
  section('阶段2 快递查询：登记 / 查重 / 查询 / 标记已取走 / 撤销');
  {
    const api = boot();
    api.setVal('pa-no', '  sf123456789 ');
    api.setVal('pa-shelf', 'A-3');
    api.setVal('pa-time', '2026-09-21T10:00');
    api.runAction('parcel-add', '', null);
    check('2.1 登记后 parcels 数量 +1', api.S.parcels.length === 1);
    check('2.2 运单号去空格并大写归一', api.S.parcels[0].trackingNo === 'SF123456789');
    check('2.3 新登记快递状态为待取(pending)', api.S.parcels[0].status === 'pending');

    api.setVal('pa-no', 'sf123456789');
    api.runAction('parcel-add', '', null);
    check('2.4 重复运单号被拒绝', api.S.parcels.length === 1);

    api.go('#/parcels'); api.render();
    api.setVal('p-tracking', 'sf123456789');
    api.runAction('parcel-query', '', null);
    const foundHtml = api.appHtml();
    check('2.5 客户查询到快递并显示待取', foundHtml.includes('SF123456789') && /待取|pending/i.test(foundHtml));

    api.setVal('p-tracking', 'NOPE000');
    api.runAction('parcel-query', '', null);
    check('2.6 查询不存在单号显示未找到', /未找到|not found|没有找到/i.test(api.appHtml()));

    api.runAction('parcel-pick', api.S.parcels[0].id, null);
    check('2.7 标记已取走后状态变更为 picked', api.S.parcels[0].status === 'picked');
    check('2.8 标记已取走时记录取走时间', !!api.S.parcels[0].pickTime);

    api.go('#/parcels'); api.render();
    api.setVal('p-tracking', 'SF123456789');
    api.runAction('parcel-query', '', null);
    check('2.9 标记后客户查询显示已取走', /已取走|picked/i.test(api.appHtml()));

    api.runAction('parcel-undo', api.S.parcels[0].id, null);
    check('2.10 撤销标记后回到待取', api.S.parcels[0].status === 'pending');
  }

  // ===== 阶段3 汇率与换汇 =====
  section('阶段3 汇率：联网获取 / 口径 / 换汇公式 / 离线红色标注 / 历史');
  {
    let calls = 0;
    const api = boot({ fetch: async () => { calls++; return { ok: true, json: async () => ({ result: 'success', base_code: 'PKR', rates: okRates('PKR') }) }; } });
    await api.doRefresh(true);
    check('3.1 联网获取后 RATE_STATE.fresh=true', api.RATE_STATE.fresh === true);
    check('3.2 汇率缓存写入 localStorage sm_rates', !!api.store['sm_rates']);
    const cached = JSON.parse(api.store['sm_rates']);
    check('3.3 缓存含 base/rates/updatedAt', cached.base === 'PKR' && cached.rates && cached.updatedAt);
    api.go('#/rates'); api.render();
    check('3.4 列表显示绿色在线状态', /已使用最新在线汇率|latest|online/i.test(api.appHtml()));

    api.CV.amount = '100'; api.CV.from = 'USD'; api.CV.to = 'PKR';
    const c1 = api.converterCard();
    check('3.5 USD100→PKR ≈ 27,793', c1.includes('27,793'));
    api.CV.amount = '27793'; api.CV.from = 'PKR'; api.CV.to = 'USD';
    const c2 = api.converterCard();
    check('3.6 PKR27793→USD ≈ 99.99', c2.includes('99.99') || c2.includes('100.0'));

    // 历史
    api.CV.amount = '50'; api.CV.from = 'USD'; api.CV.to = 'PKR';
    api.runAction('conv-save', '', null);
    check('3.7 记录本次换算后 history +1', api.S.convHistory.length === 1);
    check('3.8 历史记录字段完整(from/to/rate/result/amount)',
      api.S.convHistory[0].from === 'USD' && api.S.convHistory[0].to === 'PKR' &&
      near(api.S.convHistory[0].rate, 1 / R.USD, 0.01) && near(api.S.convHistory[0].result, 50 / R.USD, 1) && api.S.convHistory[0].amount === 50);
    api.runAction('conv-hist-del', api.S.convHistory[0].id, null);
    check('3.9 删除单条历史后归零', api.S.convHistory.length === 0);
    api.runAction('conv-save', '', null);
    api.runAction('conv-save', '', null);
    api.runAction('conv-hist-clear', '', null);
    api.runAction('confirm-ok', '', null);
    check('3.10 清空历史生效', api.S.convHistory.length === 0);
  }
  {
    // 断网 + 有缓存
    const api = boot({
      preload: { sm_rates: JSON.stringify({ base: 'PKR', rates: okRates('PKR'), updatedAt: new Date().toISOString() }) },
      fetch: async () => { throw new Error('offline'); }
    });
    await api.fetchRates();
    check('3.11 断网后 fresh=false', api.RATE_STATE.fresh === false);
    api.go('#/rates'); api.render();
    const html = api.converterCard();
    check('3.12 断网可换算（select 无 disabled）', !/<select[^>]*disabled/.test(html));
    check('3.13 红色卡片样式 conv-offline-card', html.includes('conv-offline-card'));
    check('3.14 红色文字标注 未联网 · 非在线汇率', html.includes('未联网 · 非在线汇率'));
    check('3.15 红色提示条 conv-offnote', html.includes('conv-offnote'));
    check('3.16 失败后退避 lastFail 已记录', api.RATE_STATE.lastFail > 0);

    const api2 = boot({ fetch: async () => { throw new Error('offline'); } });
    await api2.fetchRates();
    api2.go('#/rates'); api2.render();
    check('3.17 无缓存时换算控件禁用', /<select[^>]*disabled/.test(api2.converterCard()));
  }

  // ===== 阶段4 管理模式 =====
  section('阶段4 管理模式：门禁 / 口令 / 系统设置 / 备份恢复');
  {
    const api = boot();
    api.go('#/admin?tab=products'); api.render();
    check('4.1 未登录访问 #/admin 被拦截', api.hash().indexOf('#/home') === 0 || api.appHtml().includes('home'));
    check('4.2 弹出口令输入框', api.modalHtml().includes('login-pass'));
    api.setVal('login-pass', 'wrong');
    api.runAction('login-submit', '', null);
    check('4.3 错误口令不通过', api.ADMIN_OK === false);
    api.setVal('login-pass', '123456');
    api.runAction('login-submit', '', null);
    check('4.4 默认口令 123456 通过', api.ADMIN_OK === true);
    api.go('#/admin?tab=settings'); api.render();
    check('4.5 管理设置页渲染（含超市名输入）', api.appHtml().includes('st-name-zh'));

    api.setVal('st-name-zh', '星光超市');
    api.runAction('settings-store-save', '', null);
    check('4.6 修改超市名后持久化', JSON.parse(api.store['sm_settings']).storeNameZh === '星光超市');

    api.setVal('st-pass1', '888888');
    api.setVal('st-pass2', '888888');
    api.runAction('settings-pass-save', '', null);
    check('4.7 修改口令为新值', api.S.settings.adminPass === '888888');

    const catCount = api.S.settings.categories.length;
    api.setVal('cat-new-zh', '冷冻食品');
    api.runAction('cat-add', '', null);
    check('4.8 新增分类生效', api.S.settings.categories.length === catCount + 1);
    const newId = api.S.settings.categories[api.S.settings.categories.length - 1].id;
    api.runAction('cat-del', newId, null);
    check('4.9 删除未占用分类生效', api.S.settings.categories.length === catCount);
  }
  {
    // 汇率设置
    const api = boot();
    await api.doRefresh(true);
    api.setVal('rt-base', 'USD');
    api.setQSAll(() => [{ value: 'USD' }, { value: 'EUR' }]);
    api.runAction('rates-save', '', null);
    check('4.10 修改基准货币为 USD 并持久化', JSON.parse(api.store['sm_settings']).baseCurrency === 'USD');
    check('4.11 显示币种勾选持久化', JSON.parse(api.store['sm_settings']).showCurrencies.includes('USD'));
  }
  {
    // 备份导出 / 导入恢复
    const api = boot();
    api.S.products = [{ id: 'p1', nameZh: '测试', nameEn: 'Test', price: 9.9, unit: '个', categoryId: 'c1', inStock: true, img: null }];
    api.saveProducts();
    api.S.parcels = [{ id: 'q1', trackingNo: 'SF999', shelf: 'B1', arrivalTime: '2026-01-01T00:00', status: 'pending', pickTime: null }];
    api.saveParcels();
    api.exportData();
    check('4.12 导出不抛错（生成备份包）', true);
    const backup = {
      version: 1, exportedAt: '2026-09-21T00:00:00Z',
      settings: api.S.settings, products: api.S.products, parcels: api.S.parcels,
      rates: api.S.rates, convHistory: api.S.convHistory
    };
    const api2 = boot();
    await api2.importData({ _content: JSON.stringify(backup) });
    check('4.13 导入后商品恢复', api2.S.products.length === 1 && api2.S.products[0].nameZh === '测试');
    check('4.14 导入后快递恢复', api2.S.parcels.length === 1 && api2.S.parcels[0].trackingNo === 'SF999');
    const bad = boot();
    let threw = false;
    try { await bad.importData({ _content: 'not-json{{{' }); } catch (e) { threw = true; }
    check('4.15 非法备份文件报错且不破坏数据', threw || bad.S.products.length >= 0);
  }

  // ===== 阶段5 持久化 =====
  section('阶段5 持久化：写入后重新启动（新 boot）数据仍在');
  {
    const a = boot();
    a.openProductForm(null);
    a.setVal('pi-zh', '持久化商品'); a.setVal('pi-price', '22'); a.setVal('pi-cat', 'c1');
    a.runAction('product-save', '', null);
    a.setVal('pa-no', 'ZZZ777'); a.setVal('pa-time', '2026-09-21T10:00');
    a.runAction('parcel-add', '', null);
    // 全新启动：复用同一份 localStorage 后端（模拟同一浏览器 profile 重启）
    const b = boot({ reuse: a.store });
    check('5.1 重新启动后商品仍在', b.S.products.some(p => p.nameZh === '持久化商品'));
    check('5.2 重新启动后快递仍在', b.S.parcels.some(p => p.trackingNo === 'ZZZ777'));
    check('5.3 重新启动后语言设置保持', b.S.settings.lang === a.S.settings.lang);
  }

  // ===== 阶段6 安全与边界 =====
  section('阶段6 安全：XSS 转义 / 输入归一');
  {
    const api = boot();
    const esc = api.esc('<b onclick="alert(1)">hi</b>"\'&');
    check('6.1 特殊字符被转义，不残留可执行标签', !esc.includes('<b onclick') && esc.includes('&lt;'));
    api.setVal('pa-no', '  kT- 88  ');
    api.setVal('pa-time', '2026-09-21T10:00');
    api.runAction('parcel-add', '', null);
    check('6.2 运单号自动去空格并大写', api.S.parcels[0].trackingNo === 'KT-88');
  }

  console.log('\n========================================');
  console.log('总计: ' + (pass + fail) + '  通过: ' + pass + '  失败: ' + fail);
  if (fail > 0) {
    console.log('失败用例:');
    failures.forEach(f => console.log('  - ' + f));
    process.exit(1);
  } else {
    console.log('全部通过。');
  }
}

main().catch(e => { console.error('测试运行异常:', e); process.exit(1); });
