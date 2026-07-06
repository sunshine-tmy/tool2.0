import { ApiRequest, httpClient } from "../../services/http";
import type { ToolTask } from "../../types";

class TasksApi {
  @ApiRequest("获取任务列表失败")
  async list() {
    return httpClient.get<ToolTask[]>("/tasks");
  }
}

export const tasksApi = new TasksApi();
