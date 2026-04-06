export function normalizeTextContent(value) {
    let text = String(value || '');
    try {
        text = text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
    } catch (error) {
        // Ignore normalization failures and keep the original text.
    }
    return text
        .replace(/[\s\u00a0]+/g, ' ')
        .replace(/[：:]/g, '')
        .trim()
        .toLowerCase();
}

export function getConfigSelectorList(config) {
    if (!config) return [];
    if (Array.isArray(config.selector)) {
        return config.selector.filter((item) => typeof item === 'string' && item.trim());
    }
    return typeof config.selector === 'string' && config.selector.trim()
        ? [config.selector]
        : [];
}

export function getConfigWatchSelectorList(config) {
    if (!config) return [];
    if (Array.isArray(config.watchSelectors)) {
        return config.watchSelectors.filter((item) => typeof item === 'string' && item.trim());
    }
    if (typeof config.watchSelector === 'string' && config.watchSelector.trim()) {
        return [config.watchSelector];
    }
    return getConfigSelectorList(config);
}

export function normalizeResolvedElements(elements) {
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

export function cloneFieldConfig(config) {
    if (!config || typeof config !== 'object') return config;

    return {
        ...config,
        selector: Array.isArray(config.selector) ? [...config.selector] : config.selector,
        watchSelectors: Array.isArray(config.watchSelectors) ? [...config.watchSelectors] : config.watchSelectors
    };
}

export function findElementsBySelector(selector) {
    if (!selector) return [];
    const uniqueElements = new Set();

    try {
        document.querySelectorAll(selector).forEach((element) => {
            if (element instanceof HTMLElement) {
                uniqueElements.add(element);
            }
        });
    } catch (error) {
        console.warn('CSS 选择器解析失败:', selector, error);
    }

    return Array.from(uniqueElements.values());
}

export function collectElementsFromSelectors(selectors) {
    const selectorList = Array.isArray(selectors) ? selectors : [selectors];
    const results = [];
    const seen = new Set();

    selectorList
        .filter(Boolean)
        .forEach((selector) => {
            findElementsBySelector(selector).forEach((element) => {
                if (!element || seen.has(element)) return;
                seen.add(element);
                results.push(element);
            });
        });

    return results;
}

export function collectElementsFromConfig(config) {
    if (!config) return [];

    const results = [];
    const seen = new Set();

    collectElementsFromSelectors(getConfigSelectorList(config)).forEach((element) => {
        if (!element || seen.has(element)) return;
        seen.add(element);
        results.push(element);
    });

    if (typeof config.resolveElements === 'function') {
        try {
            normalizeResolvedElements(config.resolveElements()).forEach((element) => {
                if (!element || seen.has(element)) return;
                seen.add(element);
                results.push(element);
            });
        } catch (error) {
            console.warn('解析动态元素失败:', config.keySuffix || config.name || config.selector, error);
        }
    }

    return results;
}

export function extractElementValue(element, config) {
    if (!element) return '';

    if (config && typeof config.getValue === 'function') {
        try {
            const customValue = config.getValue(element);
            if (customValue !== undefined) {
                return customValue;
            }
        } catch (error) {
            console.warn('自定义字段取值失败:', config.keySuffix || config.name || element, error);
        }
    }

    if (element instanceof HTMLImageElement) {
        return element.src || '';
    }

    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
        return element.value;
    }

    if (element.childElementCount > 0) {
        return element.innerHTML.trim();
    }

    return (element.textContent || '').trim();
}

