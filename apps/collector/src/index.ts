import { readCollectorConfig } from "./config.js";
import { defaultFeedTargets } from "./feeds.js";
import { runCollector } from "./run-collector.js";

const config = readCollectorConfig();

await runCollector({
  config,
  feeds: defaultFeedTargets,
});
