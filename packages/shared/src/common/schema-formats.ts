import { FormatRegistry } from "@sinclair/typebox";

/** Explicit internal initialization; preserve the existing Date.parse policy and custom validators. */
export function registerSharedSchemaFormats() {
  if (!FormatRegistry.Has("date-time")) {
    FormatRegistry.Set("date-time", (value) => !Number.isNaN(Date.parse(value)));
  }
}
