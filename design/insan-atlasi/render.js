const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
(async()=>{
 const mode=process.argv[2], out=process.argv[3]; fs.mkdirSync(out,{recursive:true});
 const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1920}});
 p.on('pageerror',e=>console.log('ERR',e.message));
 await p.goto('file://'+path.join(__dirname,'index.html'));
 await p.waitForFunction('window.READY',null,{timeout:60000});
 let times; if(mode==='all'){const a=+process.argv[4],z=+process.argv[5];times=[];for(let i=a;i<z;i++)times.push([i,i/30]);} else times=mode.split(',').map((t,i)=>[i,+t]);
 const t0=Date.now();
 for(const [i,t] of times){await p.evaluate(([t,i])=>window.draw(t,i),[t,i]); await p.screenshot({path:path.join(out,String(i).padStart(4,'0')+'.jpg'),type:'jpeg',quality:92}); if(i%150===0)console.log('frame',i,((Date.now()-t0)/1000).toFixed(0)+'s');}
 const e=await p.evaluate('window.ERR'); if(e)console.log('PAGE ERR',e);
 await b.close();})();
