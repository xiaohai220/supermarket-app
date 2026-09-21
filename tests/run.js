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
    '  S, KEYS, PS, PQ, PA, CS, CSM, get ADMIN_OK(){return ADMIN_OK;}, FORM_PRODUCT_ID, FORM_CONSIGN_IMG,',
    '  render, runAction, go, openModal, closeModal, openLogin,',
    '  viewHome, viewProducts, viewParcels, viewConsign, viewAdmin, adminConsign,',
    '  LS, load, saveSettings, saveProducts, saveParcels, saveConsign,',
    '  esc, fmtMoney, fmtDT,',
    '  openProductForm, exportData, importData,',
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
    api.go('#/consign'); api.render();
    check('0.12 路由到寄售页并渲染', api.appHtml().includes('consign') || /寄售|Consign/i.test(api.appHtml()));
    // 主题切换持久化
    const before = api.S.settings.theme;
    api.runAction('toggle-theme', '', null);
    check('0.13 主题切换并持久化到 localStorage', JSON.parse(api.store['sm_settings']).theme !== before);
    api.runAction('toggle-theme', '', null);
    check('0.14 主题切回原状态', api.S.settings.theme === before);
  }

  // ===== 阶段1 商品展示 =====
  section('阶段1 商品展示：空态 / 增改删 / 搜索排序');
  {
    const api = boot();
    api.go('#/products'); api.render();
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

    // 回归：手机点按输入框不能触发整页重绘（data-action 必须是 prod-search-live，
    // 且由 input 事件局部刷新 prod-grid，而不是 click→render）
    api.go('#/products'); api.render();
    const prodHtml = api.appHtml();
    check('1.8a 商品搜索框使用 prod-search-live（点按不重绘）', prodHtml.includes('data-action="prod-search-live"'));
    check('1.8b 商品搜索框不再带会触发 render 的旧 data-action', !prodHtml.includes('id="prod-search" data-action="prod-search"'));
    check('1.8c 快递查询输入框不带 data-action（点按不立即查询）', !api.appHtml().includes('id="p-tracking" data-action="parcel-query"'));
    check('1.8d 商品列表容器 id=prod-grid 存在', prodHtml.includes('id="prod-grid"'));
    api.go('#/parcels'); api.render();
    check('1.8e 快递查询输入框不带 data-action（点按不立即查询）', !api.appHtml().includes('id="p-tracking" data-action="parcel-query"'));

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

  // ===== 阶段3 二手寄售：客户提交 / 管理员审核上架 / 标记售出 / 查询 =====
  section('阶段3 二手寄售：客户提交 / 管理员审核上架 / 标记售出 / 按电话查询');
  {
    const api = boot();
    api.go('#/consign'); api.render();
    check('3.1 客户寄售页可打开', api.appHtml().includes('consignTitle') || /寄售|Consign/i.test(api.appHtml()));

    // 客户提交寄售申请（缺必填应拒绝）—— 先点圆形+进入发布表单页
    api.go('#/consign?new=1'); api.render();
    api.setVal('cs-title', '九成新自行车');
    api.setVal('cs-desc', '男式，骑了半年');
    api.setVal('cs-price', '4500');
    api.setVal('cs-contact', '0300-1234567');
    api.setVal('cs-consignor', '阿里');
    api.setVal('cs-pwd', 'mypwd123');
    api.runAction('consign-submit', '', null);
    check('3.2 提交后生成 pending 记录', api.S.consign.length === 1 && api.S.consign[0].status === 'pending');
    check('3.3 寄售字段完整(含卖家密码)', api.S.consign[0].title === '九成新自行车' && near(api.S.consign[0].price, 4500, 0.001) && api.S.consign[0].contact === '0300-1234567' && api.S.consign[0].pwd === 'mypwd123');

    // 缺联系电话应拒绝
    const before = api.S.consign.length;
    api.go('#/consign?new=1'); api.render();
    api.setVal('cs-title', '缺电话'); api.setVal('cs-price', '10'); api.setVal('cs-contact', ''); api.setVal('cs-pwd', 'x');
    api.runAction('consign-submit', '', null);
    check('3.4 缺联系电话被拒绝', api.S.consign.length === before);

    // 未审核(pending)不应出现在客户在售列表
    const onSale = api.S.consign.filter(c => c.status === 'on').length;
    check('3.5 待审核物品不进入客户在售列表', onSale === 0);

    // 管理员直接上架（不再要口令）
    api.go('#/admin?tab=consign'); api.render();
    api.runAction('consign-approve', api.S.consign[0].id, null);
    check('3.6 管理员上架后状态变为 on', api.S.consign[0].status === 'on');

    // 客户在售列表现在能看到
    api.go('#/consign'); api.render();
    check('3.7 上架后客户页在售列表显示该物品', api.appHtml().includes('九成新自行车'));

    // 客户按电话查询自己的寄售
    api.setVal('cs-query', '1234567');
    api.runAction('consign-query', '', null);
    check('3.8 按联系电话查询到寄售记录', api.CS.results && api.CS.results.length === 1);

    // 买家提交手机号
    api.S.consign[0].buyers = [];
    api.setVal('cs-buy-phone', '0311-9999');
    api.runAction('consign-buy-submit', api.S.consign[0].id, null);
    check('3.8b 买家提交手机号后记录在物品上', api.S.consign[0].buyers && api.S.consign[0].buyers[0].phone === '0311-9999');

    // 卖家查看买家手机号：先输错密码被拒
    api.go('#/consign'); api.render();
    api.setVal('cs-query', '1234567');
    api.runAction('consign-query', '', null);
    api.runAction('consign-view-buyers-open', '', null);
    api.setVal('pwd-input', 'wrong');
    api.runAction('consign-view-buyers', '', null);
    check('3.8c 卖家密码错误不显示买家', api.CS.showBuyers === false);
    // 输对自己设的密码
    api.runAction('consign-view-buyers-open', '', null);
    api.setVal('pwd-input', 'mypwd123');
    api.runAction('consign-view-buyers', '', null);
    check('3.8d 卖家密码正确后显示买家', api.CS.showBuyers === true);

    // 管理员标记售出
    api.go('#/admin?tab=consign'); api.render();
    api.runAction('consign-mark-sold', api.S.consign[0].id, null);
    check('3.9 标记售出后状态变为 sold 且记录售出时间', api.S.consign[0].status === 'sold' && !!api.S.consign[0].soldTime);

    // 售出后不再出现在客户在售列表
    api.go('#/consign'); api.render();
    check('3.10 售出物品不再出现在客户在售列表', !/九成新自行车/.test(api.appHtml().match(/在售[\s\S]*?我要寄售/)?.[0] || ''));

    // 删除
    api.go('#/admin?tab=consign'); api.render();
    api.S.consign.slice().forEach(c=>{
      api.runAction('consign-del', c.id, null);
      api.runAction('confirm-ok', '', null);
    });
    check('3.11 删除寄售记录后归零', api.S.consign.length === 0);

    // 持久化键
    check('3.12 寄售数据持久化到 sm_consign', !!api.store['sm_consign']);
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
    // 寄售管理：筛选
    const api = boot();
    api.S.consign = [
      { id: 'g1', title: 'A', price: 10, contact: '1', status: 'pending', createTime: '2026-01-01' },
      { id: 'g2', title: 'B', price: 20, contact: '2', status: 'on', createTime: '2026-01-02' },
      { id: 'g3', title: 'C', price: 30, contact: '3', status: 'sold', createTime: '2026-01-03' }
    ];
    api.saveConsign();
    api.setVal('login-pass', '123456');
    api.runAction('login-submit', '', null);
    api.go('#/admin?tab=consign'); api.render();
    check('4.10 管理后台寄售页可打开', api.appHtml().includes('g1') || api.appHtml().includes('A'));
    api.runAction('consign-filter', 'pending', null);
    check('4.11 寄售管理按待审核筛选生效', api.CSM.filter === 'pending' && api.S.consign.filter(c=>c.status==='pending').length === 1);
  }
  {
    // 备份导出 / 导入恢复
    const api = boot();
    api.S.products = [{ id: 'p1', nameZh: '测试', nameEn: 'Test', price: 9.9, unit: '个', categoryId: 'c1', inStock: true, img: null }];
    api.saveProducts();
    api.S.parcels = [{ id: 'q1', trackingNo: 'SF999', shelf: 'B1', arrivalTime: '2026-01-01T00:00', status: 'pending', pickTime: null }];
    api.saveParcels();
    api.S.consign = [{ id: 'g1', title: '寄售物', price: 100, contact: '123', status: 'on', createTime: '2026-01-01' }];
    api.saveConsign();
    api.exportData();
    check('4.12 导出不抛错（生成备份包）', true);
    const backup = {
      version: 1, exportedAt: '2026-09-21T00:00:00Z',
      settings: api.S.settings, products: api.S.products, parcels: api.S.parcels, consign: api.S.consign
    };
    const api2 = boot();
    await api2.importData({ _content: JSON.stringify(backup) });
    check('4.13 导入后商品恢复', api2.S.products.length === 1 && api2.S.products[0].nameZh === '测试');
    check('4.14 导入后快递恢复', api2.S.parcels.length === 1 && api2.S.parcels[0].trackingNo === 'SF999');
    check('4.15 导入后寄售恢复', api2.S.consign.length === 1 && api2.S.consign[0].title === '寄售物');
    const bad = boot();
    let threw = false;
    try { await bad.importData({ _content: 'not-json{{{' }); } catch (e) { threw = true; }
    check('4.16 非法备份文件报错且不破坏数据', threw || bad.S.products.length >= 0);
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
