import assert from "node:assert/strict";
import { test } from "node:test";
import { checkArchitecture, importsOf } from "../tooling/quality/architecture.mjs";

test("classifies static, dynamic, CommonJS, Vue and type-only dependencies without executing source", () => {
  assert.deepEqual(
    importsOf(
      "example.vue",
      `<template><div /></template><script setup lang="ts">
    import type { A } from './a'; import { type B } from './b';
    export type { C } from './c'; import { type D, value } from './d';
    const p = import('./p'); const q = require('./q'); type T = import('./t').T;
    import r = require('./r');
  </script>`
    ),
    [
      { specifier: "./a", kind: "type" },
      { specifier: "./b", kind: "type" },
      { specifier: "./c", kind: "type" },
      { specifier: "./d", kind: "runtime" },
      { specifier: "./p", kind: "runtime" },
      { specifier: "./q", kind: "runtime" },
      { specifier: "./t", kind: "type" },
      { specifier: "./r", kind: "runtime" }
    ]
  );
});

test("rejects new cross-app imports, including types, without broad type exemptions", () => {
  const source = "apps/web/src/feature.ts";
  const violations = checkArchitecture(new Map([[source, "import type { A } from '../../api/src/domain';"]]), []);
  assert.match(violations.join("\n"), /cross-application.*|\[type\]/);
});

test("shared is browser-safe, web cannot load Node, and core cannot reverse its dependency direction", () => {
  for (const [file, code] of [
    ["packages/shared/src/a.ts", "import type { Stats } from 'node:fs';"],
    ["packages/shared/src/a.ts", "import { createRuntimeLayout } from '@toolbox/runtime-core';"],
    ["packages/runtime-core/src/a.ts", "import { getConfig } from '../../../backend/src/config';"],
    ["apps/web/src/a.ts", "import { createRuntimeLayout } from '@toolbox/runtime-core';"],
    ["apps/web/src/a.ts", "const fs = import('node:fs');"],
    ["apps/api/src/core/a.ts", "import { b } from '../domains/b';"],
    ["apps/web/src/shared/a.ts", "import { b } from '../features/b';"],
    ["apps/api/src/domains/content-archive/core/a.ts", "import { b } from '../compat/b';"]
  ])
    assert.equal(checkArchitecture(new Map([[file, code]]), []).length, 1);
  assert.deepEqual(
    checkArchitecture(new Map([["apps/api/src/domains/a.ts", "import { b } from '../core/b';"]]), []),
    []
  );
});

test("legacy exceptions are exact, kind-sensitive and must disappear when no longer consumed", () => {
  const debts = [["frontend/vite.config.ts", "backend/src/config", "type", "test-only debt"]];
  const source = "frontend/vite.config.ts";
  assert.deepEqual(
    checkArchitecture(new Map([[source, "import type { A } from '../backend/src/config';"]]), debts),
    []
  );
  assert.equal(checkArchitecture(new Map([[source, "import { A } from '../backend/src/config';"]]), debts).length, 2);
  assert.match(checkArchitecture(new Map(), debts)[0], /Stale architecture debt/);
});

test("audio-library consumers cannot regain concrete speech dependencies through types or runtime imports", () => {
  for (const folder of ["modules", "domains"]) {
    const file = `apps/api/src/${folder}/audio-library/routes.ts`;
    const prefix = folder === "modules" ? "../../domains/speech" : "../speech";
    for (const producer of ["chatterbox/stores", "edge-tts/batch-service"])
      for (const statement of [
        `import type { Source } from '${prefix}/${producer}';`,
        `import { Source } from '${prefix}/${producer}';`,
        `const source = import('${prefix}/${producer}');`
      ]) {
        const violations = checkArchitecture(new Map([[file, statement]]), []);
        assert.equal(violations.length, 1);
        assert.match(violations[0], /read-only port/);
      }
  }
  assert.deepEqual(
    checkArchitecture(
      new Map([
        ["apps/api/src/domains/audio-library/routes.ts", "import type { Source } from './types';"],
        ["apps/api/src/app/business-routes.ts", "import { register } from '../domains/speech/chatterbox/routes';"],
        ["apps/api/src/domains/audio-library/source.test.ts", "import { Store } from '../speech/chatterbox/stores';"]
      ]),
      []
    ),
    []
  );
});

test("archive core cannot consume compatibility adapters through type, export or dynamic imports", () => {
  for (const statement of [
    "import type { Store } from '../compat/xhs/store';",
    "export { Store } from '../compat/xhs/store';",
    "const store = import('../compat/xhs/store');"
  ]) {
    const violations = checkArchitecture(
      new Map([["apps/api/src/domains/content-archive/core/service.ts", statement]]),
      []
    );
    assert.equal(violations.length, 1);
    assert.match(violations[0], /archive core cannot depend on compatibility/);
  }
  assert.deepEqual(
    checkArchitecture(
      new Map([
        ["apps/api/src/domains/content-archive/routes.ts", "import { register } from './compat/xhs/routes';"],
        ["apps/api/src/domains/content-archive/compat/xhs/store.ts", "import { Store } from '../../core/store';"]
      ]),
      []
    ),
    []
  );
});

