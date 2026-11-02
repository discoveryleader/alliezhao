/* Work Journal — app
   A small hash-routed single-page app. Views return HTML strings; one set of
   delegated listeners handles every interaction. */
(function () {
  'use strict';

  var S = window.WJStore;
  var T = S.ENTRY_TYPES;
  var $app = document.getElementById('app');

  // Screen state that doesn't need to persist
  var ui = {
    quickType: 'Insight', qTitle: '', qNote: '', qProject: null,
    projStatus: 'All', projView: 'grid', projQ: '', showArchived: false,
    tlFilter: 'All', tlQ: '',
    np: null, npKey: null,
    fe: null, feKey: null,
    openPrompts: {},
    searchQ: ''
  };
  var route = { name: 'home', params: {}, query: {} };
  var lastRouteKey = '';

  // ---------- Helpers ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function nl2br(s) { return esc(s).replace(/\n/g, '<br>'); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function time12(d) {
    var h = d.getHours(), m = d.getMinutes();
    return ((h % 12) || 12) + ':' + (m < 10 ? '0' : '') + m + ' ' + (h < 12 ? 'AM' : 'PM');
  }
  function shortDate(ts) {
    var d = new Date(ts), now = new Date();
    var s = MONTHS[d.getMonth()] + ' ' + d.getDate();
    return d.getFullYear() === now.getFullYear() ? s : s + ', ' + d.getFullYear();
  }
  function longDate(ts) {
    var d = new Date(ts);
    return DAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() + ' · ' + time12(d);
  }
  function nowStamp() {
    var d = new Date();
    return DAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate() + ' · ' + time12(d);
  }
  function rel(ts) {
    var diff = Date.now() - ts;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    if (diff < 2 * 86400000) return 'Yesterday';
    if (diff < 7 * 86400000) return Math.floor(diff / 86400000) + ' days ago';
    if (diff < 28 * 86400000) return Math.floor(diff / (7 * 86400000)) + ' wk ago';
    return shortDate(ts);
  }
  function weekOf(ts) {
    var d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.getTime();
  }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'journal'; }
  function typeStyle(type) { return T[type] || T['Reflection']; }
  function typeTag(type, extra) {
    var t = typeStyle(type);
    return `<span class="tag-type" style="background:${t.bg};color:${t.fg}${extra || ''}">${esc(type)}</span>`;
  }
  function projectStatusPill(status) {
    var s = S.PROJECT_STATUS[status] || S.PROJECT_STATUS.Active;
    return `<span class="pill-status" style="background:${s.bg};color:${s.fg}"><span class="dot" style="background:${s.dot}"></span>${esc(status)}</span>`;
  }
  function decisionPill(status) {
    var s = S.DECISION_STATUS[status] || S.DECISION_STATUS.Proposed;
    return `<span class="pill-status" style="background:${s.bg};color:${s.fg};border-color:${s.border}">${esc(status)}</span>`;
  }
  function lines(s) { return String(s || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean); }
  function visibleProjects() {
    return S.data.projects.filter(function (p) { return !p.archived; })
      .sort(function (a, b) { return S.lastActivity(b.id) - S.lastActivity(a.id); });
  }
  function defaultProjectId() {
    var last = S.data.settings.lastProjectId;
    if (last && S.project(last) && !S.project(last).archived) return last;
    var v = visibleProjects();
    return v.length ? v[0].id : null;
  }
  function highlight(text, q) {
    var safe = esc(text);
    if (!q) return safe;
    var re = new RegExp('(' + esc(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
    return safe.replace(re, '<mark>$1</mark>');
  }
  function snippet(text, n) {
    text = String(text || '').replace(/\s+/g, ' ').trim();
    return text.length > n ? text.slice(0, n - 1).trim() + '…' : text;
  }

  // ---------- Icons ----------
  var I = {
    logo: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2"></rect><path d="M9 3v18M12 8h4M12 12h4"></path></svg>',
    plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>',
    plus14: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>',
    plus18: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>',
    home: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"></path></svg>',
    folder: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z"></path></svg>',
    folderPlus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z"></path><path d="M12 10.5v5M9.5 13h5" stroke-linecap="round"></path></svg>',
    timeline: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M6 4v16M6 7h12M6 12h8M6 17h10"></path></svg>',
    book: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"></path></svg>',
    sliders: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"></path><circle cx="16" cy="7" r="2"></circle><circle cx="10" cy="17" r="2"></circle></svg>',
    search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"></circle><path d="m20 20-4.2-4.2"></path></svg>',
    arrowR: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>',
    arrowR14: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>',
    arrowL: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"></path></svg>',
    download: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"></path></svg>',
    image: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="1.5"></rect><circle cx="9" cy="10" r="1.6"></circle><path d="m4 18 5-5 4 4 3-3 4 4"></path></svg>',
    image20: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="1.5"></rect><circle cx="9" cy="10" r="1.6"></circle><path d="m4 18 5-5 4 4 3-3 4 4"></path></svg>',
    link: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"></path></svg>',
    lock: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true" style="flex:none;margin-top:2px"><rect x="5" y="11" width="14" height="9" rx="1.5"></rect><path d="M8 11V8a4 4 0 0 1 8 0v3"></path></svg>',
    x: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"></path></svg>',
    dots: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.6"></circle><circle cx="12" cy="12" r="1.6"></circle><circle cx="19" cy="12" r="1.6"></circle></svg>',
    grid: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1"></rect><rect x="13" y="4" width="7" height="7" rx="1"></rect><rect x="4" y="13" width="7" height="7" rx="1"></rect><rect x="13" y="13" width="7" height="7" rx="1"></rect></svg>',
    list: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"></path></svg>',
    archive: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="4" rx="1"></rect><path d="M5 8.5v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-10M10 12.5h4"></path></svg>',
    check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"></path></svg>',
    check12: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"></path></svg>',
    info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" style="flex:none;margin-top:2px"><circle cx="12" cy="12" r="9"></circle><path d="M12 7.5v5.5M12 16.5v.01"></path></svg>',
    revisit: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4"></path></svg>',
    chevron: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg>'
  };

  // ---------- Shell ----------
  function sidebar(active) {
    var name = S.data.settings.name || 'You';
    function link(key, href, icon, label) {
      return `<a class="side-link" href="${href}"${active === key ? ' aria-current="page"' : ''}>${icon}${label}</a>`;
    }
    return `<nav class="sidebar" aria-label="Primary">
      <a class="brand" href="#/">${I.logo}<span>Work Journal</span></a>
      <a class="new-entry-btn" href="#/entry/new"><span class="row">${I.plus}New entry</span><span class="kb">⌘ J</span></a>
      <div class="side-nav">
        ${link('home', '#/', I.home, 'Home')}
        ${link('projects', '#/projects', I.folder, 'Projects')}
        ${link('timeline', '#/timeline', I.timeline, 'Timeline')}
        <span class="side-link disabled"><span class="row" style="gap:10px">${I.book}Case studies</span><span class="phase-tag">Phase 2</span></span>
        ${link('settings', '#/settings', I.sliders, 'Settings')}
      </div>
      <div class="side-user"><span class="avatar" aria-hidden="true">${esc(name.charAt(0).toUpperCase())}</span><span>${esc(name)}</span></div>
    </nav>`;
  }
  function appShell(active, inner) {
    return `<div class="shell">${sidebar(active)}<main class="main" id="main">${inner}</main></div>`;
  }
  function emptyState(msg, href, cta) {
    return `<p class="empty-note">${msg}${href ? ` <a href="${href}">${cta}</a>` : ''}</p>`;
  }

  // ---------- Views ----------
  function viewHome() {
    var st = S.data.settings;
    var h = new Date().getHours();
    var greet = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    var projects = visibleProjects();
    if (!ui.qProject || !S.project(ui.qProject)) ui.qProject = defaultProjectId();

    // Quick capture
    var capture;
    if (!projects.length) {
      capture = `<div class="continue"><div class="stack-4" style="flex:1 1 320px"><span class="h3">Start with a project</span><span class="small muted">Entries live inside a project. Only a name is required.</span></div><a class="btn btn-primary" href="#/projects/new">${I.plus}New project</a></div>`;
    } else {
      var qp = S.project(ui.qProject);
      var qpDot = (S.PROJECT_STATUS[qp.status] || S.PROJECT_STATUS.Active).dot;
      var chips = S.QUICK_TYPES.map(function (q) {
        return `<button type="button" class="chip" aria-pressed="${ui.quickType === q[0]}" data-action="quick-type" data-value="${q[0]}">${q[0]}</button>`;
      }).join('');
      capture = `<form class="capture" aria-label="Quick journal entry" data-form="quick">
        <div class="capture-body">
          <label for="qtitle" class="sr-only">Entry title</label>
          <input id="qtitle" class="bare-input capture-title" type="text" autocomplete="off" data-ui="qTitle" value="${esc(ui.qTitle)}" placeholder="Title — e.g. “Why the planner felt heavy”">
          <label for="qnote" class="sr-only">Note</label>
          <textarea id="qnote" class="bare-input capture-note autogrow" rows="3" data-ui="qNote" placeholder="A sentence or two is enough. What did you notice, decide, or wonder about?">${esc(ui.qNote)}</textarea>
        </div>
        <div class="capture-foot">
          <span class="select-wrap"><span class="dot" style="background:${qpDot}"></span>
            <label for="qproject" class="sr-only">Project</label>
            <select id="qproject" class="select-pill" data-ui="qProject" data-rerender="1">${projects.map(function (p) { return `<option value="${p.id}"${p.id === ui.qProject ? ' selected' : ''}>${esc(p.name)}</option>`; }).join('')}</select>
          </span>
          <span class="vsep" aria-hidden="true"></span>
          <div role="group" aria-label="Entry type" class="row-wrap" style="gap:6px">${chips}</div>
          <div class="row push-right" style="margin-left:auto">
            <button type="button" class="btn btn-link" data-action="quick-full">Open full template</button>
            <button type="submit" class="btn btn-primary btn-sm">Save entry<span class="kb">⌘ ↵</span></button>
          </div>
        </div>
      </form>`;
    }

    // Reminder nudge
    var nudge = '';
    if (st.reminder && reminderDue()) {
      nudge = `<div class="note-ok" role="status"><span style="flex:1 1 280px"><strong>Gentle reminder:</strong> nothing written yet today. A title and a line is enough.</span><button type="button" class="btn btn-xs btn-soft" data-action="focus-capture">Write now</button></div>`;
    }

    // Continue writing
    var drafts = S.data.entries.filter(function (e) {
      var p = S.project(e.projectId); return e.draft && e.type !== 'Milestone' && p && !p.archived;
    }).sort(function (a, b) { return b.updatedAt - a.updatedAt; });
    var cont = '';
    if (drafts.length) {
      var d = drafts[0], dp = S.project(d.projectId);
      cont = `<section aria-labelledby="cont" class="continue">
        <div class="stack-4" style="flex:1 1 360px">
          <h2 id="cont" class="label">Continue writing · autosaved ${rel(d.updatedAt)}</h2>
          <p class="serif" style="font-size:20px">${esc(d.title || 'Untitled entry')}</p>
          <div class="row-wrap small muted" style="gap:12px">${typeTag(d.type)}<span>${esc(dp.name)}</span>${d.mode === 'structured' ? `<span>${S.answeredCount(d)} of 5 prompts answered</span>` : ''}</div>
        </div>
        <a class="btn btn-outline" href="#/entry/${d.id}">Resume entry${I.arrowR}</a>
      </section>`;
    }

    // Recent projects
    var recent = projects.slice(0, 3).map(function (p) {
      var stt = S.projectStats(p.id), sc = S.PROJECT_STATUS[p.status];
      return `<a class="pcard" href="#/p/${p.id}">
        <div class="between" style="align-items:center"><span class="type">${esc(p.type)}</span><span class="row xsmall" style="gap:6px;color:var(--ink3)"><span class="dot" style="background:${sc.dot}"></span>${p.status}</span></div>
        <span class="name">${esc(p.name)}</span>
        <span class="goal">${esc(snippet(p.summary || p.problem, 90))}</span>
        <span class="foot"><span>${plural(stt.entries, 'entry', 'entries')} · ${plural(stt.decisions, 'decision')}</span><span style="margin-left:auto">${rel(S.lastActivity(p.id))}</span></span>
      </a>`;
    }).join('');

    // Recent decisions
    var decs = S.data.decisions.filter(function (d) { var p = S.project(d.projectId); return p && !p.archived; })
      .sort(function (a, b) { return b.createdAt - a.createdAt; }).slice(0, 4);
    var decList = decs.length ? `<ul class="card list-card">${decs.map(function (d) {
      var p = S.project(d.projectId);
      return `<li><a class="row-link" href="#/decision/${d.id}"><span class="stack-4" style="flex:1"><span style="font-weight:500;line-height:1.35">${esc(d.title)}</span><span class="small muted2">${esc(p.name)} · ${shortDate(d.createdAt)} · ${d.evidence.length ? plural(d.evidence.length, 'evidence', 'evidence') : 'No evidence yet'}</span></span>${decisionPill(d.status)}</a></li>`;
    }).join('')}</ul>` : `<div class="card empty-inline">No decisions yet. When you weigh options in an entry, turn it into a decision record.</div>`;

    // Ready to synthesize
    var ready = S.data.projects.filter(function (p) { return !p.archived && p.status === 'Completed'; })
      .map(function (p) { return { p: p, c: S.coverage(p.id), s: S.projectStats(p.id) }; })
      .filter(function (x) { return x.c.done >= 4; })
      .sort(function (a, b) { return b.s.entries - a.s.entries; })[0];
    var readyHtml = ready ? `<section aria-labelledby="ready" class="panel-sand row-wrap" style="gap:16px 32px;padding:22px">
        <div class="stack-6" style="flex:1 1 380px">
          <h2 id="ready" class="h2-sm">${esc(ready.p.name)} has enough material for a story</h2>
          <p style="font-size:14px;color:var(--ink3)">Completed project · ${plural(ready.s.entries, 'entry', 'entries')} · ${plural(ready.p && S.decisionsOf(ready.p.id).filter(function (d) { return d.evidence.length; }).length, 'decision')} with linked evidence. The case-study builder is coming in Phase 2 — for now, export the journal as Markdown.</p>
        </div>
        <button type="button" class="btn btn-soft" data-action="export-md" data-id="${ready.p.id}">${I.download}Export Markdown</button>
      </section>` : '';

    return appShell('home', `<div class="container w-1080 gap-40">
      <div class="row-wrap" style="justify-content:space-between;gap:12px">
        <form class="search-field" style="flex:1 1 320px;max-width:480px" role="search" data-form="search">
          ${I.search}<label for="gsearch" class="sr-only">Search</label>
          <input id="gsearch" type="search" name="q" placeholder="Search entries, decisions, evidence" autocomplete="off">
          <span class="kb">⌘ K</span>
        </form>
        <div class="row" style="gap:16px"><span class="mono xsmall muted2" id="clock">${nowStamp()}</span>
          <a class="btn btn-outline" href="#/projects/new">${I.folderPlus}New project</a></div>
      </div>

      <section aria-labelledby="greet" class="stack-20">
        <div class="stack-6"><h1 id="greet" class="h1">${greet}, ${esc(st.name || 'there')}.</h1>
          <p class="lede-serif">What happened in your work today? Capture the thought before it disappears.</p></div>
        ${nudge}
        ${capture}
        ${projects.length ? '<p class="small muted2" style="margin-top:-8px">A title and a note is a complete entry. Reflection prompts can wait until you have time.</p>' : ''}
      </section>

      ${cont}

      <div class="grid-2col">
        <section aria-labelledby="projs" class="stack-14">
          <div class="between"><h2 id="projs" class="h2">Recent projects</h2>
            <span class="row" style="gap:16px"><a href="#/projects/new" style="font-size:14px;font-weight:600">+ New project</a><a href="#/projects" style="font-size:14px">All projects</a></span></div>
          <div class="grid-cards">
            <a class="new-tile" href="#/projects/new"><span class="plus" aria-hidden="true">${I.plus18}</span>New project</a>
            ${recent}
          </div>
        </section>
        <section aria-labelledby="decs" class="stack-14">
          <div class="between"><h2 id="decs" class="h2">Recent decisions</h2><a href="#/timeline" style="font-size:14px">See in timeline</a></div>
          ${decList}
        </section>
      </div>
      ${readyHtml}
    </div>`);
  }

  function reminderDue() {
    var st = S.data.settings, now = new Date(), day = now.getDay(), h = now.getHours();
    var due = st.reminderTime === 'Fridays 4 PM' ? (day === 5 && h >= 16)
      : st.reminderTime === 'Every day 6 PM' ? h >= 18
      : (day >= 1 && day <= 5 && h >= 17);
    if (!due) return false;
    var start = new Date(); start.setHours(0, 0, 0, 0);
    return !S.data.entries.some(function (e) { return e.createdAt >= start.getTime() && (e.title || e.note); });
  }

  function viewProjects() {
    var base = S.data.projects.filter(function (p) { return !!p.archived === ui.showArchived; });
    var all = base.slice().sort(function (a, b) { return S.lastActivity(b.id) - S.lastActivity(a.id); });
    var archivedCount = S.data.projects.filter(function (p) { return p.archived; }).length;
    var totalEntries = 0;
    S.data.projects.forEach(function (p) { if (!p.archived) totalEntries += S.journalEntriesOf(p.id).length; });
    var tabs = ['All', 'Active', 'Paused', 'Completed'].map(function (k) {
      var n = k === 'All' ? all.length : all.filter(function (p) { return p.status === k; }).length;
      return `<button type="button" aria-pressed="${ui.projStatus === k}" data-action="proj-status" data-value="${k}">${k}<span class="count">${n}</span></button>`;
    }).join('');
    var q = ui.projQ.trim().toLowerCase();
    var shown = all.filter(function (p) {
      return (ui.projStatus === 'All' || p.status === ui.projStatus) &&
        (!q || (p.name + ' ' + p.summary + ' ' + p.type).toLowerCase().indexOf(q) >= 0);
    });

    var body;
    if (ui.projView === 'grid') {
      body = `<div class="grid-projects">${shown.map(function (p) {
        var s = S.projectStats(p.id), cov = S.coverage(p.id), latest = S.journalEntriesOf(p.id)[0];
        return `<article class="card project-article">
          <div class="row"><span class="mono" style="font-size:11px;letter-spacing:0.04em;text-transform:uppercase;color:var(--muted2)">${esc(p.client ? 'Client · ' + p.type : p.type)}</span><span class="spacer"></span>${projectStatusPill(p.status)}
            <button type="button" class="icon-btn bare sm" aria-label="More actions for ${esc(p.name)}" data-action="project-menu" data-id="${p.id}">${I.dots}</button></div>
          <div class="stack-6"><h2 class="serif" style="font-weight:400;font-size:24px;line-height:1.2"><a href="#/p/${p.id}">${esc(p.name)}</a></h2>
            <p style="font-size:14px" class="muted">${esc(p.summary || 'No summary yet.')}</p></div>
          <dl class="stats"><div class="stack"><dt>Entries</dt><dd>${s.entries}</dd></div><div class="stack"><dt>Decisions</dt><dd>${s.decisions}</dd></div><div class="stack"><dt>Evidence</dt><dd>${s.evidence}</dd></div></dl>
          <div class="stack-4"><span class="mono" style="font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:var(--muted2)">Latest · ${rel(S.lastActivity(p.id))}</span>
            <span style="font-size:14px;color:var(--ink2)">${latest ? esc(latest.title || snippet(latest.note, 60)) : 'No entries yet'}</span></div>
          <div class="row-wrap" style="margin-top:auto">
            <a class="btn btn-soft btn-sm" href="#/p/${p.id}">Open</a>
            <a class="btn btn-link" href="#/entry/new?project=${p.id}" style="font-weight:600">${I.plus14}Entry</a>
            <span class="spacer"></span><span class="xsmall muted">Story coverage ${cov.done} of 5</span>
          </div>
        </article>`;
      }).join('')}${ui.showArchived ? '' : `<a class="new-tile tall" href="#/projects/new"><span class="plus" aria-hidden="true" style="width:44px;height:44px">${I.plus18}</span>New project<span class="small muted" style="font-weight:400">Only a name is required</span></a>`}</div>`;
    } else {
      body = shown.length ? `<div class="card table-wrap"><table class="plain"><thead><tr><th scope="col">Project</th><th scope="col">Status</th><th scope="col">Entries</th><th scope="col">Decisions</th><th scope="col">Evidence</th><th scope="col">Last entry</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>${shown.map(function (p) {
        var s = S.projectStats(p.id);
        return `<tr><td><a href="#/p/${p.id}"><span class="serif" style="font-size:18px">${esc(p.name)}</span><span class="xsmall muted2">${esc(p.type)}</span></a></td><td>${projectStatusPill(p.status)}</td><td class="mono">${s.entries}</td><td class="mono">${s.decisions}</td><td class="mono">${s.evidence}</td><td style="color:var(--ink3)">${rel(S.lastActivity(p.id))}</td><td><button type="button" class="icon-btn bare sm" aria-label="More actions for ${esc(p.name)}" data-action="project-menu" data-id="${p.id}">${I.dots}</button></td></tr>`;
      }).join('')}</tbody></table></div>` : '';
    }
    var empty = !shown.length ? emptyState(ui.showArchived ? 'No archived projects.' : 'No projects match.', ui.showArchived ? '' : '#/projects/new', 'Start a new one') : '';

    return appShell('projects', `<div class="container w-1120 gap-24">
      <header class="row-wrap" style="align-items:flex-end;justify-content:space-between;gap:16px;padding-top:16px">
        <div class="stack-6"><h1 class="h1">${ui.showArchived ? 'Archived projects' : 'Projects'}</h1>
          <p class="muted">${ui.showArchived ? plural(all.length, 'archived project') : plural(all.length, 'project') + ' · ' + plural(totalEntries, 'journal entry', 'journal entries') + ' · private to you'}</p></div>
        <a class="btn btn-primary" href="#/projects/new">${I.plus}New project</a>
      </header>
      <div class="row-wrap" style="gap:12px">
        <label class="search-field" style="flex:1 1 260px;max-width:360px;padding:0 12px">${I.search}<span class="sr-only">Search projects</span>
          <input id="projq" type="search" placeholder="Search projects" data-ui="projQ" data-rerender="1" value="${esc(ui.projQ)}"></label>
        <div role="group" aria-label="Filter by status" class="segmented">${tabs}</div>
        <span class="spacer"></span>
        <span class="small muted">Sorted by last entry</span>
        <div role="group" aria-label="Layout" class="segmented icons">
          <button type="button" aria-label="Grid view" aria-pressed="${ui.projView === 'grid'}" data-action="proj-view" data-value="grid">${I.grid}</button>
          <button type="button" aria-label="List view" aria-pressed="${ui.projView === 'list'}" data-action="proj-view" data-value="list">${I.list}</button>
        </div>
      </div>
      ${body}${empty}
      <button type="button" class="btn btn-ghost" style="align-self:flex-start;padding:0 8px;font-size:14px;color:var(--ink3)" data-action="toggle-archived">${I.archive}${ui.showArchived ? 'Back to current projects' : 'Archived projects (' + archivedCount + ')'}</button>
    </div>`);
  }

  var CONTEXT_FIELDS = [
    { id: 'summary', label: 'Summary', prompt: 'In one or two sentences, what is this project?', placeholder: 'A redesign of the task app’s first-run and daily start experience.' },
    { id: 'problem', label: 'Problem statement', prompt: 'What isn’t working today, and for whom?', placeholder: 'Describe the problem in the user’s terms.' },
    { id: 'users', label: 'Target users', prompt: 'Who are you designing for?', placeholder: 'e.g. People who open the app intending to work but stall before starting' },
    { id: 'goals', label: 'Goals & success criteria', prompt: 'How will you know it worked? Leave targets blank until you have a baseline.', placeholder: 'One goal per line' },
    { id: 'constraints', label: 'Constraints & assumptions', prompt: 'What limits the solution, and what are you assuming but haven’t proven?', placeholder: 'One per line. Start a line with “Assumption:” to mark it.' }
  ];

  function viewProjectForm(editId) {
    var p = editId ? S.project(editId) : null;
    if (editId && !p) return viewNotFound();
    var key = editId ? 'edit:' + editId : 'new';
    if (ui.npKey !== key) {
      ui.npKey = key;
      ui.np = p ? { name: p.name, type: p.type, status: p.status, open: true, summary: p.summary, problem: p.problem, users: p.users, goals: p.goals, constraints: p.constraints }
        : { name: '', type: 'Redesign', status: 'Active', open: true, summary: '', problem: '', users: '', goals: '', constraints: '' };
    }
    var np = ui.np;
    var types = S.PROJECT_TYPES.map(function (t) {
      return `<button type="button" class="chip chip-lg" aria-pressed="${np.type === t}" data-action="np-type" data-value="${t}">${t}</button>`;
    }).join('');
    var statuses = ['Active', 'Paused', 'Completed'].map(function (s) {
      return `<button type="button" aria-pressed="${np.status === s}" data-action="np-status" data-value="${s}">${s}</button>`;
    }).join('');
    var fields = CONTEXT_FIELDS.map(function (f) {
      return `<div class="fld"><label for="np-${f.id}" class="field-label" style="font-size:14px">${f.label}</label>
        <span class="prompt-hint">${f.prompt}</span>
        <textarea id="np-${f.id}" class="text-area autogrow" rows="2" data-np="${f.id}" placeholder="${esc(f.placeholder)}">${esc(np[f.id])}</textarea></div>`;
    }).join('');
    var can = !!np.name.trim();
    var crumbs = p ? `<a href="#/projects">Projects</a><span aria-hidden="true">/</span><a href="#/p/${p.id}">${esc(p.name)}</a><span aria-hidden="true">/</span><span>Edit details</span>`
      : `<a href="#/projects">Projects</a><span aria-hidden="true">/</span><span>New project</span>`;
    var actions = p
      ? `<a class="btn btn-ghost" href="#/p/${p.id}">Cancel</a><span class="spacer"></span><button type="submit" class="btn btn-primary" id="np-save"${can ? '' : ' disabled'}>Save changes</button>`
      : `<a class="btn btn-ghost" href="#/">Cancel</a><span class="spacer"></span>
         <button type="submit" class="btn btn-outline np-req" data-then="overview"${can ? '' : ' disabled'}>Create project</button>
         <button type="submit" class="btn btn-primary np-req" data-then="first"${can ? '' : ' disabled'}>Create &amp; write first entry${I.arrowR}</button>`;

    return appShell('projects', `<form class="container w-720 gap-32" aria-labelledby="np-title" data-form="project" data-edit="${editId || ''}">
      <nav aria-label="Breadcrumb" class="breadcrumb">${crumbs}</nav>
      <div class="stack-8"><h1 id="np-title" class="h1">${p ? 'Edit project details' : 'Start a project'}</h1>
        <p class="lede">${p ? 'Update the context as your understanding changes — entries stay intact either way.' : 'Only a name is required. Add the context now or whenever you understand it better — your entries stay intact either way.'}</p></div>
      <div class="stack-8"><label for="pname" class="field-label">Project name <span style="font-weight:400" class="muted2">(required)</span></label>
        <input id="pname" class="text-input big" type="text" autocomplete="off" data-np="name" value="${esc(np.name)}" placeholder="e.g. Do-It-Now redesign" required></div>
      <fieldset style="margin:0;padding:0;border:0" class="stack-10"><legend class="field-label" style="padding:0;margin-bottom:10px">Project type</legend><div class="row-wrap">${types}</div></fieldset>
      <fieldset style="margin:0;padding:0;border:0" class="stack-10"><legend class="field-label" style="padding:0;margin-bottom:10px">Status</legend><div class="segmented">${statuses}</div></fieldset>
      <section class="card stack">
        <button type="button" class="collapse-head" aria-expanded="${np.open}" data-action="np-toggle">
          <span class="stack"><span class="strong">Project context</span><span class="small muted2">Optional · helps you and your future case study remember why this project mattered</span></span>
          <span class="mono xsmall" style="color:var(--ink3)">${np.open ? 'Hide' : 'Add now'}</span>
        </button>
        ${np.open ? `<div class="collapse-body">${fields}</div>` : ''}
      </section>
      <div class="privacy">${I.lock}<span>Projects are private by default — everything is stored only in this browser. Avoid storing identifiable research participant data unless you have permission.</span></div>
      <div class="form-foot">${actions}</div>
    </form>`);
  }

  function projectHeader(p, tab) {
    var s = S.projectStats(p.id);
    var t = function (key, href, label, count) {
      return `<a href="${href}"${tab === key ? ' aria-current="page"' : ''}>${label}${count != null ? ` <span class="count">${count}</span>` : ''}</a>`;
    };
    return `<header class="stack-16">
      <nav aria-label="Breadcrumb" class="breadcrumb"><a href="#/projects">Projects</a><span aria-hidden="true">/</span><span>${esc(p.name)}</span></nav>
      <div class="row-wrap" style="align-items:flex-end;justify-content:space-between;gap:16px">
        <div class="stack-8">
          <div class="row-wrap small muted" style="gap:10px">${projectStatusPill(p.status)}<span class="mono xsmall">${esc(p.type)} · Started ${shortDate(p.createdAt)} · Updated ${rel(S.lastActivity(p.id))}</span>${p.archived ? '<span class="outline-tag">Archived</span>' : ''}</div>
          <h1 class="h1">${esc(p.name)}</h1>
        </div>
        <div class="row-wrap">
          <a class="btn btn-soft" href="#/p/${p.id}/edit">Edit details</a>
          <button type="button" class="btn btn-soft" data-action="export-md" data-id="${p.id}">${I.download}Export Markdown</button>
          <a class="btn btn-primary" href="#/entry/new?project=${p.id}">${I.plus}New entry</a>
        </div>
      </div>
      <nav aria-label="Project sections" class="tabs">
        ${t('overview', '#/p/' + p.id, 'Overview')}
        ${t('timeline', '#/p/' + p.id + '/timeline', 'Journal', s.entries)}
        ${t('decisions', '#/p/' + p.id + '/decisions', 'Decisions', s.decisions)}
        ${t('evidence', '#/p/' + p.id + '/evidence', 'Evidence', s.evidence)}
        <span>Case study <span class="phase-tag">Phase 2</span></span>
      </nav>
    </header>`;
  }

  function contextBlock(label, text, asList) {
    var body;
    if (!text || !String(text).trim()) body = `<p class="small muted2">Not written yet.</p>`;
    else if (asList) body = `<ul style="padding-left:18px;list-style:disc;font-size:14px;color:var(--ink2)">${lines(text).map(function (l) {
      var m = l.match(/^assumption:\s*(.*)$/i);
      return `<li>${m ? `<span style="font-weight:600;color:var(--amber-ink)">Assumption:</span> ${esc(m[1])}` : esc(l)}</li>`;
    }).join('')}</ul>`;
    else body = `<p style="font-size:14px;color:var(--ink2)">${nl2br(text)}</p>`;
    return `<div class="stack-6"><h3 class="eyebrow">${label}</h3>${body}</div>`;
  }

  function entryMeta(e) {
    if (e.draft) return 'Draft' + (e.mode === 'structured' ? ' · ' + S.answeredCount(e) + '/5 prompts' : '') + (e.evidence.length ? ' · ' + plural(e.evidence.length, 'evidence', 'evidence') : '');
    return e.evidence.length ? plural(e.evidence.length, 'evidence', 'evidence') : (e.mode === 'structured' ? S.answeredCount(e) + '/5 prompts' : 'Quick note');
  }

  function viewOverview(pid) {
    var p = S.project(pid); if (!p) return viewNotFound();
    S.data.settings.lastProjectId = p.id;
    var s = S.projectStats(p.id), cov = S.coverage(p.id);
    var ents = S.journalEntriesOf(p.id).slice(0, 4);
    var decs = S.decisionsOf(p.id);
    var entryList = ents.length ? `<ul class="stack-8">${ents.map(function (e) {
      var href = e.decisionId && S.decision(e.decisionId) && e.type === 'Design decision' ? '#/decision/' + e.decisionId : '#/entry/' + e.id;
      return `<li><a class="entry-row" href="${href}"><span class="date">${shortDate(e.createdAt)}</span>
        <span class="stack-6" style="flex:1;min-width:0"><span class="row-wrap">${typeTag(e.type)}<span class="strong">${esc(e.title || 'Untitled entry')}</span></span><span style="font-size:14px" class="muted">${esc(snippet(e.note, 120))}</span></span>
        <span class="xsmall muted2" style="flex:none;padding-top:3px">${entryMeta(e)}</span></a></li>`;
    }).join('')}</ul>` : `<div class="card empty-inline">No entries yet. <a href="#/p/${p.id}/first">Write the first one</a> — what you know at the very start is the “before” your case study will need.</div>`;

    var decList = decs.length ? `<ul class="stack">${decs.slice(0, 3).map(function (d) {
      return `<li style="border-top:1px solid var(--line2)"><a href="#/decision/${d.id}" class="stack-6" style="padding:12px 0;color:var(--ink);text-decoration:none"><span style="font-weight:500;line-height:1.35">${esc(d.title)}</span><span class="row xsmall muted2">${decisionPill(d.status)}${shortDate(d.createdAt)} · ${d.evidence.length ? plural(d.evidence.length, 'evidence', 'evidence') : 'no evidence yet'}</span></a></li>`;
    }).join('')}</ul>` : `<p class="small muted2">No decisions yet. Open an entry where you weighed options and choose “Convert to decision”.</p>`;

    var kinds = ['IMG', 'FIG', 'TXT', 'QUOTE'];
    if (s.byKind.LINK) kinds.push('LINK');
    var evTiles = kinds.map(function (k) {
      return `<div class="ev-tile"><span class="n">${s.byKind[k] || 0}</span><span class="l">${S.EVIDENCE_KINDS[k]}</span></div>`;
    }).join('');

    var covList = cov.items.map(function (c) {
      var st = c.level === 'done' ? 'background:#2F7D57;border-color:#2F7D57' : c.level === 'part' ? 'background:#B7791F;border-color:#B7791F' : 'background:#fff;border-color:#8A8478';
      return `<li class="row" style="align-items:flex-start;gap:10px;font-size:14px"><span class="cov-mark" style="${st}" aria-hidden="true">${c.level === 'done' ? '✓' : ''}</span><span><span style="font-weight:500">${c.label}</span> <span style="color:var(--ink3)">· ${esc(c.state)}</span><span class="sr-only"> (${c.level === 'done' ? 'covered' : c.level === 'part' ? 'partly covered' : 'not covered'})</span></span></li>`;
    }).join('');

    return appShell('projects', `<div class="container w-1120 gap-28">
      ${projectHeader(p, 'overview')}
      <div class="split">
        <div class="split-main">
          <section aria-labelledby="ctx" class="card card-pad-lg stack-16" style="gap:18px">
            <div class="between"><h2 id="ctx" class="h2-sm">Context</h2><a href="#/p/${p.id}/edit" style="font-size:14px">Edit</a></div>
            <p class="serif" style="font-size:19px;line-height:1.45">${p.summary ? esc(p.summary) : '<span class="muted2">Add a one-line summary when you’re ready.</span>'}</p>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr));gap:20px">
              ${contextBlock('Problem', p.problem)}${contextBlock('Target users', p.users)}${contextBlock('Goals', p.goals, true)}${contextBlock('Constraints &amp; assumptions', p.constraints, true)}
            </div>
          </section>
          <section aria-labelledby="recent" class="stack-12">
            <div class="between"><h2 id="recent" class="h2-sm">Recent journal entries</h2>${s.entries ? `<a href="#/p/${p.id}/timeline" style="font-size:14px">All ${plural(s.entries, 'entry', 'entries')}</a>` : ''}</div>
            ${entryList}
          </section>
        </div>
        <aside aria-label="Project summary" class="split-rail">
          <section aria-labelledby="keyd" class="card card-pad stack-12">
            <div class="between"><h2 id="keyd" class="h3">Key decisions</h2>${decs.length ? `<a href="#/p/${p.id}/decisions" style="font-size:14px">All ${decs.length}</a>` : ''}</div>
            ${decList}
          </section>
          <section aria-labelledby="evh" class="card card-pad stack-12">
            <div class="between"><h2 id="evh" class="h3">Evidence <span class="mono" style="font-size:14px;color:var(--muted2)">${s.evidence}</span></h2>${s.evidence ? `<a href="#/p/${p.id}/evidence" style="font-size:14px">View all</a>` : ''}</div>
            <div class="ev-tiles">${evTiles}</div>
          </section>
          <section aria-labelledby="cov" class="panel-sand stack-12">
            <div class="stack-4"><h2 id="cov" class="h3">Story coverage</h2><p class="small" style="color:var(--ink3)">What a future case study can already draw on — and the gaps worth filling while you still remember.</p></div>
            <ul class="stack-8">${covList}</ul>
          </section>
        </aside>
      </div>
    </div>`);
  }

  var STARTERS = [
    { id: 'why', type: 'Reflection', label: 'General reflection', title: 'Why this project exists', prompt: 'What triggered this work? Who asked for it, and what would “better” look like to them?' },
    { id: 'know', type: 'Research insight', label: 'Research insight', title: 'What I already know', prompt: 'Data, complaints, past research or hunches you’re starting from. Note where each one comes from.' },
    { id: 'unsure', type: 'Design challenge', label: 'Design challenge', title: 'My biggest uncertainty', prompt: 'What don’t you understand yet? What would change your approach if you found out?' },
    { id: 'assume', type: 'Experiment', label: 'Experiment', title: 'An assumption to test', prompt: 'What are you assuming is true? How could you find out cheaply?' }
  ];

  function viewFirstEntry(pid) {
    var p = S.project(pid); if (!p) return viewNotFound();
    if (ui.feKey !== pid) { ui.feKey = pid; ui.fe = { starter: null, title: '', note: '', entryId: null, at: Date.now() }; }
    var fe = ui.fe;
    var cur = STARTERS.find(function (s) { return s.id === fe.starter; });
    var type = cur ? cur.type : 'Reflection';
    var has = !!(fe.title.trim() || fe.note.trim());
    var st = S.data.settings;
    var starters = STARTERS.map(function (s) {
      var t = typeStyle(s.type);
      return `<button type="button" class="starter" aria-pressed="${fe.starter === s.id}" data-action="fe-starter" data-value="${s.id}">
        <span class="tag-type" style="background:${t.bg};color:${t.fg}">${s.label}</span><span class="t">${s.title}</span></button>`;
    }).join('');
    var times = ['Weekdays 5 PM', 'Fridays 4 PM', 'Every day 6 PM'].map(function (t) {
      return `<button type="button" class="chip" aria-pressed="${st.reminderTime === t}" data-action="reminder-time" data-value="${t}">${t}</button>`;
    }).join('');

    return focusShell(`
      <header class="focus-bar">
        <a class="icon-btn" href="#/p/${p.id}" aria-label="Back to project">${I.arrowL}</a>
        <nav aria-label="Breadcrumb" class="breadcrumb"><a href="#/p/${p.id}">${esc(p.name)}</a><span aria-hidden="true">/</span><span>First entry</span></nav>
        <span class="spacer"></span>
        <span role="status" aria-live="polite" class="save-status${has ? ' ok' : ''}" id="save-status"><span class="dot" aria-hidden="true"></span><span>${has ? 'Draft saved · just now' : 'Nothing to save yet'}</span></span>
      </header>
      <div class="focus-body" style="padding-top:32px">
        <main class="focus-main" id="main">
          <div role="status" class="note-ok">
            <span aria-hidden="true" style="flex:none;width:28px;height:28px;border-radius:50%;background:var(--green);color:#fff;display:grid;place-items:center">${I.check}</span>
            <span style="flex:1 1 320px"><strong style="font-weight:600">${esc(p.name)} is ready.</strong> You can add the project context any time from the project page.</span>
            <a href="#/p/${p.id}" style="font-size:14px;font-weight:600;color:#17503A">View project</a>
          </div>
          <div class="stack-8"><h1 class="h1">What’s the story so far?</h1>
            <p class="lede">Write down what you know at the very start — it’s the “before” your case study will need later. Pick a starting point or write freely.</p></div>
          <div role="group" aria-label="Starting points" class="starters">${starters}</div>
          <section aria-label="First entry" class="capture">
            <div class="stack-10" style="padding:22px 22px 10px">
              <div class="row-wrap mono xsmall muted2" style="gap:10px">${typeTag(type, ';font-family:var(--sans)')}<span>${longDate(fe.at)}</span></div>
              <label for="ftitle" class="sr-only">Entry title</label>
              <input id="ftitle" class="bare-input serif" style="font-size:28px;line-height:1.2" type="text" autocomplete="off" data-fe="title" value="${esc(fe.title)}" placeholder="Title this first entry">
              <label for="fnote" class="sr-only">Note</label>
              <textarea id="fnote" class="bare-input autogrow" rows="6" style="font-size:17px;line-height:1.6;resize:vertical" data-fe="note" placeholder="${esc(cur ? cur.prompt : 'Write a sentence or two about where this project stands today.')}">${esc(fe.note)}</textarea>
            </div>
            <div class="capture-foot">
              <button type="button" class="btn btn-soft btn-sm" data-action="fe-full" data-kind="IMG">${I.image}Add screenshot</button>
              <button type="button" class="btn btn-soft btn-sm" data-action="fe-full" data-kind="LINK">${I.link}Add link</button>
              <button type="button" class="btn btn-link" data-action="fe-full">Use full reflection template</button>
            </div>
          </section>
          <div class="row-wrap" style="gap:10px">
            <a class="btn btn-ghost" href="#/p/${p.id}">Skip for now</a>
            <span class="spacer"></span>
            <span class="small muted2" id="fe-hint">${has ? 'Saved as a draft while you type' : 'Add a title or a note to save'}</span>
            <button type="button" class="btn btn-primary" id="fe-save" data-action="fe-save"${has ? '' : ' disabled'}>Save first entry<span class="kb">⌘ ↵</span></button>
          </div>
        </main>
        <aside aria-label="What happens next" class="focus-rail">
          <section aria-labelledby="next" class="panel-side stack-14">
            <h2 id="next" class="h3">After this</h2>
            <ol class="stack-14 steps">
              <li><span class="n">01</span><span><strong>Capture as you go.</strong> Press <span class="kbd">⌘ J</span> from any screen — a title and a line is enough.</span></li>
              <li><span class="n">02</span><span><strong>Mark the hard calls.</strong> Turn an entry into a decision record when you weigh options.</span></li>
              <li><span class="n">03</span><span><strong>Look back.</strong> The timeline shows how your thinking changed.</span></li>
            </ol>
          </section>
          <section aria-labelledby="rem" class="card card-pad stack-12">
            <div class="between" style="align-items:flex-start">
              <div class="stack" style="gap:2px"><h2 id="rem" style="font-size:15px;font-weight:600">Gentle reminder</h2><span class="small muted">Optional. No streaks — just a nudge on your home page at the end of the day.</span></div>
              <button type="button" role="switch" class="switch" aria-checked="${!!st.reminder}" aria-labelledby="rem" data-action="toggle-reminder"></button>
            </div>
            ${st.reminder ? `<div class="row-wrap" style="gap:6px">${times}</div>` : ''}
          </section>
        </aside>
      </div>`);
  }

  function focusShell(inner) { return `<div class="focus">${inner}</div>`; }

  function timelineItems(pid) {
    var items = [];
    S.entriesOf(pid).forEach(function (e) {
      // An entry that was converted shows up once, as its decision
      if (e.type === 'Design decision' && e.decisionId && S.decision(e.decisionId)) return;
      items.push({ kind: e.type === 'Milestone' ? 'milestone' : 'entry', at: e.createdAt, type: e.type, obj: e });
    });
    S.decisionsOf(pid).forEach(function (d) { items.push({ kind: 'decision', at: d.createdAt, type: 'Design decision', obj: d }); });
    items.sort(function (a, b) { return b.at - a.at; });
    return items;
  }
  function itemText(it) {
    var o = it.obj;
    if (it.kind === 'decision') return [o.title, o.context, o.challenge, o.rationale, (o.options || []).map(function (x) { return x.name + ' ' + x.gain + ' ' + x.cost; }).join(' '), (o.evidence || []).map(function (v) { return v.title; }).join(' ')].join(' ');
    return [o.title, o.note, Object.values(o.prompts || {}).join(' '), (o.tags || []).join(' '), (o.evidence || []).map(function (v) { return v.title + ' ' + (v.body || ''); }).join(' ')].join(' ');
  }

  function viewTimeline(pid) {
    var p = S.project(pid); if (!p) return viewNotFound();
    S.data.settings.lastProjectId = p.id;
    var all = timelineItems(p.id);
    var s = S.projectStats(p.id);
    var shortOf = function (it) { return (T[it.type] || {}).short || 'Other'; };
    var keys = ['All'];
    ['Insight', 'Challenge', 'Decision', 'Experiment', 'Feedback', 'Stakeholder', 'Outcome', 'Reflection', 'Milestone'].forEach(function (k) {
      if (all.some(function (it) { return shortOf(it) === k; }) || ['Insight', 'Challenge', 'Decision', 'Experiment', 'Feedback', 'Milestone'].indexOf(k) >= 0) keys.push(k);
    });
    if (keys.indexOf(ui.tlFilter) < 0) ui.tlFilter = 'All';
    var pl = { All: 'All', Insight: 'Insights', Challenge: 'Challenges', Decision: 'Decisions', Experiment: 'Experiments', Feedback: 'Feedback', Stakeholder: 'Stakeholder', Outcome: 'Outcomes', Reflection: 'Reflections', Milestone: 'Milestones' };
    var filters = keys.map(function (k) {
      var n = k === 'All' ? all.length : all.filter(function (it) { return shortOf(it) === k; }).length;
      return `<button type="button" class="chip" style="font-weight:500" aria-pressed="${ui.tlFilter === k}" data-action="tl-filter" data-value="${k}">${pl[k]}<span class="count">${n}</span></button>`;
    }).join('');
    var q = ui.tlQ.trim().toLowerCase();
    var shown = all.filter(function (it) {
      return (ui.tlFilter === 'All' || shortOf(it) === ui.tlFilter) && (!q || itemText(it).toLowerCase().indexOf(q) >= 0);
    });
    var groups = [];
    shown.forEach(function (it) {
      var w = weekOf(it.at);
      var g = groups.find(function (x) { return x.w === w; });
      if (!g) { g = { w: w, items: [] }; groups.push(g); }
      g.items.push(it);
    });
    var html = groups.map(function (g) {
      return `<section class="tl-group"><h2>Week of ${shortDate(g.w)}</h2><ol>${g.items.map(function (it) {
        var o = it.obj, t = typeStyle(it.type), ms = it.kind === 'milestone';
        var pt = `<span class="pt" style="width:${ms ? 12 : 10}px;height:${ms ? 12 : 10}px;border-radius:${ms ? '2px' : '50%'};background:${t.dot}"></span>`;
        var body;
        if (ms) {
          body = `<button type="button" class="tl-milestone" style="border:0;background:none;padding:8px 0;text-align:left" data-action="edit-milestone" data-id="${o.id}">Milestone · ${highlight(o.title, q)}</button>`;
        } else if (it.kind === 'decision') {
          body = `<a class="tl-card" href="#/decision/${o.id}" style="border-color:#C9C2EE">
            <span class="row-wrap">${typeTag('Design decision')}<span class="strong">${highlight(o.title, q)}</span><span class="xsmall muted2" style="margin-left:auto">${o.status} · ${o.evidence.length ? plural(o.evidence.length, 'evidence', 'evidence') : 'no evidence'}</span></span>
            <span style="font-size:14px" class="muted">${highlight(snippet(o.rationale || o.context, 160), q)}</span>
            ${o.shift && o.shift.from ? `<span class="shift"><span class="eyebrow" style="font-size:11px;letter-spacing:0.06em">Thinking shifted</span><span class="from">${esc(o.shift.from)}</span>${I.arrowR14}<span class="strong">${esc(o.shift.to)}</span></span>` : ''}
          </a>`;
        } else {
          body = `<a class="tl-card" href="#/entry/${o.id}">
            <span class="row-wrap">${typeTag(it.type)}<span class="strong">${highlight(o.title || 'Untitled entry', q)}</span><span class="xsmall muted2" style="margin-left:auto">${entryMeta(o)}</span></span>
            ${o.note ? `<span style="font-size:14px" class="muted">${highlight(snippet(o.note, 160), q)}</span>` : ''}
          </a>`;
        }
        return `<li class="tl-item"><span class="tl-date">${shortDate(it.at).replace(/, \d{4}$/, '')}</span><span class="tl-rail" aria-hidden="true"><span class="ln top"></span>${pt}<span class="ln bot"></span></span><div class="tl-body">${body}</div></li>`;
      }).join('')}</ol></section>`;
    }).join('');
    var empty = !groups.length ? emptyState(q ? 'Nothing matches “' + esc(ui.tlQ) + '”.' : 'Nothing of this type yet.', '#/entry/new?project=' + p.id, 'Write an entry') : '';

    return appShell('timeline', `<div class="container w-920 gap-24">
      <header class="stack-16">
        <nav aria-label="Breadcrumb" class="breadcrumb"><a href="#/p/${p.id}">${esc(p.name)}</a><span aria-hidden="true">/</span><span>Timeline</span></nav>
        <div class="row-wrap" style="align-items:flex-end;justify-content:space-between;gap:16px">
          <div class="stack-6"><h1 class="h1">How the thinking evolved</h1>
            <p class="muted">${plural(s.entries, 'entry', 'entries')} · ${plural(s.decisions, 'decision')} · ${plural(s.milestones, 'milestone')} since ${shortDate(p.createdAt)}</p></div>
          <div class="row-wrap">
            ${projectSwitcher(p.id)}
            <button type="button" class="btn btn-soft" data-action="add-milestone" data-id="${p.id}">${I.plus}Milestone</button>
            <button type="button" class="btn btn-soft" data-action="export-md" data-id="${p.id}">${I.download}Export Markdown</button>
          </div>
        </div>
        <div class="card stack-12" style="padding:14px">
          <label class="search-field" style="background:var(--paper);padding:0 12px">${I.search}<span class="sr-only">Search this project</span>
            <input id="tlq" type="search" placeholder="Search this project — try “planner” or “P3”" data-ui="tlQ" data-rerender="1" value="${esc(ui.tlQ)}"></label>
          <div role="group" aria-label="Filter by type" class="row-wrap" style="gap:6px">${filters}</div>
        </div>
      </header>
      <div class="stack-24" style="gap:28px">${html}${empty}</div>
    </div>`);
  }

  function projectSwitcher(current) {
    var ps = visibleProjects();
    if (ps.length < 2) return '';
    return `<label class="sr-only" for="tl-proj">Project</label><select id="tl-proj" class="select-box" style="width:auto;min-height:44px;padding-left:14px" data-action-change="switch-timeline">${ps.map(function (p) {
      return `<option value="${p.id}"${p.id === current ? ' selected' : ''}>${esc(p.name)}</option>`;
    }).join('')}</select>`;
  }

  function viewDecisionsList(pid) {
    var p = S.project(pid); if (!p) return viewNotFound();
    var decs = S.decisionsOf(p.id);
    var list = decs.length ? `<ul class="card list-card">${decs.map(function (d) {
      var chosen = (d.options || []).find(function (o) { return o.id === d.chosen; });
      return `<li><a class="row-link" href="#/decision/${d.id}"><span class="stack-4" style="flex:1"><span style="font-weight:500;line-height:1.35">${esc(d.title)}</span>
        <span class="small muted2">${shortDate(d.createdAt)} · ${plural((d.options || []).length, 'option')}${chosen ? ' · chose ' + esc(chosen.id) : ''} · ${d.evidence.length ? plural(d.evidence.length, 'evidence', 'evidence') : 'no evidence yet'}</span></span>${decisionPill(d.status)}</a></li>`;
    }).join('')}</ul>` : emptyState('No decisions yet. Open an entry where you weighed options and choose “Convert to decision”, or', '', '');
    return appShell('projects', `<div class="container w-1120 gap-28">${projectHeader(p, 'decisions')}
      <div class="between"><p class="muted">Decision records keep the options, rationale and evidence together.</p><button type="button" class="btn btn-soft btn-sm" data-action="new-decision" data-id="${p.id}">${I.plus}New decision</button></div>
      ${list}</div>`);
  }

  function evidenceRow(v, opts) {
    opts = opts || {};
    var icon = v.thumb ? `<img src="${v.thumb}" alt="">` : esc(v.kind === 'QUOTE' ? '“ ”' : v.kind);
    var title = v.url ? `<a class="ev-title" href="${esc(v.url)}" target="_blank" rel="noopener noreferrer">${esc(v.title)}</a>`
      : (v.thumb || v.body) ? `<button type="button" class="ev-title" style="border:0;background:none;padding:0;text-align:left" data-action="view-evidence" data-target="${opts.target}" data-id="${v.id}">${esc(v.title)}</button>`
      : `<span class="ev-title">${esc(v.title)}</span>`;
    return `<li class="ev-item"><span class="ev-icon" aria-hidden="true">${icon}</span>
      <span class="stack" style="flex:1;min-width:0">${title}<span class="small muted2">${esc(v.meta || S.EVIDENCE_KINDS[v.kind])}${opts.from ? ' · ' + opts.from : ''}</span></span>
      ${opts.badge ? `<span class="tag-type" style="background:#E6EEF9;color:#1F4A85">${opts.badge}</span>` : ''}
      ${opts.removable ? `<button type="button" class="icon-btn bare" aria-label="Remove ${esc(v.title)}" data-action="remove-evidence" data-target="${opts.target}" data-id="${v.id}">${I.x}</button>` : ''}
    </li>`;
  }

  function viewEvidenceList(pid) {
    var p = S.project(pid); if (!p) return viewNotFound();
    var ev = S.evidenceOf(p.id);
    var list = ev.length ? `<ul class="stack-8">${ev.map(function (x) {
      var from = x.kind === 'entry' ? `<a href="#/entry/${x.from.id}">${esc(snippet(x.from.title || 'Untitled entry', 50))}</a>` : `<a href="#/decision/${x.from.id}">${esc(snippet(x.from.title, 50))}</a>`;
      return evidenceRow(x.v, { from: 'in ' + from, target: x.kind + ':' + x.from.id });
    }).join('')}</ul>` : emptyState('No evidence yet. Add screenshots, links and test notes from any entry.', '', '');
    return appShell('projects', `<div class="container w-1120 gap-28">${projectHeader(p, 'evidence')}${list}</div>`);
  }

  function evidenceAdders(target) {
    return `<div class="dropzone" data-drop="${target}">
      ${I.image20}<span>Drop screenshots here, or</span>
      <button type="button" class="btn btn-soft btn-sm" data-action="add-image" data-target="${target}">Choose image</button>
      <button type="button" class="btn btn-soft btn-sm" data-action="add-link" data-target="${target}">Paste a link</button>
      <button type="button" class="btn btn-soft btn-sm" data-action="add-note" data-target="${target}" data-kind="TXT">Add test note</button>
      <button type="button" class="btn btn-soft btn-sm" data-action="add-note" data-target="${target}" data-kind="QUOTE">Add quote</button>
    </div>`;
  }

  function viewEntry(eid) {
    var e = S.entry(eid); if (!e) return viewNotFound();
    if (e.type === 'Milestone') { location.replace('#/p/' + e.projectId + '/timeline'); return null; }
    var p = S.project(e.projectId);
    var t = typeStyle(e.type);
    var structured = e.mode === 'structured';
    if (!ui.openPrompts[e.id]) {
      var op = {}, firstEmpty = false;
      S.PROMPTS.forEach(function (pr) {
        var filled = e.prompts && e.prompts[pr.n] && e.prompts[pr.n].trim();
        if (filled) op[pr.n] = true;
        else if (!firstEmpty) { op[pr.n] = true; firstEmpty = true; }
      });
      ui.openPrompts[e.id] = op;
    }
    var open = ui.openPrompts[e.id];
    var answered = S.answeredCount(e);
    var types = Object.keys(T).filter(function (k) { return k !== 'Milestone'; }).map(function (k) {
      var on = k === e.type;
      return `<button type="button" class="chip chip-sq" style="${on ? `background:${T[k].bg};color:${T[k].fg};border-color:${T[k].fg};font-weight:600` : ''}" aria-pressed="${on}" data-action="entry-type" data-value="${k}">${k}</button>`;
    }).join('');
    var prompts = S.PROMPTS.map(function (pr) {
      var txt = (e.prompts && e.prompts[pr.n]) || '';
      var filled = !!txt.trim(), isOpen = !!open[pr.n];
      return `<div><h3 style="margin:0"><button type="button" class="prompt-head" aria-expanded="${isOpen}" aria-controls="pb-${pr.n}" data-action="toggle-prompt" data-n="${pr.n}">
          <span class="n">0${pr.n}</span><span class="q">${pr.q}</span><span class="outline-tag">${pr.kind}</span>
          <span class="state" id="pstate-${pr.n}" style="color:${filled ? 'var(--green-ink)' : 'var(--muted2)'}">${filled ? 'Answered' : 'Empty'}</span></button></h3>
        ${isOpen ? `<div class="prompt-body" id="pb-${pr.n}"><textarea class="text-area autogrow" aria-label="${esc(pr.q)}" rows="3" placeholder="${esc(pr.hint)}" data-entry-prompt="${pr.n}" style="font-size:16px;line-height:1.6">${esc(txt)}</textarea></div>` : ''}
      </div>`;
    }).join('');
    var dec = e.decisionId && S.decision(e.decisionId);
    var looksLikeDecision = e.type === 'Design decision' || e.type === 'Design challenge' || (e.prompts && e.prompts[3] && e.prompts[3].trim());
    var related = (e.related || []).map(S.entry).filter(Boolean);
    var projects = S.data.projects.filter(function (x) { return !x.archived || x.id === e.projectId; });
    var pDot = (S.PROJECT_STATUS[p.status] || S.PROJECT_STATUS.Active).dot;

    var decisionBox = dec
      ? `<div class="convert-box"><span class="t">Decision record</span><span class="d">This entry became “${esc(dec.title)}”. It’s ${dec.status.toLowerCase()}.</span><a class="btn btn-violet btn-sm" style="align-self:flex-start" href="#/decision/${dec.id}">Open decision${I.arrowR14}</a></div>`
      : `<div class="convert-box"><span class="t">Is this a decision?</span><span class="d">${looksLikeDecision ? 'You listed options or a tradeoff. Turn it into a decision record so the rationale and evidence stay together.' : 'When you weigh options, a decision record keeps the rationale and evidence together.'}</span><button type="button" class="btn btn-violet btn-sm" style="align-self:flex-start" data-action="convert">Convert to decision${I.arrowR14}</button></div>`;

    return focusShell(`
      <header class="focus-bar">
        <a class="icon-btn" href="#/p/${p.id}" aria-label="Back to project">${I.arrowL}</a>
        <nav aria-label="Breadcrumb" class="breadcrumb"><a href="#/p/${p.id}">${esc(p.name)}</a><span aria-hidden="true">/</span><a href="#/p/${p.id}/timeline">Journal</a><span aria-hidden="true">/</span><span>Entry</span></nav>
        <span class="spacer"></span>
        <span role="status" aria-live="polite" class="save-status ok" id="save-status"><span class="dot" aria-hidden="true"></span><span>Saved · ${rel(e.updatedAt)}</span></span>
        ${dec ? `<a class="btn btn-soft btn-sm hide-sm" href="#/decision/${dec.id}">View decision</a>` : `<button type="button" class="btn btn-soft btn-sm hide-sm" data-action="convert">Convert to decision</button>`}
        <button type="button" class="btn btn-primary btn-sm" data-action="entry-done">Done</button>
      </header>
      <div class="focus-body">
        <article aria-label="Journal entry" class="focus-main" id="main">
          <div class="stack-14">
            <div class="row-wrap mono xsmall muted2" style="gap:10px"><span class="tag-type" id="entry-type-tag" style="background:${t.bg};color:${t.fg};font-family:var(--sans)">${esc(e.type)}</span><span>${longDate(e.createdAt)}</span>${e.draft ? '<span class="outline-tag" style="font-family:var(--sans)">Draft</span>' : ''}</div>
            <label for="etitle" class="sr-only">Entry title</label>
            <textarea id="etitle" class="bare-input serif autogrow" rows="1" style="font-size:clamp(28px,3.4vw,40px);line-height:1.15;letter-spacing:-0.015em;resize:none" data-entry-field="title" placeholder="Give this moment a title">${esc(e.title)}</textarea>
          </div>
          <div role="group" aria-label="Entry mode" class="segmented light">
            <button type="button" aria-pressed="${!structured}" data-action="entry-mode" data-value="quick">Quick note</button>
            <button type="button" aria-pressed="${structured}" data-action="entry-mode" data-value="structured">Structured</button>
          </div>
          <div class="stack-8"><label for="enote" class="eyebrow">Note</label>
            <textarea id="enote" class="bare-input autogrow" rows="3" style="font-size:17px;line-height:1.6;resize:vertical" data-entry-field="note" placeholder="A sentence or two is enough. What did you notice, decide, or wonder about?">${esc(e.note)}</textarea></div>
          ${structured ? `<section aria-labelledby="refl" class="stack-10">
              <div class="between"><h2 id="refl" class="h2-sm">Reflection</h2><span class="small muted2"><span id="answered-count">${answered}</span> of 5 answered · all optional</span></div>
              <div class="card prompts">${prompts}</div>
            </section>`
          : `<div class="continue" style="padding:16px 18px;font-size:14px;color:var(--ink3)"><span style="flex:1 1 260px">That’s a complete entry. When you have five more minutes, the reflection prompts help you remember <em>why</em>.</span><button type="button" class="btn btn-outline btn-sm" data-action="entry-mode" data-value="structured">Add reflection prompts</button></div>`}
          <section aria-labelledby="evid" class="stack-12">
            <div class="stack" style="gap:2px"><h2 id="evid" class="h2-sm">Supporting evidence</h2><p class="small muted2">Things you can point to. Your reflection above stays labelled as your interpretation.</p></div>
            ${e.evidence.length ? `<ul class="stack-8">${e.evidence.map(function (v) { return evidenceRow(v, { removable: true, target: 'entry:' + e.id }); }).join('')}</ul>` : ''}
            ${evidenceAdders('entry:' + e.id)}
          </section>
        </article>
        <aside aria-label="Entry details" class="focus-rail">
          <div class="stack-8"><label for="eproj" class="eyebrow">Project</label>
            <span class="select-wrap block"><span class="dot" style="background:${pDot}"></span><select id="eproj" class="select-box" data-action-change="entry-project">${projects.map(function (x) { return `<option value="${x.id}"${x.id === e.projectId ? ' selected' : ''}>${esc(x.name)}</option>`; }).join('')}</select></span></div>
          <fieldset style="margin:0;padding:0;border:0" class="stack-8"><legend class="eyebrow" style="padding:0;margin-bottom:8px">Entry type</legend><div class="row-wrap" style="gap:6px">${types}</div></fieldset>
          <div class="stack-8"><span class="eyebrow">Tags</span><div class="row-wrap" style="gap:6px">
            ${(e.tags || []).map(function (tg) { return `<span class="tag">${esc(tg)}<button type="button" aria-label="Remove tag ${esc(tg)}" data-action="remove-tag" data-value="${esc(tg)}">×</button></span>`; }).join('')}
            <button type="button" class="chip" style="min-height:30px;border-style:dashed;border-color:var(--dash2);background:transparent;color:var(--ink3)" data-action="add-tag">+ Add tag</button></div></div>
          <div class="stack-8"><span class="eyebrow">Related entries</span>
            ${related.map(function (r) { return `<div class="row" style="gap:4px"><a class="related-card" style="flex:1" href="#/entry/${r.id}"><span style="font-size:14px;font-weight:500">${esc(r.title || 'Untitled entry')}</span><span class="xsmall muted2">${esc(r.type)} · ${shortDate(r.createdAt)}</span></a><button type="button" class="icon-btn bare sm" aria-label="Unlink ${esc(r.title)}" data-action="unlink-related" data-id="${r.id}">${I.x}</button></div>`; }).join('')}
            <button type="button" class="btn btn-link" style="align-self:flex-start" data-action="link-related">+ Link an entry</button></div>
          ${decisionBox}
          <button type="button" class="btn btn-ghost btn-sm" style="align-self:flex-start;color:#B3261E" data-action="delete-entry">Delete entry</button>
        </aside>
      </div>`);
  }

  function viewDecision(did) {
    var d = S.decision(did); if (!d) return viewNotFound();
    var p = S.project(d.projectId);
    var DS = S.DECISION_STATUS;
    var source = d.sourceEntryId && S.entry(d.sourceEntryId);
    var statuses = Object.keys(DS).map(function (k) {
      return `<button type="button" class="chip chip-lg" style="font-weight:600" aria-pressed="${d.status === k}" data-action="decision-status" data-value="${k}"><span class="dot dot-8" style="background:${DS[k].dot}" aria-hidden="true"></span>${k}</button>`;
    }).join('');
    var options = (d.options || []).map(function (o) {
      var on = o.id === d.chosen;
      return `<div class="option-card${on ? ' on' : ''}">
        <div class="between" style="align-items:center"><span class="mono xsmall muted2">Option ${esc(o.id)}</span>
          <span class="row" style="gap:2px">${on ? `<span class="selected-badge">${I.check12}Selected</span>` : ''}
          <button type="button" class="icon-btn bare sm" aria-label="Edit option ${esc(o.id)}" data-action="edit-option" data-id="${esc(o.id)}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"></path></svg></button></span></div>
        <span class="serif" style="font-size:20px;line-height:1.25">${esc(o.name)}</span>
        <div class="stack-6">
          <span class="gc"><b style="color:var(--green-ink)">Gains</b><span>${o.gain ? esc(o.gain) : '<span class="muted2">—</span>'}</span></span>
          <span class="gc"><b style="color:var(--amber-ink)">Costs</b><span>${o.cost ? esc(o.cost) : '<span class="muted2">—</span>'}</span></span>
        </div>
        ${on ? '' : `<button type="button" class="btn btn-soft btn-xs" style="margin-top:auto;align-self:flex-start;font-weight:400" data-action="choose-option" data-id="${esc(o.id)}">Select this option</button>`}
      </div>`;
    }).join('');
    var linked = (d.linked || []).map(S.entry).filter(Boolean);
    var gapNote = d.gap
      ? `<div role="note" class="note-warn">${I.info}<span style="flex:1"><strong style="font-weight:600">Missing evidence:</strong> ${esc(d.gap)}</span><button type="button" class="btn btn-link" style="min-height:auto;color:#6E3410" data-action="edit-gap">Edit</button></div>`
      : !d.evidence.length
        ? `<div role="note" class="note-warn">${I.info}<span style="flex:1"><strong style="font-weight:600">No evidence linked yet.</strong> Add something you can point to, or note what’s missing.</span><button type="button" class="btn btn-link" style="min-height:auto;color:#6E3410" data-action="edit-gap">Note a gap</button></div>`
        : `<button type="button" class="btn btn-link" style="align-self:flex-start" data-action="edit-gap">+ Note what evidence is still missing</button>`;

    return appShell('projects', `<div class="container w-1120 gap-28">
      <header class="stack-16">
        <nav aria-label="Breadcrumb" class="breadcrumb"><a href="#/p/${p.id}">${esc(p.name)}</a><span aria-hidden="true">/</span><a href="#/p/${p.id}/decisions">Decisions</a></nav>
        <div class="row-wrap" style="align-items:flex-end;justify-content:space-between;gap:16px">
          <div class="stack-8" style="flex:1 1 520px">
            <span class="tag-type" style="align-self:flex-start;background:var(--violet-bg);color:var(--violet)">Design decision · ${source ? 'created from an entry on ' : 'created '}${shortDate(d.createdAt)}</span>
            <label for="dtitle" class="sr-only">Decision title</label>
            <textarea id="dtitle" class="editable serif autogrow" rows="1" style="font-weight:400;font-size:clamp(30px,3.6vw,42px);line-height:1.12;letter-spacing:-0.015em;resize:none" data-decision-field="title">${esc(d.title)}</textarea>
          </div>
          <div class="row-wrap">
            <a class="btn btn-soft" href="#/p/${p.id}/timeline">View in timeline</a>
            <button type="button" class="icon-btn" style="width:44px;height:44px" aria-label="More actions" data-action="decision-menu">${I.dots}</button>
          </div>
        </div>
        <div role="group" aria-label="Decision status" class="card row-wrap" style="padding:12px;border-radius:12px">
          ${statuses}<span class="small muted" style="flex:1 1 200px;padding-left:6px">${DS[d.status].help}</span>
        </div>
      </header>
      <div class="split">
        <div class="split-main" style="gap:20px">
          <section aria-labelledby="d-ctx" class="card" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr));gap:20px;padding:22px">
            <div class="stack-6"><label for="d-context" id="d-ctx" class="eyebrow">1 · Context</label>
              <textarea id="d-context" class="editable autogrow" rows="2" data-decision-field="context" placeholder="What situation led to this decision?">${esc(d.context)}</textarea></div>
            <div class="stack-6"><label for="d-challenge" class="eyebrow">2 · Challenge</label>
              <textarea id="d-challenge" class="editable autogrow" rows="2" data-decision-field="challenge" placeholder="What made it hard?">${esc(d.challenge)}</textarea></div>
          </section>
          <section aria-labelledby="d-opts" class="stack-12">
            <div class="between"><h2 id="d-opts" class="h2">Options &amp; tradeoffs</h2><button type="button" class="btn btn-dashed btn-sm" data-action="add-option">+ Add alternative</button></div>
            ${options ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr));gap:12px">${options}</div>` : `<div class="card empty-inline">No options recorded. Listing even one rejected alternative makes the rationale much easier to explain later.</div>`}
          </section>
          <section aria-labelledby="d-rat" class="card stack-10" style="padding:22px">
            <div class="row" style="gap:10px"><h2 id="d-rat" class="h2"><label for="d-rationale">Rationale</label></h2><span class="outline-tag">Your interpretation</span></div>
            <textarea id="d-rationale" class="editable serif autogrow" rows="3" style="font-size:19px;line-height:1.55" data-decision-field="rationale" placeholder="Why this option? What tipped it, and what is still an assumption?">${esc(d.rationale)}</textarea>
          </section>
          <section aria-labelledby="d-ev" class="stack-12">
            <h2 id="d-ev" class="h2">Evidence</h2>
            ${d.evidence.length ? `<ul class="stack-8">${d.evidence.map(function (v) { return evidenceRow(v, { badge: 'Supports', removable: true, target: 'decision:' + d.id }); }).join('')}</ul>` : ''}
            ${gapNote}
            ${evidenceAdders('decision:' + d.id)}
          </section>
        </div>
        <aside aria-label="Decision links" class="split-rail" style="flex-basis:280px;gap:20px">
          <section aria-labelledby="d-src" class="card stack-10" style="padding:18px">
            <h2 id="d-src" class="h3">Linked entries</h2>
            ${linked.length ? linked.map(function (l) {
              var t = typeStyle(l.type);
              return `<div class="row" style="border-top:1px solid var(--line2);align-items:flex-start"><a href="#/entry/${l.id}" class="stack-4" style="flex:1;padding:10px 0;color:var(--ink);text-decoration:none">
                <span class="tag-type" style="align-self:flex-start;padding:0 6px;border-radius:5px;font-size:11px;background:${t.bg};color:${t.fg}">${esc(l.type)}</span>
                <span style="font-size:14px;font-weight:500">${esc(l.title || 'Untitled entry')}</span><span class="xsmall muted2">${shortDate(l.createdAt)}</span></a>
                <button type="button" class="icon-btn bare sm" style="margin-top:8px" aria-label="Unlink ${esc(l.title)}" data-action="unlink-decision-entry" data-id="${l.id}">${I.x}</button></div>`;
            }).join('') : '<p class="small muted2">No linked entries yet.</p>'}
            <button type="button" class="btn btn-link" style="align-self:flex-start;padding:0" data-action="link-decision-entry">+ Link research, feedback or experiment</button>
          </section>
          <section aria-labelledby="d-hist" class="panel-sand stack-10" style="padding:18px">
            <h2 id="d-hist" class="h3">History</h2>
            <ol class="stack-10" style="font-size:13px;color:var(--ink2)">${(d.history || []).slice(0, 12).map(function (h) {
              return `<li class="row" style="align-items:flex-start;gap:10px"><span class="mono muted2" style="flex:none;width:48px">${shortDate(h.at).replace(/, \d{4}$/, '')}</span><span>${esc(h.text)}</span></li>`;
            }).join('')}</ol>
          </section>
          ${d.status === 'Revisited' ? '' : `<button type="button" class="btn btn-warn" data-action="decision-status" data-value="Revisited">${I.revisit}Mark for revisiting</button>`}
        </aside>
      </div>
    </div>`);
  }

  function viewTimelineRoot() {
    var pid = defaultProjectId();
    if (pid) { location.replace('#/p/' + pid + '/timeline'); return null; }
    return appShell('timeline', `<div class="container w-920 gap-24"><h1 class="h1">Timeline</h1>${emptyState('Create a project to start a timeline.', '#/projects/new', 'New project')}</div>`);
  }

  function viewSearch(q) {
    ui.searchQ = q || '';
    var ql = ui.searchQ.trim().toLowerCase();
    var results = [];
    if (ql) {
      S.data.entries.forEach(function (e) {
        if (e.type === 'Milestone') return;
        if (itemText({ kind: 'entry', obj: e }).toLowerCase().indexOf(ql) >= 0) results.push({ kind: 'entry', obj: e, at: e.createdAt });
      });
      S.data.decisions.forEach(function (d) {
        if (itemText({ kind: 'decision', obj: d }).toLowerCase().indexOf(ql) >= 0) results.push({ kind: 'decision', obj: d, at: d.createdAt });
      });
      results.sort(function (a, b) { return b.at - a.at; });
    }
    function context(o, kind) {
      var hay = kind === 'decision' ? [o.context, o.rationale, o.challenge] : [o.note].concat(Object.values(o.prompts || {}));
      hay = hay.concat((o.evidence || []).map(function (v) { return v.title; }));
      var hit = hay.find(function (h) { return h && h.toLowerCase().indexOf(ql) >= 0; }) || hay.find(Boolean) || '';
      var i = hit.toLowerCase().indexOf(ql);
      var start = Math.max(0, i - 50);
      return (start > 0 ? '…' : '') + snippet(hit.slice(start), 170);
    }
    var list = results.map(function (r) {
      var o = r.obj, p = S.project(o.projectId);
      var tag = r.kind === 'decision' ? typeTag('Design decision') : typeTag(o.type);
      return `<li><a class="entry-row" href="#/${r.kind === 'decision' ? 'decision' : 'entry'}/${o.id}"><span class="date">${shortDate(r.at)}</span>
        <span class="stack-6" style="flex:1;min-width:0"><span class="row-wrap">${tag}<span class="strong">${highlight(o.title || 'Untitled entry', ui.searchQ.trim())}</span></span>
        <span style="font-size:14px" class="muted">${highlight(context(o, r.kind), ui.searchQ.trim())}</span></span>
        <span class="xsmall muted2" style="flex:none;padding-top:3px">${p ? esc(p.name) : ''}</span></a></li>`;
    }).join('');
    return appShell('home', `<div class="container w-920 gap-24">
      <header class="stack-16" style="padding-top:16px"><h1 class="h1">Search</h1>
        <form class="search-field" role="search" data-form="search">${I.search}<label for="sq" class="sr-only">Search</label>
          <input id="sq" type="search" name="q" value="${esc(ui.searchQ)}" placeholder="Search entries, decisions, evidence" autocomplete="off"></form>
        ${ql ? `<p class="muted">${plural(results.length, 'result')} for “${esc(ui.searchQ)}”</p>` : ''}
      </header>
      ${ql ? (results.length ? `<ul class="stack-8">${list}</ul>` : emptyState('Nothing matches yet.', '', '')) : '<p class="muted">Search across every project — titles, notes, reflection answers, tags and evidence.</p>'}
    </div>`);
  }

  function viewSettings() {
    var st = S.data.settings;
    var times = ['Weekdays 5 PM', 'Fridays 4 PM', 'Every day 6 PM'].map(function (t) {
      return `<button type="button" class="chip" aria-pressed="${st.reminderTime === t}" data-action="reminder-time" data-value="${t}">${t}</button>`;
    }).join('');
    return appShell('settings', `<div class="container w-720 gap-32" style="padding-top:16px">
      <div class="stack-8"><h1 class="h1">Settings</h1><p class="lede">Your journal is stored only in this browser. Back it up to move it to another device.</p></div>
      ${S.storageOk ? '' : '<div class="note-warn">' + I.info + '<span>This browser is blocking storage, so changes will be lost when you close the tab.</span></div>'}
      <section class="card card-pad-lg stack-16">
        <h2 class="h3">You</h2>
        <div class="stack-8"><label for="set-name" class="field-label">Name used in greetings</label>
          <input id="set-name" class="text-input" type="text" data-setting="name" value="${esc(st.name)}" autocomplete="given-name"></div>
      </section>
      <section class="card card-pad-lg stack-16">
        <div class="between" style="align-items:flex-start">
          <div class="stack" style="gap:2px"><h2 id="rem2" class="h3">Gentle reminder</h2><span class="small muted">No streaks — if you haven’t written anything by the chosen time, Home shows a small nudge.</span></div>
          <button type="button" role="switch" class="switch" aria-checked="${!!st.reminder}" aria-labelledby="rem2" data-action="toggle-reminder"></button>
        </div>
        ${st.reminder ? `<div class="row-wrap" style="gap:6px">${times}</div>` : ''}
      </section>
      <section class="card card-pad-lg stack-16">
        <h2 class="h3">Your data</h2>
        <div class="row-wrap" style="gap:10px">
          <button type="button" class="btn btn-soft" data-action="export-json">${I.download}Download backup (.json)</button>
          <button type="button" class="btn btn-soft" data-action="import-json">Restore from backup</button>
          <button type="button" class="btn btn-soft" data-action="export-all-md">${I.download}Export everything as Markdown</button>
        </div>
        <div class="row-wrap" style="gap:10px;padding-top:12px;border-top:1px solid var(--line2)">
          <button type="button" class="btn btn-ghost" data-action="reset-sample">Reload sample data</button>
          <button type="button" class="btn btn-danger" data-action="reset-empty">Delete everything and start empty</button>
        </div>
      </section>
      <section class="stack-8 small muted"><h2 class="eyebrow">Keyboard</h2>
        <p><span class="kbd">⌘ J</span> or <span class="kbd">Ctrl J</span> new entry · <span class="kbd">⌘ K</span> search · <span class="kbd">⌘ ↵</span> save</p></section>
    </div>`);
  }

  function viewNotFound() {
    return appShell('', `<div class="container w-720 gap-24" style="padding-top:40px"><h1 class="h1">Not found</h1><p class="lede">That page may have been deleted. <a href="#/">Go home</a></p></div>`);
  }

  // ---------- Router ----------
  function parseRoute() {
    var h = location.hash.replace(/^#/, '') || '/';
    var qi = h.indexOf('?');
    var path = qi >= 0 ? h.slice(0, qi) : h;
    var query = {};
    if (qi >= 0) h.slice(qi + 1).split('&').forEach(function (kv) {
      var p = kv.split('='); if (p[0]) query[decodeURIComponent(p[0])] = decodeURIComponent((p[1] || '').replace(/\+/g, ' '));
    });
    var seg = path.split('/').filter(Boolean);
    var r = { name: 'notfound', params: {}, query: query, key: h };
    if (!seg.length) r.name = 'home';
    else if (seg[0] === 'projects' && !seg[1]) r.name = 'projects';
    else if (seg[0] === 'projects' && seg[1] === 'new') r.name = 'newProject';
    else if (seg[0] === 'p' && seg[1]) {
      r.params.id = seg[1];
      r.name = { undefined: 'overview', edit: 'editProject', first: 'first', timeline: 'timeline', decisions: 'decisions', evidence: 'evidence' }[seg[2]] || 'notfound';
    }
    else if (seg[0] === 'entry' && seg[1] === 'new') r.name = 'newEntry';
    else if (seg[0] === 'entry' && seg[1]) { r.name = 'entry'; r.params.id = seg[1]; }
    else if (seg[0] === 'decision' && seg[1]) { r.name = 'decision'; r.params.id = seg[1]; }
    else if (seg[0] === 'timeline') r.name = 'timelineRoot';
    else if (seg[0] === 'search') r.name = 'search';
    else if (seg[0] === 'settings') r.name = 'settings';
    return r;
  }

  function newEntryRoute(q) {
    var pid = q.project && S.project(q.project) ? q.project : defaultProjectId();
    if (!pid) { toast('Create a project first — entries live inside a project.'); location.replace('#/projects/new'); return null; }
    var type = q.type && T[q.type] ? q.type : 'Research insight';
    var e = S.addEntry({ projectId: pid, type: type, mode: q.mode === 'structured' ? 'structured' : 'quick', draft: true, title: q.title || '', note: q.note || '' });
    location.replace('#/entry/' + e.id);
    return null;
  }

  var TITLES = { home: 'Home', projects: 'Projects', newProject: 'New project', editProject: 'Edit project', overview: 'Project', first: 'First entry', timeline: 'Timeline', decisions: 'Decisions', evidence: 'Evidence', entry: 'Entry', decision: 'Decision', search: 'Search', settings: 'Settings' };

  function render() {
    route = parseRoute();
    var html;
    switch (route.name) {
      case 'home': html = viewHome(); break;
      case 'projects': html = viewProjects(); break;
      case 'newProject': html = viewProjectForm(null); break;
      case 'editProject': html = viewProjectForm(route.params.id); break;
      case 'overview': html = viewOverview(route.params.id); break;
      case 'first': html = viewFirstEntry(route.params.id); break;
      case 'timeline': html = viewTimeline(route.params.id); break;
      case 'decisions': html = viewDecisionsList(route.params.id); break;
      case 'evidence': html = viewEvidenceList(route.params.id); break;
      case 'newEntry': html = newEntryRoute(route.query); break;
      case 'entry': html = viewEntry(route.params.id); break;
      case 'decision': html = viewDecision(route.params.id); break;
      case 'timelineRoot': html = viewTimelineRoot(); break;
      case 'search': html = viewSearch(route.query.q); break;
      case 'settings': html = viewSettings(); break;
      default: html = viewNotFound();
    }
    if (html == null) return; // redirected

    // Keep focus and caret across re-renders of the same screen
    var active = document.activeElement, focusId = active && active.id, selS, selE;
    try { selS = active.selectionStart; selE = active.selectionEnd; } catch (e) { /* not a text field */ }
    var sameRoute = route.key === lastRouteKey;

    $app.innerHTML = html;
    autogrowAll();

    var sub = route.params.id ? (S.project(route.params.id) || S.entry(route.params.id) || S.decision(route.params.id) || {}) : {};
    document.title = (sub.name || sub.title ? (sub.name || sub.title) + ' · ' : (TITLES[route.name] ? TITLES[route.name] + ' · ' : '')) + 'Work Journal';

    if (sameRoute && focusId) {
      var el = document.getElementById(focusId);
      if (el) {
        el.focus({ preventScroll: true });
        try { if (selS != null) el.setSelectionRange(selS, selE); } catch (e) { /* ignore */ }
      }
    } else if (!sameRoute) {
      window.scrollTo(0, 0);
      if (route.name === 'first') focusLater('ftitle');
      if (route.name === 'entry') { var en = S.entry(route.params.id); if (en && !en.title && !en.note) focusLater('etitle'); }
      if (route.name === 'newProject') focusLater('pname');
    }
    lastRouteKey = route.key;
  }
  function rerender() { render(); }
  function focusLater(id) { setTimeout(function () { var el = document.getElementById(id); if (el) el.focus(); }, 0); }
  function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }

  function autogrow(el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 2 + 'px'; }
  function autogrowAll() { $app.querySelectorAll('textarea.autogrow').forEach(autogrow); }

  // ---------- Toast / dialogs ----------
  var toastTimer;
  function toast(msg, linkHref, linkText) {
    var t = document.getElementById('toast');
    t.innerHTML = esc(msg) + (linkHref ? ` <a href="${linkHref}">${esc(linkText)}</a>` : '');
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 4200);
  }
  function dialog(opts) {
    var d = document.createElement('dialog');
    d.className = 'modal';
    d.setAttribute('aria-labelledby', 'dlg-title');
    d.innerHTML = `<form method="dialog"><h2 id="dlg-title" class="h3">${esc(opts.title)}</h2>${opts.text ? `<p class="muted" style="font-size:14px">${esc(opts.text)}</p>` : ''}${opts.body || ''}
      <div class="actions"><button type="button" class="btn btn-ghost btn-sm" data-close>${opts.submit ? 'Cancel' : 'Close'}</button>${opts.submit ? `<button type="submit" class="btn btn-sm ${opts.danger ? 'btn-danger' : 'btn-primary'}">${esc(opts.submit)}</button>` : ''}</div></form>`;
    document.body.appendChild(d);
    var form = d.querySelector('form');
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var r = opts.onSubmit ? opts.onSubmit(new FormData(form), form) : undefined;
      if (r !== false) d.close();
    });
    form.addEventListener('click', function (ev) {
      var m = ev.target.closest('[data-menu]');
      if (m && opts.onMenu) { d.close(); opts.onMenu(m.getAttribute('data-menu'), m); }
    });
    d.querySelector('[data-close]').addEventListener('click', function () { d.close(); });
    d.addEventListener('close', function () { d.remove(); });
    d.showModal();
    var f = form.querySelector('input:not([type=hidden]), textarea, select');
    if (f) f.focus();
    return d;
  }
  function confirmDialog(title, text, label, fn) {
    dialog({ title: title, text: text, submit: label, danger: true, onSubmit: function () { fn(); } });
  }
  function field(name, label, value, opts) {
    opts = opts || {};
    var id = 'dlg-' + name;
    var input = opts.textarea
      ? `<textarea id="${id}" name="${name}" class="text-area" rows="${opts.rows || 3}" placeholder="${esc(opts.placeholder || '')}"${opts.required ? ' required' : ''}>${esc(value || '')}</textarea>`
      : `<input id="${id}" name="${name}" class="text-input" type="${opts.type || 'text'}" value="${esc(value || '')}" placeholder="${esc(opts.placeholder || '')}"${opts.required ? ' required' : ''} autocomplete="off">`;
    return `<div class="stack-6"><label for="${id}" class="field-label" style="font-size:14px">${label}</label>${input}</div>`;
  }

  // ---------- Evidence ----------
  function targetObj(target) {
    var parts = String(target).split(':');
    return parts[0] === 'entry' ? { kind: 'entry', obj: S.entry(parts[1]) } : { kind: 'decision', obj: S.decision(parts[1]) };
  }
  function addEvidence(target, v) {
    var t = targetObj(target); if (!t.obj) return;
    v.id = S.uid('ev');
    var list = (t.obj.evidence || []).concat([v]);
    if (t.kind === 'entry') S.updateEntry(t.obj.id, { evidence: list });
    else S.updateDecision(t.obj.id, { evidence: list }, 'Evidence added: ' + v.title);
    if (!S.storageOk) toast('Couldn’t save — this browser’s storage is full or blocked.');
    rerender();
  }
  function readImage(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () {
        var img = new Image();
        img.onload = function () {
          var max = 720, s = Math.min(1, max / Math.max(img.width, img.height));
          var c = document.createElement('canvas');
          c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          resolve({ thumb: c.toDataURL('image/jpeg', 0.82), w: img.width, h: img.height });
        };
        img.onerror = reject;
        img.src = r.result;
      };
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }
  function addImages(target, files) {
    Array.prototype.slice.call(files || []).filter(function (f) { return /^image\//.test(f.type); }).forEach(function (f) {
      readImage(f).then(function (res) {
        addEvidence(target, { kind: 'IMG', title: f.name.replace(/\.[^.]+$/, ''), meta: 'Screenshot · ' + res.w + ' × ' + res.h + ' · added ' + shortDate(Date.now()), thumb: res.thumb, url: '' });
      }).catch(function () { toast('That image couldn’t be read.'); });
    });
  }
  function pickImage(target) {
    var inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
    inp.addEventListener('change', function () { addImages(target, inp.files); });
    inp.click();
  }
  function linkDialog(target) {
    dialog({
      title: 'Add a link', submit: 'Add link',
      body: field('url', 'URL', '', { type: 'url', required: true, placeholder: 'https://www.figma.com/…' }) + field('title', 'Label (optional)', '', { placeholder: 'e.g. Planner flow v2 — prototype' }),
      onSubmit: function (fd) {
        var url = String(fd.get('url')).trim();
        var isFig = /figma\.com/i.test(url);
        var label = String(fd.get('title')).trim();
        if (!label) { try { label = new URL(url).hostname.replace(/^www\./, '') + new URL(url).pathname.replace(/\/$/, ''); } catch (e) { label = url; } }
        addEvidence(target, { kind: isFig ? 'FIG' : 'LINK', title: label, meta: (isFig ? 'Figma link' : 'Link') + ' · added ' + shortDate(Date.now()), url: url });
      }
    });
  }
  function noteDialog(target, kind) {
    var quote = kind === 'QUOTE';
    dialog({
      title: quote ? 'Add a feedback quote' : 'Add a test note', submit: 'Add',
      body: field('title', quote ? 'Quote or excerpt' : 'Title', '', { required: true, placeholder: quote ? '“I just want to start, not plan my life.” — P3' : 'e.g. Usability session notes — P1 to P3' }) +
        field('body', quote ? 'Where it came from (optional)' : 'Notes (optional)', '', { textarea: true, rows: 4 }),
      onSubmit: function (fd) {
        addEvidence(target, { kind: kind, title: String(fd.get('title')).trim(), body: String(fd.get('body')).trim(), meta: (quote ? 'Feedback excerpt' : 'Test notes') + ' · added ' + shortDate(Date.now()), url: '' });
      }
    });
  }
  function viewEvidence(target, id) {
    var t = targetObj(target); if (!t.obj) return;
    var v = (t.obj.evidence || []).find(function (x) { return x.id === id; }); if (!v) return;
    dialog({ title: v.title, body: (v.thumb ? `<img src="${v.thumb}" alt="${esc(v.title)}" style="max-width:100%;border-radius:10px;border:1px solid var(--line)">` : '') + (v.body ? `<p style="white-space:pre-wrap">${esc(v.body)}</p>` : '') + `<p class="small muted2">${esc(v.meta)}</p>` });
  }

  // ---------- Markdown export ----------
  function projectMarkdown(pid) {
    var p = S.project(pid); if (!p) return '';
    var out = [];
    out.push('# ' + p.name, '');
    out.push('_' + p.type + ' · ' + p.status + ' · started ' + shortDate(p.createdAt) + '_', '');
    if (p.summary) out.push(p.summary, '');
    out.push('## Context', '');
    [['Problem', p.problem], ['Target users', p.users], ['Goals', p.goals], ['Constraints & assumptions', p.constraints]].forEach(function (x) {
      if (!x[1] || !x[1].trim()) return;
      out.push('**' + x[0] + '**', '');
      var ls = lines(x[1]);
      if (ls.length > 1 || x[0] === 'Goals' || x[0] === 'Constraints & assumptions') ls.forEach(function (l) { out.push('- ' + l); });
      else out.push(ls[0]);
      out.push('');
    });
    var decs = S.decisionsOf(pid).slice().reverse();
    if (decs.length) {
      out.push('## Decisions', '');
      decs.forEach(function (d) {
        out.push('### ' + d.title, '', '_' + d.status + ' · ' + shortDate(d.createdAt) + '_', '');
        if (d.context) out.push('**Context.** ' + d.context, '');
        if (d.challenge) out.push('**Challenge.** ' + d.challenge, '');
        if (d.options && d.options.length) {
          out.push('**Options**', '');
          d.options.forEach(function (o) {
            out.push('- ' + (o.id === d.chosen ? '**' + o.id + ' — ' + o.name + '** (selected)' : o.id + ' — ' + o.name) + (o.gain ? ' · Gains: ' + o.gain : '') + (o.cost ? ' · Costs: ' + o.cost : ''));
          });
          out.push('');
        }
        if (d.rationale) out.push('**Rationale (my interpretation).** ' + d.rationale, '');
        if (d.evidence.length) { out.push('**Evidence**', ''); d.evidence.forEach(function (v) { out.push('- ' + (v.url ? '[' + v.title + '](' + v.url + ')' : v.title) + ' — ' + (v.meta || S.EVIDENCE_KINDS[v.kind])); }); out.push(''); }
        if (d.gap) out.push('> Missing evidence: ' + d.gap, '');
      });
    }
    var ents = S.entriesOf(pid).slice().reverse();
    if (ents.length) {
      out.push('## Journal', '');
      ents.forEach(function (e) {
        if (e.type === 'Milestone') { out.push('---', '', '**Milestone · ' + e.title + '** — ' + shortDate(e.createdAt), '', '---', ''); return; }
        out.push('### ' + shortDate(e.createdAt) + ' — ' + (e.title || 'Untitled entry'), '', '_' + e.type + (e.tags && e.tags.length ? ' · ' + e.tags.map(function (t) { return '#' + t; }).join(' ') : '') + '_', '');
        if (e.note) out.push(e.note, '');
        S.PROMPTS.forEach(function (pr) { var a = e.prompts && e.prompts[pr.n]; if (a && a.trim()) out.push('**' + pr.q + '**', '', a, ''); });
        if (e.evidence.length) { out.push('Evidence:', ''); e.evidence.forEach(function (v) { out.push('- ' + (v.url ? '[' + v.title + '](' + v.url + ')' : v.title) + ' — ' + (v.meta || S.EVIDENCE_KINDS[v.kind])); }); out.push(''); }
      });
    }
    return out.join('\n');
  }
  function download(name, text, type) {
    var blob = new Blob([text], { type: type || 'text/plain' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  // ---------- Actions ----------
  function currentEntry() { return route.name === 'entry' ? S.entry(route.params.id) : null; }
  function currentDecision() { return route.name === 'decision' ? S.decision(route.params.id) : null; }

  function saveQuick() {
    var title = ui.qTitle.trim(), note = ui.qNote.trim();
    if (!title && !note) { toast('Add a title or a note first.'); focusLater('qtitle'); return; }
    var type = (S.QUICK_TYPES.find(function (q) { return q[0] === ui.quickType; }) || [, 'Research insight'])[1];
    var e = S.addEntry({ projectId: ui.qProject, type: type, mode: 'quick', title: title, note: note });
    ui.qTitle = ''; ui.qNote = '';
    rerender();
    toast('Entry saved to ' + S.project(e.projectId).name + '.', '#/entry/' + e.id, 'Open');
  }

  function saveFirst() {
    var fe = ui.fe; if (!fe) return;
    if (!fe.title.trim() && !fe.note.trim()) return;
    var pid = route.params.id;
    syncFirstDraft();
    S.updateEntry(fe.entryId, { draft: false });
    ui.feKey = null;
    go('#/p/' + pid);
    toast('First entry saved. Press ⌘ J any time to add another.');
  }
  function syncFirstDraft() {
    var fe = ui.fe, pid = route.params.id;
    var cur = STARTERS.find(function (s) { return s.id === fe.starter; });
    var fields = { title: fe.title, note: fe.note, type: cur ? cur.type : 'Reflection' };
    if (!fe.title.trim() && !fe.note.trim()) {
      if (fe.entryId) { S.deleteEntry(fe.entryId); fe.entryId = null; }
      return null;
    }
    if (fe.entryId && S.entry(fe.entryId)) S.updateEntry(fe.entryId, fields);
    else fe.entryId = S.addEntry(Object.assign({ projectId: pid, mode: 'quick', draft: true, createdAt: fe.at }, fields)).id;
    return fe.entryId;
  }

  function submitProject(form, then) {
    var np = ui.np, editId = form.getAttribute('data-edit');
    if (!np.name.trim()) { focusLater('pname'); return; }
    var fields = { name: np.name.trim(), type: np.type, status: np.status, summary: np.summary.trim(), problem: np.problem.trim(), users: np.users.trim(), goals: np.goals.trim(), constraints: np.constraints.trim() };
    if (editId) {
      S.updateProject(editId, fields);
      ui.npKey = null;
      go('#/p/' + editId);
      toast('Project details saved.');
      return;
    }
    var p = S.addProject(fields);
    ui.npKey = null;
    if (then === 'first') go('#/p/' + p.id + '/first');
    else { go('#/p/' + p.id); toast(p.name + ' is ready.', '#/p/' + p.id + '/first', 'Write the first entry'); }
  }

  function projectMenu(id) {
    var p = S.project(id); if (!p) return;
    var statusBtns = ['Active', 'Paused', 'Completed'].filter(function (s) { return s !== p.status; }).map(function (s) {
      return `<button type="button" class="btn btn-ghost" data-menu="status:${s}">Mark as ${s.toLowerCase()}</button>`;
    }).join('');
    dialog({
      title: p.name,
      body: `<div class="menu">
        <button type="button" class="btn btn-ghost" data-menu="open">Open project</button>
        <button type="button" class="btn btn-ghost" data-menu="edit">Edit details</button>
        ${statusBtns}
        <button type="button" class="btn btn-ghost" data-menu="export">Export Markdown</button>
        <button type="button" class="btn btn-ghost" data-menu="archive">${p.archived ? 'Restore from archive' : 'Archive'}</button>
        <button type="button" class="btn btn-ghost" style="color:#B3261E" data-menu="delete">Delete project…</button>
      </div>`,
      onMenu: function (m) {
        if (m === 'open') go('#/p/' + id);
        else if (m === 'edit') go('#/p/' + id + '/edit');
        else if (m === 'export') download(slug(p.name) + '.md', projectMarkdown(id), 'text/markdown');
        else if (m === 'archive') { S.updateProject(id, { archived: !p.archived }); toast(p.archived ? p.name + ' archived.' : p.name + ' restored.'); rerender(); }
        else if (m.indexOf('status:') === 0) { S.updateProject(id, { status: m.slice(7) }); rerender(); }
        else if (m === 'delete') confirmDialog('Delete “' + p.name + '”?', 'This removes the project and all of its entries, decisions and evidence from this browser. It can’t be undone.', 'Delete project', function () {
          S.deleteProject(id); toast('Project deleted.');
          if (route.params.id === id) go('#/projects'); else rerender();
        });
      }
    });
  }

  function pickEntryDialog(title, candidates, onPick) {
    if (!candidates.length) { toast('No other entries in this project to link yet.'); return; }
    dialog({
      title: title, submit: 'Link',
      body: `<div class="stack-6"><label for="dlg-pick" class="field-label" style="font-size:14px">Entry</label><select id="dlg-pick" name="id" class="select-box" style="padding-left:14px">${candidates.map(function (c) {
        return `<option value="${c.id}">${esc(shortDate(c.createdAt) + ' · ' + (c.title || 'Untitled entry'))}</option>`;
      }).join('')}</select></div>`,
      onSubmit: function (fd) { onPick(String(fd.get('id'))); }
    });
  }

  function optionDialog(d, opt) {
    var editing = !!opt;
    dialog({
      title: editing ? 'Edit option ' + opt.id : 'Add an alternative', submit: editing ? 'Save' : 'Add option',
      body: field('name', 'Option', opt && opt.name, { required: true, placeholder: 'e.g. Planner with smart defaults' }) +
        field('gain', 'Gains', opt && opt.gain, { placeholder: 'What it gets right' }) +
        field('cost', 'Costs', opt && opt.cost, { placeholder: 'What it gives up' }) +
        (editing ? `<button type="button" class="btn btn-ghost btn-sm" style="align-self:flex-start;color:#B3261E" data-menu="remove">Remove this option</button>` : ''),
      onMenu: function (m) {
        if (m === 'remove') {
          S.updateDecision(d.id, { options: d.options.filter(function (o) { return o.id !== opt.id; }), chosen: d.chosen === opt.id ? '' : d.chosen }, 'Option ' + opt.id + ' removed');
          rerender();
        }
      },
      onSubmit: function (fd) {
        var vals = { name: String(fd.get('name')).trim(), gain: String(fd.get('gain')).trim(), cost: String(fd.get('cost')).trim() };
        if (editing) {
          S.updateDecision(d.id, { options: d.options.map(function (o) { return o.id === opt.id ? Object.assign({}, o, vals) : o; }) }, 'Option ' + opt.id + ' edited');
        } else {
          var used = d.options.map(function (o) { return o.id; });
          var id = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').find(function (l) { return used.indexOf(l) < 0; }) || String(used.length + 1);
          S.updateDecision(d.id, { options: d.options.concat([Object.assign({ id: id }, vals)]) }, 'Option ' + id + ' added');
        }
        rerender();
      }
    });
  }

  var actions = {
    'quick-type': function (el) { ui.quickType = el.dataset.value; rerender(); },
    'quick-full': function () {
      if (!ui.qProject) return;
      var type = (S.QUICK_TYPES.find(function (q) { return q[0] === ui.quickType; }) || [, 'Research insight'])[1];
      var e = S.addEntry({ projectId: ui.qProject, type: type, mode: 'structured', draft: true, title: ui.qTitle.trim(), note: ui.qNote.trim() });
      ui.qTitle = ''; ui.qNote = '';
      go('#/entry/' + e.id);
    },
    'focus-capture': function () { focusLater('qtitle'); },
    'proj-status': function (el) { ui.projStatus = el.dataset.value; rerender(); },
    'proj-view': function (el) { ui.projView = el.dataset.value; rerender(); },
    'toggle-archived': function () { ui.showArchived = !ui.showArchived; ui.projStatus = 'All'; rerender(); },
    'project-menu': function (el) { projectMenu(el.dataset.id); },
    'np-type': function (el) { ui.np.type = el.dataset.value; rerender(); },
    'np-status': function (el) { ui.np.status = el.dataset.value; rerender(); },
    'np-toggle': function () { ui.np.open = !ui.np.open; rerender(); },
    'fe-starter': function (el) {
      var fe = ui.fe, s = STARTERS.find(function (x) { return x.id === el.dataset.value; });
      var titleIsStarter = !fe.title.trim() || STARTERS.some(function (x) { return x.title === fe.title; });
      fe.starter = s.id;
      if (titleIsStarter) fe.title = s.title;
      syncFirstDraft();
      rerender();
      focusLater('fnote');
    },
    'fe-save': saveFirst,
    'fe-full': function (el) {
      var id = syncFirstDraft();
      if (!id) {
        var fe = ui.fe, cur = STARTERS.find(function (s) { return s.id === fe.starter; });
        id = S.addEntry({ projectId: route.params.id, type: cur ? cur.type : 'Reflection', mode: 'structured', draft: true, title: '', note: '' }).id;
      } else S.updateEntry(id, { mode: 'structured' });
      ui.feKey = null;
      go('#/entry/' + id);
      var kind = el.dataset.kind;
      if (kind === 'IMG') setTimeout(function () { pickImage('entry:' + id); }, 50);
      if (kind === 'LINK') setTimeout(function () { linkDialog('entry:' + id); }, 50);
    },
    'toggle-reminder': function () { S.data.settings.reminder = !S.data.settings.reminder; S.save(); rerender(); },
    'reminder-time': function (el) { S.data.settings.reminderTime = el.dataset.value; S.save(); rerender(); },
    'tl-filter': function (el) { ui.tlFilter = el.dataset.value; rerender(); },
    'add-milestone': function (el) {
      var pid = el.dataset.id;
      var today = new Date(); var iso = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
      dialog({
        title: 'Add a milestone', submit: 'Add milestone',
        body: field('title', 'Milestone', '', { required: true, placeholder: 'e.g. Usability round 2 complete' }) + field('date', 'Date', iso, { type: 'date', required: true }),
        onSubmit: function (fd) {
          var parts = String(fd.get('date')).split('-').map(Number);
          var at = new Date(parts[0], parts[1] - 1, parts[2], 18).getTime();
          S.addEntry({ projectId: pid, type: 'Milestone', title: String(fd.get('title')).trim(), createdAt: at, updatedAt: Date.now() });
          rerender();
        }
      });
    },
    'edit-milestone': function (el) {
      var e = S.entry(el.dataset.id); if (!e) return;
      dialog({
        title: 'Milestone', submit: 'Save',
        body: field('title', 'Milestone', e.title, { required: true }) + `<button type="button" class="btn btn-ghost btn-sm" style="align-self:flex-start;color:#B3261E" data-menu="delete">Delete milestone</button>`,
        onMenu: function () { S.deleteEntry(e.id); rerender(); },
        onSubmit: function (fd) { S.updateEntry(e.id, { title: String(fd.get('title')).trim() }); rerender(); }
      });
    },
    'export-md': function (el) {
      var p = S.project(el.dataset.id);
      download(slug(p.name) + '.md', projectMarkdown(p.id), 'text/markdown');
      toast('Exported ' + p.name + ' as Markdown.');
    },
    'export-all-md': function () {
      var md = S.data.projects.map(function (p) { return projectMarkdown(p.id); }).join('\n\n---\n\n');
      download('work-journal.md', md, 'text/markdown');
    },
    'export-json': function () {
      var d = new Date();
      download('work-journal-backup-' + d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate() + '.json', JSON.stringify(S.data, null, 2), 'application/json');
    },
    'import-json': function () {
      var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json,.json';
      inp.addEventListener('change', function () {
        var f = inp.files[0]; if (!f) return;
        f.text().then(function (txt) {
          var obj = JSON.parse(txt);
          confirmDialog('Replace your journal with this backup?', 'Everything currently in this browser will be replaced by “' + f.name + '”.', 'Restore backup', function () {
            S.replaceAll(obj); ui = Object.assign(ui, { npKey: null, feKey: null, openPrompts: {} }); toast('Backup restored.'); go('#/');
          });
        }).catch(function () { toast('That file isn’t a Work Journal backup.'); });
      });
      inp.click();
    },
    'reset-sample': function () {
      confirmDialog('Reload the sample data?', 'This replaces everything in this browser with the sample projects from the design.', 'Reload sample data', function () {
        S.reset('sample'); ui.openPrompts = {}; ui.npKey = null; ui.feKey = null; toast('Sample data loaded.'); go('#/');
      });
    },
    'reset-empty': function () {
      confirmDialog('Delete everything?', 'All projects, entries, decisions and evidence in this browser will be removed. Download a backup first if you might need it.', 'Delete everything', function () {
        S.reset('empty'); ui.openPrompts = {}; ui.npKey = null; ui.feKey = null; toast('Your journal is empty and ready.'); go('#/');
      });
    },

    // Entry editor
    'entry-mode': function (el) { var e = currentEntry(); S.updateEntry(e.id, { mode: el.dataset.value }); rerender(); },
    'entry-type': function (el) { var e = currentEntry(); S.updateEntry(e.id, { type: el.dataset.value }); rerender(); },
    'toggle-prompt': function (el) {
      var e = currentEntry(), n = el.dataset.n, o = ui.openPrompts[e.id];
      o[n] = !o[n]; rerender();
      if (o[n]) setTimeout(function () { var t = document.querySelector('[data-entry-prompt="' + n + '"]'); if (t) t.focus(); }, 0);
    },
    'entry-done': function () {
      var e = currentEntry();
      if (!e.title.trim() && !e.note.trim() && !S.answeredCount(e) && !e.evidence.length) {
        S.deleteEntry(e.id); go('#/p/' + e.projectId); toast('Empty entry discarded.'); return;
      }
      S.updateEntry(e.id, { draft: false });
      go('#/p/' + e.projectId);
      toast('Entry saved.', '#/entry/' + e.id, 'Open');
    },
    'delete-entry': function () {
      var e = currentEntry();
      confirmDialog('Delete this entry?', 'Its notes and evidence will be removed. Decisions created from it stay.', 'Delete entry', function () {
        S.deleteEntry(e.id); go('#/p/' + e.projectId); toast('Entry deleted.');
      });
    },
    'convert': function () {
      var e = currentEntry();
      var d = S.convertToDecision(e.id);
      go('#/decision/' + d.id);
      toast('Decision record created. Mark the option you chose.');
    },
    'add-tag': function () {
      var e = currentEntry();
      dialog({
        title: 'Add a tag', submit: 'Add tag',
        body: field('tag', 'Tag', '', { required: true, placeholder: 'e.g. task-initiation' }),
        onSubmit: function (fd) {
          var t = String(fd.get('tag')).trim().toLowerCase().replace(/\s+/g, '-');
          if (t && e.tags.indexOf(t) < 0) S.updateEntry(e.id, { tags: e.tags.concat([t]) });
          rerender();
        }
      });
    },
    'remove-tag': function (el) { var e = currentEntry(); S.updateEntry(e.id, { tags: e.tags.filter(function (t) { return t !== el.dataset.value; }) }); rerender(); },
    'link-related': function () {
      var e = currentEntry();
      var cands = S.journalEntriesOf(e.projectId).filter(function (x) { return x.id !== e.id && (e.related || []).indexOf(x.id) < 0; });
      pickEntryDialog('Link a related entry', cands, function (id) { S.updateEntry(e.id, { related: (e.related || []).concat([id]) }); rerender(); });
    },
    'unlink-related': function (el) { var e = currentEntry(); S.updateEntry(e.id, { related: e.related.filter(function (r) { return r !== el.dataset.id; }) }); rerender(); },

    // Evidence
    'add-image': function (el) { pickImage(el.dataset.target); },
    'add-link': function (el) { linkDialog(el.dataset.target); },
    'add-note': function (el) { noteDialog(el.dataset.target, el.dataset.kind); },
    'view-evidence': function (el) { viewEvidence(el.dataset.target, el.dataset.id); },
    'remove-evidence': function (el) {
      var t = targetObj(el.dataset.target); if (!t.obj) return;
      var v = t.obj.evidence.find(function (x) { return x.id === el.dataset.id; });
      var list = t.obj.evidence.filter(function (x) { return x.id !== el.dataset.id; });
      if (t.kind === 'entry') S.updateEntry(t.obj.id, { evidence: list });
      else S.updateDecision(t.obj.id, { evidence: list }, 'Evidence removed: ' + (v ? v.title : ''));
      rerender();
    },

    // Decisions
    'new-decision': function (el) {
      var pid = el.dataset.id;
      dialog({
        title: 'New decision', submit: 'Create',
        body: field('title', 'What did you decide (or are about to)?', '', { required: true, placeholder: 'e.g. Collapse onboarding to two screens' }),
        onSubmit: function (fd) { var d = S.addDecision({ projectId: pid, title: String(fd.get('title')).trim() }); go('#/decision/' + d.id); }
      });
    },
    'decision-status': function (el) {
      var d = currentDecision(), s = el.dataset.value;
      if (d.status === s) return;
      S.updateDecision(d.id, { status: s }, 'Status set to ' + s); rerender();
    },
    'choose-option': function (el) { var d = currentDecision(); S.updateDecision(d.id, { chosen: el.dataset.id }, 'Option ' + el.dataset.id + ' selected'); rerender(); },
    'add-option': function () { optionDialog(currentDecision(), null); },
    'edit-option': function (el) { var d = currentDecision(); optionDialog(d, d.options.find(function (o) { return o.id === el.dataset.id; })); },
    'edit-gap': function () {
      var d = currentDecision();
      dialog({
        title: 'What evidence is still missing?', submit: 'Save',
        text: 'Being honest about gaps keeps a decision at the right status.',
        body: field('gap', 'Missing evidence', d.gap, { textarea: true, rows: 3, placeholder: 'e.g. Nothing yet shows the focused flow helps people start faster.' }),
        onSubmit: function (fd) { S.updateDecision(d.id, { gap: String(fd.get('gap')).trim() }); rerender(); }
      });
    },
    'link-decision-entry': function () {
      var d = currentDecision();
      var cands = S.journalEntriesOf(d.projectId).filter(function (x) { return (d.linked || []).indexOf(x.id) < 0; });
      pickEntryDialog('Link an entry', cands, function (id) {
        var en = S.entry(id);
        S.updateDecision(d.id, { linked: (d.linked || []).concat([id]) }, 'Linked “' + (en.title || 'entry') + '”'); rerender();
      });
    },
    'unlink-decision-entry': function (el) { var d = currentDecision(); S.updateDecision(d.id, { linked: d.linked.filter(function (x) { return x !== el.dataset.id; }) }); rerender(); },
    'decision-menu': function () {
      var d = currentDecision();
      dialog({
        title: 'Decision',
        body: `<div class="menu">
          ${d.sourceEntryId && S.entry(d.sourceEntryId) ? '<button type="button" class="btn btn-ghost" data-menu="source">Open the original entry</button>' : ''}
          <button type="button" class="btn btn-ghost" data-menu="shift">${d.shift && d.shift.from ? 'Edit' : 'Record'} how your thinking shifted</button>
          <button type="button" class="btn btn-ghost" style="color:#B3261E" data-menu="delete">Delete decision…</button></div>`,
        onMenu: function (m) {
          if (m === 'source') go('#/entry/' + d.sourceEntryId);
          else if (m === 'shift') dialog({
            title: 'How did your thinking shift?', submit: 'Save', text: 'Shown on the timeline, so you can see where your direction changed.',
            body: field('from', 'From', d.shift && d.shift.from, { placeholder: 'e.g. Planner-first onboarding' }) + field('to', 'To', (d.shift && d.shift.to) || ((d.options.find(function (o) { return o.id === d.chosen; }) || {}).name), { placeholder: 'e.g. Do It Now first, planner on demand' }),
            onSubmit: function (fd) { S.updateDecision(d.id, { shift: { from: String(fd.get('from')).trim(), to: String(fd.get('to')).trim() } }); rerender(); }
          });
          else if (m === 'delete') confirmDialog('Delete this decision?', 'Linked entries stay in your journal.', 'Delete decision', function () {
            var pid = d.projectId; S.deleteDecision(d.id); go('#/p/' + pid + '/decisions'); toast('Decision deleted.');
          });
        }
      });
    }
  };

  // ---------- Event wiring ----------
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-action]');
    if (!el || !$app.contains(el)) return;
    var fn = actions[el.getAttribute('data-action')];
    if (fn) { ev.preventDefault(); fn(el, ev); }
  });

  var saveTimer;
  function flashSaved() {
    var s = document.getElementById('save-status');
    if (!s) return;
    s.classList.add('ok');
    s.lastElementChild.textContent = S.storageOk ? 'Saved · just now' : 'Not saved — storage blocked';
  }
  document.addEventListener('input', function (ev) {
    var el = ev.target;
    if (el.tagName === 'TEXTAREA' && el.classList.contains('autogrow')) autogrow(el);

    if (el.dataset.ui) {
      ui[el.dataset.ui] = el.value;
      if (el.dataset.rerender) rerender();
      return;
    }
    if (el.dataset.np) {
      ui.np[el.dataset.np] = el.value;
      if (el.dataset.np === 'name') {
        var can = !!el.value.trim();
        document.querySelectorAll('.np-req, #np-save').forEach(function (b) { b.disabled = !can; });
      }
      return;
    }
    if (el.dataset.fe) {
      ui.fe[el.dataset.fe] = el.value;
      var has = !!(ui.fe.title.trim() || ui.fe.note.trim());
      clearTimeout(saveTimer);
      saveTimer = setTimeout(syncFirstDraft, 400);
      var b = document.getElementById('fe-save'); if (b) b.disabled = !has;
      var h = document.getElementById('fe-hint'); if (h) h.textContent = has ? 'Saved as a draft while you type' : 'Add a title or a note to save';
      var s = document.getElementById('save-status');
      if (s) { s.classList.toggle('ok', has); s.lastElementChild.textContent = has ? 'Draft saved · just now' : 'Nothing to save yet'; }
      return;
    }
    var e = currentEntry();
    if (e && (el.dataset.entryField || el.dataset.entryPrompt)) {
      if (el.dataset.entryField) e[el.dataset.entryField] = el.value;
      else {
        e.prompts = e.prompts || {};
        e.prompts[el.dataset.entryPrompt] = el.value;
        var st = document.getElementById('pstate-' + el.dataset.entryPrompt);
        var filled = !!el.value.trim();
        if (st) { st.textContent = filled ? 'Answered' : 'Empty'; st.style.color = filled ? 'var(--green-ink)' : 'var(--muted2)'; }
        var ac = document.getElementById('answered-count'); if (ac) ac.textContent = S.answeredCount(e);
      }
      e.updatedAt = Date.now();
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () { S.save(); flashSaved(); }, 300);
      return;
    }
    var d = currentDecision();
    if (d && el.dataset.decisionField) {
      d[el.dataset.decisionField] = el.value;
      d.updatedAt = Date.now();
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () { S.save(); }, 300);
      return;
    }
    if (el.dataset.setting) {
      S.data.settings[el.dataset.setting] = el.value;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () { S.save(); var u = document.querySelector('.side-user span:last-child'); if (u) u.textContent = el.value; }, 300);
    }
  });

  document.addEventListener('change', function (ev) {
    var el = ev.target;
    var a = el.dataset && el.dataset.actionChange;
    if (a === 'switch-timeline') { ui.tlFilter = 'All'; ui.tlQ = ''; go('#/p/' + el.value + '/timeline'); }
    if (a === 'entry-project') { var e = currentEntry(); S.updateEntry(e.id, { projectId: el.value, related: [] }); rerender(); }
    if (el.dataset && el.dataset.ui && el.tagName === 'SELECT') { ui[el.dataset.ui] = el.value; rerender(); }
  });

  document.addEventListener('submit', function (ev) {
    var f = ev.target;
    if (!$app.contains(f)) return;
    var kind = f.getAttribute('data-form');
    if (!kind) return;
    ev.preventDefault();
    if (kind === 'quick') saveQuick();
    if (kind === 'search') { var q = f.querySelector('input[name=q]').value.trim(); go('#/search' + (q ? '?q=' + encodeURIComponent(q) : '')); }
    if (kind === 'project') submitProject(f, ev.submitter ? ev.submitter.getAttribute('data-then') : 'overview');
  });

  // Drag & drop screenshots
  document.addEventListener('dragover', function (ev) {
    var z = ev.target.closest && ev.target.closest('[data-drop]');
    if (!z) return;
    ev.preventDefault(); z.classList.add('over');
  });
  document.addEventListener('dragleave', function (ev) {
    var z = ev.target.closest && ev.target.closest('[data-drop]');
    if (z && !z.contains(ev.relatedTarget)) z.classList.remove('over');
  });
  document.addEventListener('drop', function (ev) {
    var z = ev.target.closest && ev.target.closest('[data-drop]');
    if (!z) return;
    ev.preventDefault(); z.classList.remove('over');
    addImages(z.getAttribute('data-drop'), ev.dataTransfer.files);
  });
  // Paste an image straight into an entry or decision
  document.addEventListener('paste', function (ev) {
    var z = document.querySelector('[data-drop]');
    if (!z || !ev.clipboardData) return;
    var files = Array.prototype.slice.call(ev.clipboardData.files || []).filter(function (f) { return /^image\//.test(f.type); });
    if (files.length) { ev.preventDefault(); addImages(z.getAttribute('data-drop'), files); }
  });

  document.addEventListener('keydown', function (ev) {
    var mod = ev.metaKey || ev.ctrlKey;
    if (document.querySelector('dialog[open]')) return;
    // Titles are single-line even though they wrap
    if (ev.key === 'Enter' && !mod && (ev.target.id === 'etitle' || ev.target.id === 'dtitle')) {
      ev.preventDefault();
      if (ev.target.id === 'etitle') focusLater('enote');
      return;
    }
    if (mod && (ev.key === 'j' || ev.key === 'J')) {
      ev.preventDefault();
      var pid = route.params && route.params.id && S.project(route.params.id) ? route.params.id : null;
      go('#/entry/new' + (pid ? '?project=' + pid : ''));
    } else if (mod && (ev.key === 'k' || ev.key === 'K')) {
      ev.preventDefault();
      var s = document.getElementById('gsearch') || document.getElementById('sq') || document.getElementById('tlq') || document.getElementById('projq');
      if (s) s.focus(); else go('#/search');
    } else if (mod && ev.key === 'Enter') {
      if (route.name === 'home' && ev.target.closest && ev.target.closest('[data-form="quick"]')) { ev.preventDefault(); saveQuick(); }
      else if (route.name === 'first') { ev.preventDefault(); saveFirst(); }
      else if (route.name === 'entry') { ev.preventDefault(); actions['entry-done'](); }
    }
  });

  window.addEventListener('hashchange', render);
  setInterval(function () { var c = document.getElementById('clock'); if (c) c.textContent = nowStamp(); }, 30000);

  render();
})();
