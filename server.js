// 静态服务器 + 共享数据接口：所有访问者共用一份数据（存在服务器 data.json）
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const PORT = process.env.PORT || 8080;
const DATA_FILE = path.join(ROOT, 'data.json');
const MIME = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json', '.svg':'image/svg+xml',
  '.webmanifest':'application/manifest+json', '.png':'image/png', '.ico':'image/x-icon'
};
function readState(){
  try{ return JSON.parse(fs.readFileSync(DATA_FILE,'utf8')); }
  catch(e){ return {}; }
}
function writeState(obj){
  fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2), 'utf8');
}
http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);

  // 共享数据接口
  if(urlPath === '/api/state'){
    if(req.method === 'GET'){
      res.writeHead(200, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
      res.end(JSON.stringify(readState()));
      return;
    }
    if(req.method === 'POST'){
      let body='';
      req.on('data', c => { body += c; if(body.length>5e6) req.destroy(); });
      req.on('end', () => {
        try{
          const obj = JSON.parse(body);
          writeState(obj);
          res.writeHead(200, {'Content-Type':'application/json'});
          res.end('{"ok":true}');
        }catch(e){
          res.writeHead(400); res.end('{"ok":false}');
        }
      });
      return;
    }
  }

  let p = urlPath;
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, path.normalize(p).replace(/^(\.\.[\/\\])+/, ''));
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('404'); return; }
    res.writeHead(200, {'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream'});
    res.end(data);
  });
}).listen(PORT, '0.0.0.0', () => console.log('Serving on http://0.0.0.0:' + PORT));
