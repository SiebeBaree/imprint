/* oxlint-disable no-await-in-loop -- Each dataset page decides whether another page exists. */
import { ApifyClient } from "apify-client";
import { z } from "zod";

import type { InstagramService } from "./types";
const postSchema = z.object({
    id: z.union([z.string(), z.number()]).optional(),
    shortCode: z.string().optional(),
    url: z.string().optional(),
    caption: z.string().optional(),
    displayUrl: z.string().optional(),
    images: z.array(z.string()).optional(),
    childPosts: z.array(z.object({ displayUrl: z.string().optional() })).optional(),
    error: z.string().optional(),
});
export function createInstagramService(token: string, limit: number): InstagramService {
    const client = new ApifyClient({ token, maxRetries: 2 });
    return {
        async start(url) {
            const run = await client
                .actor("apify/instagram-scraper")
                .start({ directUrls: [url], resultsType: "posts", resultsLimit: limit, addParentData: false });
            return run.id;
        },
        async result(runId) {
            const run = await client.run(runId).get();
            if (!run) throw new Error("Instagram scraper run was not found.");
            if (["READY", "RUNNING", "TIMING-OUT", "ABORTING"].includes(run.status))
                return { status: "running", posts: [], partial: false, message: "Importing public posts" };
            if (run.status !== "SUCCEEDED")
                return {
                    status: "failed",
                    posts: [],
                    partial: true,
                    message: `Instagram import ${run.status.toLowerCase()}. The profile may be private or unavailable.`,
                };
            const posts = [];
            let error = "";
            for (let offset = 0; offset < limit; offset += 100) {
                const page = await client
                    .dataset(run.defaultDatasetId)
                    .listItems({ offset, limit: Math.min(100, limit - offset), clean: true });
                for (const item of page.items) {
                    const parsed = postSchema.safeParse(item);
                    if (!parsed.success) continue;
                    const post = parsed.data;
                    if (post.error) {
                        error = post.error;
                        continue;
                    }
                    const images = [
                        ...new Set([
                            ...(post.images ?? []),
                            ...(post.childPosts ?? []).flatMap((child) => (child.displayUrl ? [child.displayUrl] : [])),
                            ...(post.displayUrl ? [post.displayUrl] : []),
                        ]),
                    ];
                    if (images.length)
                        posts.push({
                            id: String(post.id ?? post.shortCode ?? offset + posts.length),
                            url: post.url ?? "",
                            caption: post.caption ?? "",
                            images,
                        });
                }
                if (page.items.length < 100) break;
            }
            const partial = Boolean(error) || posts.length >= limit;
            return {
                status: posts.length ? "complete" : "failed",
                posts,
                partial,
                message: posts.length
                    ? `${posts.length} public posts found.${posts.length >= limit ? ` The import reached its ${limit}-post limit.` : " Instagram may not expose every post."}${error ? " Some posts were unavailable." : ""}`
                    : "No public images were found. Check the profile URL and try again. Private profiles cannot be imported.",
            };
        },
    };
}

export async function downloadInstagramImage(value: string): Promise<Uint8Array> {
    const url = new URL(value);
    if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.port ||
        !["cdninstagram.com", "fbcdn.net"].some((domain) => url.hostname.endsWith(`.${domain}`))
    )
        throw new Error("Unsupported Instagram image host.");
    const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(30_000) });
    if (!response.ok || !response.headers.get("content-type")?.startsWith("image/"))
        throw new Error(`Instagram image download failed (${response.status}).`);
    if (!response.body) throw new Error("Instagram returned an empty image.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for await (const chunk of response.body) {
        size += chunk.length;
        if (size > 20 * 1024 * 1024) {
            await response.body.cancel().catch(() => {});
            throw new Error("Instagram image exceeds 20 MB.");
        }
        chunks.push(chunk);
    }
    return new Uint8Array(Buffer.concat(chunks));
}
