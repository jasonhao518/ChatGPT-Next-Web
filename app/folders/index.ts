import { Folder } from "../store/folder";
import { CN_FOLDERS } from "./cn";
import { EN_FOLDERS } from "./en";

import { type BuiltinFolder } from "./typing";

export const BUILTIN_FOLDER_ID = 100000;

export const BUILTIN_FOLDER_STORE = {
  buildinId: BUILTIN_FOLDER_ID,
  folders: {} as Record<string, BuiltinFolder>,
  get(id?: string) {
    if (!id) return undefined;
    return this.folders[id] as Folder | undefined;
  },
  add(m: BuiltinFolder) {
    const folder = { ...m, id: this.buildinId++, builtin: true };
    this.folders[folder.id] = folder;
    return folder;
  },
};

export const BUILTIN_FOLDERS: BuiltinFolder[] = [
  ...CN_FOLDERS,
  ...EN_FOLDERS,
].map((m) => BUILTIN_FOLDER_STORE.add(m));
