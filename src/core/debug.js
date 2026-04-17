const DEBUG_STORAGE_KEY = 'tmInlineDebug';

function getLocalStorage() {
    try {
        return window.localStorage;
    } catch (error) {
        return null;
    }
}

export function isDebugEnabled() {
    const storage = getLocalStorage();
    return Boolean(storage && storage.getItem(DEBUG_STORAGE_KEY) === '1');
}

export function setDebugEnabled(enabled) {
    const storage = getLocalStorage();
    if (!storage) return false;
    if (enabled) {
        storage.setItem(DEBUG_STORAGE_KEY, '1');
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
    const id = element.id ? `#${element.id}` : '';
    const className = element.classList && element.classList.length > 0
        ? `.${Array.from(element.classList).slice(0, 3).join('.')}`
        : '';
    const dataComponent = element.getAttribute('data-component');
    const dataPart = dataComponent ? `[data-component="${dataComponent}"]` : '';

    return `${tagName}${id}${className}${dataPart}`;
}

function summarizeNode(node) {
    if (node instanceof Element) {
        return summarizeElement(node);
    }
    if (node instanceof Text) {
        return `#text("${String(node.textContent || '').trim().slice(0, 40)}")`;
    }
    return String(node && node.nodeName ? node.nodeName : node);
}

function formatValue(value) {
    if (Array.isArray(value)) {
        return value.map((item) => formatValue(item));
    }
    if (typeof value !== 'string') {
        return value;
    }
    return value.length > 160 ? `${value.slice(0, 160)}...` : value;
}

export function summarizeMutations(mutations, limit = 5) {
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

export function logDebug(event, details = {}) {
    if (!isDebugEnabled()) return;

    const titleParts = [`[tm-inline][${event}]`];
    if (details.writer) {
        titleParts.push(details.writer);
    }
    if (details.field) {
        titleParts.push(`field=${details.field}`);
    }

    console.groupCollapsed(titleParts.join(' '));

    if (details.reason) {
        console.log('reason:', details.reason);
    }
    if (details.element) {
        console.log('element:', summarizeElement(details.element), details.element);
    }
    if (details.current !== undefined || details.next !== undefined) {
        console.log('value:', {
            current: formatValue(details.current),
            next: formatValue(details.next)
        });
    }
    if (details.summary) {
        console.log('summary:', details.summary);
    }
    if (details.data) {
        console.log('data:', details.data);
    }
    if (details.trace) {
        console.trace('stack');
    }

    console.groupEnd();
}
