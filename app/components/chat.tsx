import { useDebouncedCallback } from "use-debounce";
import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  Fragment,
} from "react";

import SendWhiteIcon from "../icons/send-white.svg";
import BrainIcon from "../icons/brain.svg";
import RenameIcon from "../icons/rename.svg";
import ExportIcon from "../icons/share.svg";
import ReturnIcon from "../icons/return.svg";
import CopyIcon from "../icons/copy.svg";
import FolderIcon from "../icons/file-icon.svg";
import LoadingIcon from "../icons/three-dots.svg";
import PromptIcon from "../icons/prompt.svg";
import MaskIcon from "../icons/mask.svg";
import MaxIcon from "../icons/max.svg";
import MinIcon from "../icons/min.svg";
import ResetIcon from "../icons/reload.svg";
import BreakIcon from "../icons/break.svg";
import SettingsIcon from "../icons/chat-settings.svg";
import DeleteIcon from "../icons/clear.svg";
import PinIcon from "../icons/pin.svg";
import EditIcon from "../icons/rename.svg";
import ConfirmIcon from "../icons/confirm.svg";
import CancelIcon from "../icons/cancel.svg";
import UploadIcon from "../icons/upload.svg";

import LightIcon from "../icons/light.svg";
import DarkIcon from "../icons/dark.svg";
import AutoIcon from "../icons/auto.svg";
import BottomIcon from "../icons/bottom.svg";
import StopIcon from "../icons/pause.svg";
import RobotIcon from "../icons/robot.svg";
import { v4 as uuidv4 } from "uuid";

import {
  ChatMessage,
  SubmitKey,
  useChatStore,
  BOT_HELLO,
  createMessage,
  useAccessStore,
  Theme,
  useAppConfig,
  DEFAULT_TOPIC,
  ModelType,
} from "../store";

import {
  copyToClipboard,
  selectOrCopy,
  autoGrowTextArea,
  useMobileScreen,
} from "../utils";

import dynamic from "next/dynamic";

import { ChatControllerPool } from "../client/controller";
import { Prompt, usePromptStore } from "../store/prompt";
import Locale from "../locales";

import { IconButton } from "./button";
import styles from "./chat.module.scss";

import {
  List,
  ListItem,
  Modal,
  Selector,
  showConfirm,
  showPrompt,
  showToast,
} from "./ui-lib";
import { useNavigate } from "react-router-dom";
import {
  CHAT_PAGE_SIZE,
  LAST_INPUT_KEY,
  Path,
  REQUEST_TIMEOUT_MS,
  UNFINISHED_INPUT,
} from "../constant";
import { Avatar } from "./emoji";
import { ContextPrompts, MaskAvatar, MaskConfig } from "./mask";
import { useMaskStore } from "../store/mask";
import { ChatCommandPrefix, useChatCommand, useCommand } from "../command";
import { prettyObject } from "../utils/format";
import { ExportMessageModal } from "./exporter";
import { getClientConfig } from "../config/client";
import { useAllModels } from "../utils/hooks";
import { Folder, S3File } from "../store/folder";

interface ResizedImage {
  file: File;
  base64: string;
}

