import { GM_addStyle } from '$';

export function injectEditorStyles() {
    GM_addStyle(`
        #tm-inline-editor {
            position: fixed;
            bottom: 24px;
            right: 24px;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            z-index: 100000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .tm-inline-toolbar-panel {
            position: absolute;
            right: 0;
            bottom: calc(100% + 12px);
            width: min(280px, calc(100vw - 24px));
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 14px;
            border-radius: 18px;
            background: rgba(255, 255, 255, 0.96);
            border: 1px solid rgba(148, 163, 184, 0.24);
            box-shadow: 0 18px 34px rgba(2, 6, 23, 0.18);
            backdrop-filter: blur(14px);
            -webkit-backdrop-filter: blur(14px);
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
            transform: translateY(12px) scale(0.98);
            transform-origin: bottom right;
            transition: opacity 0.22s ease, transform 0.22s ease, visibility 0.22s step-end;
        }
        #tm-inline-editor:hover .tm-inline-toolbar-panel,
        #tm-inline-editor:focus-within .tm-inline-toolbar-panel,
        #tm-inline-editor.tm-inline-panel-open .tm-inline-toolbar-panel {
            opacity: 1;
            visibility: visible;
            pointer-events: auto;
            transform: translateY(0) scale(1);
            transition: opacity 0.22s ease, transform 0.22s ease, visibility 0s;
        }
        .tm-inline-toolbar-panel-header {
            display: flex;
            flex-direction: column;
            gap: 4px;
            padding: 2px 2px 8px;
        }
        .tm-inline-toolbar-title {
            color: #0f172a;
            font-size: 14px;
            font-weight: 700;
            line-height: 1.2;
        }
        .tm-inline-toolbar-subtitle {
            color: #475569;
            font-size: 12px;
            line-height: 1.4;
        }
        .tm-inline-toolbar-trigger {
            border: none;
            border-radius: 18px;
            min-width: 68px;
            height: 52px;
            padding: 0 16px;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
            color: #ffffff;
            background: linear-gradient(135deg, #0d6efd, #0b5ed7);
            box-shadow: 0 10px 24px rgba(13, 110, 253, 0.32);
            transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
        }
        .tm-inline-toolbar-trigger:hover,
        #tm-inline-editor.tm-inline-panel-open .tm-inline-toolbar-trigger {
            transform: translateY(-1px);
            box-shadow: 0 14px 28px rgba(13, 110, 253, 0.38);
            filter: brightness(1.02);
        }
        .tm-inline-toolbar-trigger:focus {
            outline: 2px solid rgba(14, 165, 233, 0.95);
            outline-offset: 2px;
        }
        #tm-inline-notifications {
            position: fixed;
            top: 16px;
            right: 16px;
            z-index: 100001;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none;
            width: min(360px, calc(100vw - 24px));
        }
        .tm-inline-notification {
            pointer-events: auto;
            color: #f8fafc;
            padding: 12px 14px;
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.26);
            font-size: 13px;
            line-height: 1.45;
            font-weight: 600;
            letter-spacing: 0.02em;
            box-shadow: 0 14px 28px rgba(2, 6, 23, 0.28);
            backdrop-filter: blur(6px);
            -webkit-backdrop-filter: blur(6px);
            opacity: 0;
            animation: tm-inline-slide-in 0.3s ease forwards;
        }
        .tm-inline-notification-info {
            background: linear-gradient(135deg, rgba(8, 145, 178, 0.95), rgba(14, 116, 144, 0.95));
        }
        .tm-inline-notification-success {
            background: linear-gradient(135deg, rgba(22, 163, 74, 0.95), rgba(21, 128, 61, 0.95));
        }
        .tm-inline-notification-warning {
            background: linear-gradient(135deg, rgba(234, 88, 12, 0.95), rgba(194, 65, 12, 0.95));
        }
        .tm-inline-notification-error {
            background: linear-gradient(135deg, rgba(220, 38, 38, 0.96), rgba(190, 24, 93, 0.96));
        }
        #tm-inline-editor .tm-inline-btn {
            border: none;
            border-radius: 14px;
            width: 100%;
            padding: 11px 14px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: space-between;
            text-align: left;
            color: #ffffff;
            background: linear-gradient(135deg, #0d6efd, #0b5ed7);
            box-shadow: 0 6px 16px rgba(13, 110, 253, 0.25);
            transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, opacity 0.2s ease;
        }
        #tm-inline-editor .tm-inline-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 8px 20px rgba(13, 110, 253, 0.35);
        }
        #tm-inline-editor .tm-inline-btn:active {
            transform: translateY(0);
        }
        #tm-inline-editor .tm-inline-btn:disabled {
            opacity: 0.55;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }
        #tm-inline-editor .tm-inline-btn:disabled:hover {
            transform: none;
            box-shadow: none;
        }
        #tm-inline-editor .tm-inline-btn.tm-inline-btn-active {
            background: linear-gradient(135deg, #198754, #157347);
            box-shadow: 0 8px 20px rgba(25, 135, 84, 0.35);
        }
        #tm-inline-editor .tm-inline-btn.tm-inline-btn-warning {
            background: linear-gradient(135deg, #fd7e14, #e36209);
            box-shadow: 0 6px 16px rgba(253, 126, 20, 0.25);
        }
        #tm-inline-editor .tm-inline-btn.tm-inline-btn-warning:hover {
            box-shadow: 0 8px 20px rgba(253, 126, 20, 0.35);
        }
        #tm-inline-editor .tm-inline-btn.tm-inline-btn-ghost {
            background: rgba(15, 23, 42, 0.1);
            color: #0f172a;
            box-shadow: none;
        }
        #tm-inline-editor .tm-inline-btn.tm-inline-btn-ghost:hover {
            background: rgba(15, 23, 42, 0.16);
        }
        .tm-inline-refund-row-hidden {
            opacity: 0 !important;
            pointer-events: none;
        }
        .tm-inline-image-replace-trigger {
            --tm-trigger-size: 22px;
            position: absolute;
            top: 6px;
            right: 6px;
            z-index: 2147483647;
            display: inline-flex!important;
            align-items: center;
            justify-content: center;
            min-width: var(--tm-trigger-size);
            height: var(--tm-trigger-size)!important;
            padding: 0 6px;
            border-radius: 999px;
            background: linear-gradient(135deg, rgba(251, 113, 133, 0.98), rgba(225, 29, 72, 0.98));
            color: #ffffff;
            font-size: 12px;
            font-weight: 700;
            line-height: 1;
            cursor: pointer;
            user-select: none;
            box-shadow: 0 8px 16px rgba(15, 23, 42, 0.34);
            transition: transform 0.2s ease, filter 0.2s ease, box-shadow 0.2s ease;
        }
        .tm-inline-image-replace-trigger:hover {
            transform: translateY(-1px);
            filter: brightness(1.06);
        }
        .tm-inline-image-replace-trigger:focus {
            outline: 2px solid rgba(14, 165, 233, 0.95);
            outline-offset: 2px;
        }
        #altImages .tm-inline-image-replace-trigger,
        li.imageThumbnail .tm-inline-image-replace-trigger {
            --tm-trigger-size: 16px;
            top: 2px;
            right: 2px;
            padding: 0 4px;
            font-size: 10px;
        }
        .tm-inline-thumb-fixed-image {
            display: block;
            box-sizing: border-box;
            width: var(--tm-thumb-w, 40px) !important;
            height: var(--tm-thumb-h, 40px) !important;
            min-width: var(--tm-thumb-w, 40px) !important;
            min-height: var(--tm-thumb-h, 40px) !important;
            max-width: var(--tm-thumb-w, 40px) !important;
            max-height: var(--tm-thumb-h, 40px) !important;
            object-fit: cover !important;
            object-position: center center !important;
        }
        .tm-inline-main-fixed-image {
            image-rendering: auto;
        }
        @media (max-width: 640px) {
            #tm-inline-editor {
                bottom: 16px;
                right: 12px;
            }
            .tm-inline-toolbar-panel {
                width: min(260px, calc(100vw - 24px));
            }
            .tm-inline-toolbar-trigger {
                min-width: 60px;
                height: 56px;
                padding: 0 14px;
                border-radius: 20px;
            }
            #tm-inline-notifications {
                top: auto;
                right: 10px;
                left: 10px;
                bottom: 80px;
                width: auto;
            }
            .tm-inline-notification {
                font-size: 12px;
                padding: 10px 12px;
            }
        }
        .tm-inline-editing {
            outline: 2px dashed rgba(13, 110, 253, 0.85);
            outline-offset: 2px;
            background-color: rgba(13, 110, 253, 0.08);
            transition: background-color 0.2s ease, outline-color 0.2s ease;
        }
        .tm-inline-editing:focus {
            background-color: rgba(13, 110, 253, 0.18);
            outline-color: rgba(25, 135, 84, 0.85);
        }
        @keyframes tm-inline-slide-in {
            from { opacity: 0; transform: translateX(120%); }
            to { opacity: 1; transform: translateX(0); }
        }
        @keyframes tm-inline-slide-out {
            from { opacity: 1; transform: translateX(0); }
            to { opacity: 0; transform: translateX(120%); }
        }
    `);
}
