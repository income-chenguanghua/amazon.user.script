import { unsafeWindow } from '$';

import { InlineEditManager } from './core/inline-edit-manager.js';
import { NotificationManager } from './core/notification-manager.js';
import { StorageManager } from './core/storage-manager.js';
import { TextObserver } from './core/text-observer.js';
import { startAmazonTopAdCleanup } from './features/top-ads.js';
import { injectEditorStyles } from './styles/editor-styles.js';

const amazonRetailHostPattern = /(^|\.)amazon\.(?:com|[a-z]{2,3}|com\.[a-z]{2}|co\.[a-z]{2})$/i;
const currentHostname = window.location && window.location.hostname ? window.location.hostname : '';

function exposeInlineEditor(inlineEditManager) {
    if (typeof inlineEditManager.show === 'function') {
        inlineEditManager.show = inlineEditManager.show.bind(inlineEditManager);
    }
    const showInlineEditor = () => inlineEditManager.show();

    const targetWindows = [window];
    if (typeof unsafeWindow !== 'undefined' && unsafeWindow && unsafeWindow !== window) {
        targetWindows.push(unsafeWindow);
    }

    let exposed = false;
    for (const targetWindow of targetWindows) {
        try {
            Object.defineProperty(targetWindow, 'tmInlineEditor', {
                value: inlineEditManager,
                configurable: true,
                writable: true
            });
            Object.defineProperty(targetWindow, 'show', {
                value: showInlineEditor,
                configurable: true,
                writable: true
            });
            exposed = true;
        } catch (error) {
            try {
                targetWindow.tmInlineEditor = inlineEditManager;
                targetWindow.show = showInlineEditor;
                exposed = true;
            } catch (assignmentError) {
                console.warn('无法注入 show 方法:', assignmentError);
            }
        }
    }

    if (exposed) {
        console.log('✅ show() 已注入 window，可直接执行 show() 显示按钮');
    }
}

if (!amazonRetailHostPattern.test(currentHostname)) {
    console.warn('Amazon 页面元素内联编辑助手（含顶部广告移除）: 非亚马逊页面，未启动。');
} else {
    startAmazonTopAdCleanup();

    function bootstrapInlineEditor() {
        if (bootstrapInlineEditor.started) return;
        bootstrapInlineEditor.started = true;

        injectEditorStyles();

        const storage = new StorageManager();
        const notification = new NotificationManager();
        const fieldConfigs = storage.getDefaultList();
        const valueMap = storage.loadValueMap();

        const textObserver = new TextObserver([]);
        const inlineEditManager = new InlineEditManager(storage, notification, textObserver, fieldConfigs, valueMap);
        exposeInlineEditor(inlineEditManager);

        setTimeout(() => {
            textObserver.start();
            console.log('🚀 Amazon 页面文字编辑器已加载');
        }, 800);

        window.addEventListener('beforeunload', () => {
            textObserver.stop();
        });
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', bootstrapInlineEditor, { once: true });
    } else {
        bootstrapInlineEditor();
    }
}
