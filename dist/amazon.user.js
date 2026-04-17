// ==UserScript==
// @name         Amazon 编辑助手（含顶部广告移除）
// @namespace    http://tampermonkey.net/
// @version      26.417.1729
// @author       rirh
// @description  Inline editing helper for Amazon pages with selector-based persistence, image uploads, and top banner ad removal.
// @downloadURL  https://cdn.jsdelivr.net/gh/income-chenguanghua/amazon.user.script/dist/amazon.user.js
// @updateURL    https://cdn.jsdelivr.net/gh/income-chenguanghua/amazon.user.script/dist/amazon.meta.js
// @include      *://amazon.*/*
// @include      *://*.amazon.*/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  var _GM_addStyle = (() => typeof GM_addStyle != "undefined" ? GM_addStyle : void 0)();
  var _GM_getValue = (() => typeof GM_getValue != "undefined" ? GM_getValue : void 0)();
  var _GM_setValue = (() => typeof GM_setValue != "undefined" ? GM_setValue : void 0)();
  var _unsafeWindow = (() => typeof unsafeWindow != "undefined" ? unsafeWindow : void 0)();
  const DEBUG_STORAGE_KEY = "tmInlineDebug";
  function getLocalStorage() {
    try {
      return window.localStorage;
    } catch (error) {
      return null;
    }
  }
  function isDebugEnabled() {
    const storage = getLocalStorage();
    return Boolean(storage && storage.getItem(DEBUG_STORAGE_KEY) === "1");
  }
  function setDebugEnabled(enabled) {
    const storage = getLocalStorage();
    if (!storage) return false;
    if (enabled) {
      storage.setItem(DEBUG_STORAGE_KEY, "1");
    } else {
      storage.removeItem(DEBUG_STORAGE_KEY);
    }
    return true;
  }
  function summarizeElement(element) {
    if (!(element instanceof Element)) {
      return String(element);
    }
    const tagName = element.tagName.toLowerCase();
    const id = element.id ? `#${element.id}` : "";
    const className = element.classList && element.classList.length > 0 ? `.${Array.from(element.classList).slice(0, 3).join(".")}` : "";
    const dataComponent = element.getAttribute("data-component");
    const dataPart = dataComponent ? `[data-component="${dataComponent}"]` : "";
    return `${tagName}${id}${className}${dataPart}`;
  }
  function summarizeNode(node) {
    if (node instanceof Element) {
      return summarizeElement(node);
    }
    if (node instanceof Text) {
      return `#text("${String(node.textContent || "").trim().slice(0, 40)}")`;
    }
    return String(node && node.nodeName ? node.nodeName : node);
  }
  function formatValue(value) {
    if (Array.isArray(value)) {
      return value.map((item) => formatValue(item));
    }
    if (typeof value !== "string") {
      return value;
    }
    return value.length > 160 ? `${value.slice(0, 160)}...` : value;
  }
  function summarizeMutations(mutations, limit = 5) {
    if (!Array.isArray(mutations)) {
      return null;
    }
    return mutations.slice(0, limit).map((mutation) => ({
      type: mutation.type,
      target: summarizeNode(mutation.target),
      added: Array.from(mutation.addedNodes || []).slice(0, 3).map((node) => summarizeNode(node)),
      removed: Array.from(mutation.removedNodes || []).slice(0, 3).map((node) => summarizeNode(node))
    }));
  }
  function logDebug(event, details = {}) {
    if (!isDebugEnabled()) return;
    const titleParts = [`[tm-inline][${event}]`];
    if (details.writer) {
      titleParts.push(details.writer);
    }
    if (details.field) {
      titleParts.push(`field=${details.field}`);
    }
    console.groupCollapsed(titleParts.join(" "));
    if (details.reason) {
      console.log("reason:", details.reason);
    }
    if (details.element) {
      console.log("element:", summarizeElement(details.element), details.element);
    }
    if (details.current !== void 0 || details.next !== void 0) {
      console.log("value:", {
        current: formatValue(details.current),
        next: formatValue(details.next)
      });
    }
    if (details.summary) {
      console.log("summary:", details.summary);
    }
    if (details.data) {
      console.log("data:", details.data);
    }
    if (details.trace) {
      console.trace("stack");
    }
    console.groupEnd();
  }
  function normalizeTextContent(value) {
    let text = String(value || "");
    try {
      text = text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
    } catch (error) {
    }
    return text.replace(/[\s\u00a0]+/g, " ").replace(/[：:]/g, "").trim().toLowerCase();
  }
  function getConfigSelectorList(config) {
    if (!config) return [];
    if (Array.isArray(config.selector)) {
      return config.selector.filter((item) => typeof item === "string" && item.trim());
    }
    return typeof config.selector === "string" && config.selector.trim() ? [config.selector] : [];
  }
  function getConfigWatchSelectorList(config) {
    if (!config) return [];
    if (Array.isArray(config.watchSelectors)) {
      return config.watchSelectors.filter((item) => typeof item === "string" && item.trim());
    }
    if (typeof config.watchSelector === "string" && config.watchSelector.trim()) {
      return [config.watchSelector];
    }
    return getConfigSelectorList(config);
  }
  function normalizeResolvedElements(elements) {
    if (!elements) return [];
    const list = Array.isArray(elements) ? elements : [elements];
    const result = [];
    const seen = new Set();
    list.forEach((element) => {
      if (!(element instanceof HTMLElement) || seen.has(element)) return;
      seen.add(element);
      result.push(element);
    });
    return result;
  }
  function cloneFieldConfig(config) {
    if (!config || typeof config !== "object") return config;
    return {
      ...config,
      selector: Array.isArray(config.selector) ? [...config.selector] : config.selector,
      watchSelectors: Array.isArray(config.watchSelectors) ? [...config.watchSelectors] : config.watchSelectors
    };
  }
  function findElementsBySelector(selector) {
    if (!selector) return [];
    const uniqueElements = new Set();
    try {
      document.querySelectorAll(selector).forEach((element) => {
        if (element instanceof HTMLElement) {
          uniqueElements.add(element);
        }
      });
    } catch (error) {
      console.warn("CSS 选择器解析失败:", selector, error);
    }
    return Array.from(uniqueElements.values());
  }
  function collectElementsFromSelectors(selectors) {
    const selectorList = Array.isArray(selectors) ? selectors : [selectors];
    const results = [];
    const seen = new Set();
    selectorList.filter(Boolean).forEach((selector) => {
      findElementsBySelector(selector).forEach((element) => {
        if (!element || seen.has(element)) return;
        seen.add(element);
        results.push(element);
      });
    });
    return results;
  }
  function collectElementsFromConfig(config) {
    if (!config) return [];
    const results = [];
    const seen = new Set();
    collectElementsFromSelectors(getConfigSelectorList(config)).forEach((element) => {
      if (!element || seen.has(element)) return;
      seen.add(element);
      results.push(element);
    });
    if (typeof config.resolveElements === "function") {
      try {
        normalizeResolvedElements(config.resolveElements()).forEach((element) => {
          if (!element || seen.has(element)) return;
          seen.add(element);
          results.push(element);
        });
      } catch (error) {
        console.warn("解析动态元素失败:", config.keySuffix || config.name || config.selector, error);
      }
    }
    return results;
  }
  function cleanupInlineEditingArtifacts(node) {
    if (!(node instanceof Element)) return;
    if (node.classList.contains("tm-inline-image-replace-trigger") || node.classList.contains("tm-inline-text-dialog-trigger")) {
      node.remove();
      return;
    }
    node.classList.remove("tm-inline-editing");
    node.removeAttribute("data-tm-inline-editing");
    node.removeAttribute("data-tm-inline-dialog-edit");
    node.removeAttribute("contenteditable");
  }
  function getSanitizedElementClone(element) {
    if (!(element instanceof Element)) return null;
    const clone = element.cloneNode(true);
    if (!(clone instanceof Element)) return null;
    cleanupInlineEditingArtifacts(clone);
    clone.querySelectorAll("*").forEach((node) => cleanupInlineEditingArtifacts(node));
    return clone;
  }
  function sanitizeInlineEditingHtml(html) {
    if (typeof html !== "string" || !html) return html;
    const template = document.createElement("template");
    template.innerHTML = html;
    template.content.childNodes.forEach((node) => {
      if (node instanceof Element) {
        cleanupInlineEditingArtifacts(node);
        node.querySelectorAll("*").forEach((child) => cleanupInlineEditingArtifacts(child));
      }
    });
    return template.innerHTML;
  }
  function extractElementValue(element, config) {
    if (!element) return "";
    if (config && typeof config.getValue === "function") {
      try {
        const customValue = config.getValue(element);
        if (customValue !== void 0) {
          return customValue;
        }
      } catch (error) {
        console.warn("自定义字段取值失败:", config.keySuffix || config.name || element, error);
      }
    }
    if (element instanceof HTMLImageElement) {
      return element.src || "";
    }
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
      return element.value;
    }
    if (element.childElementCount > 0) {
      const sanitizedClone = getSanitizedElementClone(element);
      return sanitizedClone ? sanitizedClone.innerHTML.trim() : element.innerHTML.trim();
    }
    return (element.textContent || "").trim();
  }
  function applyElementValue(element, value, config) {
    if (!element || value === void 0 || value === null) return;
    const expected = typeof value === "string" ? value : String(value);
    const fieldName = config && (config.keySuffix || config.name);
    if (config && typeof config.setValue === "function") {
      try {
        const currentValue = extractElementValue(element, config);
        config.setValue(element, expected);
        const nextValue = extractElementValue(element, config);
        if (!isEqualValue(currentValue, nextValue)) {
          logDebug("dom-write", {
            writer: "custom-setValue",
            field: fieldName,
            element,
            current: currentValue,
            next: nextValue,
            trace: true
          });
        }
        return;
      } catch (error) {
        console.warn("自定义字段写值失败:", config.keySuffix || config.name || element, error);
      }
    }
    if (config && config.type === "image" || element instanceof HTMLImageElement) {
      if (!(element instanceof HTMLImageElement)) return;
      applyImageSource(element, expected, fieldName);
      return;
    }
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
      if (element.value !== expected) {
        const currentValue = element.value;
        element.value = expected;
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
        logDebug("dom-write", {
          writer: "input-value",
          field: fieldName,
          element,
          current: currentValue,
          next: expected,
          trace: true
        });
      }
      return;
    }
    const hasHtml = /<[^>]+>/.test(expected);
    if (hasHtml) {
      const sanitizedExpected = sanitizeInlineEditingHtml(expected).trim();
      const sanitizedClone = getSanitizedElementClone(element);
      const currentHtml = sanitizedClone ? sanitizedClone.innerHTML.trim() : element.innerHTML.trim();
      if (currentHtml !== sanitizedExpected) {
        element.innerHTML = sanitizedExpected;
        logDebug("dom-write", {
          writer: "innerHTML",
          field: fieldName,
          element,
          current: currentHtml,
          next: sanitizedExpected,
          trace: true
        });
      }
    } else if ((element.textContent || "").trim() !== expected.trim()) {
      const currentText = (element.textContent || "").trim();
      element.textContent = expected;
      logDebug("dom-write", {
        writer: "textContent",
        field: fieldName,
        element,
        current: currentText,
        next: expected,
        trace: true
      });
    }
  }
  function isElementLikelyVisible(element) {
    if (!(element instanceof HTMLElement)) return false;
    if (!element.isConnected) return false;
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 0 || rect.height > 0;
  }
  function pickPreferredValueElement(elements) {
    if (!Array.isArray(elements) || elements.length === 0) return null;
    const visibleElement = elements.find((element) => isElementLikelyVisible(element));
    return visibleElement || elements[0] || null;
  }
  function getEditedElementWithChangedValue(elements, editedElements, config) {
    if (!Array.isArray(elements) || elements.length === 0 || !(editedElements instanceof Map)) {
      return null;
    }
    for (const element of elements) {
      const state = editedElements.get(element);
      if (!state || !Object.prototype.hasOwnProperty.call(state, "originalValue")) {
        continue;
      }
      const currentValue = extractElementValue(element, config);
      if (!isEqualValue(state.originalValue, currentValue)) {
        return element;
      }
    }
    return null;
  }
  function isEqualValue(currentValue, nextValue) {
    if (Array.isArray(currentValue) && Array.isArray(nextValue)) {
      if (currentValue.length !== nextValue.length) return false;
      for (let i = 0; i < currentValue.length; i += 1) {
        if (currentValue[i] !== nextValue[i]) return false;
      }
      return true;
    }
    return currentValue === nextValue;
  }
  function isThumbnailLikeImage(element) {
    if (!(element instanceof HTMLImageElement)) return false;
    return Boolean(element.closest("#altImages, li.imageThumbnail, #ivThumbs, #ivThumbs360, #ivThumbsDimensions"));
  }
  function isSameDocumentAnchorHref(href) {
    const rawHref = typeof href === "string" ? href.trim() : "";
    if (!rawHref) return true;
    const loweredHref = rawHref.toLowerCase();
    if (loweredHref === "#" || loweredHref.startsWith("#") || loweredHref.startsWith("javascript:")) {
      return true;
    }
    try {
      const targetUrl = new URL(rawHref, window.location.href);
      const currentUrl = new URL(window.location.href);
      return Boolean(targetUrl.hash) && targetUrl.origin === currentUrl.origin && targetUrl.pathname === currentUrl.pathname && targetUrl.search === currentUrl.search;
    } catch (error) {
      return false;
    }
  }
  function shouldAllowAnchorInteraction(anchor) {
    if (!(anchor instanceof HTMLAnchorElement)) return false;
    if (anchor.getAttribute("role") === "button") return true;
    if (anchor.hasAttribute("aria-controls")) return true;
    if (anchor.hasAttribute("data-action")) return true;
    if (anchor.hasAttribute("data-a-expander-toggle")) return true;
    if (anchor.closest(".a-expander-container, .a-declarative")) return true;
    return isSameDocumentAnchorHref(anchor.getAttribute("href"));
  }
  function parseCssSize(value) {
    const parsed = Number.parseFloat(value || "");
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }
  function clamp(value, min, max) {
    const n = Number.isFinite(value) ? value : min;
    return Math.min(max, Math.max(min, n));
  }
  function getStableImageSize(element) {
    if (!(element instanceof HTMLImageElement)) {
      return { width: 40, height: 40 };
    }
    if (isThumbnailLikeImage(element)) {
      const altColumn = element.closest("#altImages");
      if (altColumn instanceof HTMLElement) {
        const altWidth = Math.round(altColumn.getBoundingClientRect().width);
        if (altWidth > 0) {
          const size = clamp(altWidth, 24, 72);
          return { width: size, height: size };
        }
      }
      const thumbHost = element.closest("li.imageThumbnail, .ivThumb, .a-button-thumbnail");
      if (thumbHost instanceof HTMLElement) {
        const hostRect = thumbHost.getBoundingClientRect();
        const hostWidth = Math.round(hostRect.width);
        const hostHeight = Math.round(hostRect.height);
        if (hostWidth > 0 || hostHeight > 0) {
          const size = clamp(Math.max(hostWidth, hostHeight), 24, 72);
          return { width: size, height: size };
        }
      }
    }
    const rect = element.getBoundingClientRect();
    let width = Math.round(rect.width);
    let height = Math.round(rect.height);
    if ((!width || !height) && element.parentElement instanceof HTMLElement) {
      const parentRect = element.parentElement.getBoundingClientRect();
      if (!width) {
        width = Math.round(parentRect.width);
      }
      if (!height) {
        height = Math.round(parentRect.height);
      }
    }
    if (!width || !height) {
      const computed = window.getComputedStyle(element);
      if (!width) {
        width = Math.round(parseCssSize(computed.width));
      }
      if (!height) {
        height = Math.round(parseCssSize(computed.height));
      }
    }
    if (!width) width = 40;
    if (!height) height = 40;
    if (isThumbnailLikeImage(element)) {
      width = clamp(width, 24, 72);
      height = clamp(height, 24, 72);
    }
    return { width, height };
  }
  function applyImageDisplayConstraints(element) {
    if (!(element instanceof HTMLImageElement)) return;
    if (isThumbnailLikeImage(element)) {
      const { width, height } = getStableImageSize(element);
      element.style.setProperty("--tm-thumb-w", `${width}px`);
      element.style.setProperty("--tm-thumb-h", `${height}px`);
      element.style.width = `${width}px`;
      element.style.height = `${height}px`;
      element.style.maxWidth = `${width}px`;
      element.style.maxHeight = `${height}px`;
      element.style.minWidth = `${width}px`;
      element.style.minHeight = `${height}px`;
      element.style.objectFit = "cover";
      element.style.objectPosition = "center center";
      element.classList.add("tm-inline-thumb-fixed-image");
      return;
    }
    if (element.closest && element.closest("#mediaBlock_feature_div")) {
      if (!element.style.objectFit) {
        element.style.objectFit = "contain";
      }
      if (!element.style.objectPosition) {
        element.style.objectPosition = "center center";
      }
      element.classList.add("tm-inline-main-fixed-image");
    }
  }
  function applyImageSource(element, expected, fieldName = "image") {
    if (!(element instanceof HTMLImageElement)) return;
    const sameSource = element.src === expected;
    const alreadyApplied = element.dataset && element.dataset.tmInlineAppliedSrc === expected;
    if (!sameSource) {
      const currentSource = element.src;
      element.src = expected;
      logDebug("dom-write", {
        writer: "image-src",
        field: fieldName,
        element,
        current: currentSource,
        next: expected,
        trace: true
      });
    }
    if (!alreadyApplied) {
      element.removeAttribute("srcset");
      element.removeAttribute("sizes");
      if (element.dataset && Object.prototype.hasOwnProperty.call(element.dataset, "oldHires")) {
        element.dataset.oldHires = expected;
      }
      if (element.dataset) {
        element.dataset.tmInlineAppliedSrc = expected;
      }
    }
    if (!alreadyApplied && !element.classList.contains("tm-inline-thumb-fixed-image") && !element.classList.contains("tm-inline-main-fixed-image")) {
      applyImageDisplayConstraints(element);
    }
  }
  function buildStorageKey(pageKey, config) {
    if (!config) return null;
    const suffixSource = config.keySuffix || (Array.isArray(config.selector) ? config.selector[0] : config.selector);
    const suffix = typeof suffixSource === "string" ? suffixSource.trim() : "";
    if (!suffix) return null;
    return `${pageKey}__${suffix}`;
  }
  function buildStorageKeyFromSuffix(pageKey, keySuffix) {
    const suffix = typeof keySuffix === "string" ? keySuffix.trim() : "";
    return suffix ? `${pageKey}__${suffix}` : null;
  }
  function getDocumentTitleStorageKey(manager) {
    return buildStorageKeyFromSuffix(manager.pageKey, "document_title");
  }
  function getStoredDocumentTitle(manager) {
    const storageKey = getDocumentTitleStorageKey(manager);
    if (!storageKey) return "";
    const storedTitle = manager.valueMap[storageKey];
    return typeof storedTitle === "string" ? storedTitle.trim() : "";
  }
  function applyDocumentTitle(manager, title) {
    const nextTitle = typeof title === "string" && title.trim() ? title.trim() : manager.originalDocumentTitle;
    if (!nextTitle) return;
    document.title = nextTitle;
    const titleElement = document.querySelector("title");
    if (titleElement && titleElement.textContent !== nextTitle) {
      titleElement.textContent = nextTitle;
    }
  }
  function applyStoredDocumentTitle(manager) {
    const storedTitle = getStoredDocumentTitle(manager);
    if (storedTitle) {
      applyDocumentTitle(manager, storedTitle);
    }
  }
  function handleTitleEdit(manager) {
    manager.setPanelOpen(false);
    const storageKey = getDocumentTitleStorageKey(manager);
    if (!storageKey) {
      manager.notification.show("标题保存键生成失败。", "error");
      return;
    }
    const currentTitle = getStoredDocumentTitle(manager) || document.title || manager.originalDocumentTitle;
    const input = window.prompt(
      "请输入新的页面标题。\n留空并确认可恢复默认标题。",
      currentTitle
    );
    if (input === null) return;
    const nextTitle = input.trim();
    if (nextTitle) {
      const previousTitle2 = manager.valueMap[storageKey];
      manager.valueMap[storageKey] = nextTitle;
      const saved2 = manager.storage.saveValueMap(manager.valueMap);
      if (saved2) {
        applyDocumentTitle(manager, nextTitle);
        manager.notification.show("页面标题已更新。", "success");
        return;
      }
      if (previousTitle2 === void 0) {
        delete manager.valueMap[storageKey];
      } else {
        manager.valueMap[storageKey] = previousTitle2;
      }
      manager.notification.show("标题保存失败，请查看控制台。", "error");
      return;
    }
    const hadCustomTitle = Object.prototype.hasOwnProperty.call(manager.valueMap, storageKey);
    const previousTitle = manager.valueMap[storageKey];
    delete manager.valueMap[storageKey];
    const saved = hadCustomTitle ? manager.storage.saveValueMap(manager.valueMap) : true;
    if (saved) {
      applyDocumentTitle(manager, manager.originalDocumentTitle);
      manager.notification.show(
        hadCustomTitle ? "已恢复默认标题。" : "当前没有自定义标题。",
        hadCustomTitle ? "success" : "info"
      );
      return;
    }
    if (previousTitle !== void 0) {
      manager.valueMap[storageKey] = previousTitle;
    }
    manager.notification.show("标题恢复失败，请查看控制台。", "error");
  }
  const TOOLBAR_ICONS = {
    pencil: `
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11.7 2.8a1.77 1.77 0 0 1 2.5 2.5L6 13.5l-3.5.5.5-3.5 8.2-8.2Z"></path>
            <path d="M10.3 4.2 11.8 5.7"></path>
        </svg>
    `,
    check: `
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round">
            <path d="m3.75 8.5 2.5 2.5 6-6"></path>
        </svg>
    `,
    heading: `
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 3.25v9.5"></path>
            <path d="M12 3.25v9.5"></path>
            <path d="M4 8h8"></path>
        </svg>
    `,
    eye: `
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1.75 8s2.2-3.5 6.25-3.5S14.25 8 14.25 8s-2.2 3.5-6.25 3.5S1.75 8 1.75 8Z"></path>
            <circle cx="8" cy="8" r="1.5"></circle>
        </svg>
    `,
    eyeClosed: `
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2.2 5.2C3.3 4.1 5.1 3.3 8 3.3c4.05 0 6.25 3.5 6.25 3.5a9.7 9.7 0 0 1-1.55 1.86"></path>
            <path d="M6.2 6.3A2.1 2.1 0 0 1 9.7 9.8"></path>
            <path d="M13.8 13.8 2.2 2.2"></path>
            <path d="M1.75 8s1.02 1.62 2.94 2.7"></path>
            <path d="M8 12.5c1.25 0 2.35-.34 3.3-.84"></path>
        </svg>
    `,
    trash: `
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3.75 4.25h8.5"></path>
            <path d="M6 2.75h4"></path>
            <path d="m4.75 4.25.55 8h5.4l.55-8"></path>
            <path d="M6.5 6.25v4.25"></path>
            <path d="M9.5 6.25v4.25"></path>
        </svg>
    `,
    x: `
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
            <path d="m4.25 4.25 7.5 7.5"></path>
            <path d="m11.75 4.25-7.5 7.5"></path>
        </svg>
    `
  };
  function renderToolbarButton({ id, className, title, label, icon, activeIcon = "" }) {
    const iconMarkup = activeIcon ? `
            <span class="tm-inline-btn-icon tm-inline-btn-icon-default" aria-hidden="true">${TOOLBAR_ICONS[icon]}</span>
            <span class="tm-inline-btn-icon tm-inline-btn-icon-alt" aria-hidden="true">${TOOLBAR_ICONS[activeIcon]}</span>
        ` : `<span class="tm-inline-btn-icon" aria-hidden="true">${TOOLBAR_ICONS[icon]}</span>`;
    return `
        <button type="button" id="${id}" class="tm-inline-btn ${className}" title="${title}">
            ${iconMarkup}
            <span class="tm-inline-btn-label">${label}</span>
        </button>
    `;
  }
  function createEditorUI(manager) {
    manager.container = document.createElement("div");
    manager.container.id = "tm-inline-editor";
    manager.container.innerHTML = `
        <div id="tm-inline-toolbar-panel" class="tm-inline-toolbar-panel">
            <div class="tm-inline-toolbar-group tm-inline-toolbar-group-main">
                ${renderToolbarButton({
    id: "tm-edit-toggle",
    className: "tm-inline-btn-primary",
    title: "进入编辑模式",
    label: "编辑",
    icon: "pencil",
    activeIcon: "check"
  })}
            </div>
            <div class="tm-inline-toolbar-group tm-inline-toolbar-group-actions">
                ${renderToolbarButton({
    id: "tm-edit-title",
    className: "tm-inline-btn-ghost",
    title: "弹窗修改网站标题",
    label: "标题",
    icon: "heading"
  })}
                ${renderToolbarButton({
    id: "tm-edit-toggle-refund",
    className: "tm-inline-btn-ghost",
    title: "显示或隐藏退款总计行",
    label: "退款",
    icon: "eye",
    activeIcon: "eyeClosed"
  })}
                ${renderToolbarButton({
    id: "tm-edit-reset",
    className: "tm-inline-btn-warning",
    title: "删除所有保存的值并刷新页面",
    label: "重置",
    icon: "trash"
  })}
                ${renderToolbarButton({
    id: "tm-edit-hide",
    className: "tm-inline-btn-ghost",
    title: "隐藏编辑按钮",
    label: "隐藏",
    icon: "x"
  })}
            </div>
        </div>
    `;
    document.body.appendChild(manager.container);
    manager.toggleBtn = manager.container.querySelector("#tm-edit-toggle");
    manager.titleEditBtn = manager.container.querySelector("#tm-edit-title");
    manager.refundToggleBtn = manager.container.querySelector("#tm-edit-toggle-refund");
    manager.resetBtn = manager.container.querySelector("#tm-edit-reset");
    manager.hideBtn = manager.container.querySelector("#tm-edit-hide");
    manager.toolbarTriggerBtn = null;
  }
  function attachPanelEvents(manager) {
    if (manager.toggleBtn) {
      manager.toggleBtn.addEventListener("click", () => manager.handleEditButtonClick());
    }
    if (manager.titleEditBtn) {
      manager.titleEditBtn.addEventListener("click", () => manager.handleTitleEdit());
    }
    if (manager.resetBtn) {
      manager.resetBtn.addEventListener("click", () => manager.handleReset());
    }
    if (manager.refundToggleBtn) {
      manager.refundToggleBtn.addEventListener("click", () => manager.toggleRefundRowVisibility());
    }
    if (manager.hideBtn) {
      manager.hideBtn.addEventListener("click", () => manager.hideButton());
    }
  }
  function setPanelOpen(manager, nextOpen) {
    manager.panelOpen = Boolean(nextOpen);
    if (manager.container) {
      manager.container.classList.toggle("tm-inline-panel-open", manager.panelOpen);
    }
    if (manager.toolbarTriggerBtn) {
      manager.toolbarTriggerBtn.setAttribute("aria-expanded", manager.panelOpen ? "true" : "false");
    }
  }
  function togglePanelOpen(manager, force) {
    const nextOpen = typeof force === "boolean" ? force : !manager.panelOpen;
    setPanelOpen(manager, nextOpen);
  }
  function handleOutsideClick(manager, event) {
    if (!manager.panelOpen) return;
    const target = event.target;
    if (target instanceof Node && manager.container && manager.container.contains(target)) {
      return;
    }
    setPanelOpen(manager, false);
  }
  function setupDynamicStyles(manager) {
    const rules = [];
    manager.fieldConfigs.forEach((config) => {
      if (config.hideInView) {
        const selectors = manager.getWatchSelectorsFromConfig(config);
        selectors.forEach((selector) => {
          rules.push(`body:not(.tm-editing-mode) ${selector} { display: none !important; }`);
        });
      }
    });
    if (rules.length > 0) {
      _GM_addStyle(rules.join("\n"));
    }
  }
  function setupImageInput(manager) {
    if (manager.imageInput) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.style.display = "none";
    input.addEventListener("change", async () => {
      const file = input.files && input.files[0];
      if (!file || !manager.activeImageElement) {
        manager.activeImageElement = null;
        input.value = "";
        return;
      }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        if (typeof dataUrl !== "string") {
          throw new Error("无效图片数据");
        }
        applyImageSource(manager.activeImageElement, dataUrl, "image-upload");
        manager.notification.show("图片已更新，点击“完成”保存。", "success");
      } catch (error) {
        console.error("读取图片失败:", error);
        manager.notification.show("图片读取失败，请重试。", "error");
      } finally {
        manager.activeImageElement = null;
        input.value = "";
      }
    });
    document.body.appendChild(input);
    manager.imageInput = input;
  }
  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error("读取失败"));
      reader.readAsDataURL(file);
    });
  }
  function findImageTriggerHost(element) {
    if (!(element instanceof HTMLElement)) return null;
    const host = element.closest('#imgTagWrapperId, .imgTagWrapper, li.imageThumbnail, [data-component="itemImage"], .a-button-text, .a-list-item');
    if (host instanceof HTMLElement) {
      return host;
    }
    return element.parentElement instanceof HTMLElement ? element.parentElement : null;
  }
  function findDialogTriggerHost(element) {
    if (!(element instanceof HTMLElement)) return null;
    const anchor = element.closest("a");
    if (anchor instanceof HTMLAnchorElement && anchor.parentElement) {
      return anchor;
    }
    return element;
  }
  function applyDialogValueToElement(element, value, config) {
    applyElementValue(element, value, config);
  }
  function makeEditable(manager, element, config) {
    if (!element || manager.editedElements.has(element)) return;
    const isImageElement = element instanceof HTMLImageElement;
    const isImage = config && config.type === "image" && isImageElement || isImageElement;
    const usesDialogTrigger = !isImage && Boolean(config && config.editMode === "dialog");
    const isInput = !isImage && !usesDialogTrigger && (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement);
    const noHighlight = Boolean(config && config.noHighlight);
    const state = {
      element,
      isImage,
      isInput,
      usesDialogTrigger,
      noHighlight,
      originalValue: extractElementValue(element, config),
      disabled: isInput ? element.disabled : void 0,
      readOnly: isInput ? element.readOnly : void 0,
      originalReadonlyAttr: isInput ? element.getAttribute("readonly") : null,
      originalDisabledAttr: isInput ? element.getAttribute("disabled") : null,
      contentEditable: isInput ? null : element.getAttribute("contenteditable"),
      originalCursor: isImage ? element.style.cursor : void 0,
      originalTitle: isImage ? element.getAttribute("title") : null,
      imageTrigger: null,
      imageTriggerHost: null,
      imageTriggerHostPosition: null,
      imageTriggerHostPositionAdjusted: false,
      imageTriggerClickHandler: null,
      imageTriggerKeyHandler: null,
      dialogTrigger: null,
      dialogTriggerHost: null,
      dialogTriggerClickHandler: null
    };
    if (isImage) {
      const openReplaceDialog = (event) => {
        if (event) {
          event.preventDefault();
          event.stopPropagation();
          if (typeof event.stopImmediatePropagation === "function") {
            event.stopImmediatePropagation();
          }
        }
        if (!manager.imageInput) return;
        manager.activeImageElement = element;
        manager.imageInput.value = "";
        manager.imageInput.click();
      };
      const keyHandler = (event) => {
        if (!event) return;
        if (event.key === "Enter" || event.key === " ") {
          openReplaceDialog(event);
        }
      };
      const host = findImageTriggerHost(element);
      if (host) {
        const trigger = document.createElement("span");
        trigger.className = "tm-inline-image-replace-trigger";
        trigger.textContent = "换";
        trigger.setAttribute("role", "button");
        trigger.setAttribute("tabindex", "0");
        trigger.setAttribute("aria-label", "替换图片");
        const computed = window.getComputedStyle(host).position;
        state.imageTriggerHostPosition = host.style.position;
        if (!computed || computed === "static") {
          host.style.position = "relative";
          state.imageTriggerHostPositionAdjusted = true;
        }
        trigger.addEventListener("click", openReplaceDialog, true);
        trigger.addEventListener("keydown", keyHandler, true);
        host.appendChild(trigger);
        state.imageTrigger = trigger;
        state.imageTriggerHost = host;
        state.imageTriggerClickHandler = openReplaceDialog;
        state.imageTriggerKeyHandler = keyHandler;
      } else {
        element.addEventListener("contextmenu", openReplaceDialog, true);
        state.imageTriggerClickHandler = openReplaceDialog;
      }
      element.style.cursor = "zoom-in";
      element.setAttribute("title", host ? "左键预览，点“换”角标替换图片" : "左键预览，右键替换图片");
    } else if (usesDialogTrigger) {
      const openTextDialog = (event) => {
        if (event) {
          event.preventDefault();
          event.stopPropagation();
          if (typeof event.stopImmediatePropagation === "function") {
            event.stopImmediatePropagation();
          }
        }
        const fieldName = config && config.name ? config.name : "内容";
        const currentValue = extractElementValue(element, config);
        const nextValue = window.prompt(`请输入新的${fieldName}：`, currentValue);
        if (nextValue === null) return;
        if (nextValue === currentValue) {
          manager.notification.show(`${fieldName}未发生变化。`, "info");
          return;
        }
        applyDialogValueToElement(element, nextValue, config);
        manager.notification.show(`${fieldName}已更新，点击“完成”保存。`, "success");
      };
      const host = findDialogTriggerHost(element);
      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "tm-inline-text-dialog-trigger";
      trigger.textContent = config && config.dialogButtonLabel ? config.dialogButtonLabel : "改";
      trigger.setAttribute("aria-label", `修改${config && config.name ? config.name : "内容"}`);
      trigger.setAttribute("title", "点击弹窗修改");
      trigger.addEventListener("click", openTextDialog, true);
      if (host && host.parentNode) {
        host.parentNode.insertBefore(trigger, host.nextSibling);
        state.dialogTrigger = trigger;
        state.dialogTriggerHost = host;
        state.dialogTriggerClickHandler = openTextDialog;
      }
      element.dataset.tmInlineDialogEdit = "1";
    } else if (isInput) {
      element.disabled = false;
      element.readOnly = false;
      element.removeAttribute("readonly");
      element.removeAttribute("disabled");
    } else {
      element.setAttribute("contenteditable", "true");
    }
    element.dataset.tmInlineEditing = "1";
    if (!noHighlight) {
      element.classList.add("tm-inline-editing");
    }
    manager.editedElements.set(element, state);
  }
  function restoreElements(manager) {
    manager.editedElements.forEach((state, element) => {
      if (!element) return;
      delete element.dataset.tmInlineEditing;
      element.removeAttribute("data-tm-inline-editing");
      element.removeAttribute("data-tm-inline-dialog-edit");
      element.classList.remove("tm-inline-editing");
      if (state.isInput) {
        element.disabled = state.disabled;
        element.readOnly = state.readOnly;
        if (state.originalReadonlyAttr !== null) {
          element.setAttribute("readonly", state.originalReadonlyAttr);
        } else {
          element.removeAttribute("readonly");
        }
        if (state.originalDisabledAttr !== null) {
          element.setAttribute("disabled", state.originalDisabledAttr);
        } else {
          element.removeAttribute("disabled");
        }
      } else if (state.isImage) {
        if (state.imageTrigger) {
          if (state.imageTriggerClickHandler) {
            state.imageTrigger.removeEventListener("click", state.imageTriggerClickHandler, true);
          }
          if (state.imageTriggerKeyHandler) {
            state.imageTrigger.removeEventListener("keydown", state.imageTriggerKeyHandler, true);
          }
          state.imageTrigger.remove();
        } else if (state.imageTriggerClickHandler) {
          element.removeEventListener("contextmenu", state.imageTriggerClickHandler, true);
        }
        if (state.imageTriggerHost && state.imageTriggerHostPositionAdjusted) {
          state.imageTriggerHost.style.position = state.imageTriggerHostPosition || "";
        }
        if (state.originalCursor !== void 0) {
          element.style.cursor = state.originalCursor;
        }
        if (state.originalTitle !== null) {
          element.setAttribute("title", state.originalTitle);
        } else {
          element.removeAttribute("title");
        }
      } else if (state.usesDialogTrigger) {
        if (state.dialogTrigger) {
          if (state.dialogTriggerClickHandler) {
            state.dialogTrigger.removeEventListener("click", state.dialogTriggerClickHandler, true);
          }
          state.dialogTrigger.remove();
        }
      } else if (state.contentEditable === null || state.contentEditable === void 0) {
        element.removeAttribute("contenteditable");
      } else {
        element.setAttribute("contenteditable", state.contentEditable);
      }
    });
    manager.editedElements.clear();
    manager.activeImageElement = null;
    if (manager.imageInput) {
      manager.imageInput.value = "";
    }
    cleanupLooseEditingMarks();
  }
  function cleanupLooseEditingMarks(root = document) {
    try {
      const scope = root && typeof root.querySelectorAll === "function" ? root : document;
      scope.querySelectorAll("[data-tm-inline-editing], .tm-inline-editing").forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        node.classList.remove("tm-inline-editing");
        node.removeAttribute("data-tm-inline-editing");
        node.removeAttribute("data-tm-inline-dialog-edit");
        if (node.isContentEditable) {
          node.removeAttribute("contenteditable");
          node.contentEditable = "inherit";
        }
      });
      scope.querySelectorAll(".tm-inline-text-dialog-trigger").forEach((node) => {
        node.remove();
      });
    } catch (error) {
      console.warn("清理残留编辑标记失败:", error);
    }
  }
  function isEditorInternalNode(node) {
    if (!(node instanceof Element)) return false;
    if (node.id === "tm-inline-editor" || node.id === "tm-inline-notifications") return true;
    return Boolean(node.closest("#tm-inline-editor") || node.closest("#tm-inline-notifications"));
  }
  function nodeTouchesSelectorText(node, selectorText, warningMessage) {
    if (!(node instanceof Element) || !selectorText) return false;
    try {
      if (typeof node.matches === "function" && node.matches(selectorText)) {
        return true;
      }
      if (typeof node.closest === "function" && node.closest(selectorText)) {
        return true;
      }
      if (typeof node.querySelector === "function" && node.querySelector(selectorText)) {
        return true;
      }
    } catch (error) {
      console.warn(warningMessage, error);
      return true;
    }
    return false;
  }
  function hasRelevantNodesForSelector(nodeList, selectorText, warningMessage) {
    if (!nodeList || nodeList.length === 0 || !selectorText) return false;
    for (const node of nodeList) {
      if (!(node instanceof Element)) continue;
      if (isEditorInternalNode(node)) continue;
      if (nodeTouchesSelectorText(node, selectorText, warningMessage)) {
        return true;
      }
    }
    return false;
  }
  function hasRelevantMutationsForSelector(mutations, selectorText, warningMessage) {
    for (const mutation of mutations) {
      if (!mutation || mutation.type !== "childList") continue;
      if (!hasRelevantNodesForSelector(mutation.addedNodes, selectorText, warningMessage) && !hasRelevantNodesForSelector(mutation.removedNodes, selectorText, warningMessage)) {
        continue;
      }
      return true;
    }
    return false;
  }
  function collectTargetElements(manager) {
    const targets = [];
    const seen = new Set();
    manager.fieldConfigs.forEach((item) => {
      const elements = manager.resolveElementsFromConfig(item);
      elements.forEach((element) => {
        if (!element || seen.has(element)) return;
        seen.add(element);
        targets.push({ element, config: item });
      });
    });
    return targets;
  }
  function buildEditWatchSelectorText(manager) {
    const selectors = [];
    const seen = new Set();
    manager.fieldConfigs.forEach((config) => {
      manager.getWatchSelectorsFromConfig(config).filter(Boolean).forEach((selector) => {
        if (seen.has(selector)) return;
        seen.add(selector);
        selectors.push(selector);
      });
    });
    return selectors.join(", ");
  }
  function nodeTouchesEditTarget(manager, node) {
    if (!manager.editWatchSelectorText) return true;
    return nodeTouchesSelectorText(
      node,
      manager.editWatchSelectorText,
      "检查编辑区变更节点时选择器执行失败:"
    );
  }
  function hasRelevantEditMutations(manager, mutations) {
    return hasRelevantMutationsForSelector(
      mutations,
      manager.editWatchSelectorText,
      "检查编辑区变更节点时选择器执行失败:"
    );
  }
  function hasRelevantEditNodes(manager, nodeList) {
    if (!manager.editWatchSelectorText) return false;
    return hasRelevantNodesForSelector(
      nodeList,
      manager.editWatchSelectorText,
      "检查编辑区变更节点时选择器执行失败:"
    );
  }
  function scheduleEditableSync(manager, delay = manager.editMutationDebounceMs) {
    if (!manager.isEditing || manager.pendingEditableSyncTimer) return;
    manager.pendingEditableSyncTimer = setTimeout(() => {
      manager.pendingEditableSyncTimer = null;
      syncEditableTargets(manager);
    }, delay);
  }
  function syncEditableTargets(manager) {
    if (!manager.isEditing) return;
    logDebug("observer-apply", {
      writer: "EditSync",
      reason: "sync editable targets",
      data: manager.fieldConfigs.map((config) => config.keySuffix || config.name).slice(0, 12)
    });
    collectTargetElements(manager).forEach(({ element, config }) => {
      makeEditable(manager, element, config);
    });
  }
  function startEditMutationObserver(manager) {
    if (manager.editMutationObserver || !document.body) return;
    manager.editMutationObserver = new MutationObserver((mutations) => {
      if (!manager.isEditing) return;
      if (!hasRelevantEditMutations(manager, mutations)) return;
      logDebug("observer-hit", {
        writer: "EditSync",
        reason: "matched editable selectors",
        summary: summarizeMutations(Array.from(mutations))
      });
      scheduleEditableSync(manager, manager.editMutationDebounceMs);
    });
    manager.editMutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  function stopEditMutationObserver(manager) {
    if (manager.editMutationObserver) {
      manager.editMutationObserver.disconnect();
      manager.editMutationObserver = null;
    }
    if (manager.pendingEditableSyncTimer) {
      clearTimeout(manager.pendingEditableSyncTimer);
      manager.pendingEditableSyncTimer = null;
    }
  }
  function collectEditedValues(manager) {
    const values = {};
    manager.fieldConfigs.forEach((config) => {
      const storageKey = manager.buildStorageKey(config);
      if (!storageKey) {
        return;
      }
      const elements = manager.resolveElementsFromConfig(config);
      if (config.multiple) {
        if (elements.length > 0) {
          values[storageKey] = elements.map((element) => extractElementValue(element, config));
        }
        return;
      }
      const changedElement = getEditedElementWithChangedValue(elements, manager.editedElements, config);
      const preferredElement = changedElement || pickPreferredValueElement(elements);
      if (!preferredElement) {
        return;
      }
      const value = extractElementValue(preferredElement, config);
      if (value !== void 0 && value !== null) {
        values[storageKey] = value;
      }
    });
    return values;
  }
  const CHARGE_SUMMARY_LABEL_ALIASES = {
    charge_subtotal: ["subtotal", "小计", "小計", "sous-total", "zwischensumme", "subtotale", "ara toplam"],
    charge_shipping: ["shipping", "shipping & handling", "delivery", "delivery charges", "运费", "配送", "送料", "livraison", "versand", "spedizione", "envio", "envío", "frete", "verzending", "frakt", "dostawa", "kargo"],
    charge_total_before_tax: ["total before tax", "before tax", "pretax", "税前", "avant taxes", "vor steuern", "antes de impuestos", "imposte escluse", "vergiler haric"],
    charge_estimated_tax: ["estimated tax", "estimated vat", "estimated gst", "tax to be collected", "vat to be collected", "税费", "税額", "consumption tax", "impuestos estimados", "taxe estimee", "voraussichtliche steuer", "imposta stimata", "szacowany podatek"],
    charge_grand_total: ["grand total", "order total", "gesamtsumme", "总计", "合计", "付款总额", "importe total", "totale", "montant total", "gesamtkosten"],
    charge_refund_total: ["refund total", "refund", "退款", "返金", "払い戻し", "reembolso", "rimborso", "remboursement", "erstattung", "rückerstattung", "zwrot", "iade", "استرداد"]
  };
  const PRODUCT_OVERVIEW_BRAND_SELECTORS = [
    "#productOverview_feature_div > div > table > tbody > tr.a-spacing-small.po-brand > td.a-span9 > span",
    "#poExpander > div.a-expander-content.a-expander-partial-collapse-content > div > table > tbody > tr.a-spacing-small.po-brand > td.a-span9 > span",
    "#topHighlight > div.a-section.a-spacing-small.a-spacing-top-small > table > tbody > tr.a-spacing-small.po-brand > td.a-span9 > span"
  ];
  const LEGACY_PAYMENT_CARD_ENDING_SELECTORS = [
    ".pmts-payments-instrument-detail-box-paystationpaymentmethod .a-color-base"
  ];
  const MODERN_PAYMENT_CARD_TEXT_WRAPPER_SELECTOR = '[data-testid="payment-instrument-text-wrapper"]';
  const MODERN_PAYMENT_CARD_NUMBER_SELECTOR = '[data-testid="payment-instrument-number"]';
  function normalizeInlineText(value) {
    return String(value || "").replace(/[\s\u00a0]+/g, " ").trim();
  }
  function extractInlineTextFromHtml(value) {
    const template = document.createElement("template");
    template.innerHTML = String(value || "");
    return normalizeInlineText(template.content.textContent);
  }
  function getChargeSummaryRows() {
    const rows = [];
    const seen = new Set();
    document.querySelectorAll('[data-component="chargeSummary"]').forEach((container) => {
      const listItemCandidates = container.querySelectorAll("li");
      const candidates = listItemCandidates.length > 0 ? listItemCandidates : container.querySelectorAll(".od-line-item-row");
      candidates.forEach((row) => {
        if (!(row instanceof HTMLElement) || seen.has(row)) return;
        const labelElement = row.querySelector('.od-line-item-row-label, [class*="line-item-row-label"]');
        const valueContainerElement = row.querySelector('.od-line-item-row-content, [class*="line-item-row-content"]');
        const valueElement = valueContainerElement instanceof HTMLElement ? pickPreferredValueElement(
          Array.from(
            valueContainerElement.querySelectorAll(
              ".a-color-base, .a-size-base, .a-text-bold, span"
            )
          ).filter((element) => element instanceof HTMLElement)
        ) || valueContainerElement : null;
        if (!(labelElement instanceof HTMLElement) || !(valueElement instanceof HTMLElement)) return;
        const labelText = normalizeTextContent(labelElement.textContent);
        const valueText = normalizeTextContent(valueElement.textContent);
        if (!labelText && !valueText) return;
        seen.add(row);
        rows.push({
          row,
          labelElement,
          valueElement,
          labelText,
          valueText
        });
      });
    });
    return rows;
  }
  function rowMatchesAlias(row, aliases) {
    if (!row || !Array.isArray(aliases) || aliases.length === 0) return false;
    return aliases.some((alias) => {
      const normalizedAlias = normalizeTextContent(alias);
      return normalizedAlias && row.labelText.includes(normalizedAlias);
    });
  }
  function getChargeSummaryRowByKey(keySuffix) {
    const rows = getChargeSummaryRows();
    if (rows.length === 0) return null;
    const aliasMatch = rowMatchesAlias;
    const refundRow = rows.find((row) => aliasMatch(row, CHARGE_SUMMARY_LABEL_ALIASES.charge_refund_total)) || null;
    if (keySuffix === "charge_refund_total" || keySuffix === "charge_refund_total_label") {
      if (refundRow) return refundRow;
      return rows.length >= 6 ? rows[rows.length - 1] : null;
    }
    const directAliases = CHARGE_SUMMARY_LABEL_ALIASES[keySuffix];
    if (Array.isArray(directAliases)) {
      const matchedRow = rows.find((row) => aliasMatch(row, directAliases));
      if (matchedRow) return matchedRow;
    }
    if (keySuffix === "charge_grand_total") {
      if (refundRow) {
        const refundIndex = rows.indexOf(refundRow);
        return refundIndex > 0 ? rows[refundIndex - 1] : refundRow;
      }
      return rows[rows.length - 1] || null;
    }
    const fallbackIndexMap = {
      charge_subtotal: 0,
      charge_shipping: 1,
      charge_total_before_tax: 2,
      charge_estimated_tax: 3
    };
    const fallbackIndex = fallbackIndexMap[keySuffix];
    if (!Number.isInteger(fallbackIndex) || !rows[fallbackIndex]) {
      return null;
    }
    if (keySuffix === "charge_total_before_tax") {
      return rows.length >= 4 ? rows[fallbackIndex] : null;
    }
    if (keySuffix === "charge_estimated_tax") {
      return rows.length >= 5 ? rows[fallbackIndex] : null;
    }
    return rows[fallbackIndex];
  }
  function resolveChargeSummaryElements(keySuffix, part = "value") {
    const row = getChargeSummaryRowByKey(keySuffix);
    if (!row) return [];
    if (part === "row") return [row.row];
    if (part === "label") return row.labelElement ? [row.labelElement] : [];
    return row.valueElement ? [row.valueElement] : [];
  }
  function getChargeSummaryValue(element) {
    if (!(element instanceof HTMLElement)) return "";
    return normalizeInlineText(element.textContent);
  }
  function setChargeSummaryValue(element, value) {
    if (!(element instanceof HTMLElement)) return;
    const nextValue = typeof value === "string" && /<[^>]+>/.test(value) ? extractInlineTextFromHtml(value) : normalizeInlineText(value);
    element.textContent = nextValue;
  }
  function getSellerInfoContainer() {
    return document.querySelector("#page-section-detail-seller-info .a-box-inner");
  }
  function getSellerInfoRows() {
    const container = getSellerInfoContainer();
    if (!(container instanceof HTMLElement)) return [];
    return Array.from(container.querySelectorAll(":scope > .a-row")).filter((row) => row instanceof HTMLElement);
  }
  function getBusinessNameRow() {
    return getSellerInfoRows().find((row) => row.querySelector("span.a-text-bold + span")) || null;
  }
  function getBusinessAddressLabelRow() {
    const rows = getSellerInfoRows();
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      if (!(row instanceof HTMLElement) || !row.querySelector("span.a-text-bold")) continue;
      let next = row.nextElementSibling;
      while (next instanceof HTMLElement && next.classList.contains("a-spacing-none")) {
        if (next.classList.contains("indent-left")) {
          return row;
        }
        next = next.nextElementSibling;
      }
    }
    return null;
  }
  function resolveBusinessNameElements(part = "value") {
    const row = getBusinessNameRow();
    if (!(row instanceof HTMLElement)) return [];
    if (part === "label") {
      return normalizeResolvedElements(row.querySelector("span.a-text-bold"));
    }
    return normalizeResolvedElements(row.querySelector("span.a-text-bold + span"));
  }
  function resolveBusinessAddressElements(part = "value") {
    const row = getBusinessAddressLabelRow();
    if (!(row instanceof HTMLElement)) return [];
    if (part === "label") {
      return normalizeResolvedElements(row.querySelector("span.a-text-bold"));
    }
    const values = [];
    let next = row.nextElementSibling;
    while (next instanceof HTMLElement && next.classList.contains("a-spacing-none")) {
      if (!next.classList.contains("indent-left")) break;
      next.querySelectorAll("span").forEach((span) => values.push(span));
      next = next.nextElementSibling;
    }
    return normalizeResolvedElements(values);
  }
  function resolveOfferDisplayBrandElements() {
    const candidates = collectElementsFromSelectors([
      "#sellerProfileTriggerId",
      "#seller-name"
    ]);
    const preferred = pickPreferredValueElement(candidates);
    return preferred ? [preferred] : [];
  }
  function resolveProductOverviewBrandElements() {
    return collectElementsFromSelectors(PRODUCT_OVERVIEW_BRAND_SELECTORS);
  }
  function getModernPaymentCardNumberElement(element) {
    if (!(element instanceof HTMLElement)) return null;
    if (element.matches(MODERN_PAYMENT_CARD_NUMBER_SELECTOR)) {
      return element;
    }
    const numberElement = element.querySelector(MODERN_PAYMENT_CARD_NUMBER_SELECTOR);
    return numberElement instanceof HTMLElement ? numberElement : null;
  }
  function normalizePaymentCardEndingValue(value) {
    const normalized = normalizeInlineText(value);
    if (!normalized) return "";
    const trailingMatch = normalized.match(/(?:ending\s+in|[•*]{2,})\s*(.+)$/i);
    return trailingMatch ? trailingMatch[1].trim() : normalized;
  }
  function resolvePaymentCardEndingElements() {
    const legacyElements = collectElementsFromSelectors(LEGACY_PAYMENT_CARD_ENDING_SELECTORS).filter((element) => {
      const text = normalizeInlineText(element.textContent);
      return /ending\s+in\s+.+/i.test(text);
    });
    const modernElements = collectElementsFromSelectors([MODERN_PAYMENT_CARD_TEXT_WRAPPER_SELECTOR]).map((wrapper) => getModernPaymentCardNumberElement(wrapper)).filter((element) => {
      const text = normalizeInlineText(element.textContent);
      return Boolean(text);
    });
    return normalizeResolvedElements([...legacyElements, ...modernElements]);
  }
  function getPaymentCardEndingValue(element) {
    const modernNumberElement = getModernPaymentCardNumberElement(element);
    if (modernNumberElement) {
      return normalizePaymentCardEndingValue(modernNumberElement.textContent);
    }
    const text = normalizeInlineText(element && element.textContent);
    const match = text.match(/ending\s+in\s+(.+)$/i);
    return match ? match[1].trim() : text;
  }
  function setPaymentCardEndingValue(element, value) {
    if (!(element instanceof HTMLElement)) return;
    const nextSuffix = normalizePaymentCardEndingValue(value);
    const modernNumberElement = getModernPaymentCardNumberElement(element);
    if (modernNumberElement) {
      modernNumberElement.textContent = nextSuffix;
      return;
    }
    const currentText = normalizeInlineText(element.textContent);
    const prefixMatch = currentText.match(/^(.*?ending\s+in)\s+.+$/i);
    const prefix = prefixMatch ? prefixMatch[1].trim() : "ending in";
    element.textContent = nextSuffix ? `${prefix} ${nextSuffix}` : prefix;
  }
  function setButtonLabel(button, label) {
    if (!button) return;
    const labelElement = button.querySelector(".tm-inline-btn-label");
    if (labelElement) {
      labelElement.textContent = label;
      return;
    }
    button.textContent = label;
  }
  function handleEditButtonClick(manager) {
    manager.setPanelOpen(false);
    if (manager.isEditing) {
      exitEditMode(manager, true);
      return;
    }
    enterEditMode(manager);
  }
  function refreshButtonStates(manager) {
    if (manager.toggleBtn) {
      setButtonLabel(manager.toggleBtn, manager.isEditing ? "完成" : manager.initialEditLabel);
      manager.toggleBtn.title = manager.isEditing ? "保存并退出编辑模式" : "进入编辑模式";
      manager.toggleBtn.setAttribute("aria-pressed", manager.isEditing ? "true" : "false");
      manager.toggleBtn.disabled = false;
    }
  }
  function applyRefundRowState(manager, updateLabel = false) {
    document.querySelectorAll(".tm-inline-refund-row-hidden").forEach((row) => {
      row.classList.remove("tm-inline-refund-row-hidden");
    });
    if (manager.refundRowHidden) {
      resolveChargeSummaryElements("charge_refund_total", "row").forEach((row) => {
        row.classList.add("tm-inline-refund-row-hidden");
      });
    }
    if (manager.refundToggleBtn) {
      if (updateLabel) {
        setButtonLabel(manager.refundToggleBtn, "退款");
      }
      manager.refundToggleBtn.classList.toggle("tm-inline-btn-selected", manager.refundRowHidden);
      manager.refundToggleBtn.title = manager.refundRowHidden ? "已隐藏退款行，点击恢复显示" : "显示或隐藏退款总计行";
      manager.refundToggleBtn.setAttribute("aria-pressed", manager.refundRowHidden ? "true" : "false");
    }
  }
  function toggleRefundRowVisibility(manager) {
    manager.setPanelOpen(false);
    manager.refundRowHidden = !manager.refundRowHidden;
    manager.storage.savePersistent("refundRowHidden", manager.refundRowHidden);
    applyRefundRowState(manager, true);
    manager.notification.show(manager.refundRowHidden ? "已隐藏退款总计行。" : "已显示退款总计行。", "info");
  }
  function enterEditMode(manager) {
    if (manager.isEditing) return;
    manager.textObserver.stop();
    manager.isEditing = true;
    document.body.classList.add("tm-editing-mode");
    if (manager.toggleBtn) {
      manager.toggleBtn.classList.add("tm-inline-btn-active");
    }
    refreshButtonStates(manager);
    document.addEventListener("click", manager.boundAnchorInterceptor, true);
    const elements = collectTargetElements(manager);
    elements.forEach(({ element, config }) => makeEditable(manager, element, config));
    startEditMutationObserver(manager);
    if (elements.length === 0) {
      manager.notification.show("未找到可编辑的元素，请检查选择器配置。", "warning");
    } else {
      manager.notification.show("编辑模式已开启：可直接改文字；评论数点旁边“改”按钮编辑；点击图片角标“换”可替换，左键预览保留。", "info");
    }
  }
  function exitEditMode(manager, saveChanges = true) {
    if (!manager.isEditing) return;
    try {
      if (saveChanges) {
        const values = collectEditedValues(manager);
        let dirty = false;
        Object.entries(values).forEach(([key, value]) => {
          if (!isEqualValue(manager.valueMap[key], value)) {
            manager.valueMap[key] = value;
            dirty = true;
          }
        });
        const saved = dirty ? manager.storage.saveValueMap(manager.valueMap) : true;
        if (saved) {
          manager.notification.show(dirty ? "修改已保存并应用。" : "没有检测到新的修改。", dirty ? "success" : "info");
        } else {
          manager.notification.show("保存失败，请查看控制台。", "error");
        }
      } else {
        manager.notification.show("已退出编辑模式，修改未保存。", "info");
      }
    } catch (error) {
      console.error("退出编辑模式失败:", error);
      manager.notification.show("保存失败，请查看控制台。", "error");
    } finally {
      manager.isEditing = false;
      document.body.classList.remove("tm-editing-mode");
      try {
        restoreElements(manager);
      } catch (error) {
        console.warn("恢复元素状态失败:", error);
      }
      try {
        cleanupLooseEditingMarks();
      } catch (error) {
        console.warn("清理残留标记失败:", error);
      }
      const activeElement = document.activeElement;
      if (activeElement && activeElement instanceof HTMLElement) {
        activeElement.blur();
      }
      stopEditMutationObserver(manager);
      document.removeEventListener("click", manager.boundAnchorInterceptor, true);
      if (manager.toggleBtn) {
        manager.toggleBtn.classList.remove("tm-inline-btn-active");
      }
      refreshButtonStates(manager);
      if (manager.textObserver) {
        manager.textObserver.start();
      }
    }
  }
  function hideButton(manager) {
    manager.setPanelOpen(false);
    if (manager.isEditing) {
      exitEditMode(manager, false);
    }
    manager.hidden = true;
    document.body.classList.remove("tm-editing-mode");
    manager.storage.savePersistent("hidden", true);
    manager.container.style.display = "none";
    manager.notification.show("编辑按钮已隐藏，在控制台执行 tmInlineEditor.show() 可重新显示。", "info");
  }
  function showButton(manager) {
    manager.setPanelOpen(false);
    manager.hidden = false;
    manager.storage.savePersistent("hidden", false);
    manager.container.style.display = "flex";
    refreshButtonStates(manager);
    console.log("✅ 编辑按钮已显示");
  }
  function handleReset(manager) {
    manager.setPanelOpen(false);
    const confirmed = window.confirm("确定要删除所有保存的内容并刷新页面吗？");
    if (!confirmed) return;
    if (manager.isEditing) {
      exitEditMode(manager, false);
    }
    const cleared = manager.storage.clearValueMap();
    if (cleared) {
      manager.valueMap = {};
      manager.applyDocumentTitle(manager.originalDocumentTitle);
      manager.notification.show("已清除所有保存内容，页面即将刷新。", "warning");
      setTimeout(() => window.location.reload(), 600);
    } else {
      manager.notification.show("重置失败，请查看控制台。", "error");
    }
  }
  function handleAnchorClick(manager, event) {
    if (!manager.isEditing) return;
    const replaceTrigger = event.target && event.target.closest && event.target.closest(".tm-inline-image-replace-trigger");
    if (replaceTrigger) return;
    const dialogTrigger = event.target && event.target.closest && event.target.closest(".tm-inline-text-dialog-trigger");
    if (dialogTrigger) return;
    const anchor = event.target && event.target.closest("a");
    if (!anchor) return;
    const containsDialogEditTarget = anchor.matches('[data-tm-inline-dialog-edit="1"]') || Boolean(anchor.querySelector('[data-tm-inline-dialog-edit="1"]'));
    if (containsDialogEditTarget) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return;
    }
    if (shouldAllowAnchorInteraction(anchor)) return;
    const editingImage = event.target && event.target.closest('img[data-tm-inline-editing="1"]');
    if (editingImage) return;
    if (manager.container && manager.container.contains(anchor)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }
  class InlineEditManager {
    constructor(storage, notification, textObserver, fieldConfigs, initialValueMap = {}) {
      this.storage = storage;
      this.notification = notification;
      this.textObserver = textObserver;
      this.fieldConfigs = Array.isArray(fieldConfigs) ? fieldConfigs : [];
      this.valueMap = initialValueMap && typeof initialValueMap === "object" ? { ...initialValueMap } : {};
      this.isEditing = false;
      this.hidden = this.storage.loadPersistent("hidden", false) === true;
      this.refundRowHidden = this.storage.loadPersistent("refundRowHidden", false) === true;
      this.boundAnchorInterceptor = (event) => this.handleAnchorClick(event);
      this.editedElements = new Map();
      this.initialEditLabel = "编辑";
      this.imageInput = null;
      this.activeImageElement = null;
      this.pageKey = this.getPageKey();
      this.originalDocumentTitle = document.title || "";
      this.refundToggleBtn = null;
      this.titleEditBtn = null;
      this.toolbarTriggerBtn = null;
      this.panelOpen = false;
      this.editMutationObserver = null;
      this.pendingEditableSyncTimer = null;
      this.editMutationDebounceMs = 120;
      this.editWatchSelectorText = this.buildEditWatchSelectorText();
      this.boundOutsideClickHandler = (event) => this.handleOutsideClick(event);
      this.migrateLegacyFieldStorage();
      this.createUI();
      this.setPanelOpen(false);
      this.setupDynamicStyles();
      this.applyRefundRowState(true);
      this.attachEvents();
      this.setupImageInput();
      this.applyStoredDocumentTitle();
      if (this.toggleBtn) {
        this.initialEditLabel = this.toggleBtn.textContent?.trim() || this.initialEditLabel;
      }
      if (this.textObserver && typeof this.textObserver.setDataResolver === "function") {
        this.textObserver.setDataResolver(() => this.getRuntimeDataList());
      }
      if (this.hidden) {
        this.container.style.display = "none";
        console.log("🫥 编辑按钮已隐藏，可在控制台执行 tmInlineEditor.show() 恢复");
      }
    }
    createUI() {
      createEditorUI(this);
    }
    attachEvents() {
      attachPanelEvents(this);
    }
    setPanelOpen(nextOpen) {
      setPanelOpen(this, nextOpen);
    }
    togglePanelOpen(force) {
      togglePanelOpen(this, force);
    }
    handleOutsideClick(event) {
      handleOutsideClick(this, event);
    }
    setupImageInput() {
      setupImageInput(this);
    }
    readFileAsDataUrl(file) {
      return readFileAsDataUrl(file);
    }
    handleEditButtonClick() {
      handleEditButtonClick(this);
    }
    getDocumentTitleStorageKey() {
      return getDocumentTitleStorageKey(this);
    }
    getStoredDocumentTitle() {
      return getStoredDocumentTitle(this);
    }
    applyDocumentTitle(title) {
      applyDocumentTitle(this, title);
    }
    applyStoredDocumentTitle() {
      applyStoredDocumentTitle(this);
    }
    handleTitleEdit() {
      handleTitleEdit(this);
    }
    refreshButtonStates() {
      refreshButtonStates(this);
    }
    applyRefundRowState(updateLabel = false) {
      applyRefundRowState(this, updateLabel);
    }
    toggleRefundRowVisibility() {
      toggleRefundRowVisibility(this);
    }
    enterEditMode() {
      enterEditMode(this);
    }
    exitEditMode(saveChanges = true) {
      exitEditMode(this, saveChanges);
    }
    hideButton() {
      hideButton(this);
    }
    showButton() {
      showButton(this);
    }
    show() {
      this.showButton();
    }
    enableDebug() {
      const updated = setDebugEnabled(true);
      console.log(updated ? "🔎 调试日志已开启，刷新页面后可看到更完整的 tm-inline 日志。" : "⚠️ 当前环境无法开启调试日志。");
      return updated;
    }
    disableDebug() {
      const updated = setDebugEnabled(false);
      console.log(updated ? "🔕 调试日志已关闭。" : "⚠️ 当前环境无法关闭调试日志。");
      return updated;
    }
    isDebugEnabled() {
      return isDebugEnabled();
    }
    handleReset() {
      handleReset(this);
    }
    collectTargetElements() {
      return collectTargetElements(this);
    }
    buildEditWatchSelectorText() {
      return buildEditWatchSelectorText(this);
    }
    nodeTouchesEditTarget(node) {
      return nodeTouchesEditTarget(this, node);
    }
    hasRelevantEditMutations(mutations) {
      return hasRelevantEditMutations(this, mutations);
    }
    hasRelevantEditNodes(nodeList) {
      return hasRelevantEditNodes(this, nodeList);
    }
    scheduleEditableSync(delay = this.editMutationDebounceMs) {
      scheduleEditableSync(this, delay);
    }
    syncEditableTargets() {
      syncEditableTargets(this);
    }
    startEditMutationObserver() {
      startEditMutationObserver(this);
    }
    stopEditMutationObserver() {
      stopEditMutationObserver(this);
    }
    getSelectorsFromConfig(config) {
      return getConfigSelectorList(config);
    }
    getWatchSelectorsFromConfig(config) {
      return getConfigWatchSelectorList(config);
    }
    resolveElementsFromConfig(config) {
      return collectElementsFromConfig(config);
    }
    buildStorageKey(config) {
      return buildStorageKey(this.pageKey, config);
    }
    buildStorageKeyFromSuffix(keySuffix) {
      return buildStorageKeyFromSuffix(this.pageKey, keySuffix);
    }
    migrateLegacyFieldStorage() {
      const migrations = [
        {
          from: "brand",
          to: ["brand_offer_display", "brand_product_overview"]
        }
      ];
      let dirty = false;
      migrations.forEach((migration) => {
        const fromKey = this.buildStorageKeyFromSuffix(migration.from);
        if (!fromKey || !Object.prototype.hasOwnProperty.call(this.valueMap, fromKey)) {
          return;
        }
        const legacyValue = this.valueMap[fromKey];
        migration.to.forEach((suffix) => {
          const toKey = this.buildStorageKeyFromSuffix(suffix);
          if (!toKey || Object.prototype.hasOwnProperty.call(this.valueMap, toKey)) {
            return;
          }
          this.valueMap[toKey] = legacyValue;
          dirty = true;
        });
        delete this.valueMap[fromKey];
        dirty = true;
      });
      if (dirty) {
        this.storage.saveValueMap(this.valueMap);
      }
    }
    getRuntimeDataList() {
      return this.fieldConfigs.reduce((result, config) => {
        const storageKey = this.buildStorageKey(config);
        if (!storageKey || !Object.prototype.hasOwnProperty.call(this.valueMap, storageKey)) {
          return result;
        }
        const value = this.valueMap[storageKey];
        if (value === void 0 || value === null) {
          return result;
        }
        result.push({
          keySuffix: config.keySuffix,
          selector: this.getSelectorsFromConfig(config),
          watchSelectors: this.getWatchSelectorsFromConfig(config),
          resolveElements: typeof config.resolveElements === "function" ? () => this.resolveElementsFromConfig(config) : void 0,
          multiple: Boolean(config.multiple),
          type: config.type,
          getValue: typeof config.getValue === "function" ? config.getValue : void 0,
          setValue: typeof config.setValue === "function" ? config.setValue : void 0,
          value
        });
        return result;
      }, []);
    }
    getPageKey() {
      try {
        const href = window.location && window.location.href ? window.location.href : "";
        const clean = href.split("#")[0] || href;
        return encodeURIComponent(clean);
      } catch (error) {
        console.warn("获取页面地址失败:", error);
        return "unknown_page";
      }
    }
    collectEditedValues() {
      return collectEditedValues(this);
    }
    makeEditable(element, config) {
      makeEditable(this, element, config);
    }
    restoreElements() {
      restoreElements(this);
    }
    cleanupLooseEditingMarks(root = document) {
      cleanupLooseEditingMarks(root);
    }
    handleAnchorClick(event) {
      handleAnchorClick(this, event);
    }
    setupDynamicStyles() {
      setupDynamicStyles(this);
    }
  }
  class NotificationManager {
    constructor() {
      this.container = document.createElement("div");
      this.container.id = "tm-inline-notifications";
      document.body.appendChild(this.container);
    }
    show(message, type = "info", duration = 2600) {
      const notification = document.createElement("div");
      const safeType = ["success", "error", "warning", "info"].includes(type) ? type : "info";
      notification.className = `tm-inline-notification tm-inline-notification-${safeType}`;
      notification.setAttribute("role", safeType === "error" ? "alert" : "status");
      notification.textContent = message;
      this.container.appendChild(notification);
      setTimeout(() => {
        notification.style.animation = "tm-inline-slide-out 0.3s ease forwards";
        setTimeout(() => notification.remove(), 280);
      }, duration);
    }
  }
  const defaultFieldConfigs = [
    {
      name: "订单日期",
      keySuffix: "order_date",
      selector: '[data-component="orderDate"]'
    },
    {
      name: "订单号",
      keySuffix: "order_id",
      selector: '[data-component="orderId"]'
    },
    {
      name: "收货地址",
      keySuffix: "shipping_address_lines",
      selector: '[data-component="shippingAddress"] .a-list-item',
      multiple: true
    },
    {
      name: "预计送达日期",
      keySuffix: "checkout_delivery_date",
      selector: "#checkout-item-block-panel h2.address-promise-text span.break-word"
    },
    {
      name: "配送选项日期",
      keySuffix: "checkout_delivery_option_date",
      selector: [
        "#col-delivery-group .rcx-checkout-delivery-option-a-control-row-new .col-delivery-message span.a-text-bold",
        ".rcx-checkout-delivery-option-a-control-row .delivery-promise-text"
      ],
      multiple: true
    },
    {
      name: "配送选项费用",
      keySuffix: "checkout_delivery_option_price",
      selector: [
        "#col-delivery-group .rcx-checkout-delivery-option-a-control-row-new .col-delivery-price span",
        ".rcx-checkout-delivery-option-a-control-row .delivery-option-text"
      ],
      multiple: true
    },
    {
      name: "信用卡尾号",
      keySuffix: "payment_card_last4",
      watchSelectors: [
        ".pmts-payments-instrument-list",
        '[data-testid="payment-instrument-text-wrapper"]'
      ],
      resolveElements: () => resolvePaymentCardEndingElements(),
      multiple: true,
      editMode: "dialog",
      dialogButtonLabel: "改",
      getValue: getPaymentCardEndingValue,
      setValue: setPaymentCardEndingValue
    },
    {
      name: "发货信息",
      keySuffix: "checkout_ships_from",
      selector: "#checkout-item-block-panel .lineitem-container .product-description-column p.a-spacing-none > span.a-size-small",
      multiple: true
    },
    {
      name: "小计",
      keySuffix: "charge_subtotal",
      watchSelectors: ['[data-component="chargeSummary"]'],
      resolveElements: () => resolveChargeSummaryElements("charge_subtotal"),
      getValue: getChargeSummaryValue,
      setValue: setChargeSummaryValue
    },
    {
      name: "运费",
      keySuffix: "charge_shipping",
      watchSelectors: ['[data-component="chargeSummary"]'],
      resolveElements: () => resolveChargeSummaryElements("charge_shipping"),
      getValue: getChargeSummaryValue,
      setValue: setChargeSummaryValue
    },
    {
      name: "税前总计",
      keySuffix: "charge_total_before_tax",
      watchSelectors: ['[data-component="chargeSummary"]'],
      resolveElements: () => resolveChargeSummaryElements("charge_total_before_tax"),
      getValue: getChargeSummaryValue,
      setValue: setChargeSummaryValue
    },
    {
      name: "预估税费",
      keySuffix: "charge_estimated_tax",
      watchSelectors: ['[data-component="chargeSummary"]'],
      resolveElements: () => resolveChargeSummaryElements("charge_estimated_tax"),
      getValue: getChargeSummaryValue,
      setValue: setChargeSummaryValue
    },
    {
      name: "总计",
      keySuffix: "charge_grand_total",
      watchSelectors: ['[data-component="chargeSummary"]'],
      resolveElements: () => resolveChargeSummaryElements("charge_grand_total"),
      getValue: getChargeSummaryValue,
      setValue: setChargeSummaryValue
    },
    {
      name: "退款总计标签",
      keySuffix: "charge_refund_total_label",
      watchSelectors: ['[data-component="chargeSummary"]'],
      resolveElements: () => resolveChargeSummaryElements("charge_refund_total_label", "label")
    },
    {
      name: "退款总计",
      keySuffix: "charge_refund_total",
      watchSelectors: ['[data-component="chargeSummary"]'],
      resolveElements: () => resolveChargeSummaryElements("charge_refund_total"),
      getValue: getChargeSummaryValue,
      setValue: setChargeSummaryValue
    },
    {
      name: "商品标题",
      keySuffix: "order_item_title",
      selector: [
        '[data-component="itemTitle"]',
        '#checkout-item-block-panel [data-csa-c-slot-id="checkout-item-block-itemPrimaryTitle"] .lineitem-title-text'
      ],
      multiple: true
    },
    {
      name: "商家信息",
      keySuffix: "ordered_merchant",
      selector: [
        '[data-component="orderedMerchant"]',
        "#checkout-item-block-panel .lineitem-seller-section a span.break-word"
      ],
      multiple: true
    },
    {
      name: "退货信息",
      keySuffix: "item_return_eligibility",
      selector: '[data-component="itemReturnEligibility"]',
      multiple: true
    },
    {
      name: "单价",
      keySuffix: "unit_price",
      selector: '[data-component="unitPrice"]',
      multiple: true
    },
    {
      name: "订单商品图片",
      keySuffix: "order_item_image",
      selector: [
        '[data-component="itemImage"] img',
        '#checkout-item-block-panel [data-csa-c-slot-id="checkout-item-block-productImage"] img'
      ],
      type: "image",
      multiple: true
    },
    {
      name: "配送信息 1 (PDM)",
      keySuffix: "delivery_pdm",
      selector: '[data-csa-c-content-id="DEXUnifiedCXPDM"]'
    },
    {
      name: "配送信息 2 (SDM)",
      keySuffix: "delivery_sdm",
      selector: '[data-csa-c-content-id="DEXUnifiedCXSDM"]'
    },
    {
      name: "品牌/卖家 (报价区)",
      keySuffix: "brand_offer_display",
      watchSelectors: ["#sellerProfileTriggerId", "#seller-name"],
      resolveElements: () => resolveOfferDisplayBrandElements()
    },
    {
      name: "品牌 (商品概览)",
      keySuffix: "brand_product_overview",
      watchSelectors: ["#productOverview_feature_div", "#poExpander", "#topHighlight", "#voyagerNorthstarATF"],
      resolveElements: () => resolveProductOverviewBrandElements()
    },
    {
      name: "品牌信息",
      keySuffix: "byline_info",
      selector: [
        "#bylineInfo",
        "#seller-info-storefront-link > span > a"
      ]
    },
    {
      name: "评论数",
      keySuffix: "customer_review_count",
      selector: "#acrCustomerReviewText",
      editMode: "dialog",
      dialogButtonLabel: "改"
    },
    {
      name: "Business Name 标签",
      keySuffix: "business_name_label",
      selector: "#page-section-detail-seller-info .a-box-inner > .a-row.a-spacing-none:nth-of-type(2) > span.a-text-bold",
      watchSelectors: ["#page-section-detail-seller-info .a-box-inner"],
      resolveElements: () => resolveBusinessNameElements("label")
    },
    {
      name: "Business Name",
      keySuffix: "business_name",
      selector: "#page-section-detail-seller-info .a-box-inner > .a-row.a-spacing-none:nth-of-type(2) > span.a-text-bold + span",
      watchSelectors: ["#page-section-detail-seller-info .a-box-inner"],
      resolveElements: () => resolveBusinessNameElements("value")
    },
    {
      name: "Business Address 标签",
      keySuffix: "business_address_label",
      selector: "#page-section-detail-seller-info .a-box-inner > .a-row.a-spacing-none:nth-of-type(3) > span.a-text-bold",
      watchSelectors: ["#page-section-detail-seller-info .a-box-inner"],
      resolveElements: () => resolveBusinessAddressElements("label")
    },
    {
      name: "Business Address",
      keySuffix: "business_address",
      selector: "#page-section-detail-seller-info .a-box-inner > .a-row.a-spacing-none.indent-left > span",
      watchSelectors: ["#page-section-detail-seller-info .a-box-inner"],
      resolveElements: () => resolveBusinessAddressElements("value"),
      multiple: true
    },
    {
      name: "商品标题 (卡片页)",
      keySuffix: "product_card_title",
      selector: "#product-title > span > a > h5"
    },
    {
      name: "商品价格 (卡片页)",
      keySuffix: "product_card_price",
      selector: "#product-price > span"
    },
    {
      name: "商品图片 (卡片页)",
      keySuffix: "product_card_image",
      selector: [
        "img#product-p0-image",
        "#product-p0-image img"
      ],
      type: "image"
    },
    {
      name: "商品标题 (详情页)",
      keySuffix: "product_title",
      selector: "#productTitle"
    },
    {
      name: "五点描述 (详情页)",
      keySuffix: "product_feature_bullets",
      selector: "#feature-bullets ul.a-unordered-list.a-vertical.a-spacing-mini li > span.a-list-item",
      multiple: true
    },
    {
      name: "主预览图 (详情页)",
      keySuffix: "product_main_preview_image",
      selector: [
        "#mediaBlock_feature_div #landingImage",
        "#mediaBlock_feature_div #imgTagWrapperId img"
      ],
      type: "image"
    },
    {
      name: "缩略预览图 (详情页)",
      keySuffix: "product_thumb_preview_images",
      selector: "#mediaBlock_feature_div #altImages img",
      type: "image",
      multiple: true
    }
  ];
  class StorageManager {
    #defaultList = defaultFieldConfigs;
    constructor() {
      this.prefix = "tm_inline_editor_";
    }
    savePersistent(key, data) {
      try {
        _GM_setValue(this.prefix + key, JSON.stringify(data));
        return true;
      } catch (error) {
        console.error("保存数据失败:", key, error);
        return false;
      }
    }
    loadPersistent(key, defaultValue = null) {
      try {
        const stored = _GM_getValue(this.prefix + key, null);
        return stored ? JSON.parse(stored) : defaultValue;
      } catch (error) {
        console.error("读取数据失败:", key, error);
        return defaultValue;
      }
    }
    getDefaultList() {
      return this.#defaultList.map((item) => cloneFieldConfig(item));
    }
    loadValueMap() {
      const stored = this.loadPersistent("dataMap", null);
      if (stored && typeof stored === "object" && !Array.isArray(stored)) {
        return stored;
      }
      const legacyList = this.loadPersistent("data", null);
      if (Array.isArray(legacyList) && legacyList.length > 0) {
        const migrated = {};
        legacyList.forEach((item, index) => {
          if (!item || item.value === void 0 || item.value === null) return;
          const selectors = Array.isArray(item.selector) ? item.selector : [item.selector];
          const suffix = item.keySuffix || selectors[0] || `legacy_${index}`;
          migrated[suffix] = item.value;
        });
        this.savePersistent("dataMap", migrated);
        return migrated;
      }
      return {};
    }
    saveValueMap(map) {
      return this.savePersistent("dataMap", map);
    }
    clearValueMap() {
      return this.saveValueMap({});
    }
  }
  class TextObserver {
    constructor(dataList) {
      this.dataList = Array.isArray(dataList) ? dataList : [];
      this.mutationObserver = null;
      this.intervalId = null;
      this.isActive = false;
      this.dataResolver = null;
      this.pendingApplyTimer = null;
      this.pendingFrameId = null;
      this.applyInProgress = false;
      this.lastApplyAt = 0;
      this.minApplyIntervalMs = 220;
      this.mutationDebounceMs = 120;
      this.fallbackIntervalMs = 2e4;
      this.activeSelectorText = "";
    }
    start() {
      if (this.isActive) return;
      this.refreshDataList();
      if (!this.hasActiveData()) return;
      this.isActive = true;
      this.scheduleApply(0);
      this.setupMutationObserver();
      this.startIntervalChecker();
      console.log("🔍 文本观察者已启动");
    }
    stop() {
      if (!this.isActive) return;
      this.isActive = false;
      if (this.mutationObserver) {
        this.mutationObserver.disconnect();
        this.mutationObserver = null;
      }
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
      if (this.pendingApplyTimer) {
        clearTimeout(this.pendingApplyTimer);
        this.pendingApplyTimer = null;
      }
      if (this.pendingFrameId !== null && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(this.pendingFrameId);
        this.pendingFrameId = null;
      }
      console.log("⏹️ 文本观察者已停止");
    }
    setDataResolver(resolver) {
      if (typeof resolver === "function") {
        this.dataResolver = resolver;
        this.refreshDataList();
      } else {
        this.dataResolver = null;
        this.dataList = [];
        this.activeSelectorText = "";
      }
    }
    #safeResolveData() {
      if (!this.dataResolver) return null;
      try {
        const resolved = this.dataResolver();
        return Array.isArray(resolved) ? resolved : null;
      } catch (error) {
        console.warn("数据解析函数执行失败:", error);
        return null;
      }
    }
    refreshDataList() {
      const resolved = this.#safeResolveData();
      if (resolved) {
        this.dataList = resolved;
      }
      this.activeSelectorText = this.buildActiveSelectorText(this.dataList);
      return this.dataList;
    }
    hasActiveData() {
      return Array.isArray(this.dataList) && this.dataList.length > 0;
    }
    buildActiveSelectorText(dataList) {
      if (!Array.isArray(dataList) || dataList.length === 0) return "";
      const selectors = [];
      const seen = new Set();
      dataList.forEach((item) => {
        const selectorList = getConfigWatchSelectorList(item);
        selectorList.filter(Boolean).forEach((selector) => {
          if (seen.has(selector)) return;
          seen.add(selector);
          selectors.push(selector);
        });
      });
      return selectors.join(", ");
    }
    scheduleApply(delay = this.mutationDebounceMs) {
      if (!this.isActive) return;
      if (this.pendingApplyTimer) return;
      const elapsed = Date.now() - this.lastApplyAt;
      const throttleWait = elapsed >= this.minApplyIntervalMs ? 0 : this.minApplyIntervalMs - elapsed;
      const wait = Math.max(delay, throttleWait);
      this.pendingApplyTimer = setTimeout(() => {
        this.pendingApplyTimer = null;
        if (!this.isActive) return;
        if (typeof requestAnimationFrame === "function") {
          this.pendingFrameId = requestAnimationFrame(() => {
            this.pendingFrameId = null;
            this.applyAll();
          });
          return;
        }
        this.applyAll();
      }, wait);
    }
    hasRelevantMutations(mutations) {
      return hasRelevantMutationsForSelector(
        mutations,
        this.activeSelectorText,
        "检查变更节点时选择器执行失败:"
      );
    }
    hasRelevantNodes(nodeList) {
      return hasRelevantNodesForSelector(
        nodeList,
        this.activeSelectorText,
        "检查变更节点时选择器执行失败:"
      );
    }
    nodeTouchesActiveSelector(node) {
      return nodeTouchesSelectorText(
        node,
        this.activeSelectorText,
        "检查变更节点时选择器执行失败:"
      );
    }
    applyAll() {
      if (!this.isActive) return;
      if (this.applyInProgress) return;
      this.applyInProgress = true;
      if (this.dataResolver) {
        this.refreshDataList();
      }
      try {
        if (!this.hasActiveData()) {
          this.stop();
          return;
        }
        logDebug("observer-apply", {
          writer: "TextObserver",
          data: this.dataList.map((item) => item.keySuffix || item.selector).slice(0, 12)
        });
        const elementCache = new Map();
        this.dataList.forEach((item) => {
          if (!item || item.value === void 0 || item.value === null) return;
          const selectors = getConfigSelectorList(item);
          const selectorKey = item.keySuffix ? `dynamic:${item.keySuffix}` : selectors.join("\0");
          let elements = elementCache.get(selectorKey);
          if (!elements) {
            elements = collectElementsFromConfig(item);
            elementCache.set(selectorKey, elements);
          }
          if (item.multiple) {
            const values = Array.isArray(item.value) ? item.value : [item.value];
            elements.forEach((element, index) => {
              if (!element) return;
              if (element.dataset && element.dataset.tmInlineEditing === "1") return;
              if (values[index] === void 0) return;
              this.applyValueToElement(element, values[index], item);
            });
            return;
          }
          elements.forEach((element) => {
            if (!element) return;
            if (element.dataset && element.dataset.tmInlineEditing === "1") return;
            this.applyValueToElement(element, item.value, item);
          });
        });
      } finally {
        this.applyInProgress = false;
        this.lastApplyAt = Date.now();
      }
    }
    applyValueToElement(element, value, config = {}) {
      applyElementValue(element, value, config);
    }
    setupMutationObserver() {
      if (this.mutationObserver) return;
      this.mutationObserver = new MutationObserver((mutations) => {
        if (!this.isActive) return;
        if (!this.hasRelevantMutations(mutations)) return;
        logDebug("observer-hit", {
          writer: "TextObserver",
          reason: "matched active selectors",
          summary: summarizeMutations(Array.from(mutations))
        });
        this.scheduleApply(this.mutationDebounceMs);
      });
      this.mutationObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
    startIntervalChecker() {
      if (this.intervalId) return;
      this.intervalId = setInterval(() => this.scheduleApply(0), this.fallbackIntervalMs);
    }
  }
  const amazonTopAdSelectors = ["#nav-swmslot", "#navSwmHoliday"];
  const amazonTopAdSelectorText = amazonTopAdSelectors.join(", ");
  function removeAmazonTopAdsFromNode(node) {
    if (!(node instanceof Element)) return 0;
    let removedCount = 0;
    try {
      if (typeof node.matches === "function" && node.matches(amazonTopAdSelectorText)) {
        node.remove();
        return 1;
      }
      if (typeof node.querySelectorAll === "function") {
        node.querySelectorAll(amazonTopAdSelectorText).forEach((element) => {
          element.remove();
          removedCount += 1;
        });
      }
    } catch (error) {
      console.warn("移除 Amazon 顶部广告失败:", error);
    }
    return removedCount;
  }
  function removeAmazonTopAds(root = document) {
    if (root instanceof Element) {
      return removeAmazonTopAdsFromNode(root);
    }
    let removedCount = 0;
    try {
      document.querySelectorAll(amazonTopAdSelectorText).forEach((element) => {
        element.remove();
        removedCount += 1;
      });
    } catch (error) {
      console.warn("移除 Amazon 顶部广告失败:", error);
    }
    return removedCount;
  }
  function startAmazonTopAdCleanup() {
    _GM_addStyle(`
        ${amazonTopAdSelectors.join(",\n        ")} {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
        }
    `);
    const cleanup = () => removeAmazonTopAds();
    cleanup();
    const observerRoot = document.documentElement || document;
    if (!observerRoot) return;
    const mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (!mutation || mutation.type !== "childList" || !mutation.addedNodes) continue;
        mutation.addedNodes.forEach((node) => {
          removeAmazonTopAdsFromNode(node);
        });
      }
    });
    mutationObserver.observe(observerRoot, {
      childList: true,
      subtree: true
    });
    const stopCleanupObserver = () => mutationObserver.disconnect();
    window.addEventListener("DOMContentLoaded", cleanup, { once: true });
    window.addEventListener("load", () => {
      cleanup();
      window.setTimeout(stopCleanupObserver, 4e3);
    }, { once: true });
    window.setTimeout(stopCleanupObserver, 15e3);
  }
  function injectEditorStyles() {
    _GM_addStyle(`
        #tm-inline-editor {
            position: fixed;
            bottom: 16px;
            right: 16px;
            display: flex;
            align-items: flex-end;
            z-index: 100000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: calc(100vw - 12px);
        }
        .tm-inline-toolbar-panel {
            display: grid;
            grid-auto-flow: column;
            align-items: center;
            gap: 8px;
            padding: 8px;
            border-radius: 10px;
            background: rgba(246, 248, 250, 0.96);
            border: 1px solid #d0d7de;
            box-shadow: 0 8px 24px rgba(140, 149, 159, 0.2);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            max-width: min(520px, calc(100vw - 16px));
        }
        .tm-inline-toolbar-group {
            display: flex;
            align-items: center;
            gap: 6px;
            min-width: 0;
        }
        .tm-inline-toolbar-group-main {
            padding-right: 8px;
            border-right: 1px solid rgba(208, 215, 222, 0.96);
        }
        .tm-inline-toolbar-group-actions {
            flex-wrap: wrap;
            justify-content: flex-end;
        }
        #tm-inline-notifications {
            position: fixed;
            top: 16px;
            right: 16px;
            z-index: 100001;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none;
            width: min(360px, calc(100vw - 24px));
        }
        .tm-inline-notification {
            pointer-events: auto;
            color: #f8fafc;
            padding: 12px 14px;
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.26);
            font-size: 13px;
            line-height: 1.45;
            font-weight: 600;
            letter-spacing: 0.02em;
            box-shadow: 0 14px 28px rgba(2, 6, 23, 0.28);
            backdrop-filter: blur(6px);
            -webkit-backdrop-filter: blur(6px);
            opacity: 0;
            animation: tm-inline-slide-in 0.3s ease forwards;
        }
        .tm-inline-notification-info {
            background: linear-gradient(135deg, rgba(8, 145, 178, 0.95), rgba(14, 116, 144, 0.95));
        }
        .tm-inline-notification-success {
            background: linear-gradient(135deg, rgba(22, 163, 74, 0.95), rgba(21, 128, 61, 0.95));
        }
        .tm-inline-notification-warning {
            background: linear-gradient(135deg, rgba(234, 88, 12, 0.95), rgba(194, 65, 12, 0.95));
        }
        .tm-inline-notification-error {
            background: linear-gradient(135deg, rgba(220, 38, 38, 0.96), rgba(190, 24, 93, 0.96));
        }
        #tm-inline-editor .tm-inline-btn {
            border: 1px solid #d0d7de;
            border-radius: 6px;
            min-width: 0;
            height: 28px;
            padding: 0 10px;
            font-size: 12px;
            line-height: 20px;
            font-weight: 500;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            text-align: center;
            white-space: nowrap;
            color: #24292f;
            background: linear-gradient(#f6f8fa, #f3f4f6);
            box-shadow: 0 1px 0 rgba(27, 31, 36, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.25);
            transition: background 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease, color 0.16s ease, opacity 0.16s ease;
            flex: 0 0 auto;
        }
        #tm-inline-editor .tm-inline-btn-icon {
            width: 12px;
            height: 12px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            flex: 0 0 auto;
        }
        #tm-inline-editor .tm-inline-btn-icon svg {
            width: 12px;
            height: 12px;
            display: block;
            overflow: visible;
        }
        #tm-inline-editor .tm-inline-btn-icon-alt {
            display: none;
        }
        #tm-inline-editor .tm-inline-btn-label {
            display: inline-block;
        }
        #tm-inline-editor .tm-inline-btn:hover {
            background: linear-gradient(#f3f4f6, #ebedf0);
            border-color: #afb8c1;
            box-shadow: 0 1px 0 rgba(27, 31, 36, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.25);
        }
        #tm-inline-editor .tm-inline-btn:active {
            background: #ebecf0;
            box-shadow: inset 0 1px 0 rgba(208, 215, 222, 0.2);
        }
        #tm-inline-editor .tm-inline-btn:focus-visible {
            outline: 2px solid rgba(9, 105, 218, 0.35);
            outline-offset: 0;
            box-shadow: 0 0 0 3px rgba(9, 105, 218, 0.15);
        }
        #tm-inline-editor .tm-inline-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            box-shadow: none;
        }
        #tm-inline-editor .tm-inline-btn:disabled:hover {
            box-shadow: none;
            border-color: #d0d7de;
            background: linear-gradient(#f6f8fa, #f3f4f6);
        }
        #tm-inline-editor .tm-inline-btn.tm-inline-btn-primary {
            color: #ffffff;
            background: linear-gradient(#2da44e, #2c974b);
            border-color: rgba(31, 136, 61, 0.4);
            box-shadow: 0 1px 0 rgba(27, 31, 36, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1);
        }
        #tm-inline-editor .tm-inline-btn.tm-inline-btn-primary:hover {
            background: linear-gradient(#2c974b, #298e46);
            border-color: rgba(31, 136, 61, 0.55);
        }
        #tm-inline-editor .tm-inline-btn.tm-inline-btn-active {
            color: #ffffff;
            background: linear-gradient(#1f883d, #1a7f37);
            border-color: rgba(31, 136, 61, 0.65);
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }
        #tm-inline-editor .tm-inline-btn.tm-inline-btn-warning {
            color: #cf222e;
            background: linear-gradient(#fff8f8, #fff1f0);
            border-color: rgba(207, 34, 46, 0.22);
            box-shadow: none;
        }
        #tm-inline-editor .tm-inline-btn.tm-inline-btn-warning:hover {
            background: linear-gradient(#ffefeb, #ffe6e0);
            border-color: rgba(207, 34, 46, 0.32);
        }
        #tm-inline-editor .tm-inline-btn.tm-inline-btn-ghost {
            background: linear-gradient(#f6f8fa, #f3f4f6);
            color: #24292f;
        }
        #tm-inline-editor .tm-inline-btn.tm-inline-btn-ghost:hover {
            background: linear-gradient(#f3f4f6, #ebedf0);
        }
        #tm-inline-editor .tm-inline-btn.tm-inline-btn-selected {
            color: #0969da;
            background: linear-gradient(#ddf4ff, #d8eefc);
            border-color: rgba(9, 105, 218, 0.24);
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
        }
        #tm-inline-editor .tm-inline-btn.tm-inline-btn-active .tm-inline-btn-icon-default,
        #tm-inline-editor .tm-inline-btn.tm-inline-btn-selected .tm-inline-btn-icon-default {
            display: none;
        }
        #tm-inline-editor .tm-inline-btn.tm-inline-btn-active .tm-inline-btn-icon-alt,
        #tm-inline-editor .tm-inline-btn.tm-inline-btn-selected .tm-inline-btn-icon-alt {
            display: inline-flex;
        }
        .tm-inline-refund-row-hidden {
            opacity: 0 !important;
            pointer-events: none;
        }
        .tm-inline-image-replace-trigger {
            --tm-trigger-size: 22px;
            position: absolute;
            top: 6px;
            right: 6px;
            z-index: 2147483647;
            display: inline-flex!important;
            align-items: center;
            justify-content: center;
            min-width: var(--tm-trigger-size);
            height: var(--tm-trigger-size)!important;
            padding: 0 6px;
            border-radius: 999px;
            background: linear-gradient(135deg, rgba(251, 113, 133, 0.98), rgba(225, 29, 72, 0.98));
            color: #ffffff;
            font-size: 12px;
            font-weight: 700;
            line-height: 1;
            cursor: pointer;
            user-select: none;
            box-shadow: 0 8px 16px rgba(15, 23, 42, 0.34);
            transition: transform 0.2s ease, filter 0.2s ease, box-shadow 0.2s ease;
        }
        .tm-inline-image-replace-trigger:hover {
            transform: translateY(-1px);
            filter: brightness(1.06);
        }
        .tm-inline-image-replace-trigger:focus {
            outline: 2px solid rgba(14, 165, 233, 0.95);
            outline-offset: 2px;
        }
        .tm-inline-text-dialog-trigger {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 24px;
            height: 24px;
            margin-left: 6px;
            padding: 0 8px;
            border: none;
            border-radius: 999px;
            vertical-align: middle;
            color: #ffffff;
            background: linear-gradient(135deg, #198754, #157347);
            box-shadow: 0 6px 14px rgba(21, 128, 61, 0.24);
            font-size: 12px;
            font-weight: 700;
            line-height: 1;
            cursor: pointer;
            transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
        }
        .tm-inline-text-dialog-trigger:hover {
            transform: translateY(-1px);
            filter: brightness(1.03);
            box-shadow: 0 8px 18px rgba(21, 128, 61, 0.3);
        }
        .tm-inline-text-dialog-trigger:focus {
            outline: 2px solid rgba(14, 165, 233, 0.95);
            outline-offset: 2px;
        }
        #altImages .tm-inline-image-replace-trigger,
        li.imageThumbnail .tm-inline-image-replace-trigger {
            --tm-trigger-size: 16px;
            top: 2px;
            right: 2px;
            padding: 0 4px;
            font-size: 10px;
        }
        .tm-inline-thumb-fixed-image {
            display: block;
            box-sizing: border-box;
            width: var(--tm-thumb-w, 40px) !important;
            height: var(--tm-thumb-h, 40px) !important;
            min-width: var(--tm-thumb-w, 40px) !important;
            min-height: var(--tm-thumb-h, 40px) !important;
            max-width: var(--tm-thumb-w, 40px) !important;
            max-height: var(--tm-thumb-h, 40px) !important;
            object-fit: cover !important;
            object-position: center center !important;
        }
        .tm-inline-main-fixed-image {
            image-rendering: auto;
        }
        @media (max-width: 640px) {
            #tm-inline-editor {
                bottom: 12px;
                right: 12px;
                max-width: calc(100vw - 24px);
            }
            .tm-inline-toolbar-panel {
                grid-auto-flow: row;
                justify-items: end;
                max-width: min(340px, calc(100vw - 24px));
                gap: 6px;
                padding: 7px;
            }
            .tm-inline-toolbar-group-main {
                padding-right: 0;
                border-right: none;
            }
            #tm-inline-editor .tm-inline-btn {
                height: 26px;
                padding: 0 9px;
                font-size: 11px;
                gap: 5px;
            }
            #tm-inline-editor .tm-inline-btn-icon,
            #tm-inline-editor .tm-inline-btn-icon svg {
                width: 11px;
                height: 11px;
            }
            #tm-inline-notifications {
                top: auto;
                right: 10px;
                left: 10px;
                bottom: 68px;
                width: auto;
            }
            .tm-inline-notification {
                font-size: 12px;
                padding: 10px 12px;
            }
        }
        .tm-inline-editing {
            outline: 2px dashed rgba(13, 110, 253, 0.85);
            outline-offset: 2px;
            background-color: rgba(13, 110, 253, 0.08);
            transition: background-color 0.2s ease, outline-color 0.2s ease;
        }
        .tm-inline-editing:focus {
            background-color: rgba(13, 110, 253, 0.18);
            outline-color: rgba(25, 135, 84, 0.85);
        }
        @keyframes tm-inline-slide-in {
            from { opacity: 0; transform: translateX(120%); }
            to { opacity: 1; transform: translateX(0); }
        }
        @keyframes tm-inline-slide-out {
            from { opacity: 1; transform: translateX(0); }
            to { opacity: 0; transform: translateX(120%); }
        }
    `);
  }
  const amazonRetailHostPattern = /(^|\.)amazon\.(?:com|[a-z]{2,3}|com\.[a-z]{2}|co\.[a-z]{2})$/i;
  const currentHostname = window.location && window.location.hostname ? window.location.hostname : "";
  if (!amazonRetailHostPattern.test(currentHostname)) {
    console.warn("Amazon 页面元素内联编辑助手（含顶部广告移除）: 非亚马逊页面，未启动。");
  } else {
    let bootstrapInlineEditor = function() {
      if (bootstrapInlineEditor.started) return;
      bootstrapInlineEditor.started = true;
      injectEditorStyles();
      const storage = new StorageManager();
      const notification = new NotificationManager();
      const fieldConfigs = storage.getDefaultList();
      const valueMap = storage.loadValueMap();
      const textObserver = new TextObserver([]);
      const inlineEditManager = new InlineEditManager(storage, notification, textObserver, fieldConfigs, valueMap);
      try {
        window.tmInlineEditor = inlineEditManager;
        if (typeof _unsafeWindow !== "undefined") {
          _unsafeWindow.tmInlineEditor = inlineEditManager;
        }
      } catch (error) {
        console.warn("无法注入 tmInlineEditor 实例:", error);
      }
      setTimeout(() => {
        textObserver.start();
        console.log("🚀 Amazon 页面文字编辑器已加载");
      }, 800);
      window.addEventListener("beforeunload", () => {
        textObserver.stop();
      });
    };
    startAmazonTopAdCleanup();
    if (document.readyState === "loading") {
      window.addEventListener("DOMContentLoaded", bootstrapInlineEditor, { once: true });
    } else {
      bootstrapInlineEditor();
    }
  }

})();