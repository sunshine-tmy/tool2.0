# B13：普通 AI 图片推理最终写入失败后误报成功

状态：FIXED，独立验收已通过，见 [B13 修复验收](b13-verification.md)。发现于 2026-10-23 R07-B4。
以下保留发现时的故障及建议，不再表示仍阻塞。用户随后明确授权独立修复，验收后恢复 B4。
这是既存业务一致性缺陷，不是已证实的数据丢失；未修改用户数据及保留/删除规则。

## 可复现证据

新增回归：`apps/api/src/__tests__/image-ai.test.ts` 的 `does not report ordinary inference success when its final domain write fails`。
复用原完整隔离夹具、自有临时 SQLite 文件、合成 PNG、回环 Worker，不访问本机能力或真实模型。
应用启动后仅在第一次 image-ai-task/completed 写入时抛出合成错误；其他写入调用真实 upsert。
记录成功 upsert 后的领域及统一任务状态，并通过真实任务接口取得最终公开状态。

运行：

```text
pnpm --filter backend exec vitest run src/__tests__/image-ai.test.ts -t "ordinary inference success"
```

在临时提取草稿中、撤回提取后的 R07-B3 源码中均确定性复现：

```text
injected: true
publicStatus: completed
domainStatus: running
unifiedStatus: running
```

断言要求故障后不报告成功，并在这个一次性写入故障恢复后收敛为 failed；实际仍为上述不一致状态。
没有降低断言、忽略失败或提高超时。
不带名称筛选运行五份相关测试共 90 项，89 通过、1 失败，唯一失败即本回归。

## 根因及基线归属

`apps/api/src/domains/image-ai/task-manager.ts` 的 processTask 普通推理分支先执行：

```text
patchTask(task, { status: "completed", progress: 100 });
await persist(task);
```

persist 会先将有结果的终态过期时间设为 null，再写领域记录，最后写统一任务。
领域写入抛错时，内存对象已显示 completed，而数据库最后成功写入及统一任务仍是 running。
drain 的上层 catch 只安排队列重试，没有将这个已出队任务收敛到失败。
商品图分支已有独立最终写入异常处理，不能据其测试通过推断普通推理也安全。

已比较固定基线 55526abc4f67d04e99ba677b335c38b43b4584bb 的
`backend/src/modules/image-ai/task-manager.ts` 与撤回后源码：
processTask、outputFileName、sanitizePng 函数体 TypeScript AST 相同。
撤回后的整个 manager 与本轮开始内容也相同，确认不是本次提取引入。

本轮未验证此新故障场景下的重启恢复或持续数据库不可写，不把代码推断当作实际验收。
没有证据表明用户现存结果已丢失，不进行历史记录转换或清理。

## 独立修复建议（待执行）

1. 在原管理器状态所有权内处理：最终记录成功前，公开内存对象不得发布成功终态；不靠延迟前端轮询或改 DTO 掩盖。
2. 最终写入及统一投影异常应明确失败，不把一次性故障留成“公开完成、记录处理中”；持续不可写时也不得误报持久化成功。
3. 保留已完成图片的文件、结果身份、部分成功长期留档及取消边界，不因保存状态失败静默删除产物或改变 TTL 规则。
4. 继续使用原提交、任务、投影及失败保护机制，不新增通用任务表、Schema、API、模型或签名包。
5. 补全部成功、部分成功、取消、有结果/无结果、最终领域写失败、投影失败、持续不可写及关闭中的回归。
6. 如果需要改变事务、终态可见性或错误表达，先明确实现与兼容边界；不把业务修复混在结构提取中。
7. 独立修复通过定向和完整门禁后，更新本记录，再恢复 R07-B4 的机械提取及等价验收。

本轮仅登记并暂停，未自动实施该修复。没有提交、推送、发布或制作安装包。
