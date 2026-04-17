import { collectElementsFromConfig, getConfigSelectorList, getConfigWatchSelectorList } from './utils.js';
import { buildStorageKey, buildStorageKeyFromSuffix } from './storage-key.js';
import { isDebugEnabled, setDebugEnabled } from './debug.js';
import {
    applyDocumentTitle,
    applyStoredDocumentTitle,
    getDocumentTitleStorageKey,
    getStoredDocumentTitle,
    handleTitleEdit
} from './document-title.js';
import {
    attachPanelEvents,
    createEditorUI,
    handleOutsideClick,
    setPanelOpen,
    setupDynamicStyles,
    togglePanelOpen
} from './inline-edit-panel.js';
import {
    applyRefundRowState,
    buildEditWatchSelectorText,
    cleanupLooseEditingMarks,
    collectEditedValues,
    collectTargetElements,
    enterEditMode,
    exitEditMode,
    handleAnchorClick,
    handleEditButtonClick,
    handleReset,
    hideButton,
    makeEditable,
    readFileAsDataUrl,
    refreshButtonStates,
    restoreElements,
    scheduleEditableSync,
    setupImageInput,
    showButton,
    startEditMutationObserver,
    stopEditMutationObserver,
    syncEditableTargets,
    toggleRefundRowVisibility,
    hasRelevantEditMutations,
    hasRelevantEditNodes,
    nodeTouchesEditTarget
} from './inline-edit-session.js';

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
        this.applyStoredDocumentTitle();

        if (this.toggleBtn) {
            this.initialEditLabel = this.toggleBtn.textContent?.trim() || this.initialEditLabel;
        }

        if (this.textObserver && typeof this.textObserver.setDataResolver === 'function') {
            this.textObserver.setDataResolver(() => this.getRuntimeDataList());
        }

        if (this.hidden) {
            this.container.style.display = 'none';
            console.log('🫥 编辑按钮已隐藏，可在控制台执行 tmInlineEditor.show() 恢复');
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
        console.log(updated
            ? '🔎 调试日志已开启，刷新页面后可看到更完整的 tm-inline 日志。'
            : '⚠️ 当前环境无法开启调试日志。');
        return updated;
    }

    disableDebug() {
        const updated = setDebugEnabled(false);
        console.log(updated
            ? '🔕 调试日志已关闭。'
            : '⚠️ 当前环境无法关闭调试日志。');
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
                getValue: typeof config.getValue === 'function' ? config.getValue : undefined,
                setValue: typeof config.setValue === 'function' ? config.setValue : undefined,
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
