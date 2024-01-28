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
import { useLocation } from "react-router-dom";

import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

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
      fetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileId,
          index,
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
              <a target="_blank" href={item.url!}>
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

export function PreviewPage() {
  const [numPages, setNumPages] = useState<number>();
  const [pageNumber, setPageNumber] = useState<number>(0);
  const [title, setTitle] = useState<string>("");
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const folder = queryParams.get("folder");
  const ref = queryParams.get("ref");
  const [file, setFile] = useState<Blob | null>(null);

  useEffect(() => {
    const fetchPDF = async () => {
      if (folder && ref) {
        try {
          const files = folderStore
            .get(folder)
            .files.filter((f) => ref.startsWith(f.index + "-"));
          if (files && files.length > 0) {
            setTitle(files[0].name);
            setPageNumber(parseInt(ref.substring(ref.indexOf("-") + 1)));
            const response = await fetch(files[0].url);
            const blob = await response.blob();
            setFile(blob);
          }
        } catch (error) {
          console.error("Error fetching the PDF file:", error);
        }
      }
    };
    console.log(folder);
    console.log(ref);

    fetchPDF();
  }, [folder]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }): void {
    setNumPages(numPages);
  }

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
            <div className="window-header-main-title">{title}</div>
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
          <Document file={file} onLoadSuccess={onDocumentLoadSuccess}>
            <Page pageNumber={pageNumber} />
          </Document>
        </div>
      </div>
    </ErrorBoundary>
  );
}
