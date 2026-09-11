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
