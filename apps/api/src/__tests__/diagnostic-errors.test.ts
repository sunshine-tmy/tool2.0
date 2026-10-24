import { expect, it } from "vitest";
import { diagnosticError } from "../modules/diagnostics/errors";

it("preserves the default diagnostic error shape and fresh Error identity", () => {
  const first = diagnosticError("DIAGNOSTICS_BUSY", "busy");
  const second = diagnosticError("DIAGNOSTICS_BUSY", "busy");
  expect(first).toBeInstanceOf(Error);
  expect(first).not.toBe(second);
  expect(first).toMatchObject({ name: "Error", message: "busy", code: "DIAGNOSTICS_BUSY", statusCode: 409 });
  expect(Object.keys(first)).toEqual(["code", "statusCode"]);
});

it.each([422, 404, 0])("preserves explicit diagnostic status %s without new validation", (statusCode) => {
  expect(diagnosticError("CUSTOM", "原始提示", statusCode)).toMatchObject({
    code: "CUSTOM",
    message: "原始提示",
    statusCode
  });
});
