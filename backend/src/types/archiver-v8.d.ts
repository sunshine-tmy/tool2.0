import "archiver";

declare module "archiver" {
  export type ZipArchive = Archiver;
  export const ZipArchive: new (options?: ArchiverOptions) => ZipArchive;
}
