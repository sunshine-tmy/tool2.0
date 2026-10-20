import { LanApplicationAccessSchema } from "@toolbox/shared";
import { httpClient } from "./http";

export const lanAccessApi = {
  get: () => httpClient.get("/lan-access", LanApplicationAccessSchema, { timeout: 8000 })
};
