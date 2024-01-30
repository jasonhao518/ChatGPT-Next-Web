import { BUILTIN_FOLDERS } from "../folders";
import { getLang, Lang } from "../locales";
import { DEFAULT_TOPIC, ChatMessage } from "./chat";
import { ModelConfig, useAppConfig } from "./config";
import { StoreKey } from "../constant";
import { nanoid } from "nanoid";
import { createPersistStore } from "../utils/store";
import { v4 as uuidv4 } from "uuid";
export type S3File = {
  id: string;
  index: number;
  name: string;
  url: string;
};
export type Folder = {
  id: string;
  createdAt: number;
  avatar: string;
  name: string;
  hideContext?: boolean;
  context: ChatMessage[];
  syncGlobalConfig?: boolean;
  modelConfig: ModelConfig;
  lang: Lang;
  selectedFile: S3File | undefined;
  files: Array<S3File>;
  isOwner: boolean;
};

export const DEFAULT_FOLDER_STATE = {
  folders: {} as Record<string, Folder>,
};

export type FolderState = typeof DEFAULT_FOLDER_STATE;

export const DEFAULT_FOLDER_AVATAR = "gpt-bot";
export const createEmptyFolder = () =>
  ({
    id: "",
    selectedFile: undefined,
    avatar: DEFAULT_FOLDER_AVATAR,
    name: DEFAULT_TOPIC,
    context: [],
    syncGlobalConfig: true, // use global config as default
    modelConfig: { ...useAppConfig.getState().folderModelConfig },
    lang: getLang(),
    isOwner: true,
    files: new Array<S3File>(),
    createdAt: Date.now(),
  }) as Folder;

export const useFolderStore = createPersistStore(
  { ...DEFAULT_FOLDER_STATE },

  (set, get) => ({
    create(folder?: Partial<Folder>) {
      const folders = get().folders;
      const id = uuidv4();
      folders[id] = {
        ...createEmptyFolder(),
        ...folder,
        id,
        isOwner: true,
      };

      set(() => ({ folders }));
      get().markUpdate();

      return folders[id];
    },
    updateFolder(id: string, updater: (folders: Folder) => void) {
      const folders = get().folders;
      const folder = folders[id];
      if (!folder) return;
      const updateFolder = { ...folder };
      updater(updateFolder);
      folders[id] = updateFolder;
      set(() => ({ folders }));
      get().markUpdate();
    },
    delete(id: string) {
      const folders = get().folders;
      delete folders[id];
      set(() => ({ folders }));
      get().markUpdate();
    },

    get(id?: string) {
      return get().folders[id ?? 1145141919810];
    },
    getAll() {
      const userFolders = Object.values(get().folders).sort(
        (a, b) => b.createdAt - a.createdAt,
      );
      const config = useAppConfig.getState();
      if (config.hideBuiltinMasks) return userFolders;
      const buildinFolders = BUILTIN_FOLDERS.map(
        (m) =>
          ({
            ...m,
            modelConfig: {
              ...config.modelConfig,
              ...m.modelConfig,
            },
          }) as Folder,
      );
      return userFolders.concat(buildinFolders);
    },
    search(text: string) {
      return Object.values(get().folders);
    },
  }),
  {
    name: StoreKey.Folder,
    version: 3.1,

    migrate(state, version) {
      const newState = JSON.parse(JSON.stringify(state)) as FolderState;

      // migrate mask id to nanoid
      if (version < 3) {
        Object.values(newState.folders).forEach((m) => (m.id = nanoid()));
      }

      if (version < 3.1) {
        const updatedFolders: Record<string, Folder> = {};
        Object.values(newState.folders).forEach((m) => {
          updatedFolders[m.id] = m;
        });
        newState.folders = updatedFolders;
      }

      return newState as any;
    },
  },
);
