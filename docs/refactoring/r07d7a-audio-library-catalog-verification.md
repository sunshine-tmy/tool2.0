# R07-D7A 音频库清单兼容读取与校验

状态：DONE。独立起点为 D6 全量验收后的工作区；HEAD 55526ab、索引为空，保留已有修改。

## 范围及冻结契约

catalog.ts 统一承载规范化键、Schema 读取及语义校验；store 保留同步 validate façade 和 readCatalog 原导出。
备份解析直接读取 catalog 模块，避免后续恢复适配反向导入 store。
读取仍只移除指定旧字段再按原 Schema 检查，语义校验仍在原调用点执行，不前移到解析入口。
不改 Schema、缺省值、未知字段策略、旧字段边界、错误码/状态/优先级或原数据内容。
规范化仅用于检索/比较，不重写清单名称；缺少 presets 的旧清单在 readCatalog 中仍不补默认值。
不改启动恢复、镜像、事务、文件、预留、删除或备份合并流程。

## 前置测试及等价证明

新增 45 项在原 store 通过：9 类非清单输入、深复制及缺少 presets、两种旧 favorite、旧标签边界、
根级旧标签与单条旧标签规则区别、16 类坏字段/未知字段、读取与语义检查分离、10 类关系校验及原子失败、
Schema/预设/分组的错误优先级、三级分组及失效预设引用保持。
最初数组型 it.each 行被展开，造成 3 个新测试参数错误；在生产提取前改为对象行，45 项全部重跑通过，未调整业务预期。
提取后增加原导出身份/同步校验 1 项和纯规范化 4 项，共新增 50 项；音频库及在线批次 10 份、162 项通过。
使用原隔离夹具、内存 SQLite 和合成素材，无真实模型或用户数据。

读取体仅将 clone(value) 展开为原包装的 structuredClone(value)，规范化纯表达式和校验体保持；
store 其他方法仅改变 import/同步委派，backup 仅改变 readCatalog 的导入来源。
以项目同一 Prettier 配置格式化明确替换后的完整预期源码，三个文件均与实际内容逐字/SHA-256 匹配：

- store.ts：2c71e3bfb3f7a46e5e07b95bed878cae9065ce050524b0a92fe6fdab1b63d51f
- catalog.ts：818e91b71c35544cd7ada86858d84108110f81d8fb0402df214e9e928f4c8f59
- backup.ts：e9cb6dc047151999775d4c22cc79167236631c4ed3e52e3e7db083b42a48327f

## 门禁与后续

| 检查                           | 本单元实际结果                                                                                      |
| ------------------------------ | --------------------------------------------------------------------------------------------------- |
| 类型 / Lint / Knip / 架构      | 全部通过，381 个生产/配置文件，原精确债务不变                                                       |
| 契约 / 架构 / 差异检查器测试   | 4 / 5 / 16 通过                                                                                     |
| pnpm coverage                  | core 21、shared 130、API 1215、Web 389 通过；API 103 文件通过、1 原跳过，原 6 项跳过不变            |
| API / Web 覆盖率               | API 行 92.73%、分支 83.81%、函数 91.42%；Web 行 80.31%、分支 84.39%、函数 76.34%                    |
| pnpm build                     | 普通构建及全部隔离冒烟通过，源码/dist/异 cwd/无 Git ZIP/冷热启动/资源复用及分发映射保持             |
| 桌面编译及单元                 | pnpm --filter desktop build/test 通过，95 单元及 7 冒烟脚本单元，无 stage/rebuild/package/make      |
| 工程脚本及 Python              | 脚本 82 通过、1 原跳过，runner 5；既有 .venv-refactor-tests 的 pytest 8、Ruff 11 和 mypy 9 文件通过 |
| pnpm test:e2e                  | 按 Playwright 技能复用原 5 项，15.7 秒通过，无真实模型                                              |
| 固定基线差异覆盖率             | --base 55526abc4f67d04e99ba677b335c38b43b4584bb --worktree，3914/4102，95.42%                       |
| 格式 / git diff --check / 索引 | 通过，索引为空，HEAD 不变                                                                           |

E2E 根 `C:\Users\tangmy\AppData\Local\Temp\toolbox-r07d7a-final-e2e-caae4bf21b14473cb6f27e83c3735b6d` 保留。
无新增业务缺陷或检查例外；原测试无减少，覆盖率门槛、体积预算及排除范围不变。
原 readCatalog/error re-export 保留兼容，没有平行实现；store 同步 validate 仍明确原调用顺序。
下一单元 R07-D7B 独立处理启动恢复 IO；之后 R07-D7C 再处理备份合并，不同时改动恢复步骤。
R07 其余领域、R08–R12、B05/B07/B10 以及真实模型/macOS/安装包专项仍待完成。
无用户数据、签名包、数据保留/删除/恢复规则变更；无新依赖、提交、推送、发布或安装包制作。
