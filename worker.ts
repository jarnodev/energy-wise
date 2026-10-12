// Custom Worker entry: the OpenNext fetch handler plus a cron handler for background jobs
// @ts-expect-error .open-next/worker.js is generated at build time and has no type declarations
import { default as handler } from "./.open-next/worker.js";
import { runScheduled } from "./lib/jobs";

export default {
	fetch: handler.fetch,
	async scheduled(_controller, env, ctx)
	{
		ctx.waitUntil(runScheduled(env).then((result) => console.log(JSON.stringify(result))));
	},
} satisfies ExportedHandler<CloudflareEnv>;
