import {
    applyImageSource,
    collectElementsFromConfig,
    getConfigSelectorList,
    getConfigWatchSelectorList
} from './utils.js';

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
        for (const mutation of mutations) {
            if (!mutation || mutation.type !== 'childList') continue;
            if (!this.hasRelevantNodes(mutation.addedNodes) && !this.hasRelevantNodes(mutation.removedNodes)) {
                continue;
            }
            return true;
        }
        return false;
    }

    hasRelevantNodes(nodeList) {
        if (!nodeList || nodeList.length === 0 || !this.activeSelectorText) return false;

        for (const node of nodeList) {
            if (!(node instanceof Element)) continue;
            if (node.id === 'tm-inline-editor' || node.id === 'tm-inline-notifications') continue;
            if (typeof node.closest === 'function') {
                if (node.closest('#tm-inline-editor') || node.closest('#tm-inline-notifications')) {
                    continue;
                }
            }
            if (this.nodeTouchesActiveSelector(node)) {
                return true;
            }
        }

        return false;
    }

    nodeTouchesActiveSelector(node) {
        if (!(node instanceof Element) || !this.activeSelectorText) return false;

        try {
            if (typeof node.matches === 'function' && node.matches(this.activeSelectorText)) {
                return true;
            }
            if (typeof node.closest === 'function' && node.closest(this.activeSelectorText)) {
                return true;
            }
            if (typeof node.querySelector === 'function' && node.querySelector(this.activeSelectorText)) {
                return true;
            }
        } catch (error) {
            console.warn('检查变更节点时选择器执行失败:', error);
            return true;
        }

        return false;
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
                        this.applyValueToElement(element, values[index], item.type);
                    });
                    return;
                }

                elements.forEach((element) => {
                    if (!element) return;
                    if (element.dataset && element.dataset.tmInlineEditing === '1') return;
                    this.applyValueToElement(element, item.value, item.type);
                });
            });
        } finally {
            this.applyInProgress = false;
            this.lastApplyAt = Date.now();
        }
    }

    applyValueToElement(element, value, type = 'text') {
        if (value === undefined || value === null) return;
        const expected = typeof value === 'string' ? value : String(value);

        if (type === 'image' || element instanceof HTMLImageElement) {
            if (!(element instanceof HTMLImageElement)) return;
            applyImageSource(element, expected);
            return;
        }

        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
            if (element.value !== expected) {
                element.value = expected;
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
            }
            return;
        }

        const hasHtml = /<[^>]+>/.test(expected);
        if (hasHtml) {
            if (element.innerHTML.trim() !== expected.trim()) {
                element.innerHTML = expected;
            }
        } else if ((element.textContent || '').trim() !== expected.trim()) {
            element.textContent = expected;
        }
    }

    setupMutationObserver() {
        if (this.mutationObserver) return;
        this.mutationObserver = new MutationObserver((mutations) => {
            if (!this.isActive) return;
            if (!this.hasRelevantMutations(mutations)) return;
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
