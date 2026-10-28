/** Read only normal page data and owner-bound pagination responses. Never signs or calls private APIs. */
import { TIKTOK_PROFILE_MAX_WORKS, type TikTokProfileWork } from "@toolbox/shared/archive";
import { ArchiveTaskError } from "../../core/provider";
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const text = (value: unknown) => (typeof value === "string" ? value : undefined);
type ProfileIdentity = { username: string; id?: string; secUid?: string; declaredCount?: number };

export function readProfileIdentity(value: unknown, username: string): ProfileIdentity | undefined {
  const root = object(value),
    detail = object(object(root.__DEFAULT_SCOPE__)["webapp.user-detail"]);
  const info = object(detail.userInfo),
    old = object(root.UserModule);
  const user = object(info.user ?? object(old.users)[username]);
  if (text(user.uniqueId)?.toLowerCase() !== username.toLowerCase()) return undefined;
  if (user.privateAccount === true)
    throw new ArchiveTaskError("TIKTOK_PROFILE_PRIVATE", "该账号为私密账号，主页归档只读取公开作品", 409);
  const stats = object(info.stats ?? object(old.stats)[username]);
  const count = Number(stats.videoCount);
  return {
    username: username.toLowerCase(),
    id: text(user.id),
    secUid: text(user.secUid),
    ...(Number.isSafeInteger(count) && count >= 0 && count <= 10_000_000 ? { declaredCount: count } : {})
  };
}
type ProfilePage = { items: TikTokProfileWork[]; hasMore: boolean; cursor: string };
export function readProfilePage(value: unknown, identity: ProfileIdentity): ProfilePage {
  const data = object(value);
  if (data.statusCode !== 0 || !Array.isArray(data.itemList))
    throw new ArchiveTaskError(
      "TIKTOK_PROFILE_PAGE_INVALID",
      "TikTok 未返回有效的公开作品分页，可能需要登录或验证",
      409
    );
  const more = data.hasMore ?? data.has_more,
    cursor = String(data.cursor ?? "");
  if (![true, false, 0, 1].includes(more as boolean) || !/^\d{1,24}$/.test(cursor) || data.itemList.length > 100)
    throw new ArchiveTaskError("TIKTOK_PROFILE_PAGE_INVALID", "主页分页协议不兼容，未确认列表完整", 409);
  const items = data.itemList.map((entry: unknown) => {
    const item = object(entry),
      author = object(item.author),
      uniqueId = text(author.uniqueId),
      id = text(item.id);
    const owner = uniqueId
      ? uniqueId.toLowerCase() === identity.username
      : identity.id && (text(author.id) ?? text(item.author)) === identity.id;
    if (!owner || !id || !/^\d{5,24}$/.test(id))
      throw new ArchiveTaskError("TIKTOK_PROFILE_IDENTITY_MISMATCH", "分页包含无法确认归属的作品，已停止读取", 409);
    const time = Number(item.createTime),
      createdAt =
        Number.isFinite(time) && time > 0 && time < 253_402_300_800 ? new Date(time * 1000).toISOString() : undefined;
    return {
      id,
      url: `https://www.tiktok.com/@${identity.username}/video/${id}`,
      ...(text(item.desc) ? { title: String(item.desc).slice(0, 500) } : {}),
      ...(createdAt ? { createdAt } : {})
    };
  });
  return { items, cursor, hasMore: more === true || more === 1 };
}

export class ProfileCollector {
  readonly works = new Map<string, TikTokProfileWork>();
  identity: ProfileIdentity;
  private pages = new Map<string, ProfilePage>();
  private seen = new Set<string>();
  limited = false;
  constructor(username: string, seed: TikTokProfileWork[] = []) {
    this.identity = { username };
    for (const work of seed) this.works.set(work.id, structuredClone(work));
  }
  setIdentity(identity: ProfileIdentity) {
    this.identity = identity;
  }
  resetPagination() {
    this.pages.clear();
    this.seen.clear();
  }
  add(work: TikTokProfileWork) {
    if (!this.works.has(work.id) && this.works.size >= TIKTOK_PROFILE_MAX_WORKS) {
      this.limited = true;
      return;
    }
    this.seen.add(work.id);
    this.works.set(work.id, { ...this.works.get(work.id), ...work });
  }
  addLink(link: string, title?: string) {
    try {
      const url = new URL(link),
        match = /^\/@([A-Za-z0-9_.]+)\/(video|photo)\/(\d{5,24})\/?$/.exec(url.pathname);
      if (
        url.protocol === "https:" &&
        url.hostname === "www.tiktok.com" &&
        !url.port &&
        !url.username &&
        !url.password &&
        match?.[1].toLowerCase() === this.identity.username
      )
        this.add({
          id: match[3],
          url: `https://www.tiktok.com/@${this.identity.username}/${match[2]}/${match[3]}`,
          ...(title ? { title: title.slice(0, 500) } : {})
        });
    } catch {
      /* Other card links are not works. */
    }
  }
  accept(value: unknown, owner: string | null, cursor: string | null) {
    if (!this.identity.secUid || owner !== this.identity.secUid || !cursor || !/^\d{1,24}$/.test(cursor)) return;
    const page = readProfilePage(value, this.identity);
    for (const item of page.items) this.add(item);
    const previous = this.pages.get(cursor);
    if (previous && (previous.hasMore !== page.hasMore || previous.cursor !== page.cursor))
      throw new ArchiveTaskError(
        "TIKTOK_PROFILE_PAGE_CHANGED",
        "主页分页在读取时发生变化，请继续读取后重新确认完整性",
        409
      );
    this.pages.set(cursor, page);
  }
  get ended() {
    const visited = new Set<string>();
    let cursor = "0";
    while (!visited.has(cursor)) {
      visited.add(cursor);
      const page = this.pages.get(cursor);
      if (!page) return false;
      if (!page.hasMore) return true;
      cursor = page.cursor;
    }
    return false;
  }
  get complete() {
    return (
      this.ended &&
      !this.limited &&
      (this.identity.declaredCount === undefined || this.seen.size >= this.identity.declaredCount)
    );
  }
}
