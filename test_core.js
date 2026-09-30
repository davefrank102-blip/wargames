// Node-only test of the pure game logic extracted from index.html (script#core).
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
const code=html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const ctx={};vm.createContext(ctx);vm.runInContext(code,ctx);const C=ctx.WOPRCore;
const a=C.runBatch(400,42),b=C.runBatch(400,42);
assert.deepStrictEqual(a.map(r=>r.label+r.turns),b.map(r=>r.label+r.turns),'deterministic with seed');
const t0=Date.now(),res=C.runBatch(2000,2026),ms=Date.now()-t0;const tot={};
res.forEach(r=>{assert(r.label.startsWith('WINNER: '));assert(r.turns>=1&&r.turns<=10);const k=r.winner||r.kind;tot[k]=(tot[k]||0)+1;
 if(r.kind==='MAD')assert(r.cas.A>=C.CATASTROPHIC&&r.cas.B>=C.CATASTROPHIC&&r.winner===null);
 if(r.winner)assert(r.cas[r.winner]<C.CATASTROPHIC);});
console.log('2000 games in',ms,'ms',tot);
// human-style manual turn
const st=C.newGame({pA:'HUMAN',pB:'MEASURED',seed:7});
C.resolveTurn(st,{A:{type:'ESCALATE'},B:C.decide(st,'B')});assert.strictEqual(st.defcon<=4,true);
const tg=C.planStrike(st,'A',10,1,Math.random);const r=C.resolveTurn(st,{A:{type:'STRIKE',targets:tg},B:C.decide(st,'B')});
assert(r.events.length>=10);assert.strictEqual(st.defcon,1);
let ttt=0;const rng=C.makeRng(1);for(let i=0;i<200;i++)if(C.tttSelfPlay(rng).result==='D')ttt++;assert.strictEqual(ttt,200);
console.log('core tests passed; tic-tac-toe 200/200 draws');
// LEARN animation uses simulate(...,{trace:true}); results must be identical to the untraced run.
for (let i = 0; i < 300; i++) {
  const pA = C.DOCTRINES[i % 4], pB = C.DOCTRINES[Math.floor(i / 4) % 4], seed = (99 + i * 7919) >>> 0;
  const plain = C.simulate(pA, pB, seed), traced = C.simulate(pA, pB, seed, { trace: true });
  const tr = traced.trace; delete traced.trace;
  assert.deepStrictEqual(JSON.parse(JSON.stringify(traced)), JSON.parse(JSON.stringify(plain)), 'trace must not change results (game ' + i + ')');
  assert.strictEqual(tr.length, plain.turns);
  if (plain.anyStrike) assert(tr.some(t => t.events.length > 0));
}
// outcome log lines are flagged post:true (UI reveals them after impacts)
{ const s2 = C.newGame({ pA: 'AGGRESSIVE', pB: 'AGGRESSIVE', seed: 5 }); let saw = false;
  while (!s2.over) { const r2 = C.resolveTurn(s2, { A: C.decide(s2, 'A'), B: C.decide(s2, 'B') });
    r2.log.forEach(l => { if (/ INBOUND, /.test(l.t)) { assert.strictEqual(l.post, true); saw = true; } else assert(!l.post); }); }
  assert(saw); }
console.log('trace/identity tests passed');
