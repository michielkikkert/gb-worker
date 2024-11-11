// EXP1
// export default {
// 	async fetch(request, env, ctx): Promise<Response> {
// 		let res = await fetch('https://www.mintminds.com');
// 		res = new Response(res.body);
// 		res.headers.append('Content-Type', 'text/html');
// 		return res;
// 	},
// } satisfies ExportedHandler<Env>;

//EXP2

// import { GrowthBook, setPolyfills } from "@growthbook/growthbook";
// import { getPayloadFromKV, getKVLocalStoragePolyfill } from "@growthbook/edge-cloudflare";

// export default {
// 	async fetch(request, env, ctx) {
// 		const growthbook = new GrowthBook();
//
//
// 		// 1. Init the GrowthBook SDK and choose an optional caching strategy
//
// 		// A. Use the KV as a managed payload store to eliminate SDK requests to the GrowthBook API entirely.
// 		// Requires setting up an SDK Webhook.
// 		// const payload = await getPayloadFromKV(env);
// 		// await growthbook.init({ payload: payload });
//
// 		// B. Or provide a KV cache layer so that the GrowthBook SDK doesn't need to make as many requests
// 		// to the GrowthBook API. No SDK Webhook needed.
// 		// const localStoragePolyfill = getKVLocalStoragePolyfill(env);
// 		// setPolyfills({ localStorage: localStoragePolyfill });
// 		await growthbook.init();
//
// 		// 2. Start feature flagging
// 		if (growthbook.isOn("my-feature")) {
// 			return new Response("<h1>foo</h1>");
// 		}
// 		return new Response("<h1>bar</h1>");
// 	}
// }  satisfies ExportedHandler<Env>;

import { handleRequest } from "@growthbook/edge-cloudflare";

export default {
	fetch: async function (request, env, ctx) {



		const response = await handleRequest(request, env);

		console.log(response.body)

		return response;
		// return new Response("<h1>bar</h1>");
	},
} satisfies ExportedHandler<Env>;
