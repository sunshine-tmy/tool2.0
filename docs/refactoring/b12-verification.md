# B12：ZIP 条目顺序兼容测试稳定性

日期：2026-10-23。状态：DONE。此独立修复前暂停 R07-B1 验收，保留其布局迁移，不混改业务。

首次全量 coverage 的 API 为 904 通过、1 失败、6 原跳过，Web 389 通过；pnpm coverage 返回 1，因此后续 pnpm build 没有执行。失败只定位到 image-compression-compat 的 ZIP 条目顺序断言：收到 ['商品图 (2).jpeg','商品图.jpeg']，原期望反序。独立原 24 项重跑通过，不作为解决证据。

本地已安装 archiver 8.0.0 的 lib/core.js 使用 4 路文件 stat，再把完成者推到单路归档队列，不能从 file 调用顺序推出中央目录顺序。先增加逆序夹具，保留旧断言验证确定性失败，再修复为按文件名比较不同图片的完整字节、选择去重和确切条目集合。自然归档分支继续覆盖真实 file 路径；逆序分支只替换本测试实例的 file 调用为逆序 Buffer append，仍由真实 Archiver 生成完整 ZIP。

不改变业务 ZIP 实现或文件命名，不提高超时或截图/覆盖率容差，不删除原检查目标，不使用用户文件。验证结果待补；R07-B1 须在本任务验收后重跑全量门禁，不将原失败记录改写成通过。

确定性复现：pnpm --filter backend test -- image-compression-compat -t 'forced reverse true' 在保留旧断言时 1 失败、24 项因显式筛选未执行；返回条目顺序与首次全量失败相同。筛选不是测试收集策略修改，修复后须执行完整文件及全量。修复仅将自然分支的顺序断言改为确切名称集合，并逐名称核验不同输入图的完整结果；受控逆序分支还显式验证实际发生了逆序，而不是只加宽容差。

修复后 pnpm --filter backend test -- image-compression-compat image-tools：25 + 5 项全通过；pnpm typecheck、lint、deadcode、lint:architecture、test:contracts 与 git diff --check 通过。逆序测试对继承方法的参数先按 unknown 校验为真实 Archive、fixture 文件路径和明确名称，不使用 any/关闭检查或修改库类型来处理 Mock 类型推导。

没有修改压缩生产源码、Archiver 配置或依赖；自然分支仍走真实 file/stat 队列，强制逆序只在测试作用域内替换两个 file 调用，afterEach 恢复。原文件检查目标保留，且输入由相同图改为两张不同图，避免位置交换被误判为正确。原 24 项变为 25 项，不减少测试；B11 的 1 项、B1 的 6 项加本修复的 1 项使本轮 API 应增加 8 项。R07-B1 现在恢复全量门禁，最终结果见其验收记录。
