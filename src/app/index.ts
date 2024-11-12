import { edgeApp, Config } from "../utils";
import { init, Env } from "./init";

export async function handleRequest(
  request: Request,
  env: Env,
  config?: Partial<Config>,
) {
  const context = await init(env, config);
  console.log('HERE!')
  return (await edgeApp<Request, Response>(context, request)) as Response;
}

export type { Env } from "./init";
export { getKVLocalStoragePolyfill, getPayloadFromKV } from "./init";