function resizeImage(
  file: File,
  maxWidth: number,
  maxHeight: number,
): Promise<ResizedImage> {
  return new Promise((resolve, reject) => {
    if(file.type === "video/mp4") {
      const resizedImage: ResizedImage = {
        file: file,
        base64: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEBLAEsAAD/4QBvRXhpZgAASUkqAAgAAAADAA4BAgAlAAAAMgAAABoBBQABAAAAVwAAABsBBQABAAAAXwAAAAAAAABWZWN0b3IgZ3JhcGhpYyBvZiBubyB0aHVtYm5haWwgc3ltYm9sLAEAAAEAAAAsAQAAAQAAAP/hBUVodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+Cjx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iPgoJPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4KCQk8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczpwaG90b3Nob3A9Imh0dHA6Ly9ucy5hZG9iZS5jb20vcGhvdG9zaG9wLzEuMC8iIHhtbG5zOklwdGM0eG1wQ29yZT0iaHR0cDovL2lwdGMub3JnL3N0ZC9JcHRjNHhtcENvcmUvMS4wL3htbG5zLyIgICB4bWxuczpHZXR0eUltYWdlc0dJRlQ9Imh0dHA6Ly94bXAuZ2V0dHlpbWFnZXMuY29tL2dpZnQvMS4wLyIgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIiB4bWxuczpwbHVzPSJodHRwOi8vbnMudXNlcGx1cy5vcmcvbGRmL3htcC8xLjAvIiAgeG1sbnM6aXB0Y0V4dD0iaHR0cDovL2lwdGMub3JnL3N0ZC9JcHRjNHhtcEV4dC8yMDA4LTAyLTI5LyIgeG1sbnM6eG1wUmlnaHRzPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvcmlnaHRzLyIgcGhvdG9zaG9wOkNyZWRpdD0iR2V0dHkgSW1hZ2VzIiBHZXR0eUltYWdlc0dJRlQ6QXNzZXRJRD0iMTE0NzU0NDgwNyIgeG1wUmlnaHRzOldlYlN0YXRlbWVudD0iaHR0cHM6Ly93d3cuaXN0b2NrcGhvdG8uY29tL2xlZ2FsL2xpY2Vuc2UtYWdyZWVtZW50P3V0bV9tZWRpdW09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/wD9v/8A/wCv1/8A/wD/AP8A5f8A/wD9/r//AP8A/wD8r/8A/wDf9f8A/wD/AP8A/X//AP5/r/8A/wD/AP8A6/8A/wD/AL1//wD/AP8A/wDf5/8A9+v/AP8A/wD/APz8v/8A/wBf/wD/AP8A/wDn/wDx/wD6/wD/AP8A/wD/AL//AK//ANf/AP8A/wD/AP8A/wD13/6//wD/AP8A/wD/AD//AD/1/wD/AP8A/wD/AHv/AP7/AK//AP8A/wD/AP8A/wD/APv9f/8A/wD/AP8A/f8A/wD76/8A/wD/AP8A/wDv/wD/AO9f/wD/AP8A/wD/AP8A/wD/ALr/AP8A/wD/AP8A/gAAANf/AP8A/wD/APl//wD/AP6//wD/AP8A/wD/AP8A/wD/AP3/AP8A/wD/AP8A/wD/AP8A/wDv/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP/EACsQAAIBAgUEAgIDAQEBAAAAAAABEWHxECExQVEgUHGRofAwQIHB0WCgsf/aAAgBAQABPxC9l7L2XsvZey9l7L2XsvZey9l7L2XsvZey9l7L2XsvZey9l7L2XsvZey9l7L2XsvZey9l7L2XsvZey9l7L2XsvZey9l7L2XsvZey9l7L2XsvZey9l7L2XsvZey9l7L2XsvZey9l7L2Xsvf/qE1wV0NWV/xHxmI1wlrmf5UGnSsYKcrVDUNp7f8GxhjdEa2iVC2s6LI0pJ5eZp1Q3Z5rv6TbhKTTmS5eQ/YVEObgkSESVOhHKvJmlNvRDmn5ZiRLPRoUtcp1XGGf/E++awKjmn4Zm8HqxVC/BdDaSW0lU5+/kP/ALGNadLjINtuW56Mv+ZYV5m7xrX4I2gtWKf5BpQrHTpBPCzFdd1eRp6JRDWWNV/gpzJg0mJ6PIc81TjubCEbdEcWVC9x0Q05G+XmJRp0aVv5NO/AaY+Q1jeX0JNoRtvZCqWl5MVSl4GMaEaa2fSzQmqcilpo1OE+9knt+uhpzJcvIe0FRI5sqEEISouhPKPJmnttRDun5ZmuEcLLrSbaSzbNNy+rx03C6MabNNQ1r0xy3aMJeG47Zr0rB/tQb4erPjMXVxfIbXOMg3uWx1n8URERERD0hLZdKUhPZ9MRERxDXDDbBvR9MREaalPRrssI1y9mxpArr2dVI2U9kdNPRNM1U4NEbaEt2aYfxP8AegY58zGXCO6K32VvsrfZW+yt9lb7K32VvsrfZW+yt9lb7K32VvsrfZW+yt9lb7K32VvsrfZW+yt9lb7K32VvsrfZW+y+EnfK47OE73Sh4KJaN546vlgzYXH77OLZ9nBPxnKwn3u046vlh8T9ZYS23sMamGiHFkHUz1qeDq+hVdnCGbZMFPNGoGmxPVZYavlh8T9ZSW1vPFpI01KexLJqzXT9Cq7ODEJqnIhCaNThTmZYavlh8T9VEi9GnSqk3lrp+hVdoCrMmGX/ABPDV8sPifqsQmqci06TU9CEGzPp+hVdoDzrNYQ3dZrDV8sPifrc/f4FUqSmCNsVHRDGM5b1fT9Cq7QE72bh4NJpp6MY53Qavlh8TqW5P9zIMlbZoiyZbNaP86bTlNoeuZ+X1/Qqu0AnDlFVVOEu9kk1fLD4nSxSJbcISl21q8HhCaexOT/Kv1voVXaQqhowl5qDV8sPidM7IyWXSS5VD3/wNNOGoaxYpEt5I4RQh7klbJp+f6FV2kIeCw8ZZGr5YfE6G6ibE6CS6l8ry8kPYeGuimBCNImnsxinMQaacNQ/y/Qqu0hRZ5401T/+4fE6I2Rm8vwIqzw+BLqlwjMQhEJZLoQy/AIEuWzWj/J9Cq7UFVlnh9t3WHxMWpd9fAhCKElC/OxITT2YyWYvZGn4voVXagl5LCE0e6w+JjmxcPj9LNf5UQpfD2f4foVXagopI6PiYcKt5+BKFC/TeEpp7MlZeDdfg+hVdqCqKROVKx+JhNwlH60knl5MqKvPV9Cq7WE73Sh4/Ew/q/XiiaJCTg3XT9Cq7WHjWax+Jg6g3aT/AGZb+lZk5PH6FV2sKMyY/EwQXw0KLNzL4XwvhfC+F8L4XwvhfC+F8L4XwvhfC+F8L4XwvhfC+F8EhBDnLH6FV2sGaE1TkQtNGpw2thA3NJkEEEEEEEEEEEEEEEEEEEEEEEEEEEEPgkVxKhJ9sCGb5OiFwQuCFwQuCFwQuCFwQuCFwQuCFwQuCFwQuCFwQuCFwQuCFwQuCFwQuCFwQuCFwQuCFwQuCF20GMQtHnscjdhLtcShQeS8F4LwXgvBeC8F4LwXgvBeC8F4LwXgvBeC8F4LwXgvBeC8F4LwXgvBeC8F4LwNtuW5f/qx/9k=",
      };

      resolve(resizedImage);
    }else {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const image = new Image();
        image.src = reader.result as string;
        image.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");

          let width = image.width;
          let height = image.height;

          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }

          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }

          canvas.width = width;
          canvas.height = height;
          if (ctx) {
            ctx.drawImage(image, 0, 0, width, height);

            canvas.toBlob((blob) => {
              if (blob) {
                const resizedFile = new File([blob], file.name, {
                  type: file.type,
                  lastModified: Date.now(),
                });

                const resizedImage: ResizedImage = {
                  file: resizedFile,
                  base64: reader.result as string,
                };

                resolve(resizedImage);
              } else {
                reject("blob not available");
              }
            }, file.type);
          } else {
            reject("ctx not available");
          }
        };
      };
      reader.onerror = (error) => reject(error);
    }
  });
}

const Markdown = dynamic(async () => (await import("./markdown")).Markdown, {
  loading: () => <LoadingIcon />,
});

