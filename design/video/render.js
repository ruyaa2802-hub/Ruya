const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const root=__dirname;const types={'.js':'text/javascript','.json':'application/json','.html':'text/html'};
const srv=http.createServer((q,s)=>{const f=path.join(root,decodeURI(q.url.split('?')[0]));fs.readFile(f,(e,d)=>{if(e){s.writeHead(404);s.end();return;}s.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'});s.end(d);});}).listen(8766);
(async()=>{
 const mode=process.argv[2], out=process.argv[3]; fs.mkdirSync(out,{recursive:true});
 const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:720,height:1280}});
 p.on('pageerror',e=>console.log('ERR',e.message)); p.on('console',m=>{if(m.type()==='error')console.log('console',m.text())});
 await p.goto('http://localhost:8766/index.html');
 await p.waitForFunction('window.READY||window.ERR',null,{timeout:600000});
 const err=await p.evaluate('window.ERR'); if(err){console.log('PAGE ERR',err);process.exit(1);}
 let times; if(mode==='all'){const a=+process.argv[4]||0,z=+process.argv[5]||720;times=[];for(let i=a;i<z;i++)times.push([i,i/30]);} else times=mode.split(',').map((t,i)=>[i,+t]);
 const t0=Date.now();
 for(const [i,t] of times){const d=await p.evaluate(t=>window.frame(t),t); fs.writeFileSync(path.join(out,String(i).padStart(4,'0')+'.jpg'),Buffer.from(d.split(',')[1],'base64')); if(i%24===0)console.log('frame',i,((Date.now()-t0)/1000).toFixed(0)+'s');}
 await b.close();srv.close();})();
