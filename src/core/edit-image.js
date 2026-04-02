import {
    applyImageSource,
    extractElementValue
} from './utils.js';

export function setupImageInput(manager) {
    if (manager.imageInput) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    input.addEventListener('change', async () => {
        const file = input.files && input.files[0];
        if (!file || !manager.activeImageElement) {
            manager.activeImageElement = null;
            input.value = '';
            return;
        }
        try {
            const dataUrl = await readFileAsDataUrl(file);
            if (typeof dataUrl !== 'string') {
                throw new Error('无效图片数据');
            }
            applyImageSource(manager.activeImageElement, dataUrl);
            manager.notification.show('图片已更新，点击“完成”保存。', 'success');
        } catch (error) {
            console.error('读取图片失败:', error);
            manager.notification.show('图片读取失败，请重试。', 'error');
        } finally {
            manager.activeImageElement = null;
            input.value = '';
        }
    });
    document.body.appendChild(input);
    manager.imageInput = input;
}

export function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('读取失败'));
        reader.readAsDataURL(file);
    });
}

export function findImageTriggerHost(element) {
    if (!(element instanceof HTMLElement)) return null;

    const host = element.closest('#imgTagWrapperId, .imgTagWrapper, li.imageThumbnail, [data-component="itemImage"], .a-button-text, .a-list-item');
    if (host instanceof HTMLElement) {
        return host;
    }

    return element.parentElement instanceof HTMLElement ? element.parentElement : null;
}

export function makeEditable(manager, element, config) {
    if (!element || manager.editedElements.has(element)) return;

    const isImageElement = element instanceof HTMLImageElement;
    const isImage = (config && config.type === 'image' && isImageElement) || isImageElement;
    const isInput = !isImage && (element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLSelectElement);
    const noHighlight = Boolean(config && config.noHighlight);

    const state = {
        element,
        isImage,
        isInput,
        noHighlight,
        originalValue: extractElementValue(element),
        disabled: isInput ? element.disabled : undefined,
        readOnly: isInput ? element.readOnly : undefined,
        originalReadonlyAttr: isInput ? element.getAttribute('readonly') : null,
        originalDisabledAttr: isInput ? element.getAttribute('disabled') : null,
        contentEditable: isInput ? null : element.getAttribute('contenteditable'),
        originalCursor: isImage ? element.style.cursor : undefined,
        originalTitle: isImage ? element.getAttribute('title') : null,
        imageTrigger: null,
        imageTriggerHost: null,
        imageTriggerHostPosition: null,
        imageTriggerHostPositionAdjusted: false,
        imageTriggerClickHandler: null,
        imageTriggerKeyHandler: null
    };

    if (isImage) {
        const openReplaceDialog = (event) => {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
                if (typeof event.stopImmediatePropagation === 'function') {
                    event.stopImmediatePropagation();
                }
            }
            if (!manager.imageInput) return;
            manager.activeImageElement = element;
            manager.imageInput.value = '';
            manager.imageInput.click();
        };

        const keyHandler = (event) => {
            if (!event) return;
            if (event.key === 'Enter' || event.key === ' ') {
                openReplaceDialog(event);
            }
        };

        const host = findImageTriggerHost(element);
        if (host) {
            const trigger = document.createElement('span');
            trigger.className = 'tm-inline-image-replace-trigger';
            trigger.textContent = '换';
            trigger.setAttribute('role', 'button');
            trigger.setAttribute('tabindex', '0');
            trigger.setAttribute('aria-label', '替换图片');

            const computed = window.getComputedStyle(host).position;
            state.imageTriggerHostPosition = host.style.position;
            if (!computed || computed === 'static') {
                host.style.position = 'relative';
                state.imageTriggerHostPositionAdjusted = true;
            }
            trigger.addEventListener('click', openReplaceDialog, true);
            trigger.addEventListener('keydown', keyHandler, true);
            host.appendChild(trigger);
            state.imageTrigger = trigger;
            state.imageTriggerHost = host;
            state.imageTriggerClickHandler = openReplaceDialog;
            state.imageTriggerKeyHandler = keyHandler;
        } else {
            element.addEventListener('contextmenu', openReplaceDialog, true);
            state.imageTriggerClickHandler = openReplaceDialog;
        }

        element.style.cursor = 'zoom-in';
        element.setAttribute('title', host ? '左键预览，点“换”角标替换图片' : '左键预览，右键替换图片');
    } else if (isInput) {
        element.disabled = false;
        element.readOnly = false;
        element.removeAttribute('readonly');
        element.removeAttribute('disabled');
    } else {
        element.setAttribute('contenteditable', 'true');
    }

    element.dataset.tmInlineEditing = '1';
    if (!noHighlight) {
        element.classList.add('tm-inline-editing');
    }
    manager.editedElements.set(element, state);
}

export function restoreElements(manager) {
    manager.editedElements.forEach((state, element) => {
        if (!element) return;
        delete element.dataset.tmInlineEditing;
        element.removeAttribute('data-tm-inline-editing');
        element.classList.remove('tm-inline-editing');

        if (state.isInput) {
            element.disabled = state.disabled;
            element.readOnly = state.readOnly;

            if (state.originalReadonlyAttr !== null) {
                element.setAttribute('readonly', state.originalReadonlyAttr);
            } else {
                element.removeAttribute('readonly');
            }

            if (state.originalDisabledAttr !== null) {
                element.setAttribute('disabled', state.originalDisabledAttr);
            } else {
                element.removeAttribute('disabled');
            }
        } else if (state.isImage) {
            if (state.imageTrigger) {
                if (state.imageTriggerClickHandler) {
                    state.imageTrigger.removeEventListener('click', state.imageTriggerClickHandler, true);
                }
                if (state.imageTriggerKeyHandler) {
                    state.imageTrigger.removeEventListener('keydown', state.imageTriggerKeyHandler, true);
                }
                state.imageTrigger.remove();
            } else if (state.imageTriggerClickHandler) {
                element.removeEventListener('contextmenu', state.imageTriggerClickHandler, true);
            }
            if (state.imageTriggerHost && state.imageTriggerHostPositionAdjusted) {
                state.imageTriggerHost.style.position = state.imageTriggerHostPosition || '';
            }
            if (state.originalCursor !== undefined) {
                element.style.cursor = state.originalCursor;
            }
            if (state.originalTitle !== null) {
                element.setAttribute('title', state.originalTitle);
            } else {
                element.removeAttribute('title');
            }
        } else if (state.contentEditable === null || state.contentEditable === undefined) {
            element.removeAttribute('contenteditable');
        } else {
            element.setAttribute('contenteditable', state.contentEditable);
        }
    });

    manager.editedElements.clear();
    manager.activeImageElement = null;
    if (manager.imageInput) {
        manager.imageInput.value = '';
    }
    cleanupLooseEditingMarks();
}

export function cleanupLooseEditingMarks(root = document) {
    try {
        const scope = root && typeof root.querySelectorAll === 'function' ? root : document;
        scope.querySelectorAll('[data-tm-inline-editing], .tm-inline-editing').forEach((node) => {
            if (!(node instanceof HTMLElement)) return;
            node.classList.remove('tm-inline-editing');
            node.removeAttribute('data-tm-inline-editing');
            if (node.isContentEditable) {
                node.removeAttribute('contenteditable');
                node.contentEditable = 'inherit';
            }
        });
    } catch (error) {
        console.warn('清理残留编辑标记失败:', error);
    }
}
