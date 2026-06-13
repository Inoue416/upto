import normalizeUrl from "normalize-url";
import { parse } from "tldts";

export function normalizeArticleUrl(input: string): string {
  const normalized = normalizeUrl(input, {
    removeDirectoryIndex: true,
    removeTrailingSlash: true,
    stripHash: true,
    stripProtocol: false,
  });
  const parsed = parse(normalized);

  if (!parsed.domain) {
    throw new Error(`Invalid article URL: ${input}`);
  }

  return normalized;
}
