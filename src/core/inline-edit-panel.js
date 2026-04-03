import { GM_addStyle, unsafeWindow } from '$';

const TOOLBAR_ICONS = {
    pencil: `
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11.7 2.8a1.77 1.77 0 0 1 2.5 2.5L6 13.5l-3.5.5.5-3.5 8.2-8.2Z"></path>
            <path d="M10.3 4.2 11.8 5.7"></path>
        </svg>
    `,
    check: `
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round">
            <path d="m3.75 8.5 2.5 2.5 6-6"></path>
        </svg>
    `,
    heading: `
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 3.25v9.5"></path>
            <path d="M12 3.25v9.5"></path>
            <path d="M4 8h8"></path>
        </svg>
    `,
    eye: `
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1.75 8s2.2-3.5 6.25-3.5S14.25 8 14.25 8s-2.2 3.5-6.25 3.5S1.75 8 1.75 8Z"></path>
            <circle cx="8" cy="8" r="1.5"></circle>
        </svg>
    `,
    eyeClosed: `
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2.2 5.2C3.3 4.1 5.1 3.3 8 3.3c4.05 0 6.25 3.5 6.25 3.5a9.7 9.7 0 0 1-1.55 1.86"></path>
            <path d="M6.2 6.3A2.1 2.1 0 0 1 9.7 9.8"></path>
            <path d="M13.8 13.8 2.2 2.2"></path>
            <path d="M1.75 8s1.02 1.62 2.94 2.7"></path>
            <path d="M8 12.5c1.25 0 2.35-.34 3.3-.84"></path>
        </svg>
    `,
    trash: `
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3.75 4.25h8.5"></path>
            <path d="M6 2.75h4"></path>
            <path d="m4.75 4.25.55 8h5.4l.55-8"></path>
            <path d="M6.5 6.25v4.25"></path>
            <path d="M9.5 6.25v4.25"></path>
        </svg>
    `,
    x: `
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
            <path d="m4.25 4.25 7.5 7.5"></path>
            <path d="m11.75 4.25-7.5 7.5"></path>
        </svg>
    `
};

function renderToolbarButton({ id, className, title, label, icon, activeIcon = '' }) {
    const iconMarkup = activeIcon
        ? `
            <span class="tm-inline-btn-icon tm-inline-btn-icon-default" aria-hidden="true">${TOOLBAR_ICONS[icon]}</span>
            <span class="tm-inline-btn-icon tm-inline-btn-icon-alt" aria-hidden="true">${TOOLBAR_ICONS[activeIcon]}</span>
        `
        : `<span class="tm-inline-btn-icon" aria-hidden="true">${TOOLBAR_ICONS[icon]}</span>`;

    return `
        <button type="button" id="${id}" class="tm-inline-btn ${className}" title="${title}">
            ${iconMarkup}
            <span class="tm-inline-btn-label">${label}</span>
        </button>
    `;
}

export function createEditorUI(manager) {
    manager.container = document.createElement('div');
    manager.container.id = 'tm-inline-editor';
    manager.container.innerHTML = `
        <div id="tm-inline-toolbar-panel" class="tm-inline-toolbar-panel">
            <div class="tm-inline-toolbar-group tm-inline-toolbar-group-main">
                ${renderToolbarButton({
                    id: 'tm-edit-toggle',
                    className: 'tm-inline-btn-primary',
                    title: '进入编辑模式',
                    label: '编辑',
                    icon: 'pencil',
                    activeIcon: 'check'
                })}
            </div>
            <div class="tm-inline-toolbar-group tm-inline-toolbar-group-actions">
                ${renderToolbarButton({
                    id: 'tm-edit-title',
                    className: 'tm-inline-btn-ghost',
                    title: '弹窗修改网站标题',
                    label: '标题',
                    icon: 'heading'
                })}
                ${renderToolbarButton({
                    id: 'tm-edit-toggle-refund',
                    className: 'tm-inline-btn-ghost',
                    title: '显示或隐藏退款总计行',
                    label: '退款',
                    icon: 'eye',
                    activeIcon: 'eyeClosed'
                })}
                ${renderToolbarButton({
                    id: 'tm-edit-reset',
                    className: 'tm-inline-btn-warning',
                    title: '删除所有保存的值并刷新页面',
                    label: '重置',
                    icon: 'trash'
                })}
                ${renderToolbarButton({
                    id: 'tm-edit-hide',
                    className: 'tm-inline-btn-ghost',
                    title: '隐藏编辑按钮',
                    label: '隐藏',
                    icon: 'x'
                })}
            </div>
        </div>
    `;
    document.body.appendChild(manager.container);

    manager.toggleBtn = manager.container.querySelector('#tm-edit-toggle');
    manager.titleEditBtn = manager.container.querySelector('#tm-edit-title');
    manager.refundToggleBtn = manager.container.querySelector('#tm-edit-toggle-refund');
    manager.resetBtn = manager.container.querySelector('#tm-edit-reset');
    manager.hideBtn = manager.container.querySelector('#tm-edit-hide');
    manager.toolbarTriggerBtn = null;
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
