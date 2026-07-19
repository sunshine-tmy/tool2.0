import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { Readable, Transform } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

export type ResolvedAddress = { address: string; family: number };
export type AddressResolver = (hostname: string) => Promise<ResolvedAddress[]>;
export type RemoteFetch = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Limits only the time spent establishing a remote request and receiving its
 * response headers.  Do not leave the abort signal attached to a response body:
 * that would terminate a valid long-running media download after the timeout.
 */
export async function fetchRemoteResponse(
  remoteFetch: RemoteFetch,
  url: string,
  init: Omit<RequestInit, "signal">,
  timeoutMs: number
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await remoteFetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`Remote request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function createRemoteFetch(
  options: {
    resolver?: AddressResolver;
    fetchImpl?: typeof fetch;
    maxRedirects?: number;
  } = {}
): RemoteFetch {
  const resolver = options.resolver ?? resolveAllAddresses;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const maxRedirects = options.maxRedirects ?? 3;

  return async (input, init = {}) => {
    let current = new URL(input);

    for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
      await assertPublicRemoteUrl(current, resolver);
      const response = await fetchImpl(current.toString(), { ...init, redirect: "manual" });
      if (!isRedirect(response.status)) return response;

      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) throw new Error("Remote redirect did not include a Location header");
      if (redirectCount === maxRedirects) throw new Error("Remote URL exceeded the redirect limit");
      current = new URL(location, current);
    }

    throw new Error("Remote URL exceeded the redirect limit");
  };
}

export async function assertPublicRemoteUrl(url: URL, resolver: AddressResolver = resolveAllAddresses) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS remote URLs are allowed");
  }
  if (url.username || url.password) throw new Error("Remote URLs cannot contain credentials");
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new Error("Remote URLs can only use ports 80 and 443");
  }

  const hostname = url.hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
  if (!hostname || isLocalHostname(hostname)) throw new Error("Local network URLs are not allowed");

  const literalFamily = isIP(hostname);
  const addresses = literalFamily ? [{ address: hostname, family: literalFamily }] : await resolver(hostname);
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error("Remote URL resolves to a private or reserved network address");
  }
}

export function assertRemoteResponseSize(response: Response, maxBytes: number) {
  const rawLength = response.headers.get("content-length");
  if (!rawLength) return;
  const length = Number(rawLength);
  if (!Number.isSafeInteger(length) || length < 0 || length > maxBytes) {
    throw new Error(`Remote response exceeds the ${maxBytes} byte limit`);
  }
}

export function limitedResponseStream(response: Response, maxBytes: number) {
  if (!response.body) throw new Error("Remote response did not include a body");
  let received = 0;
  const source = Readable.fromWeb(response.body as unknown as NodeReadableStream<Uint8Array>);
  const limiter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      received += chunk.length;
      if (received > maxBytes) {
        callback(new Error(`Remote response exceeds the ${maxBytes} byte limit`));
        return;
      }
      callback(null, chunk);
    }
  });
  // Errors from the Web-stream source are not forwarded by Node's .pipe().
  // Forward them to the stream handed to Fastify so they can be handled by the
  // request lifecycle instead of becoming an unhandled process-level error.
  source.once("error", (error) => limiter.destroy(error));
  return source.pipe(limiter);
}

async function resolveAllAddresses(hostname: string) {
  return lookup(hostname, { all: true, verbatim: true });
}

function isRedirect(status: number) {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function isLocalHostname(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".lan")
  );
}

function isPublicAddress(value: string) {
  const normalized = value.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized.startsWith("::ffff:")) return isPublicAddress(normalized.slice(7));
  if (isIP(normalized) === 4) return isPublicIpv4(normalized);
  if (isIP(normalized) === 6) return isPublicIpv6(normalized);
  return false;
}

function isPublicIpv4(value: string) {
  const [a, b] = value.split(".").map(Number);
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && (b === 0 || b === 168)) return false;
  if (a === 198 && (b === 18 || b === 19 || b === 51)) return false;
  if (a === 203 && b === 0) return false;
  return true;
}

function isPublicIpv6(value: string) {
  return !(
    value === "::" ||
    value === "::1" ||
    value.startsWith("fc") ||
    value.startsWith("fd") ||
    /^fe[89ab]/.test(value) ||
    value.startsWith("ff") ||
    value.startsWith("2001:db8:")
  );
}