const TagWithTooltip = ({
  tagText,
  folder,
  tooltipText,
}: {
  tagText: string;
  folder: string;
  tooltipText: string;
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const navigate = useNavigate();
  return (
    <div
      className="chat-message-action-tag"
      onClick={() => setShowTooltip(!showTooltip)}
    >
      {tagText}
      {showTooltip && (
        <div className="chat-message-action-tag-tooltip">
          {tooltipText}
          <button
            onClick={() => {
              let ref = tagText;
              if (tagText.startsWith("[")) {
                ref = ref.substring(1);
              }
              if (tagText.endsWith("]")) {
                ref = ref.substring(0, ref.length - 1);
              }

              navigate(Path.Preview + "?folder=" + folder + "&ref=" + ref);
            }}
          >
            {"details"}
          </button>
        </div>
      )}
    </div>
  );
};

export function SessionConfigModel(props: { onClose: () => void }) {
  const chatStore = useChatStore();
  const session = chatStore.currentSession();
  const maskStore = useMaskStore();
  const navigate = useNavigate();

  return (
    <div className="modal-mask">
      <Modal
        title={Locale.Context.Edit}
        onClose={() => props.onClose()}
        actions={[
          <IconButton
            key="reset"
            icon={<ResetIcon />}
            bordered
            text={Locale.Chat.Config.Reset}
            onClick={async () => {
              if (await showConfirm(Locale.Memory.ResetConfirm)) {
                chatStore.updateCurrentSession(
                  (session) => (session.memoryPrompt = ""),
                );
              }
            }}
          />,
          <IconButton
            key="copy"
            icon={<CopyIcon />}
            bordered
            text={Locale.Chat.Config.SaveAs}
            onClick={() => {
              navigate(Path.Masks);
              setTimeout(() => {
                maskStore.create(session.mask);
              }, 500);
            }}
          />,
        ]}
      >
        <MaskConfig
          mask={session.mask}
          updateMask={(updater) => {
            const mask = { ...session.mask };
            updater(mask);
            chatStore.updateCurrentSession((session) => (session.mask = mask));
          }}
          shouldSyncFromGlobal
          extraListItems={
            session.mask.modelConfig.sendMemory ? (
              <ListItem
                className="copyable"
                title={`${Locale.Memory.Title} (${session.lastSummarizeIndex} of ${session.messages.length})`}
                subTitle={session.memoryPrompt || Locale.Memory.EmptyContent}
              ></ListItem>
            ) : (
              <></>
            )
          }
        ></MaskConfig>
      </Modal>
    </div>
  );
}

function PromptToast(props: {
  showToast?: boolean;
  showModal?: boolean;
  setShowModal: (_: boolean) => void;
}) {
  const chatStore = useChatStore();
  const session = chatStore.currentSession();
  const context = session.mask.context;

  return (
    <div className={styles["prompt-toast"]} key="prompt-toast">
      {props.showToast && (
        <div
          className={styles["prompt-toast-inner"] + " clickable"}
          role="button"
          onClick={() => props.setShowModal(true)}
        >
          <BrainIcon />
          <span className={styles["prompt-toast-content"]}>
            {Locale.Context.Toast(context.length)}
          </span>
        </div>
      )}
      {props.showModal && (
        <SessionConfigModel onClose={() => props.setShowModal(false)} />
      )}
    </div>
  );
}

function useSubmitHandler() {
  const config = useAppConfig();
  const submitKey = config.submitKey;
  const isComposing = useRef(false);

  useEffect(() => {
    const onCompositionStart = () => {
      isComposing.current = true;
    };
    const onCompositionEnd = () => {
      isComposing.current = false;
    };

    window.addEventListener("compositionstart", onCompositionStart);
    window.addEventListener("compositionend", onCompositionEnd);

    return () => {
      window.removeEventListener("compositionstart", onCompositionStart);
      window.removeEventListener("compositionend", onCompositionEnd);
    };
  }, []);

  const shouldSubmit = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter") return false;
    if (e.key === "Enter" && (e.nativeEvent.isComposing || isComposing.current))
      return false;
    return (
      (config.submitKey === SubmitKey.AltEnter && e.altKey) ||
      (config.submitKey === SubmitKey.CtrlEnter && e.ctrlKey) ||
      (config.submitKey === SubmitKey.ShiftEnter && e.shiftKey) ||
      (config.submitKey === SubmitKey.MetaEnter && e.metaKey) ||
      (config.submitKey === SubmitKey.Enter &&
        !e.altKey &&
        !e.ctrlKey &&
        !e.shiftKey &&
        !e.metaKey)
    );
  };

  return {
    submitKey,
    shouldSubmit,
  };
}

export type RenderPompt = Pick<Prompt, "title" | "content">;

export function PromptHints(props: {
  prompts: RenderPompt[];
  onPromptSelect: (prompt: RenderPompt) => void;
}) {
  const noPrompts = props.prompts.length === 0;
  const [selectIndex, setSelectIndex] = useState(0);
  const selectedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectIndex(0);
  }, [props.prompts.length]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (noPrompts || e.metaKey || e.altKey || e.ctrlKey) {
        return;
      }
      // arrow up / down to select prompt
      const changeIndex = (delta: number) => {
        e.stopPropagation();
        e.preventDefault();
        const nextIndex = Math.max(
          0,
          Math.min(props.prompts.length - 1, selectIndex + delta),
        );
        setSelectIndex(nextIndex);
        selectedRef.current?.scrollIntoView({
          block: "center",
        });
      };

      if (e.key === "ArrowUp") {
        changeIndex(1);
      } else if (e.key === "ArrowDown") {
        changeIndex(-1);
      } else if (e.key === "Enter") {
        const selectedPrompt = props.prompts.at(selectIndex);
        if (selectedPrompt) {
          props.onPromptSelect(selectedPrompt);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.prompts.length, selectIndex]);

  if (noPrompts) return null;
  return (
    <div className={styles["prompt-hints"]}>
      {props.prompts.map((prompt, i) => (
        <div
          ref={i === selectIndex ? selectedRef : null}
          className={
            styles["prompt-hint"] +
            ` ${i === selectIndex ? styles["prompt-hint-selected"] : ""}`
          }
          key={prompt.title + i.toString()}
          onClick={() => props.onPromptSelect(prompt)}
          onMouseEnter={() => setSelectIndex(i)}
        >
          <div className={styles["hint-title"]}>{prompt.title}</div>
          <div className={styles["hint-content"]}>{prompt.content}</div>
        </div>
      ))}
    </div>
  );
}

function ClearContextDivider() {
  const chatStore = useChatStore();

  return (
    <div
      className={styles["clear-context"]}
      onClick={() =>
        chatStore.updateCurrentSession(
          (session) => (session.clearContextIndex = undefined),
        )
      }
    >
      <div className={styles["clear-context-tips"]}>{Locale.Context.Clear}</div>
      <div className={styles["clear-context-revert-btn"]}>
        {Locale.Context.Revert}
      </div>
    </div>
  );
}

