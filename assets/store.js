/* Work Journal — data store
   Everything lives in localStorage. The first visit loads sample data that
   mirrors the design; Settings can reset it or start empty. */
(function () {
  'use strict';

  var KEY = 'work-journal:v1';
  var DAY = 86400000;

  // ---------- Vocabulary ----------
  var ENTRY_TYPES = {
    'Research insight':   { bg: '#E6EEF9', fg: '#1F4A85', dot: '#2B5FA8', short: 'Insight' },
    'Design challenge':   { bg: '#FBEBDD', fg: '#8A4210', dot: '#B7791F', short: 'Challenge' },
    'Design decision':    { bg: '#E9E6FA', fg: '#3F338F', dot: '#3F338F', short: 'Decision' },
    'Experiment':         { bg: '#E3F2EC', fg: '#1E6146', dot: '#2F7D57', short: 'Experiment' },
    'Usability feedback': { bg: '#FAE8EE', fg: '#8C2D4F', dot: '#A63D63', short: 'Feedback' },
    'Stakeholder':        { bg: '#EFEDE6', fg: '#4E4A40', dot: '#6B665C', short: 'Stakeholder' },
    'Outcome':            { bg: '#EAF1DE', fg: '#45601A', dot: '#5E7F25', short: 'Outcome' },
    'Reflection':         { bg: '#F1EBF7', fg: '#5B3A7A', dot: '#7A52A0', short: 'Reflection' },
    'Milestone':          { bg: '#1D1C1A', fg: '#FFFFFF', dot: '#1D1C1A', short: 'Milestone' }
  };
  // Quick-capture chips map to full entry types
  var QUICK_TYPES = [
    ['Insight', 'Research insight'], ['Challenge', 'Design challenge'], ['Decision', 'Design decision'],
    ['Experiment', 'Experiment'], ['Feedback', 'Usability feedback'], ['Reflection', 'Reflection']
  ];
  var PROJECT_TYPES = ['New product', 'Redesign', 'Feature', 'Research', 'Service design', 'Design system', 'Other'];
  var PROJECT_STATUS = {
    Active:    { dot: '#2F7D57', bg: '#E3F2EC', fg: '#1E6146' },
    Paused:    { dot: '#B7791F', bg: '#FBEBDD', fg: '#8A4210' },
    Completed: { dot: '#6B665C', bg: '#EFEDE6', fg: '#4E4A40' }
  };
  var DECISION_STATUS = {
    Proposed:  { dot: '#8A8478', bg: '#FFFFFF', fg: '#4A463F', border: '#CFC9BC', help: 'An idea you intend to act on, not yet tried.' },
    Tested:    { dot: '#2B5FA8', bg: '#E6EEF9', fg: '#1F4A85', border: '#E6EEF9', help: 'Tried in a prototype or session; results not conclusive yet.' },
    Confirmed: { dot: '#2F7D57', bg: '#E3F2EC', fg: '#1E6146', border: '#E3F2EC', help: 'Supported by linked evidence.' },
    Revisited: { dot: '#B7791F', bg: '#FBEBDD', fg: '#8A4210', border: '#FBEBDD', help: 'Reopened because new evidence emerged.' }
  };
  var EVIDENCE_KINDS = {
    IMG:   'Screenshots',
    FIG:   'Figma links',
    TXT:   'Test notes',
    QUOTE: 'Feedback excerpts',
    LINK:  'Links'
  };
  var PROMPTS = [
    { n: 1, q: 'What I noticed', kind: 'Observation', hint: 'Describe what happened, as plainly as you can.' },
    { n: 2, q: 'What was difficult or uncertain', kind: 'Interpretation', hint: 'What don’t you understand yet?' },
    { n: 3, q: 'Options I considered', kind: 'Options', hint: 'One option per line, e.g. “A — Full planner up front”.' },
    { n: 4, q: 'What I decided and why', kind: 'Decision', hint: 'Which direction, and what tipped it? It’s fine to say it’s provisional.' },
    { n: 5, q: 'What I learned and what comes next', kind: 'Learning', hint: 'What would you test next, or tell your past self?' }
  ];

  // ---------- Utilities ----------
  function uid(prefix) {
    return (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // ---------- Sample data ----------
  // The design is dated "Tue, Oct 13, 2026 · 2:40 PM". Sample dates keep their
  // distance from that moment but are shifted to sit just before "now".
  function buildSeed() {
    var anchor = new Date(2026, 9, 13, 14, 40).getTime();
    var now = Date.now();
    function at(y, m, d, h, min) {
      return now - (anchor - new Date(y, m - 1, d, h || 10, min || 0).getTime());
    }
    function ev(kind, title, meta, extra) {
      return Object.assign({ id: uid('ev'), kind: kind, title: title, meta: meta || '', url: '' }, extra || {});
    }

    var P1 = 'p_doitnow', P2 = 'p_bakery', P3 = 'p_notif', P4 = 'p_kiosk', P5 = 'p_dsaudit';
    var projects = [
      {
        id: P1, name: 'Do-It-Now redesign', type: 'Redesign', status: 'Active', archived: false,
        summary: 'Redesign the first-run and daily-start experience so people can begin a task within moments of opening the app.',
        problem: 'People open the app meaning to work, then stall while setting up lists, priorities and schedules.',
        users: 'Individual users who struggle to get started, especially on busy or low-energy days.',
        goals: 'Shorten time from open to first task started\nKeep planning available, not required',
        constraints: 'Existing data model stays\nAssumption: fewer choices up front helps people start',
        createdAt: at(2026, 9, 22, 9)
      },
      {
        id: P2, name: 'Bakery ordering site', type: 'New product', client: true, status: 'Active', archived: false,
        summary: 'Freelance project: online pre-orders for a neighborhood bakery.',
        problem: 'Phone orders pile up on weekend mornings and get written down wrong.',
        users: 'Regular customers ordering for pickup; the owner managing the queue.',
        goals: 'Let customers pre-order in under two minutes\nGive the owner a single list for each morning',
        constraints: 'Small budget, off-the-shelf payments',
        createdAt: at(2026, 9, 15, 11)
      },
      {
        id: P3, name: 'Notification settings', type: 'Feature', status: 'Active', archived: false,
        summary: 'Make it obvious which alerts people will receive, and when.',
        problem: '', users: '', goals: '', constraints: '',
        createdAt: at(2026, 10, 1, 10)
      },
      {
        id: P4, name: 'Clinic check-in kiosk', type: 'Service design', status: 'Paused', archived: false,
        summary: 'Shorten front-desk queues for returning patients.',
        problem: 'Returning patients wait in the same queue as new patients just to confirm details.',
        users: 'Returning patients, many over 65; front-desk staff.',
        goals: 'Cut average check-in time for returning patients',
        constraints: 'Must work with the existing records vendor\nAssumption: most returning patients can self-serve',
        createdAt: at(2026, 8, 20, 9)
      },
      {
        id: P5, name: 'Design system audit', type: 'Design system', status: 'Completed', archived: false,
        summary: 'Reduce one-off components across web surfaces.',
        problem: 'Teams rebuild similar components, so the product looks and behaves inconsistently.',
        users: 'Product designers and front-end engineers.',
        goals: 'Inventory every button, input and card variant\nRetire duplicate variants',
        constraints: 'No visual redesign in this pass',
        createdAt: at(2026, 8, 1, 9)
      },
      {
        id: 'p_onboard_old', name: 'Onboarding survey (2025)', type: 'Research', status: 'Completed', archived: true,
        summary: 'Old research project kept for reference.',
        problem: '', users: '', goals: '', constraints: '', createdAt: at(2026, 3, 2, 9)
      }
    ];

    var entries = [
      // --- Do-It-Now redesign ---
      {
        id: 'e_planner', projectId: P1, type: 'Design challenge', mode: 'structured', draft: true,
        title: 'Planner vs. Do It Now: which to test first?',
        note: 'I tried a full planner and a Do It Now flow. The planner had too many decisions before the user could start.',
        prompts: {
          1: 'In the planner prototype, people chose a list, a priority and a time slot before anything started. In the Do It Now prototype they were on a task after one tap.',
          2: 'I can’t tell yet whether the planner is heavy for everyone or only on first use. Some survey responses asked for more planning control, not less.',
          3: 'A — Full planner up front\nB — Do It Now first, planner on demand\nC — Planner with smart defaults pre-filled',
          4: '', 5: ''
        },
        tags: ['task-initiation', 'onboarding'],
        evidence: [
          ev('FIG', 'Planner flow v2 — prototype', 'Figma link · added Oct 13'),
          ev('TXT', 'Usability session notes — P1 to P3', 'Test notes · observed Oct 9')
        ],
        related: ['e_round1', 'e_protoB'],
        createdAt: at(2026, 10, 13, 12, 40), updatedAt: at(2026, 10, 13, 12, 40)
      },
      {
        id: 'e_round1', projectId: P1, type: 'Usability feedback', mode: 'structured',
        title: 'Round 1 sessions — first impressions',
        note: 'Participants hesitated on the priority step; one skipped it entirely.',
        prompts: { 1: 'P2 and P3 paused for several seconds on “How important is this?”. P1 skipped it.', 2: 'Not sure if the hesitation is about the wording or the step itself.', 3: '', 4: '', 5: '' },
        tags: ['usability', 'round-1'],
        evidence: [
          ev('TXT', 'Usability session notes — P1 to P3', 'Test notes · observed Oct 9'),
          ev('IMG', 'Priority step screenshot', 'Screenshot · 1280 × 800'),
          ev('QUOTE', '“I just want to start, not plan my life.” — P3', 'Feedback excerpt · Oct 9'),
          ev('IMG', 'Recording still — P2 hesitating', 'Screenshot'),
          ev('IMG', 'Recording still — P1 skipping', 'Screenshot')
        ],
        related: [], createdAt: at(2026, 10, 9, 16), updatedAt: at(2026, 10, 9, 16)
      },
      {
        id: 'e_milestone_r1', projectId: P1, type: 'Milestone', title: 'Usability round 1 complete', note: '',
        prompts: {}, tags: [], evidence: [], related: [], createdAt: at(2026, 10, 9, 17), updatedAt: at(2026, 10, 9, 17)
      },
      {
        id: 'e_protoB', projectId: P1, type: 'Experiment', mode: 'quick',
        title: 'Prototype B: one-tap start',
        note: 'Built a version that drops straight into the next suggested task.',
        prompts: {}, tags: ['prototype'],
        evidence: [
          ev('FIG', 'Prototype B: one-tap start', 'Figma link · Oct 6'),
          ev('IMG', 'Prototype B — start screen', 'Screenshot')
        ],
        related: [], createdAt: at(2026, 10, 6, 15), updatedAt: at(2026, 10, 6, 15)
      },
      {
        id: 'e_survey', projectId: P1, type: 'Research insight', mode: 'quick',
        title: 'Some people want more planning control',
        note: 'Survey comments pull against the “fewer choices” assumption.',
        prompts: {}, tags: ['survey'],
        evidence: [ev('QUOTE', 'Survey comments on planning', 'Feedback excerpt · Sep 30')],
        related: [], createdAt: at(2026, 9, 30, 11), updatedAt: at(2026, 9, 30, 11)
      },
      {
        id: 'e_analytics', projectId: P1, type: 'Research insight', mode: 'quick',
        title: 'Most sessions end before a task is started',
        note: 'Analytics export: a large share of morning sessions close without a task marked in progress.',
        prompts: {}, tags: ['analytics'],
        evidence: [ev('IMG', 'Session funnel chart', 'Screenshot')],
        related: [], createdAt: at(2026, 9, 25, 10), updatedAt: at(2026, 9, 25, 10)
      },
      {
        id: 'e_kickoff', projectId: P1, type: 'Reflection', mode: 'quick',
        title: 'Why this project exists',
        note: 'Support keeps hearing “I open it and then don’t know where to start.” The PM wants a calmer first minute.',
        prompts: {}, tags: [], evidence: [], related: [], createdAt: at(2026, 9, 22, 10), updatedAt: at(2026, 9, 22, 10)
      },
      {
        id: 'e_milestone_start', projectId: P1, type: 'Milestone', title: 'Project started', note: '',
        prompts: {}, tags: [], evidence: [], related: [], createdAt: at(2026, 9, 22, 9), updatedAt: at(2026, 9, 22, 9)
      },

      // --- Bakery ---
      {
        id: 'e_bak1', projectId: P2, type: 'Usability feedback', mode: 'quick',
        title: 'Owner feedback on the pickup-time picker',
        note: 'Wants 15-minute slots only before 10am; after that, any time is fine.',
        prompts: {}, tags: ['client'], evidence: [ev('QUOTE', 'Owner call notes', 'Feedback excerpt')],
        related: [], createdAt: at(2026, 10, 12, 17), updatedAt: at(2026, 10, 12, 17)
      },
      {
        id: 'e_bak2', projectId: P2, type: 'Research insight', mode: 'quick',
        title: 'Most orders are the same five items',
        note: 'Going through a month of paper slips — a “usuals” shortcut could cover most orders.',
        prompts: {}, tags: [], evidence: [ev('IMG', 'Order slips tally', 'Screenshot')],
        related: [], createdAt: at(2026, 10, 5, 13), updatedAt: at(2026, 10, 5, 13)
      },

      // --- Notification settings ---
      {
        id: 'e_not1', projectId: P3, type: 'Research insight', mode: 'quick',
        title: 'Support tickets cluster around digest emails',
        note: 'People don’t realize the daily digest is separate from instant alerts.',
        prompts: {}, tags: ['support'], evidence: [ev('LINK', 'Support ticket export', 'Link'), ev('TXT', 'Ticket themes', 'Test notes')],
        related: [], createdAt: at(2026, 10, 8, 11), updatedAt: at(2026, 10, 8, 11)
      },

      // --- Kiosk ---
      {
        id: 'e_k1', projectId: P4, type: 'Stakeholder', mode: 'quick',
        title: 'Paused while the clinic changes vendors',
        note: 'Records vendor is changing; picking this back up once the new API is known.',
        prompts: {}, tags: [], evidence: [],
        related: [], createdAt: at(2026, 9, 22, 15), updatedAt: at(2026, 9, 22, 15)
      },
      {
        id: 'e_k2', projectId: P4, type: 'Usability feedback', mode: 'quick',
        title: 'Large type made the difference in the lobby test',
        note: 'Patients over 65 completed check-in without help once text was 24px+.',
        prompts: {}, tags: [], evidence: [ev('TXT', 'Lobby test notes', 'Test notes'), ev('IMG', 'Kiosk mock — large type', 'Screenshot'), ev('QUOTE', '“Finally I can read it.”', 'Feedback excerpt')],
        related: [], createdAt: at(2026, 9, 18, 11), updatedAt: at(2026, 9, 18, 11)
      },

      // --- DS audit ---
      {
        id: 'e_ds1', projectId: P5, type: 'Reflection', mode: 'structured',
        title: 'Wrap-up: what I’d do differently',
        note: 'Start the inventory with engineering, not after.',
        prompts: { 1: 'Most duplicates came from code, not Figma.', 2: '', 3: '', 4: '', 5: 'Pair with an engineer on the inventory from day one.' },
        tags: ['retro'], evidence: [ev('LINK', 'Audit spreadsheet', 'Link')],
        related: [], createdAt: at(2026, 9, 28, 16), updatedAt: at(2026, 9, 28, 16)
      },
      {
        id: 'e_ds2', projectId: P5, type: 'Outcome', mode: 'quick',
        title: 'Secondary buttons down from 3 variants to 1',
        note: 'Shipped across web surfaces; no regressions reported.',
        prompts: {}, tags: [], evidence: [ev('IMG', 'Before / after buttons', 'Screenshot'), ev('FIG', 'Button component', 'Figma link')],
        related: [], createdAt: at(2026, 9, 26, 12), updatedAt: at(2026, 9, 26, 12)
      },
      {
        id: 'e_ds3', projectId: P5, type: 'Research insight', mode: 'quick',
        title: 'Inventory: 41 card variants across 6 surfaces',
        note: 'Most differ only in padding and corner radius.',
        prompts: {}, tags: [], evidence: [ev('IMG', 'Card variant wall', 'Screenshot'), ev('LINK', 'Inventory sheet', 'Link')],
        related: [], createdAt: at(2026, 9, 5, 12), updatedAt: at(2026, 9, 5, 12)
      }
    ];

    var decisions = [
      {
        id: 'd_focus', projectId: P1, title: 'Lead with the focused Do It Now flow; keep the planner on demand',
        status: 'Tested', sourceEntryId: 'e_planner',
        context: 'Round 1 prototypes showed two very different starts: a planner that front-loads choices, and a one-tap start into the next task.',
        challenge: 'Some users ask for more planning control, yet the core problem is people stalling before they start.',
        options: [
          { id: 'A', name: 'Full planner up front', gain: 'Maximum control; suits people who like to plan.', cost: 'Several decisions before anyone can start.' },
          { id: 'B', name: 'Do It Now first, planner on demand', gain: 'Start in one tap; planning stays available.', cost: 'Less structure for heavy planners on day one.' },
          { id: 'C', name: 'Planner with smart defaults', gain: 'Keeps structure while reducing typing.', cost: 'Defaults may feel wrong and need undoing.' }
        ],
        chosen: 'B',
        rationale: 'The planner offers more control but adds decisions at the moment people most need help getting started. I prioritized the focused flow and kept planning one tap away. Task initiation is still an assumption to validate in round 2.',
        gap: 'Nothing yet shows the focused flow helps people start faster. Keep this at “Tested” until a round 2 result is linked.',
        shift: { from: 'Planner-first onboarding', to: 'Do It Now first, planner on demand' },
        evidence: [
          ev('TXT', 'Usability session notes — P1 to P3', 'Test notes · observed Oct 9'),
          ev('FIG', 'Prototype B: one-tap start', 'Figma link · Oct 6'),
          ev('QUOTE', 'Survey comments on planning', 'Feedback excerpt · Sep 30')
        ],
        linked: ['e_planner', 'e_round1', 'e_protoB'],
        history: [
          { at: at(2026, 10, 10, 16), text: 'Status set to Tested' },
          { at: at(2026, 10, 10, 15), text: 'Option C added' },
          { at: at(2026, 10, 10, 14), text: 'Created from “Planner vs. Do It Now”' }
        ],
        createdAt: at(2026, 10, 10, 14), updatedAt: at(2026, 10, 10, 16)
      },
      {
        id: 'd_onb', projectId: P1, title: 'Collapse onboarding to two screens', status: 'Proposed',
        context: 'Current onboarding is five screens before the first task.', challenge: '',
        options: [{ id: 'A', name: 'Two screens: name + first task', gain: 'Fast start.', cost: 'Less personalisation.' }],
        chosen: 'A', rationale: '', gap: '', evidence: [], linked: [],
        history: [{ at: at(2026, 10, 8, 11), text: 'Created' }],
        createdAt: at(2026, 10, 8, 11), updatedAt: at(2026, 10, 8, 11)
      },
      {
        id: 'd_plannerfirst', projectId: P1, title: 'Planner-first onboarding', status: 'Revisited',
        context: 'Original direction from the kickoff.', challenge: '',
        options: [
          { id: 'A', name: 'Planner first', gain: 'Matches what power users asked for.', cost: 'Heavy for new users.' },
          { id: 'B', name: 'Task first', gain: 'Faster start.', cost: 'Unproven.' }
        ],
        chosen: 'A', rationale: 'Original direction. Revisited Oct 10 after round 1.', gap: '',
        evidence: [], linked: ['e_kickoff'],
        history: [{ at: at(2026, 10, 10, 14), text: 'Status set to Revisited' }, { at: at(2026, 9, 28, 10), text: 'Created' }],
        createdAt: at(2026, 9, 28, 10), updatedAt: at(2026, 10, 10, 14)
      },
      {
        id: 'd_datamodel', projectId: P1, title: 'Keep the existing data model', status: 'Confirmed',
        context: 'Engineering constraint for this release.', challenge: '',
        options: [{ id: 'A', name: 'Keep current model', gain: 'No migration.', cost: 'Limits some ideas.' }, { id: 'B', name: 'New task model', gain: 'More flexible.', cost: 'Out of scope this release.' }],
        chosen: 'A', rationale: 'A migration would push the release past the quarter.', gap: '',
        evidence: [ev('LINK', 'Eng scoping doc', 'Link · Sep 24')], linked: [],
        history: [{ at: at(2026, 9, 24, 12), text: 'Status set to Confirmed' }],
        createdAt: at(2026, 9, 24, 12), updatedAt: at(2026, 9, 24, 12)
      },
      {
        id: 'd_bak1', projectId: P2, title: 'Offer a “usuals” reorder shortcut', status: 'Proposed',
        context: 'Most orders repeat.', challenge: '', options: [], chosen: '', rationale: '', gap: '',
        evidence: [], linked: ['e_bak2'], history: [{ at: at(2026, 10, 6, 10), text: 'Created' }],
        createdAt: at(2026, 10, 6, 10), updatedAt: at(2026, 10, 6, 10)
      },
      {
        id: 'd_k1', projectId: P4, title: 'Large-type check-in for returning patients', status: 'Confirmed',
        context: 'Lobby test with returning patients.', challenge: 'Many patients struggled to read the standard kiosk text.',
        options: [{ id: 'A', name: '24px+ large type', gain: 'Readable for most patients.', cost: 'Fewer fields per screen.' }, { id: 'B', name: 'Standard type + zoom', gain: 'Denser screens.', cost: 'Zoom was rarely found.' }],
        chosen: 'A', rationale: 'Patients finished without help once type was large.', gap: '',
        evidence: [ev('TXT', 'Lobby test notes', 'Test notes'), ev('IMG', 'Kiosk mock — large type', 'Screenshot'), ev('QUOTE', '“Finally I can read it.”', 'Feedback excerpt'), ev('IMG', 'Before / after', 'Screenshot')],
        linked: ['e_k2'], history: [{ at: at(2026, 9, 19, 10), text: 'Status set to Confirmed' }],
        createdAt: at(2026, 9, 19, 10), updatedAt: at(2026, 9, 19, 10)
      },
      {
        id: 'd_ds1', projectId: P5, title: 'Merge three secondary button variants', status: 'Revisited',
        context: 'Three secondary buttons with near-identical styling.', challenge: '',
        options: [{ id: 'A', name: 'Merge to one', gain: 'Consistency.', cost: 'Some screens need tweaks.' }, { id: 'B', name: 'Keep two', gain: 'Less churn.', cost: 'Still inconsistent.' }],
        chosen: 'A', rationale: 'Merged; revisited after one team needed a compact size.', gap: '',
        evidence: [ev('IMG', 'Before / after buttons', 'Screenshot'), ev('FIG', 'Button component', 'Figma link')],
        linked: ['e_ds2'], history: [{ at: at(2026, 9, 12, 10), text: 'Status set to Revisited' }],
        createdAt: at(2026, 9, 12, 10), updatedAt: at(2026, 9, 12, 10)
      }
    ];

    return {
      version: 1,
      settings: { name: 'Allie', reminder: false, reminderTime: 'Weekdays 5 PM', lastProjectId: P1 },
      projects: projects,
      entries: entries,
      decisions: decisions
    };
  }

  function emptyData(name) {
    return { version: 1, settings: { name: name || 'Allie', reminder: false, reminderTime: 'Weekdays 5 PM', lastProjectId: null }, projects: [], entries: [], decisions: [] };
  }

  // ---------- Persistence ----------
  var data;
  var storageOk = true;
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      data = raw ? JSON.parse(raw) : buildSeed();
      if (!raw) save();
    } catch (e) {
      storageOk = false;
      data = buildSeed();
    }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); return true; }
    catch (e) { storageOk = false; return false; }
  }

  // ---------- Queries ----------
  function project(id) { return data.projects.find(function (p) { return p.id === id; }); }
  function entry(id) { return data.entries.find(function (e) { return e.id === id; }); }
  function decision(id) { return data.decisions.find(function (d) { return d.id === id; }); }
  function entriesOf(pid) { return data.entries.filter(function (e) { return e.projectId === pid; }).sort(byNewest); }
  function journalEntriesOf(pid) { return entriesOf(pid).filter(function (e) { return e.type !== 'Milestone'; }); }
  function decisionsOf(pid) { return data.decisions.filter(function (d) { return d.projectId === pid; }).sort(byNewest); }
  function byNewest(a, b) { return (b.createdAt || 0) - (a.createdAt || 0); }
  function lastActivity(pid) {
    var t = (project(pid) || {}).createdAt || 0;
    data.entries.forEach(function (e) { if (e.projectId === pid) t = Math.max(t, e.updatedAt || e.createdAt); });
    data.decisions.forEach(function (d) { if (d.projectId === pid) t = Math.max(t, d.updatedAt || d.createdAt); });
    return t;
  }
  function evidenceOf(pid) {
    var list = [];
    entriesOf(pid).forEach(function (e) { (e.evidence || []).forEach(function (v) { list.push({ v: v, from: e, kind: 'entry' }); }); });
    decisionsOf(pid).forEach(function (d) { (d.evidence || []).forEach(function (v) { list.push({ v: v, from: d, kind: 'decision' }); }); });
    return list;
  }
  function projectStats(pid) {
    var ev = evidenceOf(pid);
    var byKind = {};
    ev.forEach(function (x) { byKind[x.v.kind] = (byKind[x.v.kind] || 0) + 1; });
    return {
      entries: journalEntriesOf(pid).length,
      decisions: decisionsOf(pid).length,
      evidence: ev.length,
      byKind: byKind,
      milestones: entriesOf(pid).filter(function (e) { return e.type === 'Milestone'; }).length
    };
  }
  function answeredCount(e) {
    var n = 0;
    PROMPTS.forEach(function (p) { if (e.prompts && e.prompts[p.n] && String(e.prompts[p.n]).trim()) n++; });
    return n;
  }
  function coverage(pid) {
    var p = project(pid);
    var ents = journalEntriesOf(pid);
    var decs = decisionsOf(pid);
    var insights = ents.filter(function (e) { return e.type === 'Research insight'; }).length;
    var withEv = decs.filter(function (d) { return d.evidence && d.evidence.length; }).length;
    var missingOpts = decs.filter(function (d) { return !d.options || d.options.length < 2; }).length;
    var outcomes = ents.filter(function (e) { return e.type === 'Outcome' || (e.prompts && e.prompts[5] && e.prompts[5].trim()); }).length;
    var hasCtx = !!(p && p.problem && p.problem.trim() && p.goals && p.goals.trim());
    function lvl(done, part) { return done ? 'done' : part ? 'part' : 'none'; }
    var items = [
      { label: 'Problem & goals', level: lvl(hasCtx, p && (p.problem || p.goals || p.summary)), state: hasCtx ? 'defined' : 'not written yet' },
      { label: 'Research insights', level: lvl(insights > 0, false), state: insights ? insights + (insights === 1 ? ' entry' : ' entries') : 'none yet' },
      { label: 'Decisions with evidence', level: decs.length ? lvl(withEv === decs.length, withEv > 0) : 'none', state: decs.length ? withEv + ' of ' + decs.length : 'no decisions yet' },
      { label: 'Alternatives recorded', level: decs.length ? lvl(missingOpts === 0, missingOpts < decs.length) : 'none', state: decs.length ? (missingOpts ? missingOpts + (missingOpts === 1 ? ' decision' : ' decisions') + ' missing options' : 'every decision') : 'no decisions yet' },
      { label: 'Outcomes & learnings', level: lvl(outcomes > 0, false), state: outcomes ? outcomes + (outcomes === 1 ? ' entry' : ' entries') : 'none yet' }
    ];
    var done = items.filter(function (i) { return i.level === 'done'; }).length;
    return { items: items, done: done };
  }

  // ---------- Mutations ----------
  function touch(o) { o.updatedAt = Date.now(); }
  function addProject(fields) {
    var p = Object.assign({
      id: uid('p'), name: 'Untitled project', type: 'Other', status: 'Active', archived: false,
      summary: '', problem: '', users: '', goals: '', constraints: '', createdAt: Date.now()
    }, fields);
    data.projects.push(p);
    data.settings.lastProjectId = p.id;
    save();
    return p;
  }
  function updateProject(id, fields) {
    var p = project(id); if (!p) return;
    Object.assign(p, fields); save(); return p;
  }
  function deleteProject(id) {
    data.projects = data.projects.filter(function (p) { return p.id !== id; });
    data.entries = data.entries.filter(function (e) { return e.projectId !== id; });
    data.decisions = data.decisions.filter(function (d) { return d.projectId !== id; });
    if (data.settings.lastProjectId === id) data.settings.lastProjectId = null;
    save();
  }
  function addEntry(fields) {
    var now = Date.now();
    var e = Object.assign({
      id: uid('e'), projectId: null, type: 'Research insight', mode: 'quick', draft: false,
      title: '', note: '', prompts: {}, tags: [], evidence: [], related: [], createdAt: now, updatedAt: now
    }, fields);
    data.entries.push(e);
    if (e.projectId) data.settings.lastProjectId = e.projectId;
    save();
    return e;
  }
  function updateEntry(id, fields) {
    var e = entry(id); if (!e) return;
    Object.assign(e, fields); touch(e); save(); return e;
  }
  function deleteEntry(id) {
    data.entries = data.entries.filter(function (e) { return e.id !== id; });
    data.entries.forEach(function (e) { e.related = (e.related || []).filter(function (r) { return r !== id; }); });
    data.decisions.forEach(function (d) { d.linked = (d.linked || []).filter(function (r) { return r !== id; }); });
    save();
  }
  function addDecision(fields) {
    var now = Date.now();
    var d = Object.assign({
      id: uid('d'), projectId: null, title: 'Untitled decision', status: 'Proposed',
      context: '', challenge: '', options: [], chosen: '', rationale: '', gap: '',
      evidence: [], linked: [], history: [{ at: now, text: 'Created' }], createdAt: now, updatedAt: now
    }, fields);
    data.decisions.push(d);
    save();
    return d;
  }
  function updateDecision(id, fields, historyText) {
    var d = decision(id); if (!d) return;
    Object.assign(d, fields); touch(d);
    if (historyText) d.history.unshift({ at: Date.now(), text: historyText });
    save(); return d;
  }
  function deleteDecision(id) {
    data.decisions = data.decisions.filter(function (d) { return d.id !== id; });
    data.entries.forEach(function (e) { if (e.decisionId === id) delete e.decisionId; });
    save();
  }
  function convertToDecision(entryId) {
    var e = entry(entryId); if (!e) return null;
    if (e.decisionId && decision(e.decisionId)) return decision(e.decisionId);
    var opts = [];
    var letters = 'ABCDEFGH';
    String((e.prompts && e.prompts[3]) || '').split('\n').forEach(function (line) {
      line = line.trim(); if (!line) return;
      var m = line.match(/^([A-H])\s*[—\-–:.)]\s*(.+)$/i);
      var id = m ? m[1].toUpperCase() : letters[opts.length];
      opts.push({ id: id, name: m ? m[2] : line, gain: '', cost: '' });
    });
    var d = addDecision({
      projectId: e.projectId,
      title: e.title || 'Untitled decision',
      sourceEntryId: e.id,
      context: e.note || (e.prompts && e.prompts[1]) || '',
      challenge: (e.prompts && e.prompts[2]) || '',
      options: opts,
      chosen: '',
      rationale: (e.prompts && e.prompts[4]) || '',
      evidence: clone(e.evidence || []),
      linked: [e.id].concat(e.related || []),
      history: [{ at: Date.now(), text: 'Created from “' + (e.title || 'an entry') + '”' }]
    });
    e.decisionId = d.id;
    save();
    return d;
  }

  function reset(mode) {
    data = mode === 'empty' ? emptyData(data && data.settings && data.settings.name) : buildSeed();
    save();
  }
  function replaceAll(obj) {
    if (!obj || !Array.isArray(obj.projects) || !Array.isArray(obj.entries) || !Array.isArray(obj.decisions)) throw new Error('Not a Work Journal backup');
    obj.settings = Object.assign(emptyData().settings, obj.settings || {});
    data = obj; save();
  }

  load();

  window.WJStore = {
    ENTRY_TYPES: ENTRY_TYPES, QUICK_TYPES: QUICK_TYPES, PROJECT_TYPES: PROJECT_TYPES,
    PROJECT_STATUS: PROJECT_STATUS, DECISION_STATUS: DECISION_STATUS, EVIDENCE_KINDS: EVIDENCE_KINDS, PROMPTS: PROMPTS,
    get data() { return data; },
    get storageOk() { return storageOk; },
    uid: uid, save: save, reset: reset, replaceAll: replaceAll,
    project: project, entry: entry, decision: decision,
    entriesOf: entriesOf, journalEntriesOf: journalEntriesOf, decisionsOf: decisionsOf, evidenceOf: evidenceOf,
    lastActivity: lastActivity, projectStats: projectStats, coverage: coverage, answeredCount: answeredCount,
    addProject: addProject, updateProject: updateProject, deleteProject: deleteProject,
    addEntry: addEntry, updateEntry: updateEntry, deleteEntry: deleteEntry,
    addDecision: addDecision, updateDecision: updateDecision, deleteDecision: deleteDecision,
    convertToDecision: convertToDecision
  };
})();
