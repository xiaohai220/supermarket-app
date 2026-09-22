// 多用户并发模拟测试：https://xxhrcs.com
// 模拟多名客人同时进入网站，各自拉取数据 -> 本地改动 -> 提交，
// 然后检查是否出现"回档/丢数据"和接口错误。
const BASE = 'https://xxhrcs.com';

async function getState(){
  const r = await fetch(BASE+'/api/state', {cache:'no-store'});
  if(!r.ok) throw new Error('GET '+r.status);
  return r.json();
}
async function postState(s){
  const r = await fetch(BASE+'/api/state', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(s)});
  if(!r.ok) throw new Error('POST '+r.status);
  return r.json();
}

const sleep = ms => new Promise(r=>setTimeout(r,ms));

async function run(){
  console.log('== 并发测试开始 ==');
  const baseline = await getState();
  const baseProductCount = (baseline.products||[]).length;
  console.log('基线商品数:', baseProductCount);

  const USERS = 5;          // 5 名客人
  const OPS_PER_USER = 6;   // 每人 6 次操作
  const errors = [];
  const results = [];

  async function visitor(id){
    try{
      for(let i=0;i<OPS_PER_USER;i++){
        const s = await getState();                 // 拉最新
        // 本地模拟操作：每人给商品列表追加一条带唯一标记的"浏览占位"
        // （真实业务里客人的写操作主要是申请取件/购买意向，这里用唯一 id 标记以校验不丢）
        s.products = s.products||[];
        s.parcels  = s.parcels||[];
        s.products.push({
          id:'test-u'+id+'-'+i, nameZh:'压测商品'+id+'-'+i, nameEn:'',
          categoryId:(s.settings.categories[0]||{}).id||'c1',
          price:0, unit:'个', inStock:true, img:'', desc:'并发压测'
        });
        await sleep(Math.floor(Math.random()*120)); // 模拟人操作间隔
        await postState(s);                          // 提交
        results.push({user:id, op:i, ok:true});
        await sleep(Math.floor(Math.random()*80));
      }
    }catch(e){ errors.push({user:id, msg:e.message}); }
  }

  await Promise.all(Array.from({length:USERS},(_,i)=>visitor(i+1)));

  await sleep(800);
  const final = await getState();
  const testItems = (final.products||[]).filter(p=>String(p.id).startsWith('test-u'));
  const expected = USERS*OPS_PER_USER;

  console.log('--- 结果 ---');
  console.log('提交成功操作:', results.length, '/', USERS*OPS_PER_USER);
  console.log('接口错误:', errors.length, errors.slice(0,5));
  console.log('压测商品最终存在:', testItems.length, '/ 预期', expected);
  const lost = expected - testItems.length;
  console.log('丢失(被覆盖)条数:', lost);

  // 读压力测试：20 次并发 GET，全部应成功
  console.log('--- 读压力：20 并发 GET ---');
  const reads = await Promise.all(Array.from({length:20}, async(_,i)=>{
    try{ const s=await getState(); return s.products.length; }catch(e){ return -1; }
  }));
  const readFail = reads.filter(x=>x<0).length;
  console.log('GET 失败:', readFail, '/20');

  const pass = (errors.length===0) && (readFail===0) && (lost===0);
  console.log('判定:', pass ? 'PASS' : 'FAIL');
  console.log('lost='+lost+' errors='+errors.length+' readFail='+readFail);
}
run().catch(e=>{console.error('FATAL',e); process.exit(1);});
