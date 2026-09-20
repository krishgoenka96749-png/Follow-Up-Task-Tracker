/* Local stand-in for the claude.ai Artifact runtime — dev only.
   Never loaded by the published page: dev/server.py injects it, index.html
   does not reference it. Implements the slice of docs/contract/ that
   index.html actually uses:

     claude.use("db")     -> in-memory doc store: collection().onSnapshot,
                             doc().get/set/update/delete/onSnapshot, queries
     claude.use("sample") -> callable namespace with .json() and .limits()

   State lives in localStorage so a reload keeps what you filed.

   URL switches (all optional):
     ?fresh            reseed from dev/seed.js, discarding local changes
     ?db=none          use("db") resolves null  -> disconnected state
     ?sample=none      use("sample") resolves null -> Refine hidden
     ?sample=<code>    next sample.json rejects with that code
                       (rate_limited, not_granted, invalid_json, ...)
     ?latency=<ms>     write/round-trip latency, default 60
     ?slow=<ms>        extra delay on sample.json, default 700

   Console handle: window.__ledgerMock
     .dump()           every document, by path
     .reset()          reseed and reload
     .failNext(code)   make the next sample.json reject
     .fail(code)       make every db write reject (null clears it)
*/
(function(){
  "use strict";

  var params   = new URLSearchParams(window.location.search);
  var LATENCY  = Number(params.get("latency") || 60);
  var SAMPLE_MS= Number(params.get("slow") || 700);
  var STORE_KEY= "ledger-dev-db";

  function log(){
    var args = ["%c[mock]", "color:#1E685C;font-weight:600"].concat([].slice.call(arguments));
    console.log.apply(console, args);
  }
  function later(ms, fn){
    return new Promise(function(res, rej){
      setTimeout(function(){
        try{ res(fn ? fn() : undefined); }
        catch(e){ rej(e); }        // a throw in the timer must reject, not escape
      }, ms);
    });
  }
  function err(code, message){ return {code: code, message: message}; }

  /* ---------- path grammar (docs/contract/db.d.ts) ---------- */
  var SEG = /^[A-Za-z0-9_\-.~:@+]{1,200}$/;
  function segments(path, wantEven, kind){
    if(typeof path !== "string" || !path) throw new TypeError("mock db: " + kind + " path must be a non-empty string");
    var parts = path.split("/");
    if(parts.length > 16) throw new TypeError("mock db: at most 16 segments, got " + parts.length);
    parts.forEach(function(s){
      if(s === "." || s === ".." || !SEG.test(s)) throw new TypeError("mock db: bad path segment \"" + s + "\" in \"" + path + "\"");
    });
    var even = parts.length % 2 === 0;
    if(even !== wantEven){
      throw new TypeError("mock db: a " + kind + " path needs an " + (wantEven ? "even" : "odd") +
        " number of segments, \"" + path + "\" has " + parts.length);
    }
    return parts;
  }

  /* ---------- store ---------- */
  var store = {};          // path -> frozen body
  var writeFailure = null; // db write kill switch, for testing rule 6

  function deepFreeze(o){
    if(o && typeof o === "object" && !Object.isFrozen(o)){
      Object.freeze(o);
      Object.keys(o).forEach(function(k){ deepFreeze(o[k]); });
    }
    return o;
  }
  function clone(v){ return v == null ? v : JSON.parse(JSON.stringify(v)); }
  function persist(){
    try{ window.localStorage.setItem(STORE_KEY, JSON.stringify(store)); }
    catch(e){ log("could not persist store", e); }
  }
  function seed(){
    store = {};
    var s = window.__LEDGER_SEED__ || {};
    Object.keys(s).forEach(function(p){ store[p] = deepFreeze(clone(s[p])); });
    persist();
    log("seeded", Object.keys(store).length, "documents");
  }
  function load(){
    if(params.has("fresh")) return seed();
    var raw = null;
    try{ raw = window.localStorage.getItem(STORE_KEY); }catch(e){}
    if(!raw) return seed();
    try{
      var parsed = JSON.parse(raw);
      Object.keys(parsed).forEach(function(p){ store[p] = deepFreeze(parsed[p]); });
      log("restored", Object.keys(store).length, "documents from localStorage (?fresh to reseed)");
    }catch(e){ seed(); }
  }

  function collectionOf(path){ var p = path.split("/"); p.pop(); return p.join("/"); }
  function docsIn(collPath){
    return Object.keys(store)
      .filter(function(p){ return collectionOf(p) === collPath; })
      .sort()
      .map(function(p){ return {id: p.split("/").pop(), path: p, body: store[p]}; });
  }

  /* ---------- snapshots ---------- */
  function docSnap(path, pending){
    var body = store[path];
    return Object.freeze({
      id: path.split("/").pop(),
      exists: body !== undefined,
      data: function(){ return body; },
      metadata: Object.freeze({fromCache: false, hasPendingWrites: !!pending})
    });
  }
  function rowSnap(row, pending){
    return Object.freeze({
      id: row.id,
      exists: true,
      data: function(){ return row.body; },
      metadata: Object.freeze({fromCache: false, hasPendingWrites: !!pending})
    });
  }

  /* ---------- listeners ---------- */
  var listeners = [];
  function register(l){
    listeners.push(l);
    later(LATENCY / 3, function(){ if(l.live) deliver(l, false); });
    return function(){ l.live = false; listeners = listeners.filter(function(x){ return x !== l; }); };
  }
  function notifyAll(pending){
    listeners.forEach(function(l){ if(l.live) deliver(l, pending); });
  }
  function deliver(l, pending){
    if(l.kind === "doc"){
      l.next(docSnap(l.path, pending));
      return;
    }
    var rows = runQuery(l.query);
    var prev = l.last || [];
    var changes = diff(prev, rows, pending);
    l.last = rows;
    l.next(Object.freeze({
      docs: rows.map(function(r){ return rowSnap(r, pending); }),
      size: rows.length,
      empty: rows.length === 0,
      docChanges: function(){ return changes; },
      metadata: Object.freeze({fromCache: false, hasPendingWrites: !!pending})
    }));
  }
  function diff(prev, next, pending){
    var out = [], byIdPrev = {}, byIdNext = {};
    prev.forEach(function(r, i){ byIdPrev[r.id] = {row: r, i: i}; });
    next.forEach(function(r, i){ byIdNext[r.id] = {row: r, i: i}; });
    prev.forEach(function(r, i){
      if(!byIdNext[r.id]) out.push({type: "removed", doc: rowSnap(r, pending), oldIndex: i, newIndex: -1});
    });
    next.forEach(function(r, i){
      var was = byIdPrev[r.id];
      if(!was) out.push({type: "added", doc: rowSnap(r, pending), oldIndex: -1, newIndex: i});
      else if(was.row.body !== r.body) out.push({type: "modified", doc: rowSnap(r, pending), oldIndex: was.i, newIndex: i});
    });
    return out;
  }

  /* ---------- queries ---------- */
  function cmp(a, b){
    if(a === b) return 0;
    if(a === undefined) return 1;   // documents missing the field sort last
    if(b === undefined) return -1;
    return a < b ? -1 : 1;
  }
  function test(value, op, want){
    switch(op){
      case "==": case "eq":  return value === want;
      case "!=": case "ne":  return value !== want;
      case "<":  return cmp(value, want) < 0;
      case "<=": return cmp(value, want) <= 0;
      case ">":  return cmp(value, want) > 0;
      case ">=": return cmp(value, want) >= 0;
      case "in": return Array.isArray(want) && want.indexOf(value) !== -1;
      case "not-in": return Array.isArray(want) && want.indexOf(value) === -1;
      case "array-contains": return Array.isArray(value) && value.indexOf(want) !== -1;
      default: throw new TypeError("mock db: unsupported operator \"" + op + "\"");
    }
  }
  function runQuery(q){
    var rows = docsIn(q.path).filter(function(r){
      return q.wheres.every(function(w){ return test(r.body[w[0]], w[1], w[2]); });
    });
    if(q.order){
      var f = q.order.field, dir = q.order.dir === "desc" ? -1 : 1;
      rows = rows.slice().sort(function(a, b){ return cmp(a.body[f], b.body[f]) * dir; });
    }
    if(q.max) rows = rows.slice(0, q.max);
    return rows;
  }

  /* ---------- writes ---------- */
  function settle(path, body, pending){
    if(body === undefined) delete store[path]; else store[path] = deepFreeze(body);
    later(0, function(){ notifyAll(true); });   // latency compensation
    return later(LATENCY, function(){
      persist();
      notifyAll(false);
    });
  }
  function guard(){
    if(!writeFailure) return null;
    return later(LATENCY, function(){ throw err(writeFailure, "mock db: writes are failing on purpose"); });
  }
  function merge(base, patch){
    var out = clone(base) || {};
    Object.keys(patch).forEach(function(k){
      var v = patch[k];
      if(v && typeof v === "object" && !Array.isArray(v) && out[k] && typeof out[k] === "object" && !Array.isArray(out[k])){
        out[k] = merge(out[k], v);
      } else {
        out[k] = clone(v);
      }
    });
    return out;
  }
  function checkBody(data){
    if(!data || typeof data !== "object" || Array.isArray(data)){
      return err("invalid_argument", "mock db: a document body must be a plain object");
    }
    var json;
    try{ json = JSON.stringify(data); }
    catch(e){ return err("invalid_argument", "mock db: document body is not JSON-serialisable"); }
    if(json.length > 256 * 1024) return err("invalid_argument", "mock db: document body over 256 KiB");
    return null;
  }

  /* ---------- refs ---------- */
  function docRef(path){
    segments(path, true, "document");
    var ref = {
      id: path.split("/").pop(),
      path: path,

      get: function(){ return later(LATENCY, function(){ return docSnap(path, false); }); },

      set: function(data){
        var bad = guard(); if(bad) return bad;
        var e = checkBody(data); if(e) return Promise.reject(e);
        return settle(path, clone(data));
      },

      update: function(data){
        var bad = guard(); if(bad) return bad;
        var e = checkBody(data); if(e) return Promise.reject(e);
        if(store[path] === undefined){
          return later(LATENCY, function(){
            throw err("invalid_argument", "mock db: update() requires an existing document (" + path + ")");
          });
        }
        return settle(path, merge(store[path], data));
      },

      delete: function(){
        var bad = guard(); if(bad) return bad;
        return settle(path, undefined);
      },

      acquire: function(options){
        // Cooperative lease, single tab: nothing else contends here.
        var ttl = Math.min(Math.max((options && options.ttlMs) || 30000, 1000), 600000);
        if(options && options.data) store[path] = deepFreeze(merge(store[path] || {}, options.data));
        return later(LATENCY, function(){
          return {acquired: true, version: 1, holder: options && options.holder,
                  expiresAt: new Date(Date.now() + ttl).toISOString()};
        });
      },

      onSnapshot: function(next, onError){
        return register({kind: "doc", path: path, next: next, error: onError, live: true});
      },

      collection: function(sub){ return collRef(path + "/" + sub); }
    };
    return ref;
  }

  function query(path, wheres, order, max){
    segments(path, false, "collection");
    var q = {path: path, wheres: wheres || [], order: order || null, max: max || 0};
    return {
      where: function(field, op, value){ return query(path, q.wheres.concat([[field, op, value]]), q.order, q.max); },
      orderBy: function(field, dir){ return query(path, q.wheres, {field: field, dir: dir || "asc"}, q.max); },
      limit: function(n){ return query(path, q.wheres, q.order, n); },
      get: function(){
        return later(LATENCY, function(){
          var rows = runQuery(q);
          return Object.freeze({
            docs: rows.map(function(r){ return rowSnap(r, false); }),
            size: rows.length, empty: rows.length === 0,
            docChanges: function(){ return rows.map(function(r, i){ return {type: "added", doc: rowSnap(r, false), oldIndex: -1, newIndex: i}; }); },
            metadata: Object.freeze({fromCache: false, hasPendingWrites: false})
          });
        });
      },
      onSnapshot: function(next, onError){
        return register({kind: "query", query: q, next: next, error: onError, live: true});
      },
      _q: q
    };
  }

  function collRef(path){
    var base = query(path, [], null, 0);
    base.path = path;
    base.doc = function(id){ return docRef(path + "/" + (id || ("auto_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)))); };
    base.add = function(data){
      var ref = base.doc();
      return ref.set(data).then(function(){ return ref; });
    };
    return base;
  }

  var db = Object.freeze({
    doc: function(path){ return docRef(path); },
    collection: function(path){ return collRef(path); }
  });

  /* ================= sample ================= */
  var sampleFailure = params.get("sample");
  if(sampleFailure === "none") sampleFailure = null;

  var WEEKDAYS = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  var THEIRS = /\b(owes?\s+me|owed\s+to\s+me|will\s+(?:send|share|get|come|revert)|is\s+(?:sending|sharing)|to\s+(?:send|share|get)\s+me|comes?\s+back\s+to\s+me|waiting\s+(?:on|for)|chasing|they'?ll|he'?ll|she'?ll|said\s+(?:he|she|they)'?d)\b/i;
  var NOTE_START = /^(?:note\s*[:\-\u2013]?\s*|fyi\b[:,\-\s]*|for\s+the\s+record[:,\-\s]*|remember\s+that\s+)/i;
  var ACTION = /\b(send|share|call|email|ask|chase|check|book|confirm|draft|write|review|sign|deliver|follow\s*up|get|fix|prepare|schedule|pay|return|revert|decide)\b/i;
  var URGENT = /\b(urgent|asap|immediately|today|right away|eod|by end of day)\b/i;
  var STOP = /^(I|We|The|A|An|They|He|She|It|My|Our|Their|This|That|Please|Need|Needs|Note|Also|And|But|Then|Next|Today|Tomorrow|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/;

  function pad(n){ return ("0" + n).slice(-2); }
  function iso(d){ return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }

  function resolveDue(text, today){
    var m = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    if(m) return m[1];
    var base = new Date(today.getTime());
    if(/\btomorrow\b/i.test(text)){ base.setDate(base.getDate() + 1); return iso(base); }
    if(/\btoday\b|\beod\b/i.test(text)) return iso(base);
    if(/\bday after tomorrow\b/i.test(text)){ base.setDate(base.getDate() + 2); return iso(base); }
    var wd = text.match(/\b(?:by|on|before|this|next)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i)
          || text.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
    if(wd){
      var want = WEEKDAYS.indexOf(wd[1].toLowerCase());
      var delta = (want - base.getDay() + 7) % 7;
      if(delta === 0) delta = 7;
      if(/\bnext\b/i.test(text)) delta += 7;
      base.setDate(base.getDate() + delta);
      return iso(base);
    }
    if(/\bnext week\b/i.test(text)){ base.setDate(base.getDate() + 7); return iso(base); }
    if(/\bend of (?:the )?week\b/i.test(text)){
      base.setDate(base.getDate() + ((5 - base.getDay() + 7) % 7 || 7));
      return iso(base);
    }
    var dom = text.match(/\bthe\s+(\d{1,2})(?:st|nd|rd|th)\b/i);
    if(dom){
      var d2 = new Date(today.getFullYear(), today.getMonth(), +dom[1]);
      if(d2 < today) d2 = new Date(today.getFullYear(), today.getMonth() + 1, +dom[1]);
      return iso(d2);
    }
    return "";                              // rule 3: never invent a date
  }

  function counterpartyOf(text){
    var m = text.match(/\b(?:to|from|with|for|ask|chase|tell|call|email|remind)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
    if(m) return m[1];
    var words = text.split(/\s+/);
    for(var i = 0; i < words.length; i++){
      var w = words[i].replace(/[^A-Za-z]/g, "");
      if(/^[A-Z][a-z]{2,}$/.test(w) && !STOP.test(w) && !(i === 0)) return w;
      if(i === 0 && /^[A-Z][a-z]{2,}$/.test(w) && !STOP.test(w) && THEIRS.test(text)) return w;
    }
    return "";
  }

  function titleOf(text){
    var t = text.replace(/\s+/g, " ").trim().replace(/[.,;]+$/, "");
    var words = t.split(" ");
    if(words.length > 12) t = words.slice(0, 12).join(" ");
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  /* A deliberately dumb stand-in for Claude: enough structure to exercise the
     draft UI, never good enough to mistake for the real intake. */
  function fakeIntake(prompt){
    var raw = "";
    var m = prompt.match(/<<<\n([\s\S]*)\n>>>/);
    if(m) raw = m[1];
    var today = new Date();
    var td = prompt.match(/Today is (\d{4})-(\d{2})-(\d{2})/);
    if(td) today = new Date(+td[1], +td[2] - 1, +td[3]);

    var subjects = [];
    var sm = prompt.match(/^Subjects[^:]*: (\[.*\])$/m);
    if(sm){ try{ subjects = JSON.parse(sm[1]); }catch(e){} }

    var chunks = [];
    raw.split(/\n+/).forEach(function(line){
      line.trim().split(/(?:\.\s+|;\s+|\s+and then\s+)/).forEach(function(c){
        c = c.trim();
        if(c) chunks.push(c);
      });
    });

    return chunks.slice(0, 8).map(function(c){
      var isNote = NOTE_START.test(c) || !ACTION.test(c);
      var subject = "";
      subjects.forEach(function(s){
        if(!subject && s && s.name && c.toLowerCase().indexOf(String(s.name).toLowerCase()) !== -1) subject = s.id;
      });
      var body = c.replace(NOTE_START, "").trim();
      if(isNote){
        return {kind: "note", body: body.charAt(0).toUpperCase() + body.slice(1), subject: subject,
                title: "", direction: "mine", counterparty: "", due: "", priority: "normal", next_action: ""};
      }
      return {
        kind: "task",
        title: titleOf(c),
        direction: THEIRS.test(c) ? "theirs" : "mine",
        counterparty: counterpartyOf(c),
        subject: subject,
        due: resolveDue(c, today),
        priority: URGENT.test(c) ? "high" : "normal",
        next_action: ""
      };
    });
  }

  /* Tolerant parse, same order the contract describes. */
  function parseTolerant(text){
    try{ return JSON.parse(text); }catch(e){}
    var fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if(fence){ try{ return JSON.parse(fence[1]); }catch(e){} }
    var s = text.search(/[\[{]/), e2 = Math.max(text.lastIndexOf("]"), text.lastIndexOf("}"));
    if(s !== -1 && e2 > s){ try{ return JSON.parse(text.slice(s, e2 + 1)); }catch(e){} }
    return undefined;
  }

  function run(input, options){
    options = options || {};
    var prompt = typeof input === "string" ? input
      : (Array.isArray(input) ? input.map(function(t){ return t && t.content; }).join("\n") : "");
    if(!prompt) return Promise.reject(err("invalid_request", "mock sample: input is empty"));
    if(prompt.length > 64 * 1024) return Promise.reject(err("prompt_too_large", "mock sample: over 64 KiB"));

    return new Promise(function(resolve, reject){
      var done = false;
      var timer = setTimeout(function(){
        if(done) return;
        done = true;
        if(sampleFailure){
          var code = sampleFailure;
          sampleFailure = null;                 // one shot, like a real refusal you can retry past
          reject(err(code, "mock sample: injected " + code));
          return;
        }
        var text = JSON.stringify(fakeIntake(prompt), null, 2);
        if(typeof options.onText === "function") options.onText({text: text, delta: text});
        resolve(text);
      }, SAMPLE_MS);
      if(options.signal){
        if(options.signal.aborted){ done = true; clearTimeout(timer); reject(err("cancelled", "mock sample: aborted")); }
        else options.signal.addEventListener("abort", function(){
          if(done) return;
          done = true; clearTimeout(timer);
          reject(err("cancelled", "mock sample: aborted"));
        });
      }
    });
  }

  var sample = function(input, options){ return run(input, options); };
  sample.json = function(input, options){
    return run(input, options).then(function(text){
      var value = parseTolerant(text);
      if(value === undefined) throw {code: "invalid_json", message: "mock sample: no JSON in the reply", text: text};
      return value;
    });
  };
  sample.limits = function(){ return Promise.resolve({maxInputBytes: 64 * 1024}); };
  Object.freeze(sample);

  /* ================= claude.use ================= */
  load();

  var dbOff     = params.get("db") === "none";
  var sampleOff = params.get("sample") === "none";
  var promises  = {};                            // use() is memoized per name

  window.claude = Object.freeze({
    use: function(name){
      if(name === "db"){
        if(dbOff){ log("use(\"db\") -> null (?db=none)"); return Promise.resolve(null); }
        if(!promises.db) promises.db = later(120, function(){ log("use(\"db\") -> mock store"); return db; });
        return promises.db;
      }
      if(name === "sample"){
        if(sampleOff){ log("use(\"sample\") -> null (?sample=none)"); return Promise.resolve(null); }
        if(!promises.sample) promises.sample = later(150, function(){ log("use(\"sample\") -> fake intake"); return sample; });
        return promises.sample;
      }
      return Promise.resolve(null);
    }
  });

  window.__ledgerMock = {
    dump: function(){ return clone(store); },
    reset: function(){
      try{ window.localStorage.removeItem(STORE_KEY); }catch(e){}
      window.location.search = "?fresh";
    },
    failNext: function(code){ sampleFailure = code || "upstream_error"; log("next sample.json will reject:", sampleFailure); },
    fail: function(code){ writeFailure = code === null ? null : (code || "unavailable"); log("db writes:", writeFailure || "ok"); },
    store: function(){ return store; }
  };

  log("ready — window.__ledgerMock for the handles, ?fresh to reseed");
})();
