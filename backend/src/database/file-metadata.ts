/**
 * 中文模块说明：后端数据库层，负责 跨领域文件摘要、大小、路径和媒体类型登记
 */
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import type { FileMetadata, ToolboxDatabase } from "./toolbox-database";

type RegisterFileInput = {
  entityKind: string;
  entityId: string;
  filePath: string;
  mediaType?: string;
  owner?: string;
  id?: string;
};

/**
 * Single gateway for files that are persisted under storageRoot.
 * It deliberately hashes through a stream so large uploads do not get copied
 * into the Node heap while their metadata is being recorded.
 */
export class FileMetadataRepository {
  constructor(
    private readonly database: ToolboxDatabase,
    private readonly storageRoot: string
  ) {}

  async register(input: RegisterFileInput): Promise<FileMetadata> {
    const relativePath = this.relativePath(input.filePath);
    const stat = await fsp.stat(input.filePath);
    if (!stat.isFile()) throw new Error("File metadata target is not a regular file");
    const metadata: FileMetadata = {
      id: input.id ?? fileMetadataId(input.entityKind, input.entityId, relativePath),
      entityKind: input.entityKind,
      entityId: input.entityId,
      relativePath,
      byteSize: stat.size,
      sha256: await sha256(input.filePath),
      mediaType: input.mediaType,
      owner: input.owner,
      createdAt: new Date().toISOString()
    };
    this.database.upsertFile(metadata);
    return metadata;
  }

  async registerIfExists(input: RegisterFileInput) {
    try {
      return await this.register(input);
    } catch (error) {
      if (isMissingFile(error)) return undefined;
      throw error;
    }
  }

  get(id: string) {
    return this.database.getFile(id);
  }

  list(entityKind?: string, entityId?: string) {
    return this.database.listFiles({ entityKind, entityId });
  }

  remove(id: string) {
    return this.database.removeFile(id);
  }

  removeForEntity(entityKind: string, entityId: string) {
    return this.database.removeFilesForEntity(entityKind, entityId);
  }

  private relativePath(filePath: string) {
    const root = path.resolve(this.storageRoot);
    const target = path.resolve(filePath);
    const relative = path.relative(root, target).replaceAll(path.sep, "/");
    if (!relative || relative === "." || relative.startsWith("../") || relative === ".." || path.isAbsolute(relative)) {
      throw new Error("File metadata path escapes storage root");
    }
    return relative;
  }
}

function fileMetadataId(entityKind: string, entityId: string, relativePath: string) {
  return crypto.createHash("sha256").update(`${entityKind}\0${entityId}\0${relativePath}`).digest("hex");
}

async function sha256(filePath: string) {
  const hash = crypto.createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.once("error", reject);
    stream.once("end", resolve);
  });
  return hash.digest("hex");
}

function isMissingFile(error: unknown) {
  return (
    typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "ENOENT"
  );
}
