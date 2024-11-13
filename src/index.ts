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
import { getKVLocalStoragePolyfill } from '@growthbook/edge-cloudflare';
import { getUUID, Context } from '@growthbook/edge-utils';

// export default {
// 	async fetch(request, env, ctx) {
//
// 		console.log(getUUID(Context<>, request));
//
// 		const growthbook = new GrowthBook({
// 			apiHost: env.GROWTHBOOK_API_HOST,
// 			clientKey: env.GROWTHBOOK_CLIENT_KEY,
// 			// @ts-ignore
// 			trackingCallback: (experiment, results) => {
// 				// todo: replace with your tracking library
// 				console.log('edge tracking callback', {experiment, results});
// 			}
// 		});
//
// 		growthbook.setAttributes({
// 			'cookieConsent': true
// 		})
//
// 		//
// 		// // 1. Init the GrowthBook SDK and choose an optional caching strategy
// 		//
// 		// // A. Use the KV as a managed payload store to eliminate SDK requests to the GrowthBook API entirely.
// 		// // Requires setting up an SDK Webhook.
// 		// // const payload = await getPayloadFromKV(env);
// 		// // await growthbook.init({ payload: payload });
// 		//
// 		// // B. Or provide a KV cache layer so that the GrowthBook SDK doesn't need to make as many requests
// 		// // to the GrowthBook API. No SDK Webhook needed.
// 		const localStoragePolyfill = getKVLocalStoragePolyfill(env);
// 		setPolyfills({ localStorage: localStoragePolyfill });
// 		await growthbook.init();
// 		//
// 		// // 2. Start feature flagging
// 		// if (growthbook.isOn("my-feature")) {
// 		// 	return new Response("<h1>foo</h1>");
// 		// }
// 		// return new Response("<h1>bar</h1>");
// 		if(growthbook.isOn('my-fat-feature')) {
// 				console.log('my-fat-feature is ON' )
// 		} else {
// 			console.log('my-fat-feature is OFF' )
// 		}
//
// 		return new Response(JSON.stringify(growthbook), {
// 			headers: {'Content-type': 'application/json'}
// 		});
// 	}
// }  satisfies ExportedHandler<Env>;

// EXP3 - works!
import { init } from './app/init';
import { edgeApp } from './utils';

export default {
	fetch: async function (request, env, ctx) {
		const context = await init(env, {
			attributes: {
				cookieConsent: true
			},
			edgeTrackingCallback: (experiment, results) => {
				// todo: replace with your tracking library
				console.log('edge tracking callback', {experiment, results});
			}
		});
		// @ts-ignore
		const { response, growthbook, body }: {response: Response, growthbook: GrowthBook, body?: any} = await edgeApp<Request, Response>(context, request);

		if(!growthbook) {
			return response;
		}

		console.log((growthbook as any)?.context?.attributes);
		console.log(growthbook?.getPayload());
		console.log('gbuuid', growthbook?.context?.attributes.id);
		console.log('my-fat-feature is', growthbook?.isOn('my-fat-feature') ? 'ON': 'OFF');

		let updatedHtml = "Whaha!"

		return response;

		// const res = new Response(updatedHtml, {headers: response.headers, status: response.status} );
		// return res;

	},
} satisfies ExportedHandler<Env>;


// EXP4 - goes wrong with resources (no images on site visible etc)

// import { handleRequest } from '@growthbook/edge-cloudflare';
// export default {
// 	fetch: async function (request, env, ctx) {
// 			return handleRequest(request, env, ctx);
// 	}
// }