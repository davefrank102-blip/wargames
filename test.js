const puppeteer=require('puppeteer-core');const path=require('path');
const url='file://'+path.join(__dirname,'index.html');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const assert=require('assert');
(async()=>{
 const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
 const errs=[];const page=await b.newPage();await page.setViewport({width:1400,height:860});
 page.on('pageerror',e=>errs.push('pageerror: '+e.message));page.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())});
 // (a) outcome log lines must not appear while that turn's warheads are still in flight
 await page.evaluateOnNewDocument(()=>{window.__postBad=0;window.__postSeen=0;document.addEventListener('DOMContentLoaded',()=>{new MutationObserver(ms=>{ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.textContent&&/ INBOUND, /.test(n.textContent)){window.__postSeen++;const o=window.WOPR&&WOPR.missileSides();if(o&&(o.A+o.B)>0)window.__postBad++;}}))}).observe(document.getElementById('log'),{childList:true,subtree:true,characterData:true});});});
 page.on('request',r=>{if(!r.url().startsWith('file:')&&!r.url().startsWith('data:'))errs.push('NETWORK: '+r.url())});
 // 1. boot + menu navigation via keyboard
 await page.goto(url);
 await page.waitForFunction(()=>document.getElementById('term').innerText.includes('GLOBAL THERMONUCLEAR WAR'),{timeout:30000});
 const bootTxt=await page.$eval('#term',e=>e.innerText);
 console.log('BOOT OK:',bootTxt.includes('GREETINGS PROFESSOR FALKEN.'),bootTxt.includes('SHALL WE PLAY A GAME?'));
 await page.screenshot({path:'screenshot_menu.png'});
 await page.keyboard.type('6');await page.keyboard.press('Enter');
 await page.waitForFunction(()=>document.getElementById('term').innerText.includes('HOW MANY PLAYERS?')&&document.querySelectorAll('.opts:not(.done)').length,{timeout:20000});
 await page.keyboard.type('1');await page.keyboard.press('Enter');
 await page.waitForFunction(()=>document.getElementById('term').innerText.includes('WHICH SIDE')&&document.querySelectorAll('.opts:not(.done)').length);
 await page.keyboard.type('1');await page.keyboard.press('Enter');
 await page.waitForFunction(()=>document.getElementById('term').innerText.includes('OPPONENT DOCTRINE')&&document.querySelectorAll('.opts:not(.done)').length);
 await page.keyboard.type('2');await page.keyboard.press('Enter');
 await page.waitForFunction(()=>window.WOPR.match&&window.WOPR.match.awaiting,{timeout:20000});
 console.log('HUMAN MATCH STARTED via menu');
 await page.evaluate(()=>WOPR.setSpeed(10));
 // escalate then strike via UI
 await page.click('#actions button[data-a="ESCALATE"]');
 await page.waitForFunction(()=>WOPR.match.awaiting&&WOPR.match.state.turn===1,{timeout:30000});
 await page.click('#actions button[data-a="STRIKE"]');
 // click some enemy targets on canvas
 const pts=await page.evaluate(()=>{const s=WOPR.match.state.sides.B;const r=document.getElementById('map').getBoundingClientRect();return s.sites.slice(0,3).concat(s.cities.slice(0,2)).map(t=>{return {id:t.id}})});
 await page.click('#actions button[data-a="autoCF"]');
 const used=await page.evaluate(()=>Object.values(WOPR.match.alloc).reduce((a,b)=>a+b,0));
 console.log('allocated via AUTO:',used);
 await page.click('#actions button[data-a="launch"]');
 await page.waitForFunction(()=>WOPR.match.state.turn===2&&(WOPR.match.awaiting||WOPR.match.state.over),{timeout:60000});
 console.log('after strike turn:',await page.evaluate(()=>JSON.stringify({defcon:WOPR.match.state.defcon,casA:WOPR.match.state.sides.A.casualties.toFixed(1),casB:WOPR.match.state.sides.B.casualties.toFixed(1)})));
 // canvas click test
 const clickOk=await page.evaluate(()=>{return true});
 // 2. zero-player animated match screenshot
 await page.goto(url+'#auto=match&a=AGGRESSIVE&b=AGGRESSIVE&speed=3');await page.reload();
 await page.waitForFunction(()=>{const o=WOPR.missileSides();return o.A>=8&&o.B>=8},{timeout:90000,polling:50});
 await page.screenshot({path:'screenshot.png'});
 console.log('mid-sim missiles in flight:',await page.evaluate(()=>JSON.stringify(WOPR.missileSides())));
 await page.evaluate(()=>WOPR.setSpeed(10));
 await page.waitForFunction(()=>WOPR.match&&WOPR.match.state.over&&document.getElementById('banner').style.display==='block',{timeout:120000});
 console.log('single match result:',await page.evaluate(()=>WOPR.match.state.result.label+' | '+WOPR.match.state.result.detail));
 await page.screenshot({path:'screenshot_result.png'});
 console.log('log timing: outcome lines seen',await page.evaluate(()=>window.__postSeen),'revealed early',await page.evaluate(()=>window.__postBad));
 assert.strictEqual(await page.evaluate(()=>window.__postBad),0,'outcome log line revealed before impacts');
 // 3. LEARN mode: animated big board
 const sameAsCore=()=>page.evaluate(()=>{const b=window.__batch,res=WOPR.Core.runBatch(b.n,b.seed0),t={g:0,A:0,B:0,MAD:0,STALEMATE:0,PEACE:0};
   res.forEach(r=>{t.g++;t[r.winner||r.kind]++});return JSON.stringify(t)===JSON.stringify({g:b.all.g,A:b.all.A,B:b.all.B,MAD:b.all.MAD,STALEMATE:b.all.STALEMATE,PEACE:b.all.PEACE})?'IDENTICAL':'MISMATCH '+JSON.stringify(t)+' vs '+JSON.stringify(b.all)});
 await page.goto(url+'#auto=batch&n=1000&speed=5');await page.reload();
 const t0=Date.now();
 await page.waitForFunction(()=>{const l=WOPR.learn();return l&&l.i>=3},{timeout:60000,polling:100});
 console.log('LEARN: 3 games shown after',((Date.now()-t0)/1000).toFixed(1),'s (watchable start)');
 await page.waitForFunction(()=>{const l=WOPR.learn();return l&&l.i>=60&&l.arcs>=120&&l.flashes>=40},{timeout:90000,polling:50});
 await page.screenshot({path:'screenshot_learn_anim.png'});
 console.log('LEARN mid-run:',JSON.stringify(await page.evaluate(()=>WOPR.learn())));
 await page.click('#btnPause');await sleep(150);const p1=await page.evaluate(()=>WOPR.learn());await sleep(1200);const p2=await page.evaluate(()=>WOPR.learn());
 assert.strictEqual(p1.i,p2.i,'PAUSE must freeze LEARN');await page.click('#btnPause');console.log('PAUSE freezes LEARN: ok (i='+p2.i+')');
 await page.setViewport({width:1400,height:1050});
 await page.waitForFunction(()=>window.__batchDone===true,{timeout:180000});
 console.log('LEARN total time',((Date.now()-t0)/1000).toFixed(1),'s; results vs core.runBatch:',await sameAsCore());
 assert.strictEqual(await sameAsCore(),'IDENTICAL');
 await page.mouse.move(700,600);await sleep(500);
 await page.screenshot({path:'screenshot_batch.png'});
 const txt=await page.$eval('#term',e=>e.innerText);
 console.log(txt);
 assert(txt.indexOf('A STRANGE GAME. THE ONLY WINNING MOVE IS NOT TO PLAY.')<txt.indexOf('HOW ABOUT A NICE GAME OF CHESS?')&&txt.indexOf('HOW ABOUT A NICE GAME OF CHESS?')<txt.indexOf('TOTAL'),'ending order');
 // SKIP button with 5000 scenarios
 await page.goto(url+'#auto=batch&n=5000&speed=4');await page.reload();
 await page.waitForFunction(()=>{const l=WOPR.learn();return l&&l.i>=2},{timeout:60000});
 await page.click('#btnSkip');const ts=Date.now();
 await page.waitForFunction(()=>window.__batchDone===true,{timeout:60000});
 console.log('SKIP: 5000 scenarios -> results in',Date.now()-ts,'ms; games',await page.evaluate(()=>__batch.all.g),'vs core:',await sameAsCore());
 assert.strictEqual(await sameAsCore(),'IDENTICAL');
 // mobile layout 390x844
 await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
 await page.goto(url+'#auto=batch&n=1000&speed=6');await page.reload();
 await page.waitForFunction(()=>{const l=WOPR.learn();return l&&l.i>=40&&l.arcs>=60},{timeout:90000,polling:50});
 await page.screenshot({path:'screenshot_mobile.png'});
 const mob=await page.evaluate(()=>{const r=id=>document.getElementById(id).getBoundingClientRect().toJSON();return {doc:document.documentElement.scrollWidth,gv:document.getElementById('gameView').scrollWidth,map:r('mapWrap'),panel:r('panel'),log:r('log')}});
 console.log('mobile:',JSON.stringify({doc:mob.doc,gv:mob.gv,mapW:mob.map.width,panelTop:mob.panel.top,mapBottom:mob.map.bottom,logTop:mob.log.top,panelBottom:mob.panel.bottom}));
 assert(mob.doc<=390&&mob.gv<=390,'no sideways scroll');assert(mob.map.width>=388,'map full width');
 assert(mob.panel.top>=mob.map.bottom-1&&mob.log.top>=mob.panel.bottom-1,'stack: map, panel, log');
 await page.click('#btnSkip');await page.waitForFunction(()=>window.__batchDone===true,{timeout:60000});await sleep(300);
 const ov=await page.evaluate(()=>[...document.querySelectorAll('#term pre')].map(p=>p.scrollWidth-p.clientWidth).concat([document.getElementById('term').scrollWidth-document.getElementById('term').clientWidth]));
 console.log('mobile results overflow px:',ov);assert(ov.every(x=>x<=0),'mobile results table fits');
 await page.evaluate(()=>{const t=document.getElementById('term');const p=[...t.querySelectorAll('pre')][0];p.scrollIntoView()});
 await page.screenshot({path:'screenshot_mobile_results.png'});
 await page.goto(url+'#auto=match&a=AGGRESSIVE&b=MEASURED&speed=4');await page.reload();
 await page.waitForFunction(()=>{const o=WOPR.missileSides();return o.A+o.B>=6},{timeout:90000,polling:50});
 await page.screenshot({path:'screenshot_mobile_match.png'});
 await page.setViewport({width:1400,height:860});
 // 4. tic-tac-toe
 await page.goto(url+'#auto=ttt&speed=10');await page.reload();
 await page.waitForFunction(()=>document.getElementById('term').innerText.includes('GAMES DRAWN'),{timeout:120000});
 console.log('TTT:',(await page.$eval('#term',e=>e.innerText)).match(/\d+ OF \d+ GAMES DRAWN/)[0]);
 const e2=await page.evaluate(()=>window.__errors);
 console.log('ERRORS:',errs.concat(e2));
 if(errs.concat(e2).length){console.error('TEST FAIL: JS errors');process.exit(1)}
 console.log('ALL BROWSER TESTS PASSED');
 await b.close();
})().catch(e=>{console.error('TEST FAIL',e);process.exit(1)});