function ChatAction(props: {
  text: string;
  icon: JSX.Element;
  onClick: () => void;
}) {
  const iconRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState({
    full: 16,
    icon: 16,
  });

  function updateWidth() {
    if (!iconRef.current || !textRef.current) return;
    const getWidth = (dom: HTMLDivElement) => dom.getBoundingClientRect().width;
    const textWidth = getWidth(textRef.current);
    const iconWidth = getWidth(iconRef.current);
    setWidth({
      full: textWidth + iconWidth,
      icon: iconWidth,
    });
  }

  return (
    <div
      className={`${styles["chat-input-action"]} clickable`}
      onClick={() => {
        props.onClick();
        setTimeout(updateWidth, 1);
      }}
      onMouseEnter={updateWidth}
      onTouchStart={updateWidth}
      style={
        {
          "--icon-width": `${width.icon}px`,
          "--full-width": `${width.full}px`,
        } as React.CSSProperties
      }
    >
      <div ref={iconRef} className={styles["icon"]}>
        {props.icon}
      </div>
      <div className={styles["text"]} ref={textRef}>
        {props.text}
      </div>
    </div>
  );
}

function useScrollToBottom() {
  // for auto-scroll
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  function scrollDomToBottom() {
    const dom = scrollRef.current;
    if (dom) {
      requestAnimationFrame(() => {
        setAutoScroll(true);
        dom.scrollTo(0, dom.scrollHeight);
      });
    }
  }

  // auto scroll
  useEffect(() => {
    if (autoScroll) {
      scrollDomToBottom();
    }
  });

  return {
    scrollRef,
    autoScroll,
    setAutoScroll,
    scrollDomToBottom,
  };
}

