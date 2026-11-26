# Hosted language model for fictional morning notes

GitHub Pages serves the interface. The optional Cloudflare Worker calls Llama 3.3 through its Workers AI binding and returns a label and a verbatim excerpt. The browser sends only the note after the reviewer selects the hosted method and clicks **Analyse note**. The Worker has no application logging or database. Cloudflare handles the hosted request. Use fictional text.

## Connect a preview

1. Sign in to a Cloudflare account on the **Workers Free** plan. Enable Workers AI and register the account's workers.dev subdomain if prompted. Check the account plan before deploying. The Free plan stops AI requests at its daily allocation. [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
2. From the repository root, run `npx wrangler@4 login` and `npx wrangler@4 deploy --config worker/wrangler.jsonc`. Wrangler prints the Worker's HTTPS address. The Worker uses an AI binding, so the browser needs no API key. [Workers AI setup](https://developers.cloudflare.com/workers-ai/get-started/workers-wrangler/)
3. The preview branch already points to the project's Worker. If deploying your own, set the `content` of the `diary-api-url` meta tag in `index.html` to its HTTPS address followed by `/api/diary/analyse`, and update its allowed dashboard origins.
4. For a local preview run `python3 -m http.server 8000 --bind 127.0.0.1` from the repository root. Open `http://127.0.0.1:8000/#patients` and select **Morning diary → Review diary with AI → Hosted language model**. Direct file opening retains offline analysis. The committed origin allowlist also accepts this repository owner's GitHub Pages origin.

The Worker accepts JSON with one field, `note`, of up to 1,200 characters and limits repeated requests per client. The browser origin check controls cross-origin browser access. The endpoint is public and shares the account's daily quota. Notes with ambiguous support can return `unclear`; empty notes bypass inference. Invalid output or unavailable inference produces an error, with the offline classifier available as a separate method.
