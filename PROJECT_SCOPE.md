# Bot Arena Platform: Project Scope

A TypeScript platform where an admin defines a game, participants write bots in the browser, bots are validated and run in sandboxes, and tournaments are played in World Cup-style rounds with live viewing and a leaderboard.

## 1. Contest and quiz flows

### Accounts

There is no self-registration in the first release. An admin creates users, sets their initial password and assigns a role (`admin` or `player`). Users sign in with a username and password and can change their own password. Contests and quizzes are available only to the users the admin assigns to them.

### Contest flow

1. The admin creates a contest by choosing one game and the participants (users), and sets the coding window and start mode.
2. Participants write a bot during the coding window. Code is accepted only if it passes validation (it loads, and its `tick` function returns valid output on sample states).
3. The admin starts the contest, or the timer does. Submissions are frozen.
4. Optionally, the admin first runs a **warm-up round**: every participant plays in one single match and nobody is eliminated. Its results become the initial ranking. The admin decides whether spectators see the warm-up or it stays hidden.
5. The admin starts each round by entering the group size (for example 5) and how many players advance from each group. Players are drawn into groups using the round's draw strategy, creating a **draft** bracket that spectators cannot see.
6. In the draft, the admin can drag and drop players between groups. Publishing the round makes the bracket visible to everyone: who plays whom and in what order.
7. Matches then run in order, started manually by the admin or automatically if the round is set to automatic. Eliminated players and winners are marked in the bracket.
8. The admin starts the next round the same way, until a winner is decided. Everyone can watch matches live and replay them afterwards.

### Quiz flow

1. The admin writes questions in the **question bank**: an MDX statement, test cases (visible samples and hidden ones), time and memory limits, and a max score.
2. The admin creates a quiz by ticking questions from the bank, then sets the duration, open and close times, allowed languages, whether students may test-run their code, the scoring penalty and result visibility.
3. Students open the quiz assigned to them and start an attempt; their timer starts.
4. They write code for each question in the editor. If test runs are enabled, they can run their code against the sample tests or their own input. Code autosaves.
5. On final submit, or when time runs out, every answer is graded against all test cases in the sandbox.
6. Students see their scores and, as configured, per-test feedback. The admin sees a gradebook.

## 2. Stack

| Area                | Choice                                                                                                                                                                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Platform language   | TypeScript everywhere                                                                                                                                                                                                                    |
| Bot languages       | Python, JavaScript and TypeScript in the first release. One thin adapter per language speaks JSON lines over stdin/stdout; TypeScript is transpiled at submission. More languages later                                                  |
| Monorepo            | pnpm workspaces + Turborepo                                                                                                                                                                                                              |
| Frontend            | Next.js (App Router) + React + Tailwind + shadcn/ui (logical CSS classes, RTL-ready). UI only; business logic lives in the API                                                                                                           |
| Client state        | Zustand (stores only in client components, created per provider)                                                                                                                                                                         |
| Server state        | TanStack Query on top of the Hono RPC client                                                                                                                                                                                             |
| API                 | Hono + Hono RPC (`hc<AppType>`) + Zod validators                                                                                                                                                                                         |
| Auth                | Better Auth (username/password); accounts are created by admins; roles `admin` and `player`                                                                                                                                              |
| Database            | PostgreSQL + Prisma                                                                                                                                                                                                                      |
| Queue               | pg-boss (Postgres-backed, no Redis)                                                                                                                                                                                                      |
| Live updates        | SSE via Hono `streamSSE` (outside the typed RPC contract)                                                                                                                                                                                |
| Replay storage      | Full frames array, gzip JSON, in a Postgres `bytea` column                                                                                                                                                                               |
| Logging             | Seq as the log server, with a shared `packages/logger` (Pino + Seq transport) used by the API, the worker and the web server code. Browser logs reach Seq only through an authenticated API endpoint                                     |
| Reverse proxy       | Caddy in production; every public service sits behind it, with automatic HTTPS                                                                                                                                                           |
| Worker runtime      | Node                                                                                                                                                                                                                                     |
| Sandbox             | `nsjail`: one long-lived sandboxed process per bot, CPU and memory limits, no network, seccomp filter, per-tick CPU-time limit plus a wall-clock cap. Linux only, so development and CI use a Linux container. Behind a runner interface |
| Code editor         | Monaco Editor (lazy loaded). TypeScript and JavaScript get full IntelliSense from the game's generated declarations; Python gets game-driven completions, hover docs and signature help from the same definition                         |
| Question statements | MDX compiled on the server at save time and rendered with an allowlisted component set; authored by admins only                                                                                                                          |
| Judge               | Judge mode in the sandbox runner: one run per test case over stdin/stdout, with per-test time and memory limits                                                                                                                          |
| Tests               | Vitest (unit), Playwright (end-to-end, later)                                                                                                                                                                                            |

