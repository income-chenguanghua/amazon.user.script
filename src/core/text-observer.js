import {
    applyElementValue,
    collectElementsFromConfig,
    getConfigSelectorList,
    getConfigWatchSelectorList
} from './utils.js';
import { logDebug, summarizeMutations } from './debug.js';
import { hasRelevantMutationsForSelector, hasRelevantNodesForSelector, nodeTouchesSelectorText } from './dom-watch-utils.js';

export class TextObserver {
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
        this.fallbackIntervalMs = 20000;
        this.activeSelectorText = '';
    }

    start() {
        if (this.isActive) return;
        this.refreshDataList();
        if (!this.hasActiveData()) return;
        this.isActive = true;
        this.scheduleApply(0);
        this.setupMutationObserver();
        this.startIntervalChecker();
        console.log('🔍 文本观察者已启动');
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
        if (this.pendingFrameId !== null && typeof cancelAnimationFrame === 'function') {
            cancelAnimationFrame(this.pendingFrameId);
            this.pendingFrameId = null;
        }
        console.log('⏹️ 文本观察者已停止');
    }

    setDataResolver(resolver) {
        if (typeof resolver === 'function') {
            this.dataResolver = resolver;
            this.refreshDataList();
        } else {
            this.dataResolver = null;
            this.dataList = [];
            this.activeSelectorText = '';
        }
    }

    #safeResolveData() {
        if (!this.dataResolver) return null;
        try {
            const resolved = this.dataResolver();
            return Array.isArray(resolved) ? resolved : null;
        } catch (error) {
            console.warn('数据解析函数执行失败:', error);
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
        if (!Array.isArray(dataList) || dataList.length === 0) return '';

        const selectors = [];
        const seen = new Set();

        dataList.forEach((item) => {
            const selectorList = getConfigWatchSelectorList(item);
            selectorList
                .filter(Boolean)
                .forEach((selector) => {
                    if (seen.has(selector)) return;
                    seen.add(selector);
                    selectors.push(selector);
                });
        });

        return selectors.join(', ');
    }

    scheduleApply(delay = this.mutationDebounceMs) {
        if (!this.isActive) return;
        if (this.pendingApplyTimer) return;

        const elapsed = Date.now() - this.lastApplyAt;
        const throttleWait = elapsed >= this.minApplyIntervalMs
            ? 0
            : (this.minApplyIntervalMs - elapsed);
        const wait = Math.max(delay, throttleWait);

        this.pendingApplyTimer = setTimeout(() => {
            this.pendingApplyTimer = null;
            if (!this.isActive) return;

            if (typeof requestAnimationFrame === 'function') {
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
            '检查变更节点时选择器执行失败:'
        );
    }

    hasRelevantNodes(nodeList) {
        return hasRelevantNodesForSelector(
            nodeList,
            this.activeSelectorText,
            '检查变更节点时选择器执行失败:'
        );
    }

    nodeTouchesActiveSelector(node) {
        return nodeTouchesSelectorText(
            node,
            this.activeSelectorText,
            '检查变更节点时选择器执行失败:'
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

            logDebug('observer-apply', {
                writer: 'TextObserver',
                data: this.dataList.map((item) => item.keySuffix || item.selector).slice(0, 12)
            });

            const elementCache = new Map();
            this.dataList.forEach((item) => {
                if (!item || item.value === undefined || item.value === null) return;
                const selectors = getConfigSelectorList(item);
                const selectorKey = item.keySuffix
                    ? `dynamic:${item.keySuffix}`
                    : selectors.join('\u0000');
                let elements = elementCache.get(selectorKey);
                if (!elements) {
                    elements = collectElementsFromConfig(item);
                    elementCache.set(selectorKey, elements);
                }
                if (item.multiple) {
                    const values = Array.isArray(item.value) ? item.value : [item.value];
                    elements.forEach((element, index) => {
                        if (!element) return;
                        if (element.dataset && element.dataset.tmInlineEditing === '1') return;
                        if (values[index] === undefined) return;
                        this.applyValueToElement(element, values[index], item);
                    });
                    return;
                }

                elements.forEach((element) => {
                    if (!element) return;
                    if (element.dataset && element.dataset.tmInlineEditing === '1') return;
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
            logDebug('observer-hit', {
                writer: 'TextObserver',
                reason: 'matched active selectors',
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
