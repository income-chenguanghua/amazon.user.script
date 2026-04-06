import {
    collectElementsFromConfig,
    extractElementValue,
    getEditedElementWithChangedValue,
    pickPreferredValueElement
} from './utils.js';
import { hasRelevantMutationsForSelector, hasRelevantNodesForSelector, nodeTouchesSelectorText } from './dom-watch-utils.js';
import { makeEditable } from './edit-image.js';

export function collectTargetElements(manager) {
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

export function buildEditWatchSelectorText(manager) {
    const selectors = [];
    const seen = new Set();

    manager.fieldConfigs.forEach((config) => {
        manager.getWatchSelectorsFromConfig(config)
            .filter(Boolean)
            .forEach((selector) => {
                if (seen.has(selector)) return;
                seen.add(selector);
                selectors.push(selector);
            });
    });

    return selectors.join(', ');
}

export function nodeTouchesEditTarget(manager, node) {
    if (!manager.editWatchSelectorText) return true;
    return nodeTouchesSelectorText(
        node,
        manager.editWatchSelectorText,
        '检查编辑区变更节点时选择器执行失败:'
    );
}

export function hasRelevantEditMutations(manager, mutations) {
    return hasRelevantMutationsForSelector(
        mutations,
        manager.editWatchSelectorText,
        '检查编辑区变更节点时选择器执行失败:'
    );
}

export function hasRelevantEditNodes(manager, nodeList) {
    if (!manager.editWatchSelectorText) return false;
    return hasRelevantNodesForSelector(
        nodeList,
        manager.editWatchSelectorText,
        '检查编辑区变更节点时选择器执行失败:'
    );
}

export function scheduleEditableSync(manager, delay = manager.editMutationDebounceMs) {
    if (!manager.isEditing || manager.pendingEditableSyncTimer) return;

    manager.pendingEditableSyncTimer = setTimeout(() => {
        manager.pendingEditableSyncTimer = null;
        syncEditableTargets(manager);
    }, delay);
}

export function syncEditableTargets(manager) {
    if (!manager.isEditing) return;
    collectTargetElements(manager).forEach(({ element, config }) => {
        makeEditable(manager, element, config);
    });
}

export function startEditMutationObserver(manager) {
    if (manager.editMutationObserver || !document.body) return;

    manager.editMutationObserver = new MutationObserver((mutations) => {
        if (!manager.isEditing) return;
        if (!hasRelevantEditMutations(manager, mutations)) return;
        scheduleEditableSync(manager, manager.editMutationDebounceMs);
    });

    manager.editMutationObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
}

export function stopEditMutationObserver(manager) {
    if (manager.editMutationObserver) {
        manager.editMutationObserver.disconnect();
        manager.editMutationObserver = null;
    }
    if (manager.pendingEditableSyncTimer) {
        clearTimeout(manager.pendingEditableSyncTimer);
        manager.pendingEditableSyncTimer = null;
    }
}

export function collectEditedValues(manager) {
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
        if (value !== undefined && value !== null) {
            values[storageKey] = value;
        }
    });

    return values;
}