### Language runners

Each language is defined by a language spec in `packages/sandbox`: source file name, optional build command, run command and limits. Toolchains (Node, Python) are installed in the worker image and mounted read-only into the jail; each bot gets a small writable work directory (size-limited tmpfs). Build and run steps both execute inside `nsjail`.

| Language                                       | Build step                                                                                  | Run step                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Python                                         | Syntax check with `py_compile`                                                              | `python3 adapter.py`                                     |
| JavaScript                                     | None                                                                                        | `node adapter.js` with a heap limit                      |
| TypeScript                                     | Transpile to JavaScript with the TypeScript compiler API (types are stripped, not enforced) | `node adapter.js` on the transpiled file                 |
| Later: compiled languages (C#, Go, Rust, Java) | Compile once per submission with higher limits; the artifact is stored with the submission  | Run the stored artifact for every match, never recompile |

Quizzes use the same specs in judge mode: the build step runs once per answer and the run step runs once per test case.

## 3. Engineering conventions

- **Commits:** Conventional Commits, enforced by commitlint.
- **Git hooks:** Husky. `pre-commit` runs lint-staged (Prettier format + ESLint fix on staged files, then type check on affected packages); `commit-msg` runs commitlint.
- **Formatting:** Prettier with one shared config at the repo root. Code must be formatted before every commit.
- **Changelog:** generated from commits by git-cliff into `CHANGELOG.md`.
- **Contributing:** `CONTRIBUTING.md` documents setup, branch and commit rules, how to add a game, how to run tests, and the PR checklist.
- **Branches and PRs:** one feature per PR, small and reviewable.

## 4. Repository layout

```
apps/
  web/            # Next.js UI (auth, admin, quizzes, contests, viewer, changelog)
  api/            # Hono routes, exports AppType
  worker/         # job loop: validation, grading, matches
packages/
  engine/         # game interface + match runner (pure TS)
  games/tank/     # rules, bot API definition, helpers, samples, renderers (2D required, 3D optional)
  sandbox/        # runner interface, nsjail implementation, language specs and adapters
  judge/          # quizzes: test-case runner, output comparison, scoring
  logger/         # Pino + Seq transport (server) and the browser logger
  viewer/         # replay player shell
  shared/         # Zod schemas, types, constants
  db/             # Prisma schema, client, migrations
compose.yaml      # shared services (Postgres, Seq)
compose.dev.yaml  # development overrides
compose.prod.yaml # production (Caddy, web, api, worker)
Caddyfile
.env.example
CONTRIBUTING.md
CHANGELOG.md
```

## 5. Game interface

Every game is a plugin implementing: `init(seed, botIds)`, `step(actions)`, `getBotState(botId)`, `snapshot()`, `isOver()`, `results()`, a validation sample state, a supported player range (`minPlayers`, `maxPlayers`), a Zod schema for its contest settings, a bot API definition and a list of renderers (both below).

The engine never knows where actions come from; the sandbox is one implementation of an async `(state) => Promise<Action>` provider. The bot contract is language-neutral: one JSON state per tick in, one JSON action out, so every supported language implements the same `tick` function in its own idiom.

**Bot API definition.** The single source of truth for what a bot sees and returns: Zod schemas for the state and the action, plus the documented helper functions for each supported language. A build step in the game package generates everything else from it: `bot-api.d.ts` (TypeScript declarations), `bot_api.pyi` (Python stubs), a completion catalog (JSON of fields, helpers and docs), starter templates, and the reference part of the in-app guide. The server-side validator checks bot output against the same schemas, so editor hints, templates, docs and validation can never drift apart.

**Renderers.** A game provides at least one renderer (required, marked as the default) and any number of optional ones, for example a 2D canvas version and a 3D Three.js version of the same Tank game. All renderers of a game share one contract and read the same replay frames, so the choice is purely visual and the user picks it in the viewer.

```ts
type Renderer = {
  render(frame: Frame, alpha: number): void
  resize(): void
  destroy(): void
}
type RendererDefinition = {
  id: string // "2d", "3d"
  label: string // shown in the picker
  load: () => Promise<{ createRenderer(container: HTMLElement): Renderer }>
}
// game.renderers = { default: "2d", list: RendererDefinition[] }  // at least one entry
```

## 6. Feature delivery order

Delivery follows the product priorities: (1) users and roles, (2) questions, (3) quizzes with in-app coding and test cases, (4) games and bot coding, (5) contests. Infrastructure that a priority depends on is built just before it: the queue, worker and sandbox arrive in Phase 3 because quizzes need them; the engine, the interactive bot runner and the replay viewer arrive in Phases 5 and 6 because games need them.

Every phase ends with a **Try it** scenario: a feature you can click through in the UI to check that the phase works end to end, not only through API and technical tests.

Build in this order. Each item is a feature, not a task list. Finish and verify one before starting the next.

### Phase 0: Foundation

_Done when: a fresh clone installs, a commit with a bad message or unformatted code is blocked, the web app calls a typed API route, and the API's log lines appear in Seq._
_Try it: open the system status page and see the API, database and Seq reported healthy (open without login in development only; behind the admin role from Phase 1)._

1. Monorepo with TypeScript, ESLint, Prettier, Turborepo and CI.
2. Git workflow: Husky hooks, Conventional Commits with commitlint, lint-staged formatting before every commit.
3. `CONTRIBUTING.md` and git-cliff changelog generation.
4. Docker Compose setup (base, development and production files), `.env.example`, Prisma and Postgres, and an end-to-end typed Hono RPC call from the web app.
5. Structured logging: Seq in Compose (ingestion on the internal network only, UI password from `.env`), the shared `packages/logger`, and request-id middleware.
6. System status page showing the health of the API, database and Seq (the queue and sandbox are added in Phase 3).

### Phase 1: Users and roles

_Done when: an admin can create a user and assign a role, that user can sign in and sees only what the role allows, and browser errors reach Seq through the authenticated endpoint._
_Try it: sign in as the admin, create a player, sign out, sign in as the player, confirm the admin pages are blocked, then find the matching log lines in Seq._

7. Authentication: sign in, sign out and sessions with Better Auth; no self-registration.
8. Admin user management: create, edit and deactivate users, set the initial password, assign roles (`admin`, `player`); users can change their own password.
9. Role-based access control in the API and route guards in the UI, plus the app shell (navigation, layout), a changelog page that renders `CHANGELOG.md`, and the status page moved behind the admin role.
10. Client logging: an authenticated Hono endpoint (validated, size-limited and rate-limited, decision 37) and a browser logger for window errors, unhandled rejections and React error boundaries.

### Phase 2: Question bank

_Done when: an admin can write a question in MDX with test cases, preview it as students will see it, and edit or delete it._
_Try it: create a question with MDX (text, a code block and a sample), add sample and hidden tests, open the student preview, then edit and delete it._

11. Question management: title, MDX statement, tags, difficulty, time and memory limits, max score and output comparison rule.
12. MDX pipeline: compiled on the server at save time with an allowlisted component set, a live preview while authoring, and safe rendering for students.
13. Test case editor: visible sample tests and hidden tests, each with stdin and expected output.

### Phase 3: Execution core

_Done when: a code sample runs against test cases through the queue and returns per-test results, and hostile samples in all three languages cannot affect the worker._
_Try it: open the admin sandbox playground, paste code in Python, JavaScript or TypeScript, give stdin, run it and see stdout, time, memory and errors; run an infinite loop and a memory bomb and see them stopped._

14. pg-boss job queue and the worker loop (retries, stuck-job recovery), with queue and worker health added to the status page.
15. Sandbox runner interface with the `nsjail` implementation and language specs for Python, JavaScript and TypeScript (build once, run in the jail).
16. Judge mode: one run per test case over stdin/stdout, per-test time and memory limits, and output comparison rules (whitespace-trimmed exact match by default, strict or token-based per question).
17. Sandbox playground (admin tool): run any code with custom stdin through the real queue, worker and sandbox.
18. Security tests against hostile code in every language (infinite loop, memory bomb, huge output, fork bomb, network attempt, file access) and a startup and per-run speed benchmark per language.

### Phase 4: Quizzes

_Done when: an admin can build a quiz from the question bank and assign it, students take it under a timer with optional test runs, and grading returns the correct score and per-test results for correct, partly correct, failing, timeout and hostile solutions._
_Try it: as the admin build a quiz and preview it in the student view; as a player take it, test-run, submit and see the result; back as the admin, open the gradebook._

19. Quiz creation: tick questions from the bank and create the quiz, with settings for duration, open and close times, allowed languages, question shuffling, test-run permission and limit, scoring penalty and result visibility, then assign it to users.
20. Admin preview: take the quiz in the student view without touching the gradebook.
21. Student attempt flow: assigned quizzes list, server-authoritative timer, Monaco editor per question with a starter template per language, autosave, an option to upload a source file instead of typing, and final submit or auto-submit at the deadline.
22. Optional test runs, switched on per quiz by the admin: students run their code against the sample tests or custom input, rate-limited and count-limited, on a low-priority queue.
23. Grading: all test cases run for every answer on submit; full score if every test passes, otherwise the max score minus a penalty per failed test (decision 28); per-test results stored; admins can re-grade after fixing a test.
24. Results and gradebook: student result page, admin gradebook per quiz, manual score override and CSV export.

### Phase 5: Games, engine and Tank

_Done when: a registered game is played by built-in bots through the queue and worker and its replay is watchable; the same seed gives an identical replay; tests pass; no sample bot dominates the balance simulation._
_Try it: as the admin open the demo match page, pick Tank, set the number of players and a seed, start a match between the built-in sample bots and watch the replay with speed, scrubbing and the renderer picker._

25. Game interface and deterministic match engine with seeded RNG.
26. Tank game: rules, bot API definition, helpers, four sample bots and the required 2D renderer, with arena and spawn layout scaling to the player count.
27. Headless balance simulation script and engine unit tests.
28. Game registry: games are plugins in the repository; the admin panel lists them, enables or disables them and edits their default settings.
29. Replay storage and the viewer (play, pause, speed, scrubbing) with a renderer picker, a shared renderer contract test that every renderer must pass, and the choice remembered per user and game.
30. Demo match page (admin tool): run a match between built-in bots through the queue and worker, then watch it in the viewer.

### Phase 6: Bots and practice

_Done when: a player can write a bot in any supported language, validate and submit it, and watch a practice match; hostile bots are handled._
_Try it: as a player open the bot playground, pick Python, JavaScript or TypeScript, write a bot with editor suggestions, submit it, run a practice match against the sample bots, watch the replay and read the bot's errors and logs; then submit a broken bot and a hostile one and see clear feedback._

31. Interactive mode in the sandbox runner: long-lived process per bot, JSON lines over stdin/stdout, CPU-time limits, strikes, disqualification and error reporting.
32. Bot language adapters and starter templates for Python, JavaScript and TypeScript, plus the generated bot API package per game (declarations, stubs, completion catalog, docs) from one bot API definition.
33. Game-aware editor: suggestions for state and action types, helper functions, signature help and hover docs, an in-app guide per game, and a downloadable bot API bundle for local IDEs.
34. Bot submission with per-language validation (transpile or syntax check, then a sample-state run); only valid code is accepted and the latest valid version counts.
35. Practice matches (the bot playground): a player runs their bot against sample bots or their previous version, optionally with a fixed seed, and watches the replay next to the bot's errors and logs; rate-limited, low priority, replays expire.

### Phase 7: Contests and tournaments

_Done when: a simulated 100-player contest runs from the first draw to a final winner, with the admin only drawing, editing, publishing and starting rounds (or automatic mode doing the starting), and spectators see only published rounds and revealed results._
_Try it: as the admin start a dry-run contest with simulated participants, step through warm-up, draw, drag-and-drop editing, publish, matches, live view, reveal and the bracket, while a second browser signed in as a player sees only published rounds and revealed results._

36. Contest creation: the admin chooses one game and the participants (users), then sets the coding window, start mode, game settings (validated by the game's schema) and the default group size and advance count for new rounds.
37. Participant contest page: status, coding window countdown, bot editor and submission, practice matches.
38. Optional warm-up round (all players in one match, nobody eliminated, shown or hidden at the admin's choice) that produces the initial ranking, and round draw: the admin starts a round with any group size and an advance count, and players are drawn into balanced groups using the round's draw strategy (decision 12) as a hidden draft.
39. Draft editing with drag and drop, then publish: spectators only ever see published rounds, and edits are locked after publishing.
40. Match execution: contest start by admin button or timer with submissions frozen; matches in a published round start manually in order or automatically; multiple matches per group, scoring and tiebreakers; results advance players until a final winner.
41. Live match streaming over SSE with catch-up for late joiners, and result reveal when a match's broadcast ends.
42. World Cup-style bracket view across rounds (groups, match order, eliminated players and winners marked), per-round standings, final ranking, and match detail pages with replay link and bot warnings or errors.
43. Contest dry run (admin tool): a simulated contest with fake participants running the sample bots, to exercise the whole flow without real players.

### Phase 8: Hardening

_Done when: production deploys from CI, the load tests pass, and the sandbox review has no open findings._
_Try it: in the admin tools disqualify a bot, re-run a match and cancel a quiz, then follow each action in Seq._

44. Rate limits, upload size limits and admin tools (disqualify, re-run a match, cancel a contest or quiz).
45. Production deployment (Compose on a Linux VM behind Caddy, CI/CD, nightly database backups), load tests with 100 simulated contest players and a quiz grading spike (many students submitting together), and log-based dashboards and alerts in Seq.
46. Sandbox security review; move to gVisor or Firecracker isolation only if the review requires it.

### Phase 9: Later

47. Second game to prove the plugin interface.
48. Optional 3D renderer for the Tank game (Three.js, lazy loaded).
49. Self-registration and invite codes, bulk user import from CSV, global Elo or TrueSkill ladder, additional languages (C#, Go, Rust, Java), thumbnails and video export, Persian/RTL UI, function-style quiz questions (signature and test harness per language), plagiarism checks, automated Playwright end-to-end tests.

## 7. Data model

`User`, `Game`, `Contest` (with a `config` JSON validated by the game's Zod schema), `Participant`, `Submission` (code, language, status, validation result), `Round` (kind: warmup or normal, groupSize, advanceCount, drawStrategy, visibility: hidden or public, status: draft, published, running, done), `Group` (members, match order), `Match` (seed, status, replay, gameVersion), `MatchResult`, `BotLog` (stdout/stderr per bot per match), `PracticeMatch`, plus pg-boss's own job tables. Quizzes add `Question` (MDX statement, limits, max score, comparison rule), `TestCase` (stdin, expected output, visible or hidden), `Quiz` (settings JSON), `QuizQuestion` (order, score override), `QuizAttempt` (start, deadline, status), `QuizAnswer` (language, code, saved time), `AnswerResult` (per-test result, score) and `TestRun`.

## 8. Decisions

| #   | Topic                  | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Match timing           | Each bot gets 50 ms of CPU time per tick plus a hard 250 ms wall-clock cap. Concurrent matches = CPU cores / 2 (configurable by env)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2   | Build step             | TypeScript is transpiled and Python is syntax-checked inside the sandbox: 10 s, 512 MB, no network, standard library only. JavaScript needs no build step                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 3   | Bot isolation          | One sandboxed process per bot. Bots never share a process, thread or event loop                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 4   | Randomness             | The engine's randomness comes from the match seed. Where a language allows it, the adapter seeds that language's random generator. Randomness inside a bot is the player's own choice and is not required to be reproducible                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 5   | Infrastructure         | Linux dev container for development; worker on a Linux VM in a privileged container; pinned Node LTS and Python 3.12; standard library only in the first release. `nsjail` is Linux-only, so every developer and CI job uses the container                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 6   | Bot logs               | Capture stdout and stderr, up to 10 KB per bot per match, stored with the match                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 7   | Visibility             | Logged-in users only; live matches visible to all of them; bot logs only to the owner and admins; source code never public                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 8   | Deadline race          | Submissions received before the deadline (server time) count; the freeze waits up to 60 s for in-flight validations                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 9   | No valid code          | Excluded from the first round and listed as "no submission"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 10  | Group size             | No platform-wide limit: the admin enters any group size per round. Each game declares its supported range and must scale its arena and spawn layout with the player count. Before publishing, the admin UI shows a load estimate (bots x ticks) and warns if it looks heavy                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 11  | Warm-up round          | Optional round where all participants play one match (nobody is eliminated) to produce the initial ranking. Visibility is the admin's choice: hidden (spectators never see it and its results only feed the draw) or public. If the players exceed the game's `maxPlayers`, the warm-up is split into the fewest equal random groups and ranked by points, then damage, and the admin is warned that this ranking is less comparable                                                                                                                                                                                                                                                                                       |
| 12  | Round draw             | The admin picks a strategy per round. `random`: seeded shuffle, the default for round 1 when no warm-up was run. `pots`: the default for every round once a ranking exists; players are ranked by cumulative points, then damage, and split into pots of one player per group, and each group gets one random player from every pot, so strong players are spread out and meet later. `snake`: ranked players dealt in serpentine order for balanced total strength. `strong-together`: players grouped by strength, for exhibition or late rounds. Group sizes stay balanced (23 players with size 5 gives 5, 5, 5, 4, 4). The draft stays editable by drag and drop                                                      |
| 13  | Advance count          | Entered by the admin per round; default `ceil(group size / 2)`, minimum 1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 14  | Final round            | When the remaining players fit in one group, a final of 3 matches decided by total points                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 15  | Tiebreakers            | Total points, then damage, then kills, then fewest warnings, then a seeded draw                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 16  | Worker crash           | A failed match restarts from scratch with the same seed, up to 2 retries; partial results are discarded. After 2 failures the admin decides. A completed result is never overwritten without an admin action                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 17  | Live and reveal        | A match is fully simulated first, then streamed at 30 fps; late joiners can join mid-stream. A match's result and the bracket advancement become public when its broadcast ends (or when the admin reveals it), never when the simulation finishes. The featured match is chosen by the admin, otherwise the first match of the round                                                                                                                                                                                                                                                                                                                                                                                      |
| 18  | Match start            | Per-round setting: manual (admin starts each match in order) or automatic (matches run in order as workers become free); default manual                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 19  | Draft visibility       | Draft rounds exist only for admins: the spectator API never returns them and no live event is sent until the round is published. After publishing, group membership is locked; changes need an explicit admin "reopen"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 20  | Bracket display        | Each round shows groups with match order and status (pending, running, done); eliminated players are greyed out and the winners of each group and of the contest are highlighted                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 21  | Game settings          | `Contest.config` JSON validated by the game's Zod schema                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 22  | Participant docs       | In-app guide per game, with a starter template per language                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 23  | Deployment             | Docker Compose on one VM (Caddy, web, api, worker, Postgres, Seq), GitHub Actions CI/CD, nightly database backups                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 24  | Reverse proxy and auth | Caddy in production routes `/` to the web app and `/api` to Hono on one domain, so cookies work without CORS; Seq's UI is served on its own subdomain; Caddy is the only service with published ports (80 and 443)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 25  | Renderers              | Each game provides one required default renderer and any number of optional ones, all implementing the same contract over the same replay frames. The viewer shows a picker when a game has more than one, stores the choice per user and game (Zustand with localStorage), can switch during playback without losing the position, loads heavy renderers lazily, and falls back to the default renderer if one fails to load or the device lacks support. Renderers never affect game logic or stored replays                                                                                                                                                                                                             |
| 26  | Editor suggestions     | Each game's bot API definition generates the declarations, stubs, completion catalog, templates and guide reference. TypeScript and JavaScript use the Monaco language service with the generated declarations (JavaScript through JSDoc type checking). Python uses catalog-based completions, hover docs and signature help; full Python type checking is out of the first release. Suggestions are advisory: server-side validation stays the authority                                                                                                                                                                                                                                                                 |
| 27  | Language runners       | Each language is a language spec (file name, optional build command, run command, limits) executed inside `nsjail`. Python and JavaScript run directly, TypeScript is transpiled first, and compiled languages (later) are built once per submission with the artifact stored and reused for every match. Toolchains live in the worker image and are mounted read-only into the jail                                                                                                                                                                                                                                                                                                                                      |
| 28  | Quiz scoring           | Each question has a max score. All tests passed: full score. Otherwise the score is the max score minus a penalty for each failed test (default 1 point per failed test, set per question), never below the minimum score (default 0; admins can allow negative totals). A timeout, crash or build error counts as failing the affected tests                                                                                                                                                                                                                                                                                                                                                                              |
| 29  | Test cases             | Questions are programs reading stdin and writing stdout. Output is compared whitespace-trimmed by default. Sample tests are visible to students; hidden tests never leave the server, and hidden failures are reported as counts (admins can choose to show which test numbers failed)                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 30  | Test runs              | Switched on per quiz by the admin (default off), with a per-question run limit and a rate limit. They run only sample tests or the student's own input, never hidden tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 31  | Quiz timer             | Server-authoritative: deadline = the earlier of start + duration and the close time. Code autosaves periodically; on expiry the last saved code is graded and later submissions are rejected                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 32  | MDX safety             | Only admins author MDX. It is compiled on the server at save time with an allowlisted component set and no imports; students never supply MDX                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 33  | Quiz access            | Students use the same accounts and the player role; admins assign quizzes to users                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 34  | Accounts               | No self-registration in the first release: admins create users, set initial passwords and assign roles (`admin`, `player`). Users can change their own password                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 35  | Contest participants   | A contest is one game plus a list of users chosen by the admin; only those users can see and play it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 36  | Logging                | Seq collects all logs. Services send structured events to Seq's ingestion port (5341) over the internal Docker network only, without API keys (the ingestion port is reachable only from the internal network). Seq's web UI is reachable from outside through Caddy on its own subdomain and protected by Seq's own login; Caddy refuses the log-ingestion paths on that public site, so nothing can write logs from outside. In production Seq publishes no ports of its own. The admin password is set in plain text from `.env` (`SEQ_ADMIN_PASSWORD`, passed to Seq as `SEQ_FIRSTRUN_ADMINPASSWORD`). Services log only through `packages/logger`, with fields such as service, requestId, userId, matchId and quizId |
| 37  | Client logs            | Browser logs reach Seq only through a Hono endpoint that requires an authenticated session, validates a Zod schema (level allowlist, message up to 2 KB, up to 20 events per request, fixed field allowlist), rate-limits per user, and adds user id, request id and `source=client` on the server. It is built after authentication                                                                                                                                                                                                                                                                                                                                                                                       |
| 38  | Compose files          | `compose.yaml` holds shared services (Postgres, Seq). `compose.dev.yaml` publishes Postgres and Seq to localhost (Seq ingestion on 5341, UI on 8087), runs the worker in a privileged Linux dev container with the source mounted, and has no Caddy; the web and API run on the host with hot reload. `compose.prod.yaml` adds Caddy, web, api and worker, and puts them on two networks: `edge` (Caddy, web, api, Seq UI) and `internal` (Postgres, worker, Seq ingestion), with no published ports except Caddy's                                                                                                                                                                                                        |

## 9. Risks

| Risk                                      | Mitigation                                                                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sandbox escape or resource abuse          | `nsjail` namespaces, cgroup limits and seccomp filter, no secrets in the worker environment, runner interface allows gVisor or Firecracker later |
| Deadline spike (everyone submits at once) | Queue for validation, per-user rate limit                                                                                                        |
| Slow interpreter startup                  | Warm start before the match, larger first-tick timeout                                                                                           |
| Engine changes break old replays          | Store full frames and a `gameVersion` with each match                                                                                            |
| Hono RPC does not cover SSE well          | Keep the live stream as a separate documented protocol                                                                                           |
| Abuse of the client log endpoint          | Authenticated only, schema, size and rate limits, server-added identity (decision 37)                                                            |

## 10. Rules for the coding agent

- Follow the delivery order in section 6; do not skip ahead.
- One feature per branch and PR, with Conventional Commit messages.
- Engine and sandbox features need unit tests before they count as done.
- Keep game logic out of `apps/web`; the UI only renders and calls the API.
- Every new renderer must pass the shared renderer contract test.
- Hidden test cases and their expected outputs never leave the server.
- Services log only through `packages/logger`; no `console.log` in service code.
- Change the bot API only through the game's bot API definition; generated files are never edited by hand.
- Do not add dependencies outside the stack in section 2 without a written reason in the PR.
