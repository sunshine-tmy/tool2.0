import { smokeSharedContract } from "./shared-contract-consumer.mjs";

export async function smokeCommonContract(repoRoot) {
  const runtime = `
    import {TaskSchema, TaskIdParamsSchema, ApiFailureSchema, apiSuccessSchema, ok, fail, listTools, WORKER_PROTOCOL_VERSION} from '@toolbox/shared/common';
    import {Type} from '@sinclair/typebox'; import {Value} from '@sinclair/typebox/value';
    function check(value,message){if(!value)throw new Error(message);}
    check(Value.Check(TaskSchema.properties.createdAt,'2026-10-22T00:00:00.000Z'),'date initialized');
    check(!Value.Check(TaskSchema.properties.createdAt,'invalid'),'invalid date');
    check(Value.Check(TaskIdParamsSchema,{taskId:'task-1'}),'id');
    check(!Value.Check(TaskIdParamsSchema,{taskId:'../task'}),'unsafe id');
    check(Value.Check(apiSuccessSchema(Type.Number()),{...ok(1),requestId:'req-1',extra:true}),'response extra fields');
    check(Value.Check(ApiFailureSchema,{...fail('CODE','message'),requestId:'req-1'}),'failure envelope');
    check(WORKER_PROTOCOL_VERSION===1,'worker version');
    check(listTools().length===6,'tool registry');
  `;
  await smokeSharedContract(repoRoot, {
    name: "common",
    declarations: `
      import type {ApiResponse, TaskDto, ImageWorkerProcess} from '@toolbox/shared/common';
      import type {ApiResponse as RootResponse, TaskDto as RootTask} from '@toolbox/shared';
      declare const response:ApiResponse<number>; const old:RootResponse<number>=response;
      declare const task:TaskDto; const oldTask:RootTask=task;
      // @ts-expect-error Internal initialization is not a public capability.
      import {registerSharedSchemaFormats} from '@toolbox/shared/common';
    `,
    runtime,
    browserRuntime: runtime
  });
  console.log(
    "Common contract smoke passed: browser-safe envelopes, strict requests, unchanged response extras and protocol."
  );
}
