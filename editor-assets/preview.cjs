// Aperçu local du dépôt, identique à ce que sert Vercel.
//   node editor-assets/preview.cjs   puis http://127.0.0.1:8766
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.md':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8','.png':'image/png'};
http.createServer((req,res)=>{let url;
 try{url=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
 if(url==='/')url='/index.html';
 const file=path.join(root,url);
 if(path.relative(root,file).startsWith('..')){res.writeHead(404).end();return;}
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);});
}).listen(8766,'127.0.0.1',()=>console.log('Atelier 3D : http://127.0.0.1:8766'));
