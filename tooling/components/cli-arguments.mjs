/** 中文模块说明：统一移除 pnpm 传给 Node 脚本的单个参数分隔符。 */
export function stripPnpmSeparator(argv) {
  return argv[0] === "--" ? argv.slice(1) : argv;
}
