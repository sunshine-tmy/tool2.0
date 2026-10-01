/** 旧服务类型与哈希入口保留，运行逻辑统一由平台无关服务实现。 */
import type { XhsArchiveItem } from "@toolbox/shared";
import { ContentArchiveTranslationService } from "../media-archive/translation-service";
import { archiveTranslationSourceHash } from "../media-archive/text";

export class XhsTranslationService extends ContentArchiveTranslationService<XhsArchiveItem> {}
export const translationSourceHash = archiveTranslationSourceHash;
