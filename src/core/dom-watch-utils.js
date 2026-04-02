export function isEditorInternalNode(node) {
    if (!(node instanceof Element)) return false;
    if (node.id === 'tm-inline-editor' || node.id === 'tm-inline-notifications') return true;
    return Boolean(node.closest('#tm-inline-editor') || node.closest('#tm-inline-notifications'));
}

export function nodeTouchesSelectorText(node, selectorText, warningMessage) {
    if (!(node instanceof Element) || !selectorText) return false;

    try {
        if (typeof node.matches === 'function' && node.matches(selectorText)) {
            return true;
        }
        if (typeof node.closest === 'function' && node.closest(selectorText)) {
            return true;
        }
        if (typeof node.querySelector === 'function' && node.querySelector(selectorText)) {
            return true;
        }
    } catch (error) {
        console.warn(warningMessage, error);
        return true;
    }

    return false;
}

export function hasRelevantNodesForSelector(nodeList, selectorText, warningMessage) {
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

export function hasRelevantMutationsForSelector(mutations, selectorText, warningMessage) {
    for (const mutation of mutations) {
        if (!mutation || mutation.type !== 'childList') continue;
        if (
            !hasRelevantNodesForSelector(mutation.addedNodes, selectorText, warningMessage) &&
            !hasRelevantNodesForSelector(mutation.removedNodes, selectorText, warningMessage)
        ) {
            continue;
        }
        return true;
    }

    return false;
}
