/** 短视频解析仍复用 XHS 登录；只保留登录别名，不维护第二套归档业务客户端。 */
import { contentArchiveApi } from "./content-api";
export const xhsArchiveApi = {
  startAuth: contentArchiveApi.startXhsAuth,
  auth: contentArchiveApi.xhsAuth
};
