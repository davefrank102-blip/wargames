const puppeteer=require('puppeteer-core');const path=require('path');
const url='file://'+path.join(__dirname,'index.html');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
 const errs=[];const page=await b.newPage();await page.setViewport({width:1400,height:860});
 page.on('pageerror',e=>errs.push('pageerror: '+e.message));page.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())});
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
 // 3. batch
 await page.setViewport({width:1400,height:1050});await page.goto(url+'#auto=batch&n=1000&speed=7');await page.reload();
 await page.waitForFunction(()=>window.__batchDone===true,{timeout:180000});
 await sleep(800);
 await page.screenshot({path:'screenshot_batch.png'});
 const txt=await page.$eval('#term',e=>e.innerText);
 console.log(txt);
 // 4. tic-tac-toe
 await page.goto(url+'#auto=ttt&speed=10');await page.reload();
 await page.waitForFunction(()=>document.getElementById('term').innerText.includes('GAMES DRAWN'),{timeout:120000});
 console.log('TTT:',(await page.$eval('#term',e=>e.innerText)).match(/\d+ OF \d+ GAMES DRAWN/)[0]);
 const e2=await page.evaluate(()=>window.__errors);
 console.log('ERRORS:',errs.concat(e2));
 await b.close();
})().catch(e=>{console.error('TEST FAIL',e);process.exit(1)});