test("retired R07 business trees cannot return through new production imports", () => {
  for (const folder of [
    "image-compress",
    "image-ai",
    "speech",
    "edge-tts",
    "chatterbox",
    "audio-library",
    "media-archive",
    "xhs-archive",
    "lan-transfer",
    "lan-access"
  ])
    for (const suffix of ["", "/routes", ".ts"])
      for (const statement of [
        `import { value } from '../modules/${folder}${suffix}';`,
        `import type { Value } from '../modules/${folder}${suffix}';`,
        `const value = import('../modules/${folder}${suffix}');`
      ]) {
        const violations = checkArchitecture(new Map([["apps/api/src/app/entry.ts", statement]]), []);
        assert.equal(violations.length, 1);
        assert.match(violations[0], /retired modules tree/);
      }
  assert.deepEqual(
    checkArchitecture(
      new Map([
        ["apps/api/src/app/entry.ts", "import { register } from '../domains/lan-transfer/routes';"],
        ["apps/api/src/domains/lan-transfer/example.test.ts", "import { old } from '../../modules/lan-transfer';"],
        ["apps/api/src/app/entry2.ts", "import { Manager } from '../modules/components/component-manager';"]
      ]),
      []
    ),
    []
  );
});

test("R08 feature consumers use explicit ports and shared speech does not reverse into an engine", () => {
  for (const statement of [
    "import { state } from '../../audio-library/player';",
    "import type { State } from '../../audio-library/state';",
    "const action = import('../../audio-library/SaveToAudioLibrary.vue');"
  ]) {
    const violations = checkArchitecture(new Map([["apps/web/src/features/speech/shared/actions.ts", statement]]), []);
    assert.equal(violations.length, 1);
    assert.match(violations[0], /explicit integration port/);
  }
  assert.match(
    checkArchitecture(
      new Map([["apps/web/src/features/speech/shared/editor.ts", "import { parse } from '../chatterbox/parser';"]]),
      []
    )[0],
    /engine's private implementation/
  );
  assert.deepEqual(
    checkArchitecture(
      new Map([
        [
          "apps/web/src/features/speech/shared/actions.ts",
          "import { SaveToAudioLibrary } from '../../audio-library/integrations/speech';"
        ],
        ["apps/web/src/features/audio-library/integrations/playback.ts", "export { player } from '../player';"],
        ["apps/web/src/features/speech/chatterbox/editor.ts", "import { parse } from '../shared/parser';"],
        ["apps/web/src/features/speech/shared/actions.test.ts", "import { player } from '../../audio-library/player';"]
      ]),
      []
    ),
    []
  );
});

test("R08 retired frontend source imports are rejected without exempting types", () => {
  for (const folder of ["modules", "pages", "layouts", "components", "composables", "services", "utils", "config"])
    for (const statement of [
      `import { value } from '../${folder}/old';`,
      `import type { Value } from '../${folder}/old';`,
      `const value = import('../${folder}/old');`
    ]) {
      const violations = checkArchitecture(new Map([["apps/web/src/app/entry.ts", statement]]), []);
      assert.equal(violations.length, 1);
      assert.match(violations[0], /retired web tree/);
    }
});

test("R09 removed journal debts cannot reappear at old or relocated desktop paths", () => {
  for (const file of [
    "apps/desktop/src/backend-supervisor.ts",
    "apps/desktop/src/backend/backend-supervisor.ts",
    "apps/desktop/src/app/startup-diagnostics.ts"
  ])
    for (const statement of [
      `import { DiagnosticJournal } from '${file === "apps/desktop/src/backend-supervisor.ts" ? "../.." : "../../.."}/api/src/runtime/diagnostic-journal';`,
      `import type { Journal } from '${file === "apps/desktop/src/backend-supervisor.ts" ? "../.." : "../../.."}/api/src/runtime/diagnostic-journal';`
    ]) {
      const violations = checkArchitecture(new Map([[file, statement]]));
      expectViolation(violations);
    }
  function expectViolation(violations) {
    assert.ok(violations.some((value) => value.includes("cross-application source import")));
  }
  assert.deepEqual(
    checkArchitecture(
      new Map([
        ["apps/desktop/src/backend/backend-supervisor.ts", "import { DiagnosticJournal } from '@toolbox/runtime-core';"]
      ])
    ),
    []
  );
});

test("R09 preload remains a fixed Electron bridge and retired desktop imports stay retired", () => {
  for (const statement of [
    "import { readFile } from 'node:fs';",
    "const child = import('node:child_process');",
    "import { DiagnosticJournal } from '@toolbox/runtime-core';",
    "import { start } from './app/application';"
  ])
    assert.match(
      checkArchitecture(new Map([["apps/desktop/src/preload.ts", statement]]))[0],
      /preload must keep fixed Electron capabilities/
    );
  for (const statement of [
    "import { BackendSupervisor } from '../backend-supervisor';",
    "import type { ProcessGuard } from '../process-guard';"
  ])
    assert.match(
      checkArchitecture(new Map([["apps/desktop/src/app/application.ts", statement]]))[0],
      /retired flat implementation/
    );
  assert.deepEqual(
    checkArchitecture(
      new Map([
        [
          "apps/desktop/src/preload.ts",
          "import { contextBridge, ipcRenderer } from 'electron'; import type { DesktopBridge } from '@toolbox/shared/desktop';"
        ],
        ["apps/desktop/src/app/application.ts", "import { BackendSupervisor } from '../backend/backend-supervisor';"],
        ["apps/desktop/src/main.ts", "import { createDesktopRuntimeLayout } from './runtime-layout';"]
      ])
    ),
    []
  );
});
