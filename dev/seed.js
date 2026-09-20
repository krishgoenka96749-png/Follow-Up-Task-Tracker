/* Seed data for the local mock. Dev only — never served by the published page.
   Dates are relative to the day you open the harness, so the overdue item
   stays overdue and nothing goes stale. Edit freely; ?fresh reloads it. */
(function(){
  "use strict";

  function day(offset){
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + offset);
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }
  function at(offsetDays, hour){
    var d = new Date();
    d.setDate(d.getDate() + offsetDays);
    d.setHours(hour || 9, 30, 0, 0);
    return d.toISOString();
  }

  /* path -> document body, exactly as the real db would hold it. */
  window.__TRACKER_SEED__ = {

    /* ---------- subjects ---------- */
    "subjects/aquaterra": {name: "AquaTerra", order: 1, active: true, note: "Scope refresh, Q4 delivery"},
    "subjects/deloitte":  {name: "Deloitte", order: 2, active: true, note: ""},
    "subjects/personal":  {name: "Personal", order: 3, active: true, note: ""},
    "subjects/archived":  {name: "Old pilot", order: 9, active: false, note: "closed out"},

    /* ---------- tasks: mine ---------- */
    "tasks/t_aq01": {
      title: "Send Priya the revised scope note",
      direction: "mine", counterparty: "Priya Nair", subject: "aquaterra",
      status: "open", priority: "high", due: day(-5),
      next_action: "Rewrite section 3, then email it",
      source: "WhatsApp — Priya", context: "She needs it before the steering call.",
      created: at(-9), updated: at(-2, 17),
      history: [
        {at: at(-9), text: "Captured: Priya wants the scope note redone with the new headcount"},
        {at: at(-6), text: "Priya nudged on WhatsApp; promised it by Friday"},
        {at: at(-2, 17), text: "Section 3 still open, everything else drafted"}
      ]
    },
    "tasks/t_aq02": {
      title: "Confirm the AquaTerra kickoff date",
      direction: "mine", counterparty: "Priya Nair", subject: "aquaterra",
      status: "open", priority: "normal", due: day(2),
      next_action: "", source: "standup transcript", context: "",
      created: at(-3), updated: at(-3),
      history: [{at: at(-3), text: "Captured: need to lock the kickoff date with Priya"}]
    },
    "tasks/t_pe01": {
      title: "Book flights for the Pune site visit",
      direction: "mine", counterparty: "", subject: "personal",
      status: "open", priority: "high", due: "",
      next_action: "Check if the team is going Tuesday or Wednesday",
      source: "voice note", context: "",
      created: at(-1, 21), updated: at(-1, 21),
      history: [{at: at(-1, 21), text: "Captured: book Pune flights, no date fixed yet"}]
    },
    "tasks/t_dl02": {
      title: "Write up the utilisation numbers for Rahul",
      direction: "mine", counterparty: "Rahul Mehta", subject: "deloitte",
      status: "done", priority: "normal", due: day(-4),
      next_action: "", source: "captured in chat", context: "",
      created: at(-11), updated: at(-1, 11),
      history: [
        {at: at(-11), text: "Captured: Rahul asked for the Q3 utilisation write-up"},
        {at: at(-1, 11), text: "Sent. Marked done."}
      ]
    },

    /* ---------- tasks: theirs ---------- */
    "tasks/t_dl01": {
      title: "Rahul to sign off the Q3 utilisation deck",
      direction: "theirs", counterparty: "Rahul Mehta", subject: "deloitte",
      status: "open", priority: "normal", due: day(5),
      next_action: "", source: "captured in chat", context: "",
      created: at(-4), updated: at(-4),
      history: [{at: at(-4), text: "Captured: Rahul said he'd sign off by the end of next week"}]
    },
    "tasks/t_dl03": {
      title: "Legal to return the redlined MSA",
      direction: "theirs", counterparty: "Legal", subject: "deloitte",
      status: "waiting", priority: "normal", due: day(1),
      next_action: "Chase Anita if nothing by tomorrow",
      source: "email", context: "",
      created: at(-7), updated: at(-2, 10),
      history: [
        {at: at(-7), text: "Captured: MSA with legal for redlines"},
        {at: at(-2, 10), text: "Anita says it's in the queue, expects it this week"}
      ]
    },
    "tasks/t_aq03": {
      title: "AquaTerra to share last year's borewell data",
      direction: "theirs", counterparty: "Priya Nair", subject: "aquaterra",
      status: "open", priority: "normal", due: "",
      next_action: "", source: "standup transcript", context: "",
      created: at(-5), updated: at(-5),
      history: [{at: at(-5), text: "Captured: they owe the borewell dataset, no date given"}]
    },

    /* ---------- notes ---------- */
    "notes/n_aq01": {
      body: "Priya's real constraint is the board pack on the 28th — everything else can slip a week.",
      subject: "aquaterra", task_id: "", created: at(-6, 15), source: "captured in chat"
    },
    "notes/n_ge01": {
      body: "Rahul prefers a one-pager over a deck. Ask before building slides next time.",
      subject: "deloitte", task_id: "", created: at(-2, 12), source: "added on the tracker page"
    },

    /* ---------- inbox: pending approval ---------- */
    "inbox/i_pend1": {
      kind: "task", raw: "priya wants the water balance model by next monday, she's presenting it internally",
      title: "Send Priya the water balance model",
      direction: "mine", counterparty: "Priya Nair", subject: "aquaterra",
      due: day(7), priority: "normal", next_action: "",
      source: "captured in chat", created: at(0, 8), unrefined: false
    },
    "inbox/i_pend2": {
      kind: "task", raw: "Rahul said the staffing plan comes back to me Thursday",
      title: "Rahul to return the staffing plan",
      direction: "theirs", counterparty: "Rahul Mehta", subject: "deloitte",
      due: day(3), priority: "normal", next_action: "",
      source: "captured in chat", created: at(0, 9), unrefined: false
    },
    "inbox/i_pend3": {
      kind: "note", raw: "note - the borewell dataset they sent last year was in a pdf, ask for csv this time",
      body: "The borewell dataset came as a PDF last year — ask for CSV this time.",
      subject: "aquaterra",
      source: "typed on tracker page", created: at(0, 10)
    },
    "inbox/i_pend4": {
      kind: "task", raw: "call the accountant about the advance tax thing before the 15th",
      title: "Call the accountant about the advance tax thing before the 15th",
      direction: "mine", counterparty: "", subject: "", due: "",
      priority: "normal", next_action: "",
      source: "typed on tracker page", created: at(0, 11), unrefined: true
    },

    /* ---------- inbox: edits (never filed from the page) ---------- */
    "inbox/i_edit1": {
      kind: "edit", raw: "Priya says Thursday works better for the scope note",
      task_id: "t_aq01", inbox_id: "",
      source: "typed on tracker page", created: at(0, 12)
    },
    "inbox/i_edit2": {
      kind: "edit", raw: "she's presenting on Tuesday not Monday, so bring it forward",
      task_id: "", inbox_id: "i_pend1",
      source: "typed on tracker page", created: at(0, 13)
    }
  };
})();
