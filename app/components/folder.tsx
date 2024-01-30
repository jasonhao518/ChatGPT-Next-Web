import { IconButton } from "./button";
import { ErrorBoundary } from "./error";
import { S3File } from "../store/folder";
import styles from "./folder.module.scss";

import EditIcon from "../icons/edit.svg";
import AddIcon from "../icons/add.svg";
import CloseIcon from "../icons/close.svg";
import DeleteIcon from "../icons/delete.svg";
import EyeIcon from "../icons/eye.svg";
import UploadIcon from "../icons/upload.svg";
import DragIcon from "../icons/drag.svg";
import { v4 as uuidv4 } from "uuid";

import { DEFAULT_FOLDER_AVATAR, Folder, useFolderStore } from "../store/folder";
import {
  ChatMessage,
  createMessage,
  ModelConfig,
  ModelType,
  useAppConfig,
  useChatStore,
} from "../store";
import { ROLES } from "../client/api";
import {
  Input,
  List,
  ListItem,
  Modal,
  Popover,
  Select,
  showConfirm,
  showToast,
} from "./ui-lib";
import { Avatar, AvatarPicker } from "./emoji";
import Locale, { AllLangs, ALL_LANG_OPTIONS, Lang } from "../locales";
import { useNavigate } from "react-router-dom";

import chatStyle from "./chat.module.scss";
import { useEffect, useState } from "react";
import { copyToClipboard, downloadAs, readFromFile } from "../utils";
import { Updater } from "../typing";
import { ModelConfigList } from "./model-config";
import { FileName, Path } from "../constant";
import { BUILTIN_FOLDER_STORE } from "../folders";
import { nanoid } from "nanoid";
import {
  DragDropContext,
  Droppable,
  Draggable,
  OnDragEndResponder,
} from "@hello-pangea/dnd";

// drag and drop helper function
function reorder<T>(list: T[], startIndex: number, endIndex: number): T[] {
  const result = [...list];
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
}

export function FolderAvatar(props: { avatar: string; model?: ModelType }) {
  return props.avatar !== DEFAULT_FOLDER_AVATAR ? (
    <Avatar avatar={props.avatar} />
  ) : (
    <Avatar model={props.model} />
  );
}

export function FolderConfig(props: {
  folder: Folder;
  updateFolder: Updater<Folder>;
  extraListItems?: JSX.Element;
  readonly?: boolean;
  shouldSyncFromGlobal?: boolean;
}) {
  const [showPicker, setShowPicker] = useState(false);

  const importFromFile = (id: string | undefined, updater: Updater<Folder>) => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "application/pdf";
    const folder = props.folder.id;
    const folderName = props.folder.name;
    const fileId = uuidv4();
    const index = props.folder.files.length + 1;
    fileInput.onchange = (event: any) => {
      const file = event.target.files[0];
      const size = file.size;
      fetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-transaction-id": uuidv4(),
        },
        body: JSON.stringify({
          fileId,
          index,
          size,
          folder,
          folderName,
          filename: file?.name,
          contentType: file?.type,
        }),
      }).then(async (response) => {
        if (response.ok) {
          const { url, fields } = await response.json();

          const formData = new FormData();
          let fileUrl: string | null = null;
          Object.entries(fields).forEach(([key, value]) => {
            formData.append(key, value as string);
            if ("key" === key) {
              fileUrl = url + value;
            }
          });
          formData.append("file", file!);

          fetch(url, {
            method: "POST",
            body: formData,
          }).then((res) => {
            if (res.status === 204) {
              const file2: S3File = {
                id: fileId,
                index: index,
                name: file.name,
                url: fileUrl!,
              };
              updater((updater) => {
                updater.files.push(file2);
              });
            } else {
              alert("upload failed");
              return null;
            }
          });
        } else {
          const { error } = await response.json();
          if ("NO_QUOTA" === error) {
            // TODO use localise error message
            showToast(error);
          } else {
            showToast(error);
          }
        }
      });
    };

    fileInput.click();
  };

  const updateConfig = (updater: (config: ModelConfig) => void) => {
    if (props.readonly) return;

    const config = { ...props.folder.modelConfig };
    updater(config);
    props.updateFolder((folder) => {
      folder.modelConfig = config;
      // if user changed current session mask, it will disable auto sync
      folder.syncGlobalConfig = false;
    });
  };

  const copyFolderLink = () => {
    const folderLink = `${location.protocol}//${location.host}/#${Path.NewChat}?folder=${props.folder.id}`;
    copyToClipboard(folderLink);
  };

  const globalConfig = useAppConfig();
  const navigate = useNavigate();
  return (
    <>
      <List>
        <ListItem title={Locale.Mask.Config.Avatar}>
          <Popover
            content={
              <AvatarPicker
                onEmojiClick={(emoji) => {
                  props.updateFolder((folder) => (folder.avatar = emoji));
                  setShowPicker(false);
                }}
              ></AvatarPicker>
            }
            open={showPicker}
            onClose={() => setShowPicker(false)}
          >
            <div
              onClick={() => setShowPicker(true)}
              style={{ cursor: "pointer" }}
            >
              <FolderAvatar
                avatar={props.folder.avatar}
                model={props.folder.modelConfig.model}
              />
            </div>
          </Popover>
        </ListItem>
        <ListItem title={Locale.Mask.Config.Name}>
          <input
            type="text"
            value={props.folder.name}
            onInput={(e) =>
              props.updateFolder((folder) => {
                folder.name = e.currentTarget.value;
              })
            }
          ></input>
        </ListItem>
      </List>
      {props.folder.isOwner && (
        <IconButton
          icon={<UploadIcon />}
          text={Locale.UI.Import}
          key="import"
          bordered
          onClick={() => {
            importFromFile(props.folder.id, props.updateFolder);
          }}
        />
      )}
      <div>
        {props.folder.files?.map((item) => {
          return (
            <p key={item.id}>
              <a
                onClick={() => {
                  navigate(
                    Path.Preview +
                      "?folder=" +
                      props.folder.id +
                      "&ref=" +
                      item.index +
                      "-1",
                  );
                }}
              >
                {item.index}. {item.name}
              </a>
            </p>
          );
        })}
      </div>
    </>
  );
}

