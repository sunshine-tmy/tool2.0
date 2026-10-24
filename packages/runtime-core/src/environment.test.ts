import { describe, expect, it } from "vitest";
import { parseDotEnv, readInteger } from "./index";

describe("compatible configuration primitives", () => {
  it("keeps the existing dotenv syntax, including quotes, duplicate keys and literal comments", () => {
    expect(
      parseDotEnv(
        "\ufeff# comment\r\n =skip\ninvalid\n PORT = 1\nPORT=' 2 '\nURL=\"a=b\"\nEMPTY=\nRAW=3 # literal\nOPEN='x\nEXPAND=${PORT}\n"
      )
    ).toEqual({
      PORT: " 2 ",
      URL: "a=b",
      EMPTY: "",
      RAW: "3 # literal",
      OPEN: "'x",
      EXPAND: "${PORT}"
    });
    expect(parseDotEnv("X=\"\"\nY=''\nZ=plain")).toEqual({ X: "", Y: "", Z: "plain" });
  });
  it.each([undefined, "", " \t"])("preserves integer fallback for %j", (value) => {
    expect(readInteger("API_PORT", value, 3100, 1, 65535)).toBe(3100);
  });
  it.each(["1", "65535", " 3210 ", "3.1e3", "0xC1C"])("preserves Number-based parsing of %s", (value) => {
    expect(readInteger("API_PORT", value, 3100, 1, 65535)).toBe(Number(value));
  });
  it.each(["0", "65536", "-1", "3.5", "NaN", "Infinity", "9007199254740992", "12a"])(
    "rejects invalid port %s with the same message",
    (value) => {
      expect(() => readInteger("API_PORT", value, 3100, 1, 65535)).toThrow(
        "API_PORT must be an integer between 1 and 65535"
      );
    }
  );
  it("retains the safe-integer default upper bound used by non-port settings", () => {
    expect(readInteger("SIZE", String(Number.MAX_SAFE_INTEGER), 1, 1)).toBe(Number.MAX_SAFE_INTEGER);
    expect(() => readInteger("SIZE", "9007199254740992", 1, 1)).toThrow(String(Number.MAX_SAFE_INTEGER));
  });
});
