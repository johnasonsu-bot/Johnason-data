import { useEffect } from "react";
import { isReadOnlyUser } from "../app/accessControl";
import { useAuth } from "../app/providers/AuthProvider";

const MUTATING_TEXT_PATTERN = /新建|新增|创建|添加|保存|编辑|修改|删除|移除|清空|上传|导入|发布|下线|启用|停用|启动|停止|重启|运行|执行|重跑|重试|同步|取消同步|重建|刷新画像|AI 分析|智能分析|恢复|回滚|授权|绑定|解绑|设为默认|生成|确认逻辑模型|部署|复制/;

function getActionText(element: Element) {
  return [
    element.textContent || "",
    element.getAttribute("title") || "",
    element.getAttribute("aria-label") || "",
  ].join(" ").replace(/\s+/g, " ").trim();
}

function markElement(element: HTMLElement) {
  if (!element.dataset.readonlyGuard) {
    element.dataset.readonlyGuard = "1";
    element.dataset.readonlyPrevDisabled = element instanceof HTMLButtonElement || element instanceof HTMLInputElement
      ? String(element.disabled)
      : "false";
    element.dataset.readonlyPrevPointerEvents = element.style.pointerEvents || "";
  }

  if (element instanceof HTMLButtonElement || element instanceof HTMLInputElement) {
    element.disabled = true;
  }

  element.setAttribute("aria-disabled", "true");
  element.classList.add("readonly-action-disabled");
  element.style.pointerEvents = "none";
}

function restoreElements() {
  document.querySelectorAll<HTMLElement>("[data-readonly-guard='1']").forEach((element) => {
    if ((element instanceof HTMLButtonElement || element instanceof HTMLInputElement) && element.dataset.readonlyPrevDisabled === "false") {
      element.disabled = false;
    }
    element.removeAttribute("aria-disabled");
    element.classList.remove("readonly-action-disabled");
    element.style.pointerEvents = element.dataset.readonlyPrevPointerEvents || "";
    delete element.dataset.readonlyGuard;
    delete element.dataset.readonlyPrevDisabled;
    delete element.dataset.readonlyPrevPointerEvents;
  });
}

function applyReadOnlyGuard() {
  const targets = document.querySelectorAll<HTMLElement>(
    "button, .ant-btn, [role='menuitem'], .ant-dropdown-menu-item, .ant-upload, input[type='file']"
  );

  targets.forEach((element) => {
    const text = getActionText(element);
    if (!text && !(element instanceof HTMLInputElement && element.type === "file")) {
      return;
    }
    if (element.closest(".app-header__logout")) {
      return;
    }
    if (element.closest("[data-readonly-allow-action='true']")) {
      return;
    }
    if (MUTATING_TEXT_PATTERN.test(text) || (element instanceof HTMLInputElement && element.type === "file")) {
      markElement(element);
    }
  });
}

export function ReadOnlyModeGuard() {
  const { user } = useAuth();
  const readOnly = isReadOnlyUser(user);

  useEffect(() => {
    if (!readOnly) {
      restoreElements();
      return undefined;
    }

    let timer = 0;
    const scheduleApply = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(applyReadOnlyGuard, 60);
    };

    applyReadOnlyGuard();
    const observer = new MutationObserver(scheduleApply);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      restoreElements();
    };
  }, [readOnly]);

  return null;
}