export function ChatActions(props: {
  showPromptModal: () => void;
  scrollToBottom: () => void;
  showPromptHints: () => void;
  imageSelected: (img: any) => void;
  hitBottom: boolean;
  folder: Folder;
  display: boolean;
}) {
  const config = useAppConfig();
  const navigate = useNavigate();
  const chatStore = useChatStore();

  // switch themes
  const theme = config.theme;
  function nextTheme() {
    const themes = [Theme.Auto, Theme.Light, Theme.Dark];
    const themeIndex = themes.indexOf(theme);
    const nextIndex = (themeIndex + 1) % themes.length;
    const nextTheme = themes[nextIndex];
    config.update((config) => (config.theme = nextTheme));
  }

  // stop all responses
  const couldStop = ChatControllerPool.hasPending();
  const stopAll = () => ChatControllerPool.stopAll();

  function selectImage() {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".png,.jpg,.webp,.jpeg,.mp4";
    const fileReader = new FileReader();
    fileInput.onchange = async (event: any) => {
      const file = event.target.files[0];
      const resizedImage = await resizeImage(file, 2048, 2048);
      // Upload the resized image file or use the resized image data URL
      console.log(resizedImage);
      const size = resizedImage.file.size;
      fetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-transaction-id": uuidv4(),
        },
        body: JSON.stringify({
          size,
          fileId: uuidv4(),
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
          formData.append("file", resizedImage.file!);

          fetch(url, {
            method: "POST",
            body: formData,
          }).then((res) => {
            if (res.status === 204) {
              props.imageSelected({
                filename: file.name,
                url: fileUrl,
                base64: resizedImage.base64,
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
  }

  // switch model
  const currentModel = chatStore.currentSession().mask.modelConfig.model;
  const currentFile = chatStore.currentSession().folder.selectedFile;

  const allModels = useAllModels();
  const models = useMemo(
    () => allModels.filter((m) => m.available),
    [allModels],
  );
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showFolder, setShowFolder] = useState(false);

  useEffect(() => {
    // if current model is not available
    // switch to first available model
    const isUnavaliableModel = !models.some((m) => m.name === currentModel);
    if (isUnavaliableModel && models.length > 0) {
      const nextModel = models[0].name as ModelType;
      chatStore.updateCurrentSession(
        (session) => (session.mask.modelConfig.model = nextModel),
      );
      showToast(nextModel);
    }
  }, [chatStore, currentModel, models]);

  return (
    <div className={styles["chat-input-actions"]}>
      {couldStop && (
        <ChatAction
          onClick={stopAll}
          text={Locale.Chat.InputActions.Stop}
          icon={<StopIcon />}
        />
      )}
      {!props.hitBottom && (
        <ChatAction
          onClick={props.scrollToBottom}
          text={Locale.Chat.InputActions.ToBottom}
          icon={<BottomIcon />}
        />
      )}
      {props.hitBottom && (
        <ChatAction
          onClick={props.showPromptModal}
          text={Locale.Chat.InputActions.Settings}
          icon={<SettingsIcon />}
        />
      )}

      <ChatAction
        onClick={nextTheme}
        text={Locale.Chat.InputActions.Theme[theme]}
        icon={
          <>
            {theme === Theme.Auto ? (
              <AutoIcon />
            ) : theme === Theme.Light ? (
              <LightIcon />
            ) : theme === Theme.Dark ? (
              <DarkIcon />
            ) : null}
          </>
        }
      />
      {props.display && (
        <ChatAction
          onClick={props.showPromptHints}
          text={Locale.Chat.InputActions.Prompt}
          icon={<PromptIcon />}
        />
      )}
      {props.display && (
        <ChatAction
          onClick={() => {
            navigate(Path.Masks);
          }}
          text={Locale.Chat.InputActions.Masks}
          icon={<MaskIcon />}
        />
      )}
      <ChatAction
        text={Locale.Chat.InputActions.Clear}
        icon={<BreakIcon />}
        onClick={() => {
          chatStore.updateCurrentSession((session) => {
            if (session.clearContextIndex === session.messages.length) {
              session.clearContextIndex = undefined;
            } else {
              session.clearContextIndex = session.messages.length;
              session.memoryPrompt = ""; // will clear memory
            }
          });
        }}
      />
      {props.display && (
        <ChatAction
          onClick={() => setShowModelSelector(true)}
          text={currentModel}
          icon={<RobotIcon />}
        />
      )}
      {props.display &&
        (currentModel === "gemini-pro-vision" ||
          currentModel === "gpt-4-vision-preview" ||
          currentModel === "midjourney") && (
          <ChatAction
            onClick={selectImage}
            text="选择图片"
            icon={<UploadIcon />}
          />
        )}
      {props.display && showModelSelector && (
        <Selector
          defaultSelectedValue={currentModel}
          items={models.map((m) => ({
            title: m.displayName,
            value: m.name,
          }))}
          onClose={() => setShowModelSelector(false)}
          onSelection={(s) => {
            if (s.length === 0) return;
            chatStore.updateCurrentSession((session) => {
              session.mask.modelConfig.model = s[0] as ModelType;
              session.mask.syncGlobalConfig = false;
            });
            showToast(s[0]);
          }}
        />
      )}
      {props.folder && props.folder.id != "" && (
        <ChatAction
          text={currentFile ? currentFile.name : props.folder.name}
          icon={<FolderIcon />}
          onClick={() => {
            setShowFolder(true);
          }}
        />
      )}
      {showFolder && props.folder && props.folder.id != "" && (
        <Selector
          defaultSelectedValue={currentFile ? currentFile.id : ""}
          items={[
            { title: props.folder.name, value: "" },
            ...props.folder?.files.map((m) => ({
              title: m.index + ". " + m.name,
              value: m.id,
            })),
          ]}
          onClose={() => setShowFolder(false)}
          onSelection={(s) => {
            if (s.length === 0) return;
            const folders = props.folder.files.filter((f) => f.id === s[0]);

            chatStore.updateCurrentSession((session) => {
              session.folder.selectedFile = (
                folders.length > 0 ? folders[0] : null
              ) as S3File;
            });

            showToast(
              folders.map((item) => item.index + ". " + item.name).join(""),
            );
          }}
        />
      )}
    </div>
  );
}

export function EditMessageModal(props: { onClose: () => void }) {
  const chatStore = useChatStore();
  const session = chatStore.currentSession();
  const [messages, setMessages] = useState(session.messages.slice());

  return (
    <div className="modal-mask">
      <Modal
        title={Locale.Chat.EditMessage.Title}
        onClose={props.onClose}
        actions={[
          <IconButton
            text={Locale.UI.Cancel}
            icon={<CancelIcon />}
            key="cancel"
            onClick={() => {
              props.onClose();
            }}
          />,
          <IconButton
            type="primary"
            text={Locale.UI.Confirm}
            icon={<ConfirmIcon />}
            key="ok"
            onClick={() => {
              chatStore.updateCurrentSession(
                (session) => (session.messages = messages),
              );
              props.onClose();
            }}
          />,
        ]}
      >
        <List>
          <ListItem
            title={Locale.Chat.EditMessage.Topic.Title}
            subTitle={Locale.Chat.EditMessage.Topic.SubTitle}
          >
            <input
              type="text"
              value={session.topic}
              onInput={(e) =>
                chatStore.updateCurrentSession(
                  (session) => (session.topic = e.currentTarget.value),
                )
              }
            ></input>
          </ListItem>
        </List>
        <ContextPrompts
          context={messages}
          updateContext={(updater) => {
            const newMessages = messages.slice();
            updater(newMessages);
            setMessages(newMessages);
          }}
        />
      </Modal>
    </div>
  );
}

function _Chat() {
  type RenderMessage = ChatMessage & { preview?: boolean };

  const chatStore = useChatStore();
  const session = chatStore.currentSession();
  const config = useAppConfig();
  const fontSize = config.fontSize;

  const [showExport, setShowExport] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [userInput, setUserInput] = useState("");
  const [useImages, setUseImages] = useState<any[]>([]);
  const [mjImageMode, setMjImageMode] = useState<string>("IMAGINE");
  const [isLoading, setIsLoading] = useState(false);
  const { submitKey, shouldSubmit } = useSubmitHandler();
  const { scrollRef, setAutoScroll, scrollDomToBottom } = useScrollToBottom();
  const [hitBottom, setHitBottom] = useState(true);
  const isMobileScreen = useMobileScreen();
  const navigate = useNavigate();

  // prompt hints
  const promptStore = usePromptStore();
  const [promptHints, setPromptHints] = useState<RenderPompt[]>([]);
  const onSearch = useDebouncedCallback(
    (text: string) => {
      const matchedPrompts = promptStore.search(text);
      setPromptHints(matchedPrompts);
    },
    100,
    { leading: true, trailing: true },
  );

  // auto grow input
  const [inputRows, setInputRows] = useState(2);
  const measure = useDebouncedCallback(
    () => {
      const rows = inputRef.current ? autoGrowTextArea(inputRef.current) : 1;
      const inputRows = Math.min(
        20,
        Math.max(2 + Number(!isMobileScreen), rows),
      );
      setInputRows(inputRows);
    },
    100,
    {
      leading: true,
      trailing: true,
    },
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(measure, [userInput]);

  // chat commands shortcuts
  const chatCommands = useChatCommand({
    new: () => chatStore.newSession(),
    newm: () => navigate(Path.NewChat),
    prev: () => chatStore.nextSession(-1),
    next: () => chatStore.nextSession(1),
    clear: () =>
      chatStore.updateCurrentSession(
        (session) => (session.clearContextIndex = session.messages.length),
      ),
    del: () => chatStore.deleteSession(chatStore.currentSessionIndex),
  });

  // only search prompts when user input is short
  const SEARCH_TEXT_LIMIT = 30;
  const onInput = (text: string) => {
    setUserInput(text);
    const n = text.trim().length;

    // clear search results
    if (n === 0) {
      setPromptHints([]);
    } else if (text.startsWith(ChatCommandPrefix)) {
      setPromptHints(chatCommands.search(text));
    } else if (!config.disablePromptHint && n < SEARCH_TEXT_LIMIT) {
      // check if need to trigger auto completion
      if (text.startsWith("/")) {
        let searchText = text.slice(1);
        onSearch(searchText);
      }
    }
  };

  const doSubmit = (userInput: string) => {
    if (userInput.trim() === "" && useImages.length === 0) return;
    const matchCommand = chatCommands.match(userInput);
    if (matchCommand.matched) {
      setUserInput("");
      setPromptHints([]);
      matchCommand.invoke();
      return;
    }
    setIsLoading(true);
    chatStore
      .onUserInput(
        userInput,
        useImages.map((item) => item.url),
      )
      .then(() => setIsLoading(false));
    localStorage.setItem(LAST_INPUT_KEY, userInput);
    setUserInput("");
    setUseImages([]);
    setPromptHints([]);
    if (!isMobileScreen) inputRef.current?.focus();
    setAutoScroll(true);
  };

  const onPromptSelect = (prompt: RenderPompt) => {
    setTimeout(() => {
      setPromptHints([]);

      const matchedChatCommand = chatCommands.match(prompt.content);
      if (matchedChatCommand.matched) {
        // if user is selecting a chat command, just trigger it
        matchedChatCommand.invoke();
        setUserInput("");
      } else {
        // or fill the prompt
        setUserInput(prompt.content);
      }
      inputRef.current?.focus();
    }, 30);
  };

  // stop response
  const onUserStop = (messageId: string) => {
    ChatControllerPool.stop(session.id, messageId);
  };

  useEffect(() => {
    chatStore.updateCurrentSession((session) => {
      const stopTiming = Date.now() - REQUEST_TIMEOUT_MS;
      session.messages.forEach((m) => {
        // check if should stop all stale messages
        if (m.isError || new Date(m.date).getTime() < stopTiming) {
          if (m.streaming) {
            m.streaming = false;
          }

          if (m.content.length === 0) {
            m.isError = true;
            m.content = prettyObject({
              error: true,
              message: "empty response",
            });
          }
        }
      });

      // auto sync mask config from global config
      if (session.mask.syncGlobalConfig) {
        console.log("[Mask] syncing from global, name = ", session.mask.name);
        session.mask.modelConfig = { ...config.modelConfig };
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // check if should send message
  const onInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // if ArrowUp and no userInput, fill with last input
    if (
      e.key === "ArrowUp" &&
      userInput.length <= 0 &&
      !(e.metaKey || e.altKey || e.ctrlKey)
    ) {
      setUserInput(localStorage.getItem(LAST_INPUT_KEY) ?? "");
      e.preventDefault();
      return;
    }
    if (shouldSubmit(e) && promptHints.length === 0) {
      doSubmit(userInput);
      e.preventDefault();
    }
  };
  const onRightClick = (e: any, message: ChatMessage) => {
    // copy to clipboard
    if (selectOrCopy(e.currentTarget, message.content)) {
      if (userInput.length === 0) {
        setUserInput(message.content);
      }

      e.preventDefault();
    }
  };

  const deleteMessage = (msgId?: string) => {
    chatStore.updateCurrentSession(
      (session) =>
        (session.messages = session.messages.filter((m) => m.id !== msgId)),
    );
  };

  const onDelete = (msgId: string) => {
    deleteMessage(msgId);
  };

  const onResend = (message: ChatMessage) => {
    // when it is resending a message
    // 1. for a user's message, find the next bot response
    // 2. for a bot's message, find the last user's input
    // 3. delete original user input and bot's message
    // 4. resend the user's input

    const resendingIndex = session.messages.findIndex(
      (m) => m.id === message.id,
    );

    if (resendingIndex < 0 || resendingIndex >= session.messages.length) {
      console.error("[Chat] failed to find resending message", message);
      return;
    }

    let userMessage: ChatMessage | undefined;
    let botMessage: ChatMessage | undefined;

    if (message.role === "assistant") {
      // if it is resending a bot's message, find the user input for it
      botMessage = message;
      if (message.status) {
        // refresh message status
        chatStore.refreshMessage(message, resendingIndex);
        return;
      } else {
        // original logic here
        for (let i = resendingIndex; i >= 0; i -= 1) {
          if (session.messages[i].role === "user") {
            userMessage = session.messages[i];
            break;
          }
        }
      }
    } else if (message.role === "user") {
      // if it is resending a user's input, find the bot's response
      userMessage = message;
      for (let i = resendingIndex; i < session.messages.length; i += 1) {
        if (session.messages[i].role === "assistant") {
          botMessage = session.messages[i];
          break;
        }
      }
    }

    if (userMessage === undefined) {
      console.error("[Chat] failed to resend", message);
      return;
    }

    // delete the original messages
    deleteMessage(userMessage.id);
    deleteMessage(botMessage?.id);

    // resend the message
    setIsLoading(true);
    chatStore.onUserInput(userMessage.content).then(() => setIsLoading(false));
    inputRef.current?.focus();
  };

  const onPinMessage = (message: ChatMessage) => {
    chatStore.updateCurrentSession((session) =>
      session.mask.context.push(message),
    );

    showToast(Locale.Chat.Actions.PinToastContent, {
      text: Locale.Chat.Actions.PinToastAction,
      onClick: () => {
        setShowPromptModal(true);
      },
    });
  };

  const context: RenderMessage[] = useMemo(() => {
    return session.mask.hideContext ? [] : session.mask.context.slice();
  }, [session.mask.context, session.mask.hideContext]);
  const accessStore = useAccessStore();

  if (
    context.length === 0 &&
    session.messages.at(0)?.content !== BOT_HELLO.content
  ) {
    const copiedHello = Object.assign({}, BOT_HELLO);
    if (!accessStore.isAuthorized()) {
      copiedHello.content = Locale.Error.Unauthorized;
    }
    context.push(copiedHello);
  }

  // preview messages
  const renderMessages = useMemo(() => {
    return context
      .concat(session.messages as RenderMessage[])
      .concat(
        isLoading
          ? [
              {
                ...createMessage({
                  role: "assistant",
                  content: "……",
                }),
                preview: true,
              },
            ]
          : [],
      )
      .concat(
        userInput.length > 0 && config.sendPreviewBubble
          ? [
              {
                ...createMessage({
                  role: "user",
                  content: userInput,
                }),
                preview: true,
              },
            ]
          : [],
      );
  }, [
    config.sendPreviewBubble,
    context,
    isLoading,
    session.messages,
    userInput,
  ]);

  const [msgRenderIndex, _setMsgRenderIndex] = useState(
    Math.max(0, renderMessages.length - CHAT_PAGE_SIZE),
  );
  function setMsgRenderIndex(newIndex: number) {
    newIndex = Math.min(renderMessages.length - CHAT_PAGE_SIZE, newIndex);
    newIndex = Math.max(0, newIndex);
    _setMsgRenderIndex(newIndex);
  }

  const messages = useMemo(() => {
    const endRenderIndex = Math.min(
      msgRenderIndex + 3 * CHAT_PAGE_SIZE,
      renderMessages.length,
    );
    return renderMessages.slice(msgRenderIndex, endRenderIndex);
  }, [msgRenderIndex, renderMessages]);

  const onChatBodyScroll = (e: HTMLElement) => {
    const bottomHeight = e.scrollTop + e.clientHeight;
    const edgeThreshold = e.clientHeight;

    const isTouchTopEdge = e.scrollTop <= edgeThreshold;
    const isTouchBottomEdge = bottomHeight >= e.scrollHeight - edgeThreshold;
    const isHitBottom =
      bottomHeight >= e.scrollHeight - (isMobileScreen ? 4 : 10);

    const prevPageMsgIndex = msgRenderIndex - CHAT_PAGE_SIZE;
    const nextPageMsgIndex = msgRenderIndex + CHAT_PAGE_SIZE;

    if (isTouchTopEdge && !isTouchBottomEdge) {
      setMsgRenderIndex(prevPageMsgIndex);
    } else if (isTouchBottomEdge) {
      setMsgRenderIndex(nextPageMsgIndex);
    }

    setHitBottom(isHitBottom);
    setAutoScroll(isHitBottom);
  };

  function scrollToBottom() {
    setMsgRenderIndex(renderMessages.length - CHAT_PAGE_SIZE);
    scrollDomToBottom();
  }

  // clear context index = context length + index in messages
  const clearContextIndex =
    (session.clearContextIndex ?? -1) >= 0
      ? session.clearContextIndex! + context.length - msgRenderIndex
      : -1;

  const [showPromptModal, setShowPromptModal] = useState(false);

  const clientConfig = useMemo(() => getClientConfig(), []);

  const autoFocus = !isMobileScreen; // wont auto focus on mobile screen
  const showMaxIcon = !isMobileScreen && !clientConfig?.isApp;

  useCommand({
    fill: setUserInput,
    submit: (text) => {
      doSubmit(text);
    },
    code: (text) => {
      if (accessStore.disableFastLink) return;
      console.log("[Command] got code from url: ", text);
      showConfirm(Locale.URLCommand.Code + `code = ${text}`).then((res) => {
        if (res) {
          accessStore.update((access) => (access.accessCode = text));
        }
      });
    },
    settings: (text) => {
      if (accessStore.disableFastLink) return;

      try {
        const payload = JSON.parse(text) as {
          key?: string;
          url?: string;
        };

        console.log("[Command] got settings from url: ", payload);

        if (payload.key || payload.url) {
          showConfirm(
            Locale.URLCommand.Settings +
              `\n${JSON.stringify(payload, null, 4)}`,
          ).then((res) => {
            if (!res) return;
            if (payload.key) {
              accessStore.update(
                (access) => (access.openaiApiKey = payload.key!),
              );
            }
            if (payload.url) {
              accessStore.update((access) => (access.openaiUrl = payload.url!));
            }
          });
        }
      } catch {
        console.error("[Command] failed to get settings from url: ", text);
      }
    },
  });

  // edit / insert message modal
  const [isEditingMessage, setIsEditingMessage] = useState(false);

  // remember unfinished input
  useEffect(() => {
    // try to load from local storage
    const key = UNFINISHED_INPUT(session.id);
    const mayBeUnfinishedInput = localStorage.getItem(key);
    if (mayBeUnfinishedInput && userInput.length === 0) {
      setUserInput(mayBeUnfinishedInput);
      localStorage.removeItem(key);
    }

    const dom = inputRef.current;
    return () => {
      localStorage.setItem(key, dom?.value ?? "");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.chat} key={session.id}>
      <div className="window-header" data-tauri-drag-region>
        {isMobileScreen && (
          <div className="window-actions">
            <div className={"window-action-button"}>
              <IconButton
                icon={<ReturnIcon />}
                bordered
                title={Locale.Chat.Actions.ChatList}
                onClick={() => navigate(Path.Home)}
              />
            </div>
          </div>
        )}

        <div className={`window-header-title ${styles["chat-body-title"]}`}>
          <div
            className={`window-header-main-title ${styles["chat-body-main-title"]}`}
            onClickCapture={() => setIsEditingMessage(true)}
          >
            {!session.topic ? DEFAULT_TOPIC : session.topic}
          </div>
          <div className="window-header-sub-title">
            {Locale.Chat.SubTitle(session.messages.length)}
          </div>
        </div>
        <div className="window-actions">
          {!isMobileScreen && (
            <div className="window-action-button">
              <IconButton
                icon={<RenameIcon />}
                bordered
                onClick={() => setIsEditingMessage(true)}
              />
            </div>
          )}
          <div className="window-action-button">
            <IconButton
              icon={<ExportIcon />}
              bordered
              title={Locale.Chat.Actions.Export}
              onClick={() => {
                setShowExport(true);
              }}
            />
          </div>
          {showMaxIcon && (
            <div className="window-action-button">
              <IconButton
                icon={config.tightBorder ? <MinIcon /> : <MaxIcon />}
                bordered
                onClick={() => {
                  config.update(
                    (config) => (config.tightBorder = !config.tightBorder),
                  );
                }}
              />
            </div>
          )}
        </div>

        <PromptToast
          showToast={!hitBottom}
          showModal={showPromptModal}
          setShowModal={setShowPromptModal}
        />
      </div>

      <div
        className={styles["chat-body"]}
        ref={scrollRef}
        onScroll={(e) => onChatBodyScroll(e.currentTarget)}
        onMouseDown={() => inputRef.current?.blur()}
        onTouchStart={() => {
          inputRef.current?.blur();
          setAutoScroll(false);
        }}
      >
        {messages.map((message, i) => {
          const isUser = message.role === "user";
          const isContext = i < context.length;
          const showActions =
            i > 0 &&
            !(message.preview || message.content.length === 0) &&
            !isContext;
          const showTyping = message.preview || message.streaming;

          const shouldShowClearContextDivider = i === clearContextIndex - 1;

          return (
            <Fragment key={message.id}>
              <div
                className={
                  isUser ? styles["chat-message-user"] : styles["chat-message"]
                }
              >
                <div className={styles["chat-message-container"]}>
                  <div className={styles["chat-message-header"]}>
                    <div className={styles["chat-message-avatar"]}>
                      <div className={styles["chat-message-edit"]}>
                        <IconButton
                          icon={<EditIcon />}
                          onClick={async () => {
                            const newMessage = await showPrompt(
                              Locale.Chat.Actions.Edit,
                              message.content,
                              10,
                            );
                            chatStore.updateCurrentSession((session) => {
                              const m = session.mask.context
                                .concat(session.messages)
                                .find((m) => m.id === message.id);
                              if (m) {
                                m.content = newMessage;
                              }
                            });
                          }}
                        ></IconButton>
                      </div>
                      {isUser ? (
                        <Avatar avatar={config.avatar} />
                      ) : (
                        <>
                          {["system"].includes(message.role) ? (
                            <Avatar avatar="2699-fe0f" />
                          ) : (
                            <MaskAvatar
                              avatar={session.mask.avatar}
                              model={
                                message.model || session.mask.modelConfig.model
                              }
                            />
                          )}
                        </>
                      )}
                    </div>

                    {showActions && (
                      <div className={styles["chat-message-actions"]}>
                        <div className={styles["chat-input-actions"]}>
                          {message.streaming ? (
                            <ChatAction
                              text={Locale.Chat.Actions.Stop}
                              icon={<StopIcon />}
                              onClick={() => onUserStop(message.id ?? i)}
                            />
                          ) : (
                            <>
                              <ChatAction
                                text={Locale.Chat.Actions.Retry}
                                icon={<ResetIcon />}
                                onClick={() => onResend(message)}
                              />

                              <ChatAction
                                text={Locale.Chat.Actions.Delete}
                                icon={<DeleteIcon />}
                                onClick={() => onDelete(message.id ?? i)}
                              />

                              <ChatAction
                                text={Locale.Chat.Actions.Pin}
                                icon={<PinIcon />}
                                onClick={() => onPinMessage(message)}
                              />
                              <ChatAction
                                text={Locale.Chat.Actions.Copy}
                                icon={<CopyIcon />}
                                onClick={() => copyToClipboard(message.content)}
                              />
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {showTyping && (
                    <div className={styles["chat-message-status"]}>
                      {Locale.Chat.Typing}
                    </div>
                  )}
                  <div className={styles["chat-message-item"]}>
                    <Markdown
                      content={message.content}
                      loading={
                        (message.preview || message.streaming) &&
                        message.content.length === 0 &&
                        !isUser
                      }
                      onContextMenu={(e) => onRightClick(e, message)}
                      onDoubleClickCapture={() => {
                        if (!isMobileScreen) return;
                        setUserInput(message.content);
                      }}
                      fontSize={fontSize}
                      parentRef={scrollRef}
                      defaultShow={i >= messages.length - 6}
                    />
                  </div>
                  <div className={styles["chat-message-action-tag-container"]}>
                    {message.references?.map((ref, index) => (
                      <TagWithTooltip
                        key={index}
                        folder={session.folder?.id}
                        tagText={ref.referenceNumber}
                        tooltipText={ref.quote}
                      />
                    ))}
                    {message.images?.map((image, index) => (
                      <>
                        <img
                          key={index}
                          className={styles["chat-message-image"]}
                          src={image}
                        />
                        {message.model === "midjourney" &&
                          ("imagine" === message.action ||
                            "blend" === message.action) && (
                            <>
                              <div className={styles["button-line"]}>
                                <button
                                  className={styles["my-button"]}
                                  onClick={() => onInput(message.id + " U1")}
                                >
                                  U1
                                </button>
                                <button
                                  className={styles["my-button"]}
                                  onClick={() => onInput(message.id + " U2")}
                                >
                                  U2
                                </button>
                                <button
                                  className={styles["my-button"]}
                                  onClick={() => onInput(message.id + " U3")}
                                >
                                  U3
                                </button>
                                <button
                                  className={styles["my-button"]}
                                  onClick={() => onInput(message.id + " U4")}
                                >
                                  U4
                                </button>
                              </div>
                              <div className={styles["button-line"]}>
                                <button
                                  className={styles["my-button"]}
                                  onClick={() => onInput(message.id + " V1")}
                                >
                                  V1
                                </button>
                                <button
                                  className={styles["my-button"]}
                                  onClick={() => onInput(message.id + " V2")}
                                >
                                  V2
                                </button>
                                <button
                                  className={styles["my-button"]}
                                  onClick={() => onInput(message.id + " V3")}
                                >
                                  V3
                                </button>
                                <button
                                  className={styles["my-button"]}
                                  onClick={() => onInput(message.id + " V4")}
                                >
                                  V4
                                </button>
                              </div>
                            </>
                          )}
                      </>
                    ))}
                  </div>
                  <div className={styles["chat-message-action-date"]}>
                    {isContext
                      ? Locale.Chat.IsContext
                      : message.date.toLocaleString() + `(${message.model})`}
                  </div>
                </div>
              </div>
              {shouldShowClearContextDivider && <ClearContextDivider />}
            </Fragment>
          );
        })}
      </div>
      <div className={styles["chat-input-panel"]}>
        <PromptHints prompts={promptHints} onPromptSelect={onPromptSelect} />
        <ChatActions
          display={session?.folder?.id === ""}
          folder={session?.folder}
          showPromptModal={() => setShowPromptModal(true)}
          scrollToBottom={scrollToBottom}
          hitBottom={hitBottom}
          showPromptHints={() => {
            // Click again to close
            if (promptHints.length > 0) {
              setPromptHints([]);
              return;
            }

            inputRef.current?.focus();
            setUserInput("/");
            onSearch("");
          }}
          imageSelected={(img: any) => {
            if (useImages.length >= 5) {
              alert(Locale.Midjourney.SelectImgMax(5));
              return;
            }
            setUseImages([...useImages, img]);
          }}
        />
        {useImages.length > 0 && (
          <div className={styles["chat-select-images"]}>
            {useImages.map((img: any, i) => (
              <img
                src={img.base64}
                key={i}
                onClick={() => {
                  setUseImages(useImages.filter((_, ii) => ii != i));
                }}
                title={img.filename}
                alt={img.filename}
              />
            ))}
          </div>
        )}
        <div className={styles["chat-input-panel-inner"]}>
          <textarea
            ref={inputRef}
            className={styles["chat-input"]}
            placeholder={
              useImages.length > 0 && mjImageMode != "IMAGINE"
                ? Locale.Midjourney.InputDisabled
                : Locale.Chat.Input(submitKey)
            }
            onInput={(e) => onInput(e.currentTarget.value)}
            value={userInput}
            onKeyDown={onInputKeyDown}
            onFocus={scrollToBottom}
            onClick={scrollToBottom}
            rows={inputRows}
            autoFocus={autoFocus}
            style={{
              fontSize: config.fontSize,
            }}
            disabled={useImages.length > 0 && mjImageMode != "IMAGINE"}
          />
          <IconButton
            icon={<SendWhiteIcon />}
            text={Locale.Chat.Send}
            className={styles["chat-input-send"]}
            type="primary"
            onClick={() => doSubmit(userInput)}
          />
        </div>
      </div>

      {showExport && (
        <ExportMessageModal onClose={() => setShowExport(false)} />
      )}

      {isEditingMessage && (
        <EditMessageModal
          onClose={() => {
            setIsEditingMessage(false);
          }}
        />
      )}
    </div>
  );
}

export function Chat() {
  const chatStore = useChatStore();
  const sessionIndex = chatStore.currentSessionIndex;
  return <_Chat key={sessionIndex}></_Chat>;
}
