import { GM_addStyle, unsafeWindow } from '$';

import { resolveChargeSummaryElements } from '../features/resolvers.js';
import {
    applyImageSource,
    collectElementsFromConfig,
    extractElementValue,
    getConfigSelectorList,
    getConfigWatchSelectorList,
    getEditedElementWithChangedValue,
    isEqualValue,
    pickPreferredValueElement,
    shouldAllowAnchorInteraction
} from './utils.js';

export class InlineEditManager {
    constructor(storage, notification, textObserver, fieldConfigs, initialValueMap = {}) {
        this.storage = storage;
        this.notification = notification;
        this.textObserver = textObserver;
        this.fieldConfigs = Array.isArray(fieldConfigs) ? fieldConfigs : [];
        this.valueMap = initialValueMap && typeof initialValueMap === 'object' ? { ...initialValueMap } : {};
        this.isEditing = false;
        this.hidden = this.storage.loadPersistent('hidden', false) === true;
        this.refundRowHidden = this.storage.loadPersistent('refundRowHidden', false) === true;
        this.boundAnchorInterceptor = (event) => this.handleAnchorClick(event);
        this.editedElements = new Map();
        this.initialEditLabel = '编辑';
        this.imageInput = null;
        this.activeImageElement = null;
        this.pageKey = this.getPageKey();
        this.originalDocumentTitle = document.title || '';
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
        this.injectShowFunction();
        this.applyStoredDocumentTitle();

        if (this.toggleBtn) {
            this.initialEditLabel = this.toggleBtn.textContent || this.initialEditLabel;
        }

        if (this.textObserver && typeof this.textObserver.setDataResolver === 'function') {
            this.textObserver.setDataResolver(() => this.getRuntimeDataList());
        }

        if (this.hidden) {
            this.container.style.display = 'none';
            console.log('🫥 编辑按钮已隐藏，可在控制台执行 show() 恢复');
        }
    }

    createUI() {
        this.container = document.createElement('div');
        this.container.id = 'tm-inline-editor';
        this.container.innerHTML = `
            <div id="tm-inline-toolbar-panel" class="tm-inline-toolbar-panel">
                <div class="tm-inline-toolbar-panel-header">
                    <div class="tm-inline-toolbar-title">Amazon 编辑助手</div>
                    <div class="tm-inline-toolbar-subtitle">悬停或点击右下角按钮，展开全部功能</div>
                </div>
                <button type="button" id="tm-edit-toggle" class="tm-inline-btn tm-inline-btn-primary">编辑</button>
                <button type="button" id="tm-edit-title" class="tm-inline-btn tm-inline-btn-ghost" title="弹窗修改网站标题">修改标题</button>
                <button type="button" id="tm-edit-toggle-refund" class="tm-inline-btn tm-inline-btn-ghost" title="切换退款总计行显示">隐藏退款行</button>
                <button type="button" id="tm-edit-reset" class="tm-inline-btn tm-inline-btn-warning" title="删除所有保存的值并刷新页面">重置</button>
                <button type="button" id="tm-edit-hide" class="tm-inline-btn tm-inline-btn-ghost" title="隐藏编辑按钮">隐藏按钮</button>
            </div>
            <button
                type="button"
                id="tm-inline-toolbar-trigger"
                class="tm-inline-toolbar-trigger"
                aria-expanded="false"
                aria-controls="tm-inline-toolbar-panel"
                title="展开功能面板"
            >工具</button>
        `;
        document.body.appendChild(this.container);

        this.toggleBtn = this.container.querySelector('#tm-edit-toggle');
        this.titleEditBtn = this.container.querySelector('#tm-edit-title');
        this.refundToggleBtn = this.container.querySelector('#tm-edit-toggle-refund');
        this.resetBtn = this.container.querySelector('#tm-edit-reset');
        this.hideBtn = this.container.querySelector('#tm-edit-hide');
        this.toolbarTriggerBtn = this.container.querySelector('#tm-inline-toolbar-trigger');
    }

