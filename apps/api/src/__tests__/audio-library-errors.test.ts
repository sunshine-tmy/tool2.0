import { expect, it } from "vitest";
import { AudioLibraryError, reject } from "../domains/audio-library/store";
import { AudioLibraryError as DomainError, reject as domainReject } from "../domains/audio-library/errors";

it("keeps the facade and internal consumers on exactly one class and throw helper", () => {
  expect(AudioLibraryError).toBe(DomainError);
  expect(reject).toBe(domainReject);
  try {
    domainReject("AUDIO_LIBRARY_FIXTURE", "合成错误", 409);
  } catch (error) {
    expect(error).toBeInstanceOf(AudioLibraryError);
    expect(error).toMatchObject({ code: "AUDIO_LIBRARY_FIXTURE", status: 409 });
  }
});

it.each([undefined, 400, 404, 409, 413, 415, 503])("keeps error fields and identity for status %s", (status) => {
  const direct = new AudioLibraryError("AUDIO_LIBRARY_FIXTURE", "合成错误", status);
  expect(direct).toBeInstanceOf(Error);
  expect(direct.name).toBe("Error");
  expect(direct.code).toBe("AUDIO_LIBRARY_FIXTURE");
  expect(direct.status).toBe(status ?? 400);
  expect(direct.message).toBe("合成错误");
  expect(Object.keys(direct).sort()).toEqual(["code", "status"]);
  expect(() => reject("AUDIO_LIBRARY_FIXTURE", "合成错误", status)).toThrow(direct);
});
