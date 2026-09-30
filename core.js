/* ===== WOPR CORE: pure game logic (no DOM). Exposed as WOPRCore. ===== */
(function (root) {
  'use strict';
  var CATASTROPHIC = 0.35;           // fraction of target-city population lost = catastrophic
  var DOCTRINES = ['AGGRESSIVE', 'MEASURED', 'DEFENSIVE', 'RANDOM'];
  var DOCTRINE_INFO = {
    AGGRESSIVE: { desc: 'FIRST STRIKE. ESCALATES EARLY AND HITS FORCES BEFORE THEY LAUNCH.', lowFrac: 1.0, lowCF: 0.5 },
    MEASURED:   { desc: 'PROPORTIONAL RESPONSE. MATCHES ESCALATION, ANSWERS IN KIND.', lowFrac: 0.5, lowCF: 0.5 },
    DEFENSIVE:  { desc: 'DETERRENCE. FAVORS INTERCEPTORS AND TALKS; RETALIATES WHEN HURT.', lowFrac: 0.3, lowCF: 0.15 },
    RANDOM:     { desc: 'UNPREDICTABLE. ACTIONS DRAWN AT RANDOM.', lowFrac: 0.5, lowCF: 0.5 },
    HUMAN:      { desc: 'HUMAN COMMANDER.', lowFrac: 0.5, lowCF: 0.5 }
  };
  // Abstract game data. Populations are rounded, approximate "game points" (millions).
  // Site unit counts are arbitrary game values, not real force data.
  var SIDE_DATA = {
    A: {
      name: 'UNITED STATES', short: 'US', interceptors: 20, subs: 8,
      subPatrol: [[-45, 42], [-150, 38], [-30, 58], [-60, 30]],
      cities: [
        ['NEW YORK', -74.0, 40.7, 16.0], ['LOS ANGELES', -118.2, 34.0, 11.0], ['CHICAGO', -87.6, 41.9, 7.9],
        ['PHILADELPHIA', -75.2, 39.9, 5.6], ['SAN FRANCISCO', -122.4, 37.8, 5.4], ['DETROIT', -83.0, 42.3, 4.6],
        ['BOSTON', -71.1, 42.4, 4.0], ['WASHINGTON', -77.0, 38.9, 3.4], ['HOUSTON', -95.4, 29.8, 3.1],
        ['DALLAS', -96.8, 32.8, 3.0], ['ATLANTA', -84.4, 33.7, 2.1], ['SEATTLE', -122.3, 47.6, 2.1]
      ],
      sites: [
        ['SILO FIELD ALPHA', 'SILO', -109.0, 47.5, 8], ['SILO FIELD BRAVO', 'SILO', -101.5, 47.9, 8],
        ['SILO FIELD CHARLIE', 'SILO', -104.3, 42.2, 6], ['BOMBER BASE', 'AIRBASE', -97.0, 36.5, 5],
        ['SUB PEN (PACIFIC)', 'SUBBASE', -123.2, 44.5, 3], ['NORAD COMMAND', 'COMMAND', -104.8, 38.7, 0]
      ]
    },
    B: {
      name: 'SOVIET UNION', short: 'USSR', interceptors: 22, subs: 7,
      subPatrol: [[-15, 66], [165, 48], [5, 74], [-35, 50]],
      cities: [
        ['MOSCOW', 37.6, 55.75, 8.5], ['LENINGRAD', 30.3, 59.9, 4.8], ['KIEV', 30.5, 50.45, 2.4],
        ['TASHKENT', 69.3, 41.3, 2.0], ['BAKU', 49.9, 40.4, 1.7], ['KHARKOV', 36.2, 50.0, 1.5],
        ['MINSK', 27.6, 53.9, 1.5], ['GORKY', 44.0, 56.3, 1.4], ['NOVOSIBIRSK', 82.9, 55.0, 1.4],
        ['SVERDLOVSK', 60.6, 56.8, 1.3], ['KUYBYSHEV', 50.1, 53.2, 1.3], ['VLADIVOSTOK', 131.9, 43.1, 0.6]
      ],
      sites: [
        ['SILO FIELD URAL', 'SILO', 57.5, 51.8, 9], ['SILO FIELD OMSK', 'SILO', 73.4, 54.0, 8],
        ['SILO FIELD YENISEI', 'SILO', 92.0, 56.5, 6], ['BOMBER BASE', 'AIRBASE', 46.2, 50.2, 4],
        ['SUB PEN (NORTH)', 'SUBBASE', 33.2, 68.9, 3], ['COMMAND BUNKER', 'COMMAND', 40.5, 58.2, 0]
      ]
    }
  };

  function makeRng(seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function other(id) { return id === 'A' ? 'B' : 'A'; }
  function forces(s) {
    var n = s.subUnits;
    for (var i = 0; i < s.sites.length; i++) if (s.sites[i].alive) n += s.sites[i].units;
    return n;
  }
  function casFrac(s) { return s.casualties / s.totalPop; }

  function mkSide(id, personality, rnd, low) {
    var d = SIDE_DATA[id];
    var s = {
      id: id, name: d.name, short: d.short, personality: personality,
      cities: [], sites: [], subUnits: d.subs, subPatrol: d.subPatrol,
      interceptors: d.interceptors, maxInterceptors: d.interceptors,
      casualties: 0, totalPop: 0, commandAlive: true, receivedLast: 0, lowFiredLast: false,
      launched: 0, unitsLost: 0, intercepts: 0
    };
    d.cities.forEach(function (c, i) {
      s.cities.push({ id: id + 'C' + i, side: id, kind: 'city', name: c[0], lon: c[1], lat: c[2], pop: c[3], popLeft: c[3], hits: 0 });
      s.totalPop += c[3];
    });
    d.sites.forEach(function (c, i) {
      s.sites.push({ id: id + 'S' + i, side: id, kind: 'site', name: c[0], type: c[1], lon: c[2], lat: c[3], units: c[4], alive: true, hits: 0 });
    });
    s.initialForces = forces(s);
    s.low = (low !== undefined) ? !!low : (personality === 'RANDOM' ? rnd() < 0.6 : true);
    return s;
  }

  function newGame(o) {
    o = o || {};
    var seed = (o.seed !== undefined) ? o.seed : ((Math.random() * 4294967295) >>> 0);
    var rnd = makeRng(seed);
    var st = {
      seed: seed, rnd: rnd, turn: 0, maxTurns: o.maxTurns || 10, defcon: 5,
      over: false, result: null, anyStrike: false, falseAlarms: o.falseAlarms !== false,
      lastActions: { A: null, B: null }, history: []
    };
    st.sides = { A: mkSide('A', o.pA || 'MEASURED', rnd, o.lowA), B: mkSide('B', o.pB || 'MEASURED', rnd, o.lowB) };
    return st;
  }

  function findTarget(side, id) {
    var i;
    for (i = 0; i < side.cities.length; i++) if (side.cities[i].id === id) return side.cities[i];
    for (i = 0; i < side.sites.length; i++) if (side.sites[i].id === id) return side.sites[i];
    return null;
  }
  function getTarget(state, id) { return findTarget(state.sides[id.charAt(0)], id); }
  function isCityId(id) { return id.charAt(1) === 'C'; }

  /* Remove strike units from a side; returns launch origins [lon,lat]. Priority sites launch first (use-or-lose). */
  function drawUnits(side, n, rnd, priority) {
    var out = [];
    function takeFrom(st) { while (st.alive && st.units > 0 && out.length < n) { st.units--; out.push([st.lon, st.lat]); } }
    if (priority) side.sites.forEach(function (st) { if (priority[st.id]) takeFrom(st); });
    ['SILO', 'AIRBASE', 'SUBBASE'].forEach(function (t) { side.sites.forEach(function (st) { if (st.type === t) takeFrom(st); }); });
    while (side.subUnits > 0 && out.length < n) {
      side.subUnits--;
      var p = side.subPatrol[Math.floor(rnd() * side.subPatrol.length)];
      out.push([p[0] + (rnd() - 0.5) * 10, p[1] + (rnd() - 0.5) * 6]);
    }
    side.launched += out.length;
    return out;
  }

  /* Build a target allocation: cf = fraction counterforce (military sites), rest countervalue (cities). */
  function planStrike(state, attId, n, cf, rnd) {
    var def = state.sides[other(attId)], alloc = {};
    var nCF = Math.round(n * cf), nCV = n - nCF;
    var sites = def.sites.filter(function (s) { return s.alive && (s.units > 0 || s.type === 'COMMAND'); })
      .map(function (s) { return { s: s, v: s.units + (s.type === 'COMMAND' ? 6 : 0) + rnd() * 2 }; })
      .sort(function (a, b) { return b.v - a.v; }).map(function (x) { return x.s; });
    var cities = def.cities.filter(function (c) { return c.popLeft > 0.05; })
      .map(function (c) { return { c: c, v: c.popLeft * (0.8 + rnd() * 0.4) }; })
      .sort(function (a, b) { return b.v - a.v; }).map(function (x) { return x.c; });
    if (!sites.length) { nCV += nCF; nCF = 0; }
    if (!cities.length) { nCF += nCV; nCV = 0; }
    var i = 0;
    while (nCF > 0 && sites.length) { var st = sites[i % sites.length], k = Math.min(2, nCF); alloc[st.id] = (alloc[st.id] || 0) + k; nCF -= k; i++; }
    i = 0;
    while (nCV > 0 && cities.length) { var c = cities[i % cities.length]; alloc[c.id] = (alloc[c.id] || 0) + 1; nCV--; i++; }
    return Object.keys(alloc).map(function (k) { return { id: k, n: alloc[k] }; });
  }

  /* AI decision for side `id` according to its personality. */
  function decide(state, id) {
    var me = state.sides[id], r = state.rnd, d = state.defcon, f = forces(me);
    var opLast = state.lastActions[other(id)], hit = me.receivedLast;
    var ESC = { type: 'ESCALATE' }, DEF = { type: 'DEFEND' }, NEG = { type: 'NEGOTIATE' };
    function S(n, cf) { n = Math.max(1, Math.min(f, Math.round(n))); return { type: 'STRIKE', targets: planStrike(state, id, n, cf, r) }; }
    if (f <= 0) return d < 5 ? NEG : DEF;
    switch (me.personality) {
      case 'AGGRESSIVE':
        if (state.anyStrike) return r() < 0.85 ? S(f * (0.45 + 0.35 * r()), 0.35) : DEF;
        if (d <= 3 || (state.turn >= 1 && r() < 0.18)) return S(f * (0.65 + 0.15 * r()), 0.85);
        return r() < 0.85 ? ESC : DEF;
      case 'MEASURED':
        if (hit > 0 && !me.lowFiredLast) return S(hit * (0.9 + 0.4 * r()), 0.5);
        if (hit > 0 && r() < 0.4) return S(Math.max(2, hit * 0.5), 0.5);
        if (opLast === 'ESCALATE') return r() < 0.7 ? ESC : DEF;
        if (state.anyStrike) return r() < 0.6 ? NEG : DEF;
        if (d < 5) return r() < 0.7 ? NEG : DEF;
        return r() < 0.5 ? NEG : DEF;
      case 'DEFENSIVE':
        if (hit > 0 && (casFrac(me) > 0.12 || r() < 0.35)) return S(f * (0.3 + 0.2 * r()), 0.15);
        if (opLast === 'ESCALATE' && d > 3 && r() < 0.35) return ESC;
        if (me.interceptors < me.maxInterceptors || r() < 0.5) return DEF;
        return d < 5 ? NEG : DEF;
      default: // RANDOM
        var x = r();
        if (x < 0.3) return ESC;
        if (x < 0.55) return DEF;
        if (x < 0.8) return NEG;
        return S(2 + r() * 10, r());
    }
  }

  function totalN(targets) { var n = 0; (targets || []).forEach(function (t) { n += t.n; }); return n; }

  function sanitize(state, id, a) {
    if (!a || !a.type) return { type: 'DEFEND' };
    if (a.type !== 'STRIKE') return { type: a.type };
    var me = state.sides[id], enemy = state.sides[other(id)], left = forces(me), out = [];
    (a.targets || []).forEach(function (t) {
      var tg = findTarget(enemy, t.id), n = Math.min(t.n | 0, left);
      if (tg && n > 0) { out.push({ id: t.id, n: n }); left -= n; }
    });
    if (!out.length) return { type: 'DEFEND' };
    return { type: 'STRIKE', targets: out, falseAlarm: a.falseAlarm };
  }

  function describe(a) {
    switch (a.type) {
      case 'ESCALATE': return 'ESCALATES. FORCES TO HIGHER READINESS.';
      case 'DEFEND': return 'HOLDS. INTERCEPTORS ON STATION.';
      case 'NEGOTIATE': return 'PROPOSES DE-ESCALATION TALKS.';
      case 'STRIKE':
        var cf = 0, cv = 0;
        a.targets.forEach(function (t) { if (isCityId(t.id)) cv += t.n; else cf += t.n; });
        return 'LAUNCHES ' + (cf + cv) + ' UNITS  [COUNTERFORCE ' + cf + ' / COUNTERVALUE ' + cv + ']';
    }
    return a.type;
  }

  function applyHit(side, tgt, st) {
    tgt.hits++;
    if (tgt.kind === 'city') {
      var k = tgt.popLeft * 0.55; tgt.popLeft -= k; side.casualties += k; st.cas += k;
    } else if (tgt.alive) {
      tgt.alive = false; st.lost += tgt.units; side.unitsLost += tgt.units; tgt.units = 0;
      side.casualties += 0.1; st.cas += 0.1;
      if (tgt.type === 'COMMAND') side.commandAlive = false;
    }
  }

  function shuffle(a, r) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  /* Resolve one simultaneous turn. Mutates state. Returns {events, log}. */
  function resolveTurn(state, acts) {
    if (state.over) return { events: [], log: [] };
    var r = state.rnd, log = [], events = [], IDS = ['A', 'B'];
    state.turn++;
    var d0 = state.defcon;
    var act = { A: sanitize(state, 'A', acts.A), B: sanitize(state, 'B', acts.B) };
    log.push({ t: '== TURN ' + state.turn + '/' + state.maxTurns + ' == DEFCON ' + d0 + ' ==', c: 'hdr' });

    // False alarms: sensor ghosts at high alert can trigger a computer-controlled launch.
    IDS.forEach(function (id) {
      var s = state.sides[id];
      if (state.falseAlarms && s.personality !== 'HUMAN' && d0 <= 2 && act[id].type !== 'STRIKE' && forces(s) > 0 && r() < 0.06) {
        log.push({ t: s.short + ' EARLY WARNING: INBOUND TRACKS DETECTED...', c: 'warn' });
        if (s.low && s.commandAlive && r() < 0.5) {
          act[id] = sanitize(state, id, { type: 'STRIKE', targets: planStrike(state, id, Math.max(1, Math.round(forces(s) * 0.4)), 0.5, r), falseAlarm: true });
          log.push({ t: s.short + ' LAUNCHES ON WARNING. THE TRACKS WERE A SENSOR GHOST.', c: 'alert' });
        } else log.push({ t: s.short + ' ALERT CLEARED: SENSOR GHOST. STANDING DOWN.', c: 'dim' });
      }
    });
    IDS.forEach(function (id) { log.push({ t: state.sides[id].short + ': ' + describe(act[id]), c: 'side' + id }); });

    var strikers = IDS.filter(function (id) { return act[id].type === 'STRIKE'; });
    if (strikers.length) {
      if (!state.anyStrike) log.push({ t: '*** LAUNCH DETECTED. DEFCON 1. ***', c: 'alert' });
      state.defcon = 1; state.anyStrike = true;
    } else {
      var esc = IDS.filter(function (id) { return act[id].type === 'ESCALATE'; }).length;
      var neg = IDS.filter(function (id) { return act[id].type === 'NEGOTIATE'; }).length;
      if (esc) state.defcon = Math.max(1, d0 - esc);
      else if (neg === 2 || (neg === 1 && r() < 0.5)) state.defcon = Math.min(5, d0 + 1);
      else if (neg === 1) log.push({ t: 'TALKS STALL. NO CHANGE.', c: 'dim' });
      if (state.defcon !== d0) log.push({ t: (state.defcon < d0 ? 'ESCALATION: ' : 'TALKS SUCCEED: ') + 'DEFCON ' + d0 + ' -> ' + state.defcon, c: state.defcon < d0 ? 'warn' : 'ok' });
    }

    var salvos = [];
    strikers.forEach(function (id) {
      var s = state.sides[id], tg = act[id].targets, origins = drawUnits(s, totalN(tg), r), k = 0;
      tg.forEach(function (t) { for (var j = 0; j < t.n && k < origins.length; j++, k++) salvos.push({ att: id, def: other(id), target: t.id, from: origins[k], low: false }); });
    });

    // Launch on warning: a defender at DEFCON<=3 with command intact fires before impacts.
    var lowFired = { A: false, B: false };
    IDS.forEach(function (id) {
      var s = state.sides[id];
      if (act[id].type === 'STRIKE') return;
      var incoming = salvos.filter(function (x) { return x.def === id && !x.low; });
      if (!incoming.length) return;
      if (!s.low) { log.push({ t: s.short + ': LAUNCH-ON-WARNING DISABLED. ABSORBING STRIKE.', c: 'warn' }); return; }
      if (!s.commandAlive) { log.push({ t: s.short + ': COMMAND OFFLINE. NO LAUNCH ON WARNING.', c: 'warn' }); return; }
      if (d0 > 3) { log.push({ t: s.short + ' CAUGHT AT DEFCON ' + d0 + '. FORCES NOT ON ALERT. NO LAUNCH ON WARNING.', c: 'warn' }); return; }
      var pri = {}, uol = 0;
      incoming.forEach(function (x) { var st = findTarget(s, x.target); if (st && st.kind === 'site' && st.alive && !pri[st.id]) { pri[st.id] = 1; uol += st.units; } });
      var f = forces(s), info = DOCTRINE_INFO[s.personality] || DOCTRINE_INFO.HUMAN;
      var frac = s.personality === 'RANDOM' ? r() : info.lowFrac;
      var n = Math.min(f, uol + Math.round((f - uol) * frac));
      if (n <= 0) return;
      var plan = planStrike(state, id, n, info.lowCF, r), origins = drawUnits(s, n, r, pri), k = 0;
      plan.forEach(function (t) { for (var j = 0; j < t.n && k < origins.length; j++, k++) salvos.push({ att: id, def: other(id), target: t.id, from: origins[k], low: true }); });
      lowFired[id] = true;
      log.push({ t: s.short + ' LAUNCH ON WARNING: ' + k + ' UNITS AIRBORNE BEFORE IMPACT.', c: 'alert' });
    });

    var first = shuffle(salvos.filter(function (x) { return !x.low; }), r);
    var second = shuffle(salvos.filter(function (x) { return x.low; }), r);
    salvos = first.concat(second);
    var used = { A: 0, B: 0 };
    var stats = { A: { inb: 0, int: 0, hit: 0, cas: 0, lost: 0 }, B: { inb: 0, int: 0, hit: 0, cas: 0, lost: 0 } };
    salvos.forEach(function (x, i) {
      var dS = state.sides[x.def], tgt = findTarget(dS, x.target), st = stats[x.def];
      var defending = act[x.def].type === 'DEFEND';
      var cap = defending ? 12 : 6;
      var p = Math.min(0.7, 0.3 + (defending ? 0.15 : 0) + (5 - d0) * 0.04);
      var ev = { att: x.att, def: x.def, from: x.from, to: [tgt.lon, tgt.lat], target: tgt.id, low: x.low, intercepted: false, order: i };
      st.inb++;
      if (dS.interceptors > 0 && used[x.def] < cap) {
        dS.interceptors--; used[x.def]++;
        if (r() < p) { ev.intercepted = true; st.int++; dS.intercepts++; events.push(ev); return; }
      }
      st.hit++; applyHit(dS, tgt, st); events.push(ev);
    });
    IDS.forEach(function (id) {
      var st = stats[id], s = state.sides[id];
      // post: true = outcome line; UIs should reveal it only after the impacts are shown.
      if (st.inb) log.push({ t: s.short + ': ' + st.inb + ' INBOUND, ' + st.int + ' INTERCEPTED, ' + st.hit + ' IMPACTS. LOSSES +' + st.cas.toFixed(1) + 'M' + (st.lost ? ', ' + st.lost + ' UNITS LOST ON GROUND' : '') + '.', c: 'side' + id, post: true });
    });

    IDS.forEach(function (id) {
      var s = state.sides[id];
      s.interceptors = Math.min(s.maxInterceptors, s.interceptors + (act[id].type === 'DEFEND' ? 3 : 1));
      s.receivedLast = salvos.filter(function (x) { return x.def === id; }).length;
      s.lowFiredLast = lowFired[id];
    });
    state.lastActions = { A: act.A.type, B: act.B.type };
    var A = state.sides.A, B = state.sides.B;
    state.history.push({ turn: state.turn, defcon: state.defcon, acts: { A: act.A.type, B: act.B.type }, cas: { A: A.casualties, B: B.casualties }, forces: { A: forces(A), B: forces(B) } });

    var fA = forces(A), fB = forces(B);
    if (state.turn >= state.maxTurns || (state.anyStrike && (fA === 0 || fB === 0)) || (casFrac(A) >= CATASTROPHIC && casFrac(B) >= CATASTROPHIC)) {
      state.over = true; state.result = evaluate(state);
    }
    return { events: events, log: log, acts: act };
  }

  /* Winner determination. */
  function evaluate(state) {
    var A = state.sides.A, B = state.sides.B, cA = casFrac(A), cB = casFrac(B);
    var fa = forces(A) / A.initialForces, fb = forces(B) / B.initialForces;
    var res = { turns: state.turn, cas: { A: cA, B: cB }, casM: { A: A.casualties, B: B.casualties }, forces: { A: forces(A), B: forces(B) }, anyStrike: state.anyStrike, winner: null };
    res.score = { A: 60 * (1 - cA) + 40 * fa, B: 60 * (1 - cB) + 40 * fb };
    if (!state.anyStrike) { res.kind = 'PEACE'; res.detail = 'NO WEAPONS LAUNCHED. BOTH SIDES SURVIVE.'; }
    else if (cA >= CATASTROPHIC && cB >= CATASTROPHIC) { res.kind = 'MAD'; res.detail = 'MUTUAL DESTRUCTION. CATASTROPHIC LOSSES ON BOTH SIDES.'; }
    else if (cA >= CATASTROPHIC) { res.kind = 'VICTORY'; res.winner = 'B'; }
    else if (cB >= CATASTROPHIC) { res.kind = 'VICTORY'; res.winner = 'A'; }
    else if (Math.abs(res.score.A - res.score.B) < 8) { res.kind = 'STALEMATE'; res.detail = 'NO DECISIVE ADVANTAGE. BOTH SIDES DAMAGED.'; }
    else { res.kind = 'VICTORY'; res.winner = res.score.A > res.score.B ? 'A' : 'B'; }
    if (res.winner) {
      var w = state.sides[res.winner];
      res.detail = w.name + ' PREVAILS AT A COST OF ' + w.casualties.toFixed(1) + 'M LOSSES (' + Math.round(casFrac(w) * 100) + '%).';
      res.label = 'WINNER: ' + w.name;
    } else res.label = 'WINNER: NONE';
    return res;
  }

  function simulate(pA, pB, seed, opts) {
    opts = opts || {};
    var st = newGame({ pA: pA, pB: pB, seed: seed, maxTurns: opts.maxTurns });
    var guard = 0, trace = opts.trace ? [] : null;
    while (!st.over && guard++ < 100) {
      var tr = resolveTurn(st, { A: decide(st, 'A'), B: decide(st, 'B') });
      // Optional presentation trace (read-only copy of what happened; does not affect the outcome).
      if (trace) trace.push({ defcon: st.defcon, acts: { A: tr.acts.A.type, B: tr.acts.B.type },
        falseAlarm: { A: !!tr.acts.A.falseAlarm, B: !!tr.acts.B.falseAlarm }, events: tr.events });
    }
    var r = st.result; r.pA = pA; r.pB = pB; r.seed = seed;
    if (trace) r.trace = trace;
    return r;
  }

  function runBatch(n, seed) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(simulate(DOCTRINES[i % 4], DOCTRINES[Math.floor(i / 4) % 4], (seed + i * 7919) >>> 0));
    return out;
  }

  /* ---- Tic-tac-toe (perfect self-play with random tie-breaking) ---- */
  var LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  function tttWinner(b) {
    for (var i = 0; i < 8; i++) { var l = LINES[i]; if (b[l[0]] && b[l[0]] === b[l[1]] && b[l[1]] === b[l[2]]) return b[l[0]]; }
    for (var j = 0; j < 9; j++) if (!b[j]) return null;
    return 'D';
  }
  var memo = {};
  function tttScore(b, p) { // value from X's perspective, p = player to move
    var key = b.join(',') + p; if (key in memo) return memo[key];
    var w = tttWinner(b), v;
    if (w === 'X') v = 1; else if (w === 'O') v = -1; else if (w === 'D') v = 0;
    else {
      v = p === 'X' ? -2 : 2;
      for (var i = 0; i < 9; i++) if (!b[i]) {
        b[i] = p; var s = tttScore(b, p === 'X' ? 'O' : 'X'); b[i] = '';
        v = p === 'X' ? Math.max(v, s) : Math.min(v, s);
      }
    }
    return (memo[key] = v);
  }
  function tttBestMoves(b, p) {
    var best = null, moves = [];
    for (var i = 0; i < 9; i++) if (!b[i]) {
      b[i] = p; var s = tttScore(b, p === 'X' ? 'O' : 'X'); b[i] = '';
      var v = p === 'X' ? s : -s;
      if (best === null || v > best) { best = v; moves = [i]; } else if (v === best) moves.push(i);
    }
    return moves;
  }
  function tttSelfPlay(rnd) {
    var b = ['', '', '', '', '', '', '', '', ''], p = 'X', moves = [];
    while (!tttWinner(b)) { var ms = tttBestMoves(b, p), m = ms[Math.floor(rnd() * ms.length)]; b[m] = p; moves.push(m); p = p === 'X' ? 'O' : 'X'; }
    return { moves: moves, board: b, result: tttWinner(b) };
  }

  root.WOPRCore = {
    CATASTROPHIC: CATASTROPHIC, DOCTRINES: DOCTRINES, DOCTRINE_INFO: DOCTRINE_INFO, SIDE_DATA: SIDE_DATA,
    makeRng: makeRng, newGame: newGame, decide: decide, resolveTurn: resolveTurn, evaluate: evaluate,
    simulate: simulate, runBatch: runBatch, forces: forces, casFrac: casFrac, planStrike: planStrike,
    getTarget: getTarget, findTarget: findTarget, isCityId: isCityId, other: other, totalN: totalN,
    tttWinner: tttWinner, tttBestMoves: tttBestMoves, tttSelfPlay: tttSelfPlay
  };
})(typeof window !== 'undefined' ? window : globalThis);
