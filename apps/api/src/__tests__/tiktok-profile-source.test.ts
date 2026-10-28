import { expect, it } from "vitest";
import {
  ProfileCollector,
  readProfileIdentity,
  readProfilePage
} from "../domains/content-archive/providers/tiktok/profile-source";
const identity = { username: "shop", id: "user123", secUid: "public-sec-uid", declaredCount: 3 };
const item = (id: string, username = "shop") => ({
  id,
  author: { uniqueId: username },
  desc: "标题",
  createTime: 1_700_000_000
});
it("reads only the expected public account and refuses private profiles", () => {
  const user = { uniqueId: "Shop", id: "user123", secUid: "public-sec-uid" };
  expect(
    readProfileIdentity(
      { __DEFAULT_SCOPE__: { "webapp.user-detail": { userInfo: { user, stats: { videoCount: 616 } } } } },
      "shop"
    )
  ).toEqual({ ...identity, declaredCount: 616 });
  expect(
    readProfileIdentity({ UserModule: { users: { shop: user }, stats: { shop: { videoCount: 3 } } } }, "shop")
  ).toEqual(identity);
  expect(readProfileIdentity({}, "shop")).toBeUndefined();
  expect(() =>
    readProfileIdentity({ UserModule: { users: { shop: { ...user, privateAccount: true } } } }, "shop")
  ).toThrow("私密");
});
it("validates author identity, status and pagination instead of accepting recommendation data", () => {
  const page = readProfilePage(
    { statusCode: 0, cursor: "10", hasMore: 1, itemList: [item("12345"), { id: "12346", author: "user123" }] },
    identity
  );
  expect(page.hasMore).toBe(true);
  expect(page.items[0]?.createdAt).toBe("2023-11-14T22:13:20.000Z");
  for (const invalid of [
    { statusCode: 1 },
    { statusCode: 0, cursor: "10", hasMore: false, itemList: [item("12345", "other")] },
    { statusCode: 0, cursor: "bad", hasMore: false, itemList: [] },
    { statusCode: 0, cursor: "10", hasMore: "false", itemList: [] },
    { statusCode: 0, cursor: "10", hasMore: false, itemList: [{ id: "invalid", author: {} }] }
  ])
    expect(() => readProfilePage(invalid, identity)).toThrow();
});
it("proves a complete contiguous pagination chain and handles out-of-order pages and pinned duplicates", () => {
  const collector = new ProfileCollector("shop");
  collector.setIdentity(identity);
  collector.accept({ statusCode: 0, cursor: "20", hasMore: false, itemList: [item("12347")] }, identity.secUid, "10");
  expect(collector.ended).toBe(false);
  collector.accept(
    { statusCode: 0, cursor: "10", hasMore: true, itemList: [item("12345"), item("12346"), item("12345")] },
    identity.secUid,
    "0"
  );
  expect(collector.complete).toBe(true);
  expect(collector.works.size).toBe(3);
  expect(() =>
    collector.accept({ statusCode: 0, cursor: "99", hasMore: true, itemList: [] }, identity.secUid, "0")
  ).toThrow("发生变化");
});
it("never infers completion from DOM links, a stalled cursor, another account, or insufficient visible counts", () => {
  const collector = new ProfileCollector("shop");
  collector.setIdentity(identity);
  collector.addLink("https://www.tiktok.com/@shop/photo/12345", "=test");
  collector.addLink("https://www.tiktok.com/@other/video/12346");
  collector.addLink("https://user:pass@www.tiktok.com/@shop/video/12346");
  collector.addLink("javascript:alert(1)");
  expect(collector.works.size).toBe(1);
  expect(collector.complete).toBe(false);
  collector.accept({ statusCode: 0, cursor: "0", hasMore: false, itemList: [] }, "wrong-owner", "0");
  expect(collector.ended).toBe(false);
  collector.accept({ statusCode: 0, cursor: "0", hasMore: true, itemList: [item("12345")] }, identity.secUid, "0");
  expect(collector.ended).toBe(false);
  const ended = new ProfileCollector("shop", [...collector.works.values()]);
  ended.setIdentity(identity);
  ended.accept({ statusCode: 0, cursor: "20", hasMore: false, itemList: [] }, identity.secUid, "0");
  expect(ended.ended).toBe(true);
  expect(ended.complete).toBe(false);
});
it("caps the work inventory and keeps old discoveries without using them as this run's completeness proof", () => {
  const seed = Array.from({ length: 10000 }, (_, i) => ({
    id: String(i + 12345),
    url: `https://www.tiktok.com/@shop/video/${i + 12345}`
  }));
  const collector = new ProfileCollector("shop", seed);
  collector.setIdentity({ ...identity, declaredCount: 10000 });
  collector.addLink("https://www.tiktok.com/@shop/video/9999999");
  expect(collector.limited).toBe(true);
  expect(collector.works.size).toBe(10000);
  collector.accept({ statusCode: 0, cursor: "1", hasMore: false, itemList: [] }, identity.secUid, "0");
  expect(collector.complete).toBe(false);
});
it("retains discovered links across a refresh but requires a new complete pagination chain", () => {
  const collector = new ProfileCollector("shop");
  collector.setIdentity(identity);
  collector.accept(
    { statusCode: 0, cursor: "20", hasMore: false, itemList: [item("12345"), item("12346"), item("12347")] },
    identity.secUid,
    "0"
  );
  expect(collector.complete).toBe(true);
  collector.resetPagination();
  expect(collector.works.size).toBe(3);
  expect(collector.ended).toBe(false);
  collector.accept({ statusCode: 0, cursor: "20", hasMore: false, itemList: [item("12345")] }, identity.secUid, "0");
  expect(collector.ended).toBe(true);
  expect(collector.complete).toBe(false);
});