export function applyElementValue(element, value, config) {
    if (!element || value === undefined || value === null) return;
    const expected = typeof value === 'string' ? value : String(value);

    if (config && typeof config.setValue === 'function') {
        try {
            config.setValue(element, expected);
            return;
        } catch (error) {
            console.warn('自定义字段写值失败:', config.keySuffix || config.name || element, error);
        }
    }

    if ((config && config.type === 'image') || element instanceof HTMLImageElement) {
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

export function isElementLikelyVisible(element) {
    if (!(element instanceof HTMLElement)) return false;
    if (!element.isConnected) return false;

    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') {
        return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 0 || rect.height > 0;
}

export function pickPreferredValueElement(elements) {
    if (!Array.isArray(elements) || elements.length === 0) return null;

    const visibleElement = elements.find((element) => isElementLikelyVisible(element));
    return visibleElement || elements[0] || null;
}

export function getEditedElementWithChangedValue(elements, editedElements, config) {
    if (!Array.isArray(elements) || elements.length === 0 || !(editedElements instanceof Map)) {
        return null;
    }

    for (const element of elements) {
        const state = editedElements.get(element);
        if (!state || !Object.prototype.hasOwnProperty.call(state, 'originalValue')) {
            continue;
        }

        const currentValue = extractElementValue(element, config);
        if (!isEqualValue(state.originalValue, currentValue)) {
            return element;
        }
    }

    return null;
}

export function isEqualValue(currentValue, nextValue) {
    if (Array.isArray(currentValue) && Array.isArray(nextValue)) {
        if (currentValue.length !== nextValue.length) return false;
        for (let i = 0; i < currentValue.length; i += 1) {
            if (currentValue[i] !== nextValue[i]) return false;
        }
        return true;
    }
    return currentValue === nextValue;
}

export function isThumbnailLikeImage(element) {
    if (!(element instanceof HTMLImageElement)) return false;
    return Boolean(element.closest('#altImages, li.imageThumbnail, #ivThumbs, #ivThumbs360, #ivThumbsDimensions'));
}

export function isSameDocumentAnchorHref(href) {
    const rawHref = typeof href === 'string' ? href.trim() : '';
    if (!rawHref) return true;

    const loweredHref = rawHref.toLowerCase();
    if (loweredHref === '#' || loweredHref.startsWith('#') || loweredHref.startsWith('javascript:')) {
        return true;
    }

    try {
        const targetUrl = new URL(rawHref, window.location.href);
        const currentUrl = new URL(window.location.href);
        return Boolean(targetUrl.hash) &&
            targetUrl.origin === currentUrl.origin &&
            targetUrl.pathname === currentUrl.pathname &&
            targetUrl.search === currentUrl.search;
    } catch (error) {
        return false;
    }
}

export function shouldAllowAnchorInteraction(anchor) {
    if (!(anchor instanceof HTMLAnchorElement)) return false;
    if (anchor.getAttribute('role') === 'button') return true;
    if (anchor.hasAttribute('aria-controls')) return true;
    if (anchor.hasAttribute('data-action')) return true;
    if (anchor.hasAttribute('data-a-expander-toggle')) return true;
    if (anchor.closest('.a-expander-container, .a-declarative')) return true;
    return isSameDocumentAnchorHref(anchor.getAttribute('href'));
}

export function parseCssSize(value) {
    const parsed = Number.parseFloat(value || '');
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function clamp(value, min, max) {
    const n = Number.isFinite(value) ? value : min;
    return Math.min(max, Math.max(min, n));
}

export function getStableImageSize(element) {
    if (!(element instanceof HTMLImageElement)) {
        return { width: 40, height: 40 };
    }

    if (isThumbnailLikeImage(element)) {
        const altColumn = element.closest('#altImages');
        if (altColumn instanceof HTMLElement) {
            const altWidth = Math.round(altColumn.getBoundingClientRect().width);
            if (altWidth > 0) {
                const size = clamp(altWidth, 24, 72);
                return { width: size, height: size };
            }
        }

        const thumbHost = element.closest('li.imageThumbnail, .ivThumb, .a-button-thumbnail');
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

export function applyImageDisplayConstraints(element) {
    if (!(element instanceof HTMLImageElement)) return;

    if (isThumbnailLikeImage(element)) {
        const { width, height } = getStableImageSize(element);
        element.style.setProperty('--tm-thumb-w', `${width}px`);
        element.style.setProperty('--tm-thumb-h', `${height}px`);
        element.style.width = `${width}px`;
        element.style.height = `${height}px`;
        element.style.maxWidth = `${width}px`;
        element.style.maxHeight = `${height}px`;
        element.style.minWidth = `${width}px`;
        element.style.minHeight = `${height}px`;
        element.style.objectFit = 'cover';
        element.style.objectPosition = 'center center';
        element.classList.add('tm-inline-thumb-fixed-image');
        return;
    }

    if (element.closest && element.closest('#mediaBlock_feature_div')) {
        if (!element.style.objectFit) {
            element.style.objectFit = 'contain';
        }
        if (!element.style.objectPosition) {
            element.style.objectPosition = 'center center';
        }
        element.classList.add('tm-inline-main-fixed-image');
    }
}

export function applyImageSource(element, expected) {
    if (!(element instanceof HTMLImageElement)) return;
    const sameSource = element.src === expected;
    const alreadyApplied = element.dataset && element.dataset.tmInlineAppliedSrc === expected;

    if (!sameSource) {
        element.src = expected;
    }

    if (!alreadyApplied) {
        element.removeAttribute('srcset');
        element.removeAttribute('sizes');
        if (element.dataset && Object.prototype.hasOwnProperty.call(element.dataset, 'oldHires')) {
            element.dataset.oldHires = expected;
        }
        if (element.dataset) {
            element.dataset.tmInlineAppliedSrc = expected;
        }
    }

    if (!alreadyApplied &&
        !element.classList.contains('tm-inline-thumb-fixed-image') &&
        !element.classList.contains('tm-inline-main-fixed-image')) {
        applyImageDisplayConstraints(element);
    }
}
