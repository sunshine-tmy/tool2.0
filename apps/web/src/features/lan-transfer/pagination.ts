/**
 * 中文模块说明：局域网传输前端模块，负责文件、图文、分片上传和批量管理
 */
export function shouldShowPagination(total: number) {
  return total > 0;
}
