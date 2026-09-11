# Deficit and Debt Calculator

A single-page simulator for the US federal budget. Pick from CBO-scored spending cuts and revenue options (or set totals directly), choose an AI growth scenario, choose how hard the economy reacts to austerity, and read off the yearly deficit, debt held by the public, and GDP against the CBO February 2026 baseline.

Built for Giroux Technologies · girouxtech.com · chuck@girouxtech.com

## Run locally

```bash
npm install
ANTHROPIC_API_KEY=sk-ant-... node server.js
```

Then open http://localhost:8080. The only dependency is the official Anthropic SDK, used by the "Ask Claude about side effects" button. Without the key the page still works and hides that button.

## Host on Replit

1. Create a new Repl and choose **Import from GitHub**, or create a blank Node.js Repl and upload this folder.
2. Open **Secrets** and add `ANTHROPIC_API_KEY`. Optional: `CLAUDE_MODEL` (defaults to `claude-opus-5`).
3. Press **Run**. The `.replit` file installs the SDK and starts `server.js` on port 8080.
4. To publish, open **Deploy** and pick **Autoscale** (the `.replit` file already sets it). Static hosting will not work because the side-effects button needs the server.

## If the summary never comes back

The Claude call takes 20 to 90 seconds, longer than most hosting proxies keep a request open. So the browser submits the job, gets an immediate "pending" reply, and re-sends the same request every few seconds until the answer lands. Polling by re-sending is idempotent, so it still works when Autoscale routes the poll to a different instance.

First place to look: open `/api/status` on the deployed app. It reports whether a credential was found and which kind, the model, and the last five job outcomes with duration and error text. The server also logs every job to the console:

```
[analyze] job 94e9762b... started (4 options, model claude-opus-5)
[analyze] job 94e9762b... finished in 41.2s, stop_reason=end_turn, input=1843, output=912
```

If a job shows `finished` but the page shows an error, the log line right after it says why (reply shape, refusal, or max_tokens). If a job never logs `finished` or `failed`, the process was restarted mid-call; on Replit that usually means the Repl went to sleep or was redeployed.

## Identity federation instead of an API key

The server builds the Anthropic client with no key argument, so it uses the SDK's credential chain. On a host that mints OIDC identity tokens for the running app (Google Cloud Run, AWS, Azure, Kubernetes, GitHub Actions), you can skip the API key entirely: set up Workload Identity Federation in the Claude Console and inject `ANTHROPIC_FEDERATION_RULE_ID`, `ANTHROPIC_ORGANIZATION_ID`, `ANTHROPIC_SERVICE_ACCOUNT_ID`, `ANTHROPIC_IDENTITY_TOKEN_FILE` (and `ANTHROPIC_WORKSPACE_ID` if the rule spans workspaces). Leave `ANTHROPIC_API_KEY` unset, since it outranks federation.

Replit does not mint OIDC tokens for deployed apps. Its Repl Identity token is a PASETO signed with Ed25519 and has no OIDC issuer or JWKS endpoint, so Anthropic cannot verify it. On Replit, keep the API key in Secrets; scope it to one workspace with a spending limit.

## How the Claude call is hardened

- The API key lives only on the server. The browser calls `POST /api/analyze` on the same origin.
- The browser sends only numbers and option ids. The server rejects unknown fields, non-numeric values, out-of-range numbers, unknown option ids, bodies over 16 KB, and requests without the `X-Requested-With` header.
- The server recomputes the scenario itself and builds the prompt from its own copy of the option list. No visitor-typed text can reach the prompt.
- The system prompt tells Claude the scenario is data, not instructions, and the reply is constrained to a fixed JSON schema.
- The page renders the reply with `textContent` only. Nothing from the model is interpreted as HTML.
- Per-IP rate limit of 8 calls per 10 minutes, at most 4 calls in flight, and identical scenarios are served from a 10-minute cache.

## Files

| File | Purpose |
|---|---|
| `public/index.html` | Page structure and copy |
| `public/styles.css` | Page styles on top of the GT brand tokens |
| `public/gt-brand.css` | Giroux Technologies brand tokens |
| `public/model.js` | The fiscal model. Runs in the browser and in Node |
| `public/options.js` | The policy menu: CBO-scored options with ten-year savings and multiplier classes |
| `public/analysis.js` | Builds and validates the Claude request and reply. Shared by browser and server |
| `public/app.js` | Controls, charts, table, and URL sharing |
| `server.js` | Static server plus the hardened `/api/analyze` route |

## Check the model from the command line

```bash
node -e "const M=require('./public/model.js'); console.log(M.run({cutPct:2, revPct:1}).summary)"
```