function ContextPromptItem(props: {
  index: number;
  prompt: ChatMessage;
  update: (prompt: ChatMessage) => void;
  remove: () => void;
}) {
  const [focusingInput, setFocusingInput] = useState(false);

  return (
    <div className={chatStyle["context-prompt-row"]}>
      {!focusingInput && (
        <>
          <div className={chatStyle["context-drag"]}>
            <DragIcon />
          </div>
          <Select
            value={props.prompt.role}
            className={chatStyle["context-role"]}
            onChange={(e) =>
              props.update({
                ...props.prompt,
                role: e.target.value as any,
              })
            }
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </>
      )}
      <Input
        value={props.prompt.content}
        type="text"
        className={chatStyle["context-content"]}
        rows={focusingInput ? 5 : 1}
        onFocus={() => setFocusingInput(true)}
        onBlur={() => {
          setFocusingInput(false);
          // If the selection is not removed when the user loses focus, some
          // extensions like "Translate" will always display a floating bar
          window?.getSelection()?.removeAllRanges();
        }}
        onInput={(e) =>
          props.update({
            ...props.prompt,
            content: e.currentTarget.value as any,
          })
        }
      />
      {!focusingInput && (
        <IconButton
          icon={<DeleteIcon />}
          className={chatStyle["context-delete-button"]}
          onClick={() => props.remove()}
          bordered
        />
      )}
    </div>
  );
}