    attachEvents() {
        if (this.toggleBtn) {
            this.toggleBtn.addEventListener('click', () => this.handleEditButtonClick());
        }
        if (this.titleEditBtn) {
            this.titleEditBtn.addEventListener('click', () => this.handleTitleEdit());
        }
        if (this.resetBtn) {
            this.resetBtn.addEventListener('click', () => this.handleReset());
        }
        if (this.refundToggleBtn) {
            this.refundToggleBtn.addEventListener('click', () => this.toggleRefundRowVisibility());
        }
        if (this.hideBtn) {
            this.hideBtn.addEventListener('click', () => this.hideButton());
        }
        if (this.toolbarTriggerBtn) {
            this.toolbarTriggerBtn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.togglePanelOpen();
            });
        }
        document.addEventListener('click', this.boundOutsideClickHandler);
    }

    setPanelOpen(nextOpen) {
        this.panelOpen = Boolean(nextOpen);
        if (this.container) {
            this.container.classList.toggle('tm-inline-panel-open', this.panelOpen);
        }
        if (this.toolbarTriggerBtn) {
            this.toolbarTriggerBtn.setAttribute('aria-expanded', this.panelOpen ? 'true' : 'false');
        }
    }

    togglePanelOpen(force) {
        const nextOpen = typeof force === 'boolean' ? force : !this.panelOpen;
        this.setPanelOpen(nextOpen);
    }

    handleOutsideClick(event) {
        if (!this.panelOpen) return;
        const target = event.target;
        if (target instanceof Node && this.container && this.container.contains(target)) {
            return;
        }
        this.setPanelOpen(false);
    }

    setupImageInput() {
        if (this.imageInput) return;
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.style.display = 'none';
        input.addEventListener('change', async () => {
            const file = input.files && input.files[0];
            if (!file || !this.activeImageElement) {
                this.activeImageElement = null;
                input.value = '';
                return;
            }
            try {
                const dataUrl = await this.readFileAsDataUrl(file);
                if (typeof dataUrl !== 'string') {
                    throw new Error('无效图片数据');
                }
                applyImageSource(this.activeImageElement, dataUrl);
                this.notification.show('图片已更新，点击“完成”保存。', 'success');
            } catch (error) {
                console.error('读取图片失败:', error);
                this.notification.show('图片读取失败，请重试。', 'error');
            } finally {
                this.activeImageElement = null;
                input.value = '';
            }
        });
        document.body.appendChild(input);
        this.imageInput = input;
    }

    readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error || new Error('读取失败'));
            reader.readAsDataURL(file);
        });
    }

    handleEditButtonClick() {
        this.setPanelOpen(false);
        if (this.isEditing) {
            this.exitEditMode(true);
            return;
        }

        this.enterEditMode();
    }

    getDocumentTitleStorageKey() {
        return this.buildStorageKeyFromSuffix('document_title');
    }

    getStoredDocumentTitle() {
        const storageKey = this.getDocumentTitleStorageKey();
        if (!storageKey) return '';
        const storedTitle = this.valueMap[storageKey];
        return typeof storedTitle === 'string' ? storedTitle.trim() : '';
    }

    applyDocumentTitle(title) {
        const nextTitle = typeof title === 'string' && title.trim()
            ? title.trim()
            : this.originalDocumentTitle;
        if (!nextTitle) return;
        document.title = nextTitle;
        const titleElement = document.querySelector('title');
        if (titleElement && titleElement.textContent !== nextTitle) {
            titleElement.textContent = nextTitle;
        }
    }

    applyStoredDocumentTitle() {
        const storedTitle = this.getStoredDocumentTitle();
        if (storedTitle) {
            this.applyDocumentTitle(storedTitle);
        }
    }

    handleTitleEdit() {
        this.setPanelOpen(false);
        const storageKey = this.getDocumentTitleStorageKey();
        if (!storageKey) {
            this.notification.show('标题保存键生成失败。', 'error');
            return;
        }

        const currentTitle = this.getStoredDocumentTitle() || document.title || this.originalDocumentTitle;
        const input = window.prompt(
            '请输入新的页面标题。\n留空并确认可恢复默认标题。',
            currentTitle
        );

        if (input === null) return;

        const nextTitle = input.trim();
        if (nextTitle) {
            const previousTitle = this.valueMap[storageKey];
            this.valueMap[storageKey] = nextTitle;
            const saved = this.storage.saveValueMap(this.valueMap);
            if (saved) {
                this.applyDocumentTitle(nextTitle);
                this.notification.show('页面标题已更新。', 'success');
                return;
            }

            if (previousTitle === undefined) {
                delete this.valueMap[storageKey];
            } else {
                this.valueMap[storageKey] = previousTitle;
            }
            this.notification.show('标题保存失败，请查看控制台。', 'error');
            return;
        }

        const hadCustomTitle = Object.prototype.hasOwnProperty.call(this.valueMap, storageKey);
        const previousTitle = this.valueMap[storageKey];
        delete this.valueMap[storageKey];

        const saved = hadCustomTitle ? this.storage.saveValueMap(this.valueMap) : true;
        if (saved) {
            this.applyDocumentTitle(this.originalDocumentTitle);
            this.notification.show(hadCustomTitle ? '已恢复默认标题。' : '当前没有自定义标题。', hadCustomTitle ? 'success' : 'info');
            return;
        }

        if (previousTitle !== undefined) {
            this.valueMap[storageKey] = previousTitle;
        }
        this.notification.show('标题恢复失败，请查看控制台。', 'error');
    }

    refreshButtonStates() {
        if (this.toggleBtn) {
            this.toggleBtn.textContent = this.isEditing ? '完成' : this.initialEditLabel;
            this.toggleBtn.disabled = false;
        }
    }

    applyRefundRowState(updateLabel = false) {
        document.querySelectorAll('.tm-inline-refund-row-hidden').forEach((row) => {
            row.classList.remove('tm-inline-refund-row-hidden');
        });

        if (this.refundRowHidden) {
            resolveChargeSummaryElements('charge_refund_total', 'row').forEach((row) => {
                row.classList.add('tm-inline-refund-row-hidden');
            });
        }

        if (updateLabel && this.refundToggleBtn) {
            this.refundToggleBtn.textContent = this.refundRowHidden ? '显示退款行' : '隐藏退款行';
        }
    }

    toggleRefundRowVisibility() {
        this.setPanelOpen(false);
        this.refundRowHidden = !this.refundRowHidden;
        this.storage.savePersistent('refundRowHidden', this.refundRowHidden);
        this.applyRefundRowState(true);
        this.notification.show(this.refundRowHidden ? '已隐藏退款总计行。' : '已显示退款总计行。', 'info');
    }

    enterEditMode() {
        if (this.isEditing) return;
        this.textObserver.stop();
        this.isEditing = true;
        document.body.classList.add('tm-editing-mode');
        if (this.toggleBtn) {
            this.toggleBtn.classList.add('tm-inline-btn-active');
        }
        this.refreshButtonStates();
        document.addEventListener('click', this.boundAnchorInterceptor, true);

        const elements = this.collectTargetElements();
        elements.forEach(({ element, config }) => this.makeEditable(element, config));
        this.startEditMutationObserver();

        if (elements.length === 0) {
            this.notification.show('未找到可编辑的元素，请检查选择器配置。', 'warning');
        } else {
            this.notification.show('编辑模式已开启：可直接改文字；点击图片角标“换”可替换，左键预览保留。', 'info');
        }
    }

    exitEditMode(saveChanges = true) {
        if (!this.isEditing) return;

        try {
            if (saveChanges) {
                const values = this.collectEditedValues();
                let dirty = false;
                Object.entries(values).forEach(([key, value]) => {
                    if (!isEqualValue(this.valueMap[key], value)) {
                        this.valueMap[key] = value;
                        dirty = true;
                    }
                });

                const saved = dirty ? this.storage.saveValueMap(this.valueMap) : true;
                if (saved) {
                    this.notification.show(dirty ? '修改已保存并应用。' : '没有检测到新的修改。', dirty ? 'success' : 'info');
                } else {
                    this.notification.show('保存失败，请查看控制台。', 'error');
                }
            } else {
                this.notification.show('已退出编辑模式，修改未保存。', 'info');
            }
        } catch (error) {
            console.error('退出编辑模式失败:', error);
            this.notification.show('保存失败，请查看控制台。', 'error');
        } finally {
            this.isEditing = false;
            document.body.classList.remove('tm-editing-mode');
            try {
                this.restoreElements();
            } catch (error) {
                console.warn('恢复元素状态失败:', error);
            }
            try {
                this.cleanupLooseEditingMarks();
            } catch (error) {
                console.warn('清理残留标记失败:', error);
            }
            const activeElement = document.activeElement;
            if (activeElement && activeElement instanceof HTMLElement) {
                activeElement.blur();
            }
            this.stopEditMutationObserver();
            document.removeEventListener('click', this.boundAnchorInterceptor, true);
            if (this.toggleBtn) {
                this.toggleBtn.classList.remove('tm-inline-btn-active');
            }
            this.refreshButtonStates();
            if (this.textObserver) {
                this.textObserver.start();
            }
        }
    }

    hideButton() {
        this.setPanelOpen(false);
        if (this.isEditing) {
            this.exitEditMode(false);
        }
        this.hidden = true;
        document.body.classList.remove('tm-editing-mode');
        this.storage.savePersistent('hidden', true);
        this.container.style.display = 'none';
        this.notification.show('编辑按钮已隐藏，在控制台执行 show() 可重新显示。', 'info');
    }

    showButton() {
        this.setPanelOpen(false);
        this.hidden = false;
        this.storage.savePersistent('hidden', false);
        this.container.style.display = 'flex';
        this.refreshButtonStates();
        console.log('✅ 编辑按钮已显示');
    }

    handleReset() {
        this.setPanelOpen(false);
        const confirmed = window.confirm('确定要删除所有保存的内容并刷新页面吗？');
        if (!confirmed) return;

        if (this.isEditing) {
            this.exitEditMode(false);
        }

        const cleared = this.storage.clearValueMap();
        if (cleared) {
            this.valueMap = {};
            this.applyDocumentTitle(this.originalDocumentTitle);
            this.notification.show('已清除所有保存内容，页面即将刷新。', 'warning');
            setTimeout(() => window.location.reload(), 600);
        } else {
            this.notification.show('重置失败，请查看控制台。', 'error');
        }
    }

    collectTargetElements() {
        const targets = [];
        const seen = new Set();

        this.fieldConfigs.forEach((item) => {
            const elements = this.resolveElementsFromConfig(item);
            elements.forEach((element) => {
                if (!element || seen.has(element)) return;
                seen.add(element);
                targets.push({ element, config: item });
            });
        });

        return targets;
    }

    buildEditWatchSelectorText() {
        const selectors = [];
        const seen = new Set();

        this.fieldConfigs.forEach((config) => {
            this.getWatchSelectorsFromConfig(config)
                .filter(Boolean)
                .forEach((selector) => {
                    if (seen.has(selector)) return;
                    seen.add(selector);
                    selectors.push(selector);
                });
        });

        return selectors.join(', ');
    }

    nodeTouchesEditTarget(node) {
        if (!(node instanceof Element)) return false;
        if (!this.editWatchSelectorText) return true;

        try {
            if (typeof node.matches === 'function' && node.matches(this.editWatchSelectorText)) {
                return true;
            }
            if (typeof node.closest === 'function' && node.closest(this.editWatchSelectorText)) {
                return true;
            }
            if (typeof node.querySelector === 'function' && node.querySelector(this.editWatchSelectorText)) {
                return true;
            }
        } catch (error) {
            console.warn('检查编辑区变更节点时选择器执行失败:', error);
            return true;
        }

        return false;
    }

    hasRelevantEditMutations(mutations) {
        for (const mutation of mutations) {
            if (!mutation || mutation.type !== 'childList') continue;
            if (this.hasRelevantEditNodes(mutation.addedNodes) || this.hasRelevantEditNodes(mutation.removedNodes)) {
                return true;
            }
        }
        return false;
    }

    hasRelevantEditNodes(nodeList) {
        if (!nodeList || nodeList.length === 0) return false;

        for (const node of nodeList) {
            if (!(node instanceof Element)) continue;
            if (node.id === 'tm-inline-editor' || node.id === 'tm-inline-notifications') continue;
            if (typeof node.closest === 'function') {
                if (node.closest('#tm-inline-editor') || node.closest('#tm-inline-notifications')) {
                    continue;
                }
            }
            if (this.nodeTouchesEditTarget(node)) {
                return true;
            }
        }

        return false;
    }

    scheduleEditableSync(delay = this.editMutationDebounceMs) {
        if (!this.isEditing || this.pendingEditableSyncTimer) return;

        this.pendingEditableSyncTimer = setTimeout(() => {
            this.pendingEditableSyncTimer = null;
            this.syncEditableTargets();
        }, delay);
    }

    syncEditableTargets() {
        if (!this.isEditing) return;
        this.collectTargetElements().forEach(({ element, config }) => {
            this.makeEditable(element, config);
        });
    }

    startEditMutationObserver() {
        if (this.editMutationObserver || !document.body) return;

        this.editMutationObserver = new MutationObserver((mutations) => {
            if (!this.isEditing) return;
            if (!this.hasRelevantEditMutations(mutations)) return;
            this.scheduleEditableSync(this.editMutationDebounceMs);
        });

        this.editMutationObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    stopEditMutationObserver() {
        if (this.editMutationObserver) {
            this.editMutationObserver.disconnect();
            this.editMutationObserver = null;
        }
        if (this.pendingEditableSyncTimer) {
            clearTimeout(this.pendingEditableSyncTimer);
            this.pendingEditableSyncTimer = null;
        }
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
        if (!config) return null;
        const suffixSource = config.keySuffix ||
            (Array.isArray(config.selector) ? config.selector[0] : config.selector);
        const suffix = typeof suffixSource === 'string' ? suffixSource.trim() : '';
        if (!suffix) return null;

        return `${this.pageKey}__${suffix}`;
    }

    buildStorageKeyFromSuffix(keySuffix) {
        const suffix = typeof keySuffix === 'string' ? keySuffix.trim() : '';
        return suffix ? `${this.pageKey}__${suffix}` : null;
    }

    migrateLegacyFieldStorage() {
        const migrations = [
            {
                from: 'brand',
                to: ['brand_offer_display', 'brand_product_overview']
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
            if (value === undefined || value === null) {
                return result;
            }

            result.push({
                keySuffix: config.keySuffix,
                selector: this.getSelectorsFromConfig(config),
                watchSelectors: this.getWatchSelectorsFromConfig(config),
                resolveElements: typeof config.resolveElements === 'function'
                    ? () => this.resolveElementsFromConfig(config)
                    : undefined,
                multiple: Boolean(config.multiple),
                type: config.type,
                value
            });
            return result;
        }, []);
    }

    getPageKey() {
        try {
            const href = window.location && window.location.href ? window.location.href : '';
            const clean = href.split('#')[0] || href;
            return encodeURIComponent(clean);
        } catch (error) {
            console.warn('获取页面地址失败:', error);
            return 'unknown_page';
        }
    }

    collectEditedValues() {
        const values = {};

        this.fieldConfigs.forEach((config) => {
            const storageKey = this.buildStorageKey(config);
            if (!storageKey) {
                return;
            }

            const elements = this.resolveElementsFromConfig(config);

            if (config.multiple) {
                if (elements.length > 0) {
                    values[storageKey] = elements.map((element) => extractElementValue(element));
                }
                return;
            }

            const changedElement = getEditedElementWithChangedValue(elements, this.editedElements);
            const preferredElement = changedElement || pickPreferredValueElement(elements);
            if (!preferredElement) {
                return;
            }

            const value = extractElementValue(preferredElement);
            if (value !== undefined && value !== null) {
                values[storageKey] = value;
            }
        });

        return values;
    }

    findImageTriggerHost(element) {
        if (!(element instanceof HTMLElement)) return null;

        const host = element.closest('#imgTagWrapperId, .imgTagWrapper, li.imageThumbnail, [data-component="itemImage"], .a-button-text, .a-list-item');
        if (host instanceof HTMLElement) {
            return host;
        }

        return element.parentElement instanceof HTMLElement ? element.parentElement : null;
    }

    makeEditable(element, config) {
        if (!element || this.editedElements.has(element)) return;

        const isImageElement = element instanceof HTMLImageElement;
        const isImage = (config && config.type === 'image' && isImageElement) || isImageElement;
        const isInput = !isImage && (element instanceof HTMLInputElement ||
            element instanceof HTMLTextAreaElement ||
            element instanceof HTMLSelectElement);
        const noHighlight = Boolean(config && config.noHighlight);

        const state = {
            element,
            isImage,
            isInput,
            noHighlight,
            originalValue: extractElementValue(element),
            disabled: isInput ? element.disabled : undefined,
            readOnly: isInput ? element.readOnly : undefined,
            originalReadonlyAttr: isInput ? element.getAttribute('readonly') : null,
            originalDisabledAttr: isInput ? element.getAttribute('disabled') : null,
            contentEditable: isInput ? null : element.getAttribute('contenteditable'),
            originalCursor: isImage ? element.style.cursor : undefined,
            originalTitle: isImage ? element.getAttribute('title') : null,
            imageTrigger: null,
            imageTriggerHost: null,
            imageTriggerHostPosition: null,
            imageTriggerHostPositionAdjusted: false,
            imageTriggerClickHandler: null,
            imageTriggerKeyHandler: null
        };

        if (isImage) {
            const openReplaceDialog = (event) => {
                if (event) {
                    event.preventDefault();
                    event.stopPropagation();
                    if (typeof event.stopImmediatePropagation === 'function') {
                        event.stopImmediatePropagation();
                    }
                }
                if (!this.imageInput) return;
                this.activeImageElement = element;
                this.imageInput.value = '';
                this.imageInput.click();
            };

            const keyHandler = (event) => {
                if (!event) return;
                if (event.key === 'Enter' || event.key === ' ') {
                    openReplaceDialog(event);
                }
            };

            const host = this.findImageTriggerHost(element);
            if (host) {
                const trigger = document.createElement('span');
                trigger.className = 'tm-inline-image-replace-trigger';
                trigger.textContent = '换';
                trigger.setAttribute('role', 'button');
                trigger.setAttribute('tabindex', '0');
                trigger.setAttribute('aria-label', '替换图片');

                const computed = window.getComputedStyle(host).position;
                state.imageTriggerHostPosition = host.style.position;
                if (!computed || computed === 'static') {
                    host.style.position = 'relative';
                    state.imageTriggerHostPositionAdjusted = true;
                }
                trigger.addEventListener('click', openReplaceDialog, true);
                trigger.addEventListener('keydown', keyHandler, true);
                host.appendChild(trigger);
                state.imageTrigger = trigger;
                state.imageTriggerHost = host;
                state.imageTriggerClickHandler = openReplaceDialog;
                state.imageTriggerKeyHandler = keyHandler;
            } else {
                element.addEventListener('contextmenu', openReplaceDialog, true);
                state.imageTriggerClickHandler = openReplaceDialog;
            }

            element.style.cursor = 'zoom-in';
            element.setAttribute('title', host ? '左键预览，点“换”角标替换图片' : '左键预览，右键替换图片');
        } else if (isInput) {
            element.disabled = false;
            element.readOnly = false;
            element.removeAttribute('readonly');
            element.removeAttribute('disabled');
        } else {
            element.setAttribute('contenteditable', 'true');
        }

        element.dataset.tmInlineEditing = '1';
        if (!noHighlight) {
            element.classList.add('tm-inline-editing');
        }
        this.editedElements.set(element, state);
    }

    restoreElements() {
        this.editedElements.forEach((state, element) => {
            if (!element) return;
            delete element.dataset.tmInlineEditing;
            element.removeAttribute('data-tm-inline-editing');
            element.classList.remove('tm-inline-editing');

            if (state.isInput) {
                element.disabled = state.disabled;
                element.readOnly = state.readOnly;

                if (state.originalReadonlyAttr !== null) {
                    element.setAttribute('readonly', state.originalReadonlyAttr);
                } else {
                    element.removeAttribute('readonly');
                }

                if (state.originalDisabledAttr !== null) {
                    element.setAttribute('disabled', state.originalDisabledAttr);
                } else {
                    element.removeAttribute('disabled');
                }
            } else if (state.isImage) {
                if (state.imageTrigger) {
                    if (state.imageTriggerClickHandler) {
                        state.imageTrigger.removeEventListener('click', state.imageTriggerClickHandler, true);
                    }
                    if (state.imageTriggerKeyHandler) {
                        state.imageTrigger.removeEventListener('keydown', state.imageTriggerKeyHandler, true);
                    }
                    state.imageTrigger.remove();
                } else if (state.imageTriggerClickHandler) {
                    element.removeEventListener('contextmenu', state.imageTriggerClickHandler, true);
                }
                if (state.imageTriggerHost && state.imageTriggerHostPositionAdjusted) {
                    state.imageTriggerHost.style.position = state.imageTriggerHostPosition || '';
                }
                if (state.originalCursor !== undefined) {
                    element.style.cursor = state.originalCursor;
                }
                if (state.originalTitle !== null) {
                    element.setAttribute('title', state.originalTitle);
                } else {
                    element.removeAttribute('title');
                }
            } else if (state.contentEditable === null || state.contentEditable === undefined) {
                element.removeAttribute('contenteditable');
            } else {
                element.setAttribute('contenteditable', state.contentEditable);
            }
        });

        this.editedElements.clear();
        this.activeImageElement = null;
        if (this.imageInput) {
            this.imageInput.value = '';
        }
        this.cleanupLooseEditingMarks();
    }

    cleanupLooseEditingMarks(root = document) {
        try {
            const scope = root && typeof root.querySelectorAll === 'function' ? root : document;
            scope.querySelectorAll('[data-tm-inline-editing], .tm-inline-editing').forEach((node) => {
                if (!(node instanceof HTMLElement)) return;
                node.classList.remove('tm-inline-editing');
                node.removeAttribute('data-tm-inline-editing');
                if (node.isContentEditable) {
                    node.removeAttribute('contenteditable');
                    node.contentEditable = 'inherit';
                }
            });
        } catch (error) {
            console.warn('清理残留编辑标记失败:', error);
        }
    }

    handleAnchorClick(event) {
        if (!this.isEditing) return;
        const replaceTrigger = event.target && event.target.closest && event.target.closest('.tm-inline-image-replace-trigger');
        if (replaceTrigger) return;
        const anchor = event.target && event.target.closest('a');
        if (!anchor) return;
        if (shouldAllowAnchorInteraction(anchor)) return;
        const editingImage = event.target && event.target.closest('img[data-tm-inline-editing="1"]');
        if (editingImage) return;
        if (this.container && this.container.contains(anchor)) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
    }

    injectShowFunction() {
        const showHandler = () => this.showButton();

        try {
            window.show = showHandler;
        } catch (error) {
            console.warn('无法将 show() 注入 window:', error);
        }

        if (typeof unsafeWindow !== 'undefined') {
            try {
                unsafeWindow.show = showHandler;
            } catch (error) {
                console.warn('无法将 show() 注入 unsafeWindow:', error);
            }
        }

        document.addEventListener('tm-inline-editor-show', showHandler);

        try {
            const script = document.createElement('script');
            script.textContent = `
                (function () {
                    const trigger = function () {
                        document.dispatchEvent(new CustomEvent('tm-inline-editor-show'));
                    };
                    window.show = trigger;
                    window.tmInlineEditor = Object.assign({}, window.tmInlineEditor || {}, { show: trigger });
                    console.log('✅ show() 函数已注入，执行 show() 可显示编辑按钮');
                })();
            `;
            document.documentElement.appendChild(script);
            script.remove();
        } catch (error) {
            console.warn('注入 show() 脚本失败:', error);
        }
    }

    setupDynamicStyles() {
        const rules = [];
        this.fieldConfigs.forEach((config) => {
            if (config.hideInView) {
                const selectors = this.getWatchSelectorsFromConfig(config);
                selectors.forEach((selector) => {
                    rules.push(`body:not(.tm-editing-mode) ${selector} { display: none !important; }`);
                });
            }
        });

        if (rules.length > 0) {
            GM_addStyle(rules.join('\n'));
        }
    }
}
