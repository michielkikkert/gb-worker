import {
  AutoExperimentVariation, configureCache,
  GrowthBook,
  helpers,
  setPolyfills,
  StickyBucketService
} from "@growthbook/growthbook";
import { Context } from "./types";
import { getUserAttributes } from "./attributes";
import { getCspInfo, injectScript } from "./inject";
import { applyDomMutations } from "./domMutations";
import redirect from "./redirect";
import { getRoute } from "./routing";
import { EdgeStickyBucketService } from "./stickyBucketService";

export async function edgeApp<Req, Res>(
  context: Context<Req, Res>,
  req: Req,
  res?: Res,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  next?: any,
): Promise<any> {
  let url = context.helpers.getRequestURL?.(req) || "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let headers: Record<string, any> = {
    // "content-type": "text/html",
  };
  const cookies: Record<string, string> = {};
  const setCookie = (key: string, value: string) => {
    cookies[key] = value;
  };
  const { csp, nonce } = getCspInfo(context as Context<unknown, unknown>);
  if (csp) {
    headers["Content-Security-Policy"] = csp;
  }
  let body = "";

  // Non GET requests are proxied
  if (context.helpers.getRequestMethod?.(req) !== "GET") {
    const response = await context.helpers.proxyRequest?.(context, req, res, next);
    return {
      response,
      growthbook: null
    }
  }
  // Check the url for routing rules (default behavior is intercept)
  const route = getRoute(context as Context<unknown, unknown>, url);

  if (route.behavior === "error") {
    const response = context.helpers.sendResponse?.(
      context,
      res,
      headers,
      route.body || "",
      cookies,
      route.statusCode,
    );
    return {response, growthbook: null};
  }
  if (route.behavior === "proxy") {
    const response = await context.helpers.proxyRequest?.(context, req, res, next);
    return {
      response,
      growthbook: null
    }
  }

  const attributes = getUserAttributes(context, req, url, setCookie);

  let domChanges: AutoExperimentVariation[] = [];
  const resetDomChanges = () => (domChanges = []);

  let preRedirectChangeIds: string[] = [];
  const setPreRedirectChangeIds = (changeIds: string[]) =>
    (preRedirectChangeIds = changeIds);

  if (context.config.localStorage)
    setPolyfills({ localStorage: context.config.localStorage });
  if (context.config.crypto)
    setPolyfills({ SubtleCrypto: context.config.crypto });
  if (context.config.staleTTL !== undefined)
    configureCache({ staleTTL: context.config.staleTTL });
  if (context.config.fetchFeaturesCall)
    helpers.fetchFeaturesCall = context.config.fetchFeaturesCall;

  let stickyBucketService:
    | EdgeStickyBucketService<Req, Res>
    | StickyBucketService
    | undefined = undefined;
  if (context.config.enableStickyBucketing) {
    stickyBucketService =
      context.config.edgeStickyBucketService ??
      new EdgeStickyBucketService<Req, Res>({
        context,
        prefix: context.config.stickyBucketPrefix,
        req,
      });
  }

  const originUrl = getOriginUrl(context as Context<unknown, unknown>, url);

  /* eslint-disable @typescript-eslint/no-explicit-any */
  let fetchedResponse:
    | (Res & { status: number; headers: Record<string, any>; text: any })
    | undefined = undefined;
  try {
    fetchedResponse = (await context.helpers.fetch?.(
      context as Context<Req, Res>,
      originUrl,
      /* eslint-disable @typescript-eslint/no-explicit-any */
    )) as Res & { status: number; headers: Record<string, any>; text: any };

    if(!fetchedResponse.headers?.get('content-type')?.includes('text/html')) {
      // console.log('NOT HTML - > fallthrough', url)
      // const response = await context.helpers.proxyRequest?.(context, req, res, next);
      return {
        response: fetchedResponse,
        growthbook: null,
        body: null,
      }
    } else {
      console.log('Processing', originUrl);
    }

    const status = parseInt(fetchedResponse.status ? fetchedResponse.status + "" : "400");
    if (status >= 500) {
      console.error("Fetch: 5xx status returned");
      const response = context.helpers.sendResponse?.(
        context,
        res,
        headers,
        "Error fetching page",
        cookies,
        500,
      );
      return {
        response,
        growthbook: null
      }
    }
    if (status >= 400) {
      const response = await context.helpers.proxyRequest?.(context, req, res, next);
      return {
        response,
        growthbook: null
      }
    }
  } catch (e) {
    console.error(e);
    const response = context.helpers.sendResponse?.(
      context,
      res,
      headers,
      "Error fetching page",
      cookies,
      500,
    );
    return {
      response,
      growthbook: null
    }
  }

  const growthbook = new GrowthBook({
    apiHost: context.config.apiHost,
    clientKey: context.config.clientKey,
    decryptionKey: context.config.decryptionKey,
    attributes,
    applyDomChangesCallback: (changes: AutoExperimentVariation) => {
      console.log(' >>>>>>>>>> applyDomChangesCallback', changes)
      domChanges.push(changes);
      return () => {};
    },
    url,
    disableVisualExperiments: ["skip", "browser"].includes(
      context.config.runVisualEditorExperiments,
    ),
    disableJsInjection: context.config.disableJsInjection,
    disableUrlRedirectExperiments: ["skip", "browser"].includes(
      context.config.runUrlRedirectExperiments,
    ),
    disableCrossOriginUrlRedirectExperiments: ["skip", "browser"].includes(
      context.config.runCrossOriginUrlRedirectExperiments,
    ),
    stickyBucketService,
    trackingCallback: context.config.edgeTrackingCallback,
  });

  await growthbook.init({
    streaming: true,
    payload: context.config.payload,
  });

  const oldUrl = url;
  url = await redirect({
    context: context as Context<unknown, unknown>,
    req,
    setCookie,
    growthbook,
    previousUrl: url,
    resetDomChanges,
    setPreRedirectChangeIds: setPreRedirectChangeIds,
  });



  if (context.config.forwardProxyHeaders && fetchedResponse?.headers) {
    headers = fetchedResponse.headers;
  }

  body = await fetchedResponse.text();
  body = await applyDomMutations({
    body,
    nonce,
    domChanges,
  });

  body = injectScript({
    context: context as Context<unknown, unknown>,
    body,
    nonce,
    growthbook,
    attributes,
    preRedirectChangeIds,
    url,
    oldUrl,
  });

  const response = context.helpers.sendResponse?.(context, res, headers, body, cookies);

  return {
    response,
    growthbook,
    body
  }
}

export function getOriginUrl(context: Context, currentURL: string): string {
  const proxyTarget = context.config.proxyTarget;
  const currentParsedURL = new URL(currentURL);
  const proxyParsedURL = new URL(proxyTarget);

  const protocol = proxyParsedURL.protocol
    ? proxyParsedURL.protocol
    : currentParsedURL.protocol;
  const hostname = proxyParsedURL.hostname
    ? proxyParsedURL.hostname
    : currentParsedURL.hostname;
  const port = proxyParsedURL.port
    ? proxyParsedURL.port
    : protocol === "http:"
    ? "80"
    : "443";

  let newURL = `${protocol}//${hostname}`;
  if ((protocol === "http" && port !== "80") || port !== "443") {
    newURL += `:${port}`;
  }
  newURL += `${currentParsedURL.pathname}`;
  if (currentParsedURL.search) {
    newURL += currentParsedURL.search;
  }
  if (currentParsedURL.hash) {
    newURL += currentParsedURL.hash;
  }

  return newURL;
}
