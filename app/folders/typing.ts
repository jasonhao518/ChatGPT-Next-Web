import { ModelConfig } from "../store";
import { type Folder } from "../store/folder";

export type BuiltinFolder = Omit<Folder, "id" | "modelConfig"> & {
  isOwner: Boolean;
  modelConfig: Partial<ModelConfig>;
};
