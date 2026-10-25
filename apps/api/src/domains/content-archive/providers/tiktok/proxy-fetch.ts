/** Proxy reads pin CONNECT to a validated public IP and preserve the original TLS SNI/Host.
 * DNS uses HTTPS through the selected proxy; no system DNS or proxy configuration is modified. */
import { isIP } from "node:net";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
import { ProxyAgent, fetch as proxyFetch, request } from "undici";
import {
  assertPublicRemoteUrl,
  createRemoteFetch,
  type AddressResolver,
  type RemoteFetch,
  type ResolvedAddress
} from "../../../../security/remote-fetch";

export async function resolveProxyPublicAddress(
  host: string,
  proxyUrl: string,
  signal?: AbortSignal
): Promise<ResolvedAddress[]> {
  if (isIP(host)) return [{ address: host, family: isIP(host) }];
  const dispatcher = new ProxyAgent(proxyUrl);
  let response: Awaited<ReturnType<typeof proxyFetch>> | undefined;
  try {
    response = await proxyFetch(`https://1.1.1.1/dns-query?name=${encodeURIComponent(host)}&type=A`, {
      dispatcher,
      redirect: "error",
      signal: AbortSignal.any([AbortSignal.timeout(10_000), ...(signal ? [signal] : [])]),
      headers: { accept: "application/dns-json" }
    });
    if (!response.ok) throw new Error("PROXY_DNS_UNAVAILABLE");
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    for await (const chunk of response.body ?? []) {
      bytes += chunk.byteLength;
      if (bytes > 65536) throw new Error("PROXY_DNS_RESPONSE_TOO_LARGE");
      chunks.push(chunk);
    }
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (
      !value ||
      typeof value !== "object" ||
      !("Status" in value) ||
      value.Status !== 0 ||
      !("Answer" in value) ||
      !Array.isArray(value.Answer)
    )
      throw new Error("PROXY_DNS_UNAVAILABLE");
    const addresses = value.Answer.flatMap((answer: unknown) => {
      if (
        !answer ||
        typeof answer !== "object" ||
        !("type" in answer) ||
        answer.type !== 1 ||
        !("data" in answer) ||
        typeof answer.data !== "string" ||
        isIP(answer.data) !== 4
      )
        return [];
      return [{ address: answer.data, family: 4 }];
    });
    await assertPublicRemoteUrl(new URL(`https://${host}/`), async () => addresses);
    return addresses;
  } finally {
    await response?.body?.cancel().catch(() => undefined);
    await dispatcher.destroy();
  }
}

async function fetchPinnedProxy(
  url: URL,
  address: ResolvedAddress,
  proxyUrl: string,
  init: RequestInit
): Promise<Response> {
  const pinned = new URL(url);
  pinned.hostname = address.family === 6 ? `[${address.address}]` : address.address;
  const dispatcher = new ProxyAgent({ uri: proxyUrl, requestTls: { servername: url.hostname } });
  const headers = new Headers(init.headers);
  headers.set("host", url.host);
  headers.delete("cookie");
  headers.delete("authorization");
  headers.delete("proxy-authorization");
  headers.set("accept-encoding", "identity");
  let response: Awaited<ReturnType<typeof request>>;
  try {
    response = await request(pinned, {
      method: "GET",
      signal: init.signal ?? undefined,
      headers: Object.fromEntries(headers),
      dispatcher
    });
  } catch (error) {
    await dispatcher.destroy();
    throw error;
  }
  const resultHeaders = new Headers();
  for (const [name, value] of Object.entries(response.headers)) {
    if (Array.isArray(value)) for (const item of value) resultHeaders.append(name, item);
    else if (value !== undefined) resultHeaders.set(name, value);
  }
  const encoding = resultHeaders.get("content-encoding")?.toLowerCase();
  const decoder =
    encoding === "gzip"
      ? createGunzip()
      : encoding === "br"
        ? createBrotliDecompress()
        : encoding === "deflate"
          ? createInflate()
          : undefined;
  const stream = decoder ? response.body.pipe(decoder) : response.body;
  if (decoder) response.body.on("error", (error) => decoder.destroy(error));
  const reader = stream[Symbol.asyncIterator]();
  let finished = false;
  const finish = async () => {
    if (finished) return;
    finished = true;
    init.signal?.removeEventListener("abort", abort);
    response.body.destroy();
    decoder?.destroy();
    await dispatcher.destroy();
  };
  const abort = () => {
    void finish();
  };
  init.signal?.addEventListener("abort", abort, { once: true });
  if (init.signal?.aborted) abort();
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await reader.next();
        if (finished) {
          controller.error(init.signal?.reason ?? new DOMException("Request aborted", "AbortError"));
          return;
        }
        if (next.done) {
          controller.close();
          await finish();
        } else controller.enqueue(next.value as Uint8Array);
      } catch (error) {
        controller.error(error);
        await finish();
      }
    },
    async cancel() {
      await finish();
    }
  });
  return Object.defineProperty(new Response(body, { status: response.statusCode, headers: resultHeaders }), "url", {
    value: url.toString()
  });
}

export function createPinnedTikTokProxyFetch(
  proxyUrl: string,
  options: {
    resolver?: AddressResolver;
    fetchPinned?: typeof fetchPinnedProxy;
  } = {}
): RemoteFetch {
  return async (input, init = {}) => {
    init.signal?.throwIfAborted();
    const resolver =
      options.resolver ?? ((host: string) => resolveProxyPublicAddress(host, proxyUrl, init.signal ?? undefined));
    const addresses = new Map<string, ResolvedAddress>();
    const fetch = createRemoteFetch({
      requireHttps: true,
      maxRedirects: 5,
      resolver: async (host) => {
        const result = await resolver(host);
        if (result[0]) addresses.set(host, result[0]);
        return result;
      },
      fetchImpl: async (request, requestInit) => {
        const url = new URL(String(request));
        const hostname = url.hostname
          .toLowerCase()
          .replace(/^\[|\]$/g, "")
          .replace(/\.$/, "");
        const address =
          addresses.get(hostname) ?? (isIP(hostname) ? { address: hostname, family: isIP(hostname) } : undefined);
        if (!address) throw new Error("TIKTOK_UNVALIDATED_ADDRESS");
        return (options.fetchPinned ?? fetchPinnedProxy)(url, address, proxyUrl, requestInit ?? {});
      }
    });
    return fetch(input, init);
  };
}
