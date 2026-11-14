const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const root=__dirname;const srv=http.createServer((q,s)=>{const f=path.join(root,decodeURI(q.url.split('?')[0]));fs.readFile(f,(e,d)=>{if(e){s.writeHead(404);s.end();return;}s.writeHead(200,{'Content-Type':f.endsWith('.js')?'text/javascript':'text/html'});s.end(d);});}).listen(8765);
(async()=>{const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1920,height:1080}});
p.on('console',m=>console.log('console:',m.text()));p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('http://localhost:8765/'+process.argv[2]);await p.waitForFunction('window.DONE',null,{timeout:240000});
await p.screenshot({path:process.argv[3]});await b.close();srv.close();})();
