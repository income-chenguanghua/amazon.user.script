import { GM_addStyle, unsafeWindow } from '$';

export function createEditorUI(manager) {
    manager.container = document.createElement('div');
    manager.container.id = 'tm-inline-editor';
    manager.container.innerHTML = `
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
    document.body.appendChild(manager.container);

    manager.toggleBtn = manager.container.querySelector('#tm-edit-toggle');
    manager.titleEditBtn = manager.container.querySelector('#tm-edit-title');
    manager.refundToggleBtn = manager.container.querySelector('#tm-edit-toggle-refund');
    manager.resetBtn = manager.container.querySelector('#tm-edit-reset');
    manager.hideBtn = manager.container.querySelector('#tm-edit-hide');
    manager.toolbarTriggerBtn = manager.container.querySelector('#tm-inline-toolbar-trigger');
}

export function attachPanelEvents(manager) {
    if (manager.toggleBtn) {
        manager.toggleBtn.addEventListener('click', () => manager.handleEditButtonClick());
    }
    if (manager.titleEditBtn) {
        manager.titleEditBtn.addEventListener('click', () => manager.handleTitleEdit());
    }
    if (manager.resetBtn) {
        manager.resetBtn.addEventListener('click', () => manager.handleReset());
    }
    if (manager.refundToggleBtn) {
        manager.refundToggleBtn.addEventListener('click', () => manager.toggleRefundRowVisibility());
    }
    if (manager.hideBtn) {
        manager.hideBtn.addEventListener('click', () => manager.hideButton());
    }
    if (manager.toolbarTriggerBtn) {
        manager.toolbarTriggerBtn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            manager.togglePanelOpen();
        });
    }
    document.addEventListener('click', manager.boundOutsideClickHandler);
}

export function setPanelOpen(manager, nextOpen) {
    manager.panelOpen = Boolean(nextOpen);
    if (manager.container) {
        manager.container.classList.toggle('tm-inline-panel-open', manager.panelOpen);
    }
    if (manager.toolbarTriggerBtn) {
        manager.toolbarTriggerBtn.setAttribute('aria-expanded', manager.panelOpen ? 'true' : 'false');
    }
}

export function togglePanelOpen(manager, force) {
    const nextOpen = typeof force === 'boolean' ? force : !manager.panelOpen;
    setPanelOpen(manager, nextOpen);
}

export function handleOutsideClick(manager, event) {
    if (!manager.panelOpen) return;
    const target = event.target;
    if (target instanceof Node && manager.container && manager.container.contains(target)) {
        return;
    }
    setPanelOpen(manager, false);
}

export function injectShowFunction(manager) {
    const showHandler = () => manager.showButton();

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

export function setupDynamicStyles(manager) {
    const rules = [];
    manager.fieldConfigs.forEach((config) => {
        if (config.hideInView) {
            const selectors = manager.getWatchSelectorsFromConfig(config);
            selectors.forEach((selector) => {
                rules.push(`body:not(.tm-editing-mode) ${selector} { display: none !important; }`);
            });
        }
    });

    if (rules.length > 0) {
        GM_addStyle(rules.join('\n'));
    }
}
