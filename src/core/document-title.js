import { buildStorageKeyFromSuffix } from './storage-key.js';

export function getDocumentTitleStorageKey(manager) {
    return buildStorageKeyFromSuffix(manager.pageKey, 'document_title');
}

export function getStoredDocumentTitle(manager) {
    const storageKey = getDocumentTitleStorageKey(manager);
    if (!storageKey) return '';
    const storedTitle = manager.valueMap[storageKey];
    return typeof storedTitle === 'string' ? storedTitle.trim() : '';
}

export function applyDocumentTitle(manager, title) {
    const nextTitle = typeof title === 'string' && title.trim()
        ? title.trim()
        : manager.originalDocumentTitle;
    if (!nextTitle) return;
    document.title = nextTitle;
    const titleElement = document.querySelector('title');
    if (titleElement && titleElement.textContent !== nextTitle) {
        titleElement.textContent = nextTitle;
    }
}

export function applyStoredDocumentTitle(manager) {
    const storedTitle = getStoredDocumentTitle(manager);
    if (storedTitle) {
        applyDocumentTitle(manager, storedTitle);
    }
}

export function handleTitleEdit(manager) {
    manager.setPanelOpen(false);
    const storageKey = getDocumentTitleStorageKey(manager);
    if (!storageKey) {
        manager.notification.show('标题保存键生成失败。', 'error');
        return;
    }

    const currentTitle = getStoredDocumentTitle(manager) || document.title || manager.originalDocumentTitle;
    const input = window.prompt(
        '请输入新的页面标题。\n留空并确认可恢复默认标题。',
        currentTitle
    );

    if (input === null) return;

    const nextTitle = input.trim();
    if (nextTitle) {
        const previousTitle = manager.valueMap[storageKey];
        manager.valueMap[storageKey] = nextTitle;
        const saved = manager.storage.saveValueMap(manager.valueMap);
        if (saved) {
            applyDocumentTitle(manager, nextTitle);
            manager.notification.show('页面标题已更新。', 'success');
            return;
        }

        if (previousTitle === undefined) {
            delete manager.valueMap[storageKey];
        } else {
            manager.valueMap[storageKey] = previousTitle;
        }
        manager.notification.show('标题保存失败，请查看控制台。', 'error');
        return;
    }

    const hadCustomTitle = Object.prototype.hasOwnProperty.call(manager.valueMap, storageKey);
    const previousTitle = manager.valueMap[storageKey];
    delete manager.valueMap[storageKey];

    const saved = hadCustomTitle ? manager.storage.saveValueMap(manager.valueMap) : true;
    if (saved) {
        applyDocumentTitle(manager, manager.originalDocumentTitle);
        manager.notification.show(
            hadCustomTitle ? '已恢复默认标题。' : '当前没有自定义标题。',
            hadCustomTitle ? 'success' : 'info'
        );
        return;
    }

    if (previousTitle !== undefined) {
        manager.valueMap[storageKey] = previousTitle;
    }
    manager.notification.show('标题恢复失败，请查看控制台。', 'error');
}
