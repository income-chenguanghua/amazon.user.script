import { resolveChargeSummaryElements } from '../features/resolvers.js';
import { isEqualValue, shouldAllowAnchorInteraction } from './utils.js';
import { restoreElements, cleanupLooseEditingMarks, makeEditable } from './edit-image.js';
import {
    collectEditedValues,
    collectTargetElements,
    startEditMutationObserver,
    stopEditMutationObserver
} from './edit-sync.js';

function setButtonLabel(button, label) {
    if (!button) return;
    const labelElement = button.querySelector('.tm-inline-btn-label');
    if (labelElement) {
        labelElement.textContent = label;
        return;
    }
    button.textContent = label;
}

export function handleEditButtonClick(manager) {
    manager.setPanelOpen(false);
    if (manager.isEditing) {
        exitEditMode(manager, true);
        return;
    }

    enterEditMode(manager);
}

export function refreshButtonStates(manager) {
    if (manager.toggleBtn) {
        setButtonLabel(manager.toggleBtn, manager.isEditing ? '完成' : manager.initialEditLabel);
        manager.toggleBtn.title = manager.isEditing ? '保存并退出编辑模式' : '进入编辑模式';
        manager.toggleBtn.setAttribute('aria-pressed', manager.isEditing ? 'true' : 'false');
        manager.toggleBtn.disabled = false;
    }
}

export function applyRefundRowState(manager, updateLabel = false) {
    document.querySelectorAll('.tm-inline-refund-row-hidden').forEach((row) => {
        row.classList.remove('tm-inline-refund-row-hidden');
    });

    if (manager.refundRowHidden) {
        resolveChargeSummaryElements('charge_refund_total', 'row').forEach((row) => {
            row.classList.add('tm-inline-refund-row-hidden');
        });
    }

    if (manager.refundToggleBtn) {
        if (updateLabel) {
            setButtonLabel(manager.refundToggleBtn, '退款');
        }
        manager.refundToggleBtn.classList.toggle('tm-inline-btn-selected', manager.refundRowHidden);
        manager.refundToggleBtn.title = manager.refundRowHidden ? '已隐藏退款行，点击恢复显示' : '显示或隐藏退款总计行';
        manager.refundToggleBtn.setAttribute('aria-pressed', manager.refundRowHidden ? 'true' : 'false');
    }
}

export function toggleRefundRowVisibility(manager) {
    manager.setPanelOpen(false);
    manager.refundRowHidden = !manager.refundRowHidden;
    manager.storage.savePersistent('refundRowHidden', manager.refundRowHidden);
    applyRefundRowState(manager, true);
    manager.notification.show(manager.refundRowHidden ? '已隐藏退款总计行。' : '已显示退款总计行。', 'info');
}

export function enterEditMode(manager) {
    if (manager.isEditing) return;
    manager.textObserver.stop();
    manager.isEditing = true;
    document.body.classList.add('tm-editing-mode');
    if (manager.toggleBtn) {
        manager.toggleBtn.classList.add('tm-inline-btn-active');
    }
    refreshButtonStates(manager);
    document.addEventListener('click', manager.boundAnchorInterceptor, true);

    const elements = collectTargetElements(manager);
    elements.forEach(({ element, config }) => makeEditable(manager, element, config));
    startEditMutationObserver(manager);

    if (elements.length === 0) {
        manager.notification.show('未找到可编辑的元素，请检查选择器配置。', 'warning');
    } else {
        manager.notification.show('编辑模式已开启：可直接改文字；评论数点旁边“改”按钮编辑；点击图片角标“换”可替换，左键预览保留。', 'info');
    }
}

export function exitEditMode(manager, saveChanges = true) {
    if (!manager.isEditing) return;

    try {
        if (saveChanges) {
            const values = collectEditedValues(manager);
            let dirty = false;
            Object.entries(values).forEach(([key, value]) => {
                if (!isEqualValue(manager.valueMap[key], value)) {
                    manager.valueMap[key] = value;
                    dirty = true;
                }
            });

            const saved = dirty ? manager.storage.saveValueMap(manager.valueMap) : true;
            if (saved) {
                manager.notification.show(dirty ? '修改已保存并应用。' : '没有检测到新的修改。', dirty ? 'success' : 'info');
            } else {
                manager.notification.show('保存失败，请查看控制台。', 'error');
            }
        } else {
            manager.notification.show('已退出编辑模式，修改未保存。', 'info');
        }
    } catch (error) {
        console.error('退出编辑模式失败:', error);
        manager.notification.show('保存失败，请查看控制台。', 'error');
    } finally {
        manager.isEditing = false;
        document.body.classList.remove('tm-editing-mode');
        try {
            restoreElements(manager);
        } catch (error) {
            console.warn('恢复元素状态失败:', error);
        }
        try {
            cleanupLooseEditingMarks();
        } catch (error) {
            console.warn('清理残留标记失败:', error);
        }
        const activeElement = document.activeElement;
        if (activeElement && activeElement instanceof HTMLElement) {
            activeElement.blur();
        }
        stopEditMutationObserver(manager);
        document.removeEventListener('click', manager.boundAnchorInterceptor, true);
        if (manager.toggleBtn) {
            manager.toggleBtn.classList.remove('tm-inline-btn-active');
        }
        refreshButtonStates(manager);
        if (manager.textObserver) {
            manager.textObserver.start();
        }
    }
}

export function hideButton(manager) {
    manager.setPanelOpen(false);
    if (manager.isEditing) {
        exitEditMode(manager, false);
    }
    manager.hidden = true;
    document.body.classList.remove('tm-editing-mode');
    manager.storage.savePersistent('hidden', true);
    manager.container.style.display = 'none';
    manager.notification.show('编辑按钮已隐藏，在控制台执行 show() 可重新显示。', 'info');
}

export function showButton(manager) {
    manager.setPanelOpen(false);
    manager.hidden = false;
    manager.storage.savePersistent('hidden', false);
    manager.container.style.display = 'flex';
    refreshButtonStates(manager);
    console.log('✅ 编辑按钮已显示');
}

export function handleReset(manager) {
    manager.setPanelOpen(false);
    const confirmed = window.confirm('确定要删除所有保存的内容并刷新页面吗？');
    if (!confirmed) return;

    if (manager.isEditing) {
        exitEditMode(manager, false);
    }

    const cleared = manager.storage.clearValueMap();
    if (cleared) {
        manager.valueMap = {};
        manager.applyDocumentTitle(manager.originalDocumentTitle);
        manager.notification.show('已清除所有保存内容，页面即将刷新。', 'warning');
        setTimeout(() => window.location.reload(), 600);
    } else {
        manager.notification.show('重置失败，请查看控制台。', 'error');
    }
}

export function handleAnchorClick(manager, event) {
    if (!manager.isEditing) return;
    const replaceTrigger = event.target && event.target.closest && event.target.closest('.tm-inline-image-replace-trigger');
    if (replaceTrigger) return;
    const dialogTrigger = event.target && event.target.closest && event.target.closest('.tm-inline-text-dialog-trigger');
    if (dialogTrigger) return;
    const anchor = event.target && event.target.closest('a');
    if (!anchor) return;
    const containsDialogEditTarget = anchor.matches('[data-tm-inline-dialog-edit="1"]') ||
        Boolean(anchor.querySelector('[data-tm-inline-dialog-edit="1"]'));
    if (containsDialogEditTarget) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return;
    }
    if (shouldAllowAnchorInteraction(anchor)) return;
    const editingImage = event.target && event.target.closest('img[data-tm-inline-editing="1"]');
    if (editingImage) return;
    if (manager.container && manager.container.contains(anchor)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
}
