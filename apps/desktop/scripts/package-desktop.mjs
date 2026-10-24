import packager from "@electron/packager";
import { run } from "../../../tooling/build/package-desktop.mjs";
await run({ packager });
