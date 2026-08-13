# Chorvam.uz — selected code

Chorvam.uz is a livestock marketplace for Uzbekistan: a Telegram Mini App and a web app.
The product is under active development and the codebase is closed. What follows is a small
selection meant to show **how we solve engineering problems** — not what we are building.

Three stories, each with proof. Every fragment is working code from the product.

```
npm install && npm test        # 15 tests, ~2 seconds
```

---

## 1. A notification about money must not disappear

**What happened.** The delivery channel goes down, the failure is written to the log at
`warn` level, and that is the end of it. The person never learns their payment went
through, and there is nothing left to recover from: one line in a log, nothing in the system.

The bug was not that the channel failed — it always will. The bug was that **the log
reported success**: the code finished without throwing, the "sent" counter went up, and
nothing reached the human being.

**What we did.** A queue with state: `PENDING → SENT | FAILED`, attempt count, the text of
the last error, and the time of the next attempt.

- [`src/reliable-delivery/outbox.entity.ts`](src/reliable-delivery/outbox.entity.ts) — the model
- [`src/reliable-delivery/retry-policy.ts`](src/reliable-delivery/retry-policy.ts) — when to retry and when to stop
- [`src/reliable-delivery/retry-worker.ts`](src/reliable-delivery/retry-worker.ts) — scheduled retries

**Two decisions worth noticing:**

The delay doubles (1, 2, 4… minutes, capped at an hour). The usual cause of failure is the
receiving side restarting, which takes seconds: the first retry has to be fast so the user
never notices. But if the channel is genuinely down, hammering it every minute keeps it
from coming back up.

After eight attempts the row moves to `FAILED` and **stays visible**. Giving up is allowed;
losing the message is not. That status is what the "N undelivered" summary is built from —
the one a human actually looks at.

**Proof:** [`tests/retry-policy.spec.ts`](tests/retry-policy.spec.ts) — 7 tests, including
one asserting the whole retry cycle fits in roughly two hours. Leaving someone in the dark
longer than that is not acceptable: past that point what is needed is an investigation,
not another retry.

---

## 2. Nobody should learn their amount changed by reading a statement

**What happened.** Accruals are indivisible: each one is a closed deal, and you cannot
withdraw half a deal. So a requested amount does not always add up exactly.

A request for 349,090,000 against 348,090,000 available would **silently create a request
for the smaller amount**. The screen then truthfully said "request accepted" — a different
request had been accepted. Nothing threw, nothing appeared in the logs.

What makes it worse: right next to it, the minimum-amount check handled the same situation
correctly — it refused and explained with numbers. One rule, two implementations, two
behaviours. That is a defect class we have caught in our own code more than once.

**What we did.** The discrepancy is no longer swallowed: either the request is for the
amount the person asked for, or there is no request at all — with an explanation of what
does add up and what to do about it.

- [`src/payouts/accrual-selection.ts`](src/payouts/accrual-selection.ts)

**Proof:** [`tests/accrual-selection.spec.ts`](tests/accrual-selection.spec.ts) — 8 tests,
including that exact 349,090,000 case and an assertion that the refusal message contains
**both** numbers, available and attainable. One of them alone does not tell the person what
to do next.

---

## 3. We verify what the user sees, not what the server answered

Defects that API-level checks miss entirely:

- the server returns `200 OK` and updates the row, while the button on screen stays
  disabled — success as far as the API is concerned, a broken feature as far as the
  person is concerned;
- two amounts get concatenated as strings, so instead of `550,000` the screen shows
  `300,000 250,000` — not one exception, not one log line;
- a list is empty not because there is no data but because loading failed — the empty
  state disguises the crash.

**The rule of this framework:** only what is visible on screen counts as proof that a
feature works. The API is called exactly twice — to read the state **before** and to clean
up fixtures **after** — and never to conclude "it works".

- [`browser-checks/base.py`](browser-checks/base.py) — steps, screenshot on failure
- [`browser-checks/helpers.py`](browser-checks/helpers.py) — selectors by role and label, not by CSS class
- [`browser-checks/example_scenario.py`](browser-checks/example_scenario.py) — a full scenario

A failed step does not abort the scenario: one broken button must not hide the state of the
other ten, or every run fixes exactly one defect at a time.

---

## Also: which build is answering right now

Over two days our testing checked a process running old code three times, and a service
nobody had rebuilt very nearly went to production. There was no way to tell a live process
from the right one: from the outside both answer identically, and just as confidently.

`GET /health` returns the commit, branch and build time — the first request of any check.

- [`src/build-identity/health.controller.ts`](src/build-identity/health.controller.ts)
- [`src/build-identity/write-build-info.js`](src/build-identity/write-build-info.js)

The subtlety the whole thing exists for: the snapshot is written **after** the build and
lives next to it. Reading git at request time is not an option — `/health` would then report
the working tree's commit while the process runs an older build, lying in precisely the
situation it was created for.

---

## About the code in this repository

These fragments come from the running product. Exactly three kinds of changes were made:

1. **Names tied to the delivery channel** (`telegramId` → `recipientId`) and internal issue
   numbers were removed, so the code reads without access to our tracker.
2. **The retry policy and accrual selection were extracted into separate modules.** In the
   product they live inside services, together with the database transaction. Here they are
   separated from infrastructure so the rule can be tested without a database or a network.
   The logic itself is unchanged.
3. **Comments and error messages were translated from Russian**, the working language of
   the team. Wording and meaning were preserved.

Nothing was rewritten to look better: the comments are the ones we actually keep in the
product, including the descriptions of the defects these solutions grew out of.

## Deliberately not included

- the business rules and thresholds the product rests on;
- the commission model and how money is split between participants;
- payment provider integrations;
- roles and access control;
- the investment side of the product.

This is not carelessness in selection: the above is the substance of the product, and
publishing it openly would mean giving that substance away. We are glad to walk through any
of these modules in person.

## License

Published for review as part of a competition application. All rights reserved — see
[LICENSE](LICENSE).
