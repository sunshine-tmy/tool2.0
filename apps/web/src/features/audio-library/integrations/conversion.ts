/** Conversion only consumes the public library communication contract. */
import { audioLibraryApi } from "../api";
export const conversionLibraryApi = { list: audioLibraryApi.list };