export function ContextPrompts(props: {
  context: ChatMessage[];
  updateContext: (updater: (context: ChatMessage[]) => void) => void;
}) {
  const context = props.context;

  const addContextPrompt = (prompt: ChatMessage, i: number) => {
    props.updateContext((context) => context.splice(i, 0, prompt));
  };

  const removeContextPrompt = (i: number) => {
    props.updateContext((context) => context.splice(i, 1));
  };

  const updateContextPrompt = (i: number, prompt: ChatMessage) => {
    props.updateContext((context) => (context[i] = prompt));
  };

  const onDragEnd: OnDragEndResponder = (result) => {
    if (!result.destination) {
      return;
    }
    const newContext = reorder(
      context,
      result.source.index,
      result.destination.index,
    );
    props.updateContext((context) => {
      context.splice(0, context.length, ...newContext);
    });
  };

  return (
    <>
      <div className={chatStyle["context-prompt"]} style={{ marginBottom: 20 }}>
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="context-prompt-list">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps}>
                {context.map((c, i) => (
                  <Draggable
                    draggableId={c.id || i.toString()}
                    index={i}
                    key={c.id}
                  >
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                      >
                        <ContextPromptItem
                          index={i}
                          prompt={c}
                          update={(prompt) => updateContextPrompt(i, prompt)}
                          remove={() => removeContextPrompt(i)}
                        />
                        <div
                          className={chatStyle["context-prompt-insert"]}
                          onClick={() => {
                            addContextPrompt(
                              createMessage({
                                role: "user",
                                content: "",
                                date: new Date().toLocaleString(),
                              }),
                              i + 1,
                            );
                          }}
                        >
                          <AddIcon />
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {props.context.length === 0 && (
          <div className={chatStyle["context-prompt-row"]}>
            <IconButton
              icon={<AddIcon />}
              text={Locale.Context.Add}
              bordered
              className={chatStyle["context-prompt-button"]}
              onClick={() =>
                addContextPrompt(
                  createMessage({
                    role: "user",
                    content: "",
                    date: "",
                  }),
                  props.context.length,
                )
              }
            />
          </div>
        )}
      </div>
    </>
  );
}

export function FolderPage() {
  const navigate = useNavigate();

  const folderStore = useFolderStore();
  const chatStore = useChatStore();

  const [filterLang, setFilterLang] = useState<Lang>();

  const allMasks = folderStore
    .getAll()
    .filter((m) => !filterLang || m.lang === filterLang);

  const [searchMasks, setSearchMasks] = useState<Folder[]>([]);
  const [searchText, setSearchText] = useState("");
  const masks = searchText.length > 0 ? searchMasks : allMasks;

  // refactored already, now it accurate
  const onSearch = (text: string) => {
    setSearchText(text);
    if (text.length > 0) {
      const result = allMasks.filter((m) =>
        m.name.toLowerCase().includes(text.toLowerCase()),
      );
      setSearchMasks(result);
    } else {
      setSearchMasks(allMasks);
    }
  };

  const [editingMaskId, setEditingMaskId] = useState<string | undefined>();
  const editingMask =
    folderStore.get(editingMaskId) ?? BUILTIN_FOLDER_STORE.get(editingMaskId);
  const closeMaskModal = () => setEditingMaskId(undefined);

  const downloadAll = () => {
    downloadAs(JSON.stringify(masks.filter((v) => !v.isOwner)), FileName.Masks);
  };

  return (
    <ErrorBoundary>
      <div className={styles["mask-page"]}>
        <div className="window-header">
          <div className="window-header-title">
            <div className="window-header-main-title">
              {Locale.Mask.Page.Title}
            </div>
            <div className="window-header-submai-title">
              {Locale.Mask.Page.SubTitle(allMasks.length)}
            </div>
          </div>

          <div className="window-actions">
            <div className="window-action-button">
              <IconButton
                icon={<CloseIcon />}
                bordered
                onClick={() => navigate(-1)}
              />
            </div>
          </div>
        </div>

        <div className={styles["mask-page-body"]}>
          <div className={styles["mask-filter"]}>
            <input
              type="text"
              className={styles["search-bar"]}
              placeholder={Locale.Mask.Page.Search}
              autoFocus
              onInput={(e) => onSearch(e.currentTarget.value)}
            />

            <IconButton
              className={styles["mask-create"]}
              icon={<AddIcon />}
              text={Locale.Mask.Page.Create}
              bordered
              onClick={() => {
                const createdMask = folderStore.create();
                setEditingMaskId(createdMask.id);
              }}
            />
          </div>

          <div>
            {masks.map((m) => (
              <div className={styles["mask-item"]} key={m.id}>
                <div className={styles["mask-header"]}>
                  <div className={styles["mask-icon"]}>
                    <FolderAvatar
                      avatar={m.avatar}
                      model={m.modelConfig.model}
                    />
                  </div>
                  <div className={styles["mask-title"]}>
                    <div className={styles["mask-name"]}>{m.name}</div>
                    <div className={styles["mask-info"] + " one-line"}>
                      {`${Locale.Mask.Item.Info(m.files?.length)} `}
                    </div>
                  </div>
                </div>
                <div className={styles["mask-actions"]}>
                  <IconButton
                    icon={<AddIcon />}
                    text={Locale.Mask.Item.Chat}
                    onClick={() => {
                      chatStore.newSession2(m);
                      navigate(Path.Chat);
                    }}
                  />
                  {!m.isOwner ? (
                    <IconButton
                      icon={<EyeIcon />}
                      text={Locale.Mask.Item.View}
                      onClick={() => setEditingMaskId(m.id)}
                    />
                  ) : (
                    <IconButton
                      icon={<EditIcon />}
                      text={Locale.Mask.Item.Edit}
                      onClick={() => setEditingMaskId(m.id)}
                    />
                  )}
                  {m.isOwner && (
                    <IconButton
                      icon={<DeleteIcon />}
                      text={Locale.Mask.Item.Delete}
                      onClick={async () => {
                        if (await showConfirm(Locale.Mask.Item.DeleteConfirm)) {
                          folderStore.delete(m.id);
                        }
                      }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {editingMask && (
        <div className="modal-mask">
          <Modal
            title={Locale.Mask.EditModal.Title(!editingMask?.isOwner)}
            onClose={closeMaskModal}
            actions={[]}
          >
            <FolderConfig
              folder={editingMask}
              updateFolder={(updater) =>
                folderStore.updateFolder(editingMaskId!, updater)
              }
              readonly={!editingMask.isOwner}
            />
          </Modal>
        </div>
      )}
    </ErrorBoundary>
  );
}
