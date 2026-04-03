import { GM_addStyle } from '$';

export function injectEditorStyles() {
    GM_addStyle(`
        #tm-inline-editor {
            position: fixed;
            bottom: 16px;
            right: 16px;
            display: flex;
            align-items: flex-end;
            z-index: 100000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: calc(100vw - 12px);
        }
        .tm-inline-toolbar-panel {
            display: grid;
            grid-auto-flow: column;
            align-items: center;
            gap: 8px;
            padding: 8px;
            border-radius: 10px;
            background: rgba(246, 248, 250, 0.96);
            border: 1px solid #d0d7de;
            box-shadow: 0 8px 24px rgba(140, 149, 159, 0.2);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            max-width: min(520px, calc(100vw - 16px));
        }
        .tm-inline-toolbar-group {
            display: flex;
            align-items: center;
            gap: 6px;
            min-width: 0;
        }
        .tm-inline-toolbar-group-main {
            padding-right: 8px;
            border-right: 1px solid rgba(208, 215, 222, 0.96);
        }
        .tm-inline-toolbar-group-actions {
            flex-wrap: wrap;
            justify-content: flex-end;
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
            border: 1px solid #d0d7de;
            border-radius: 6px;
            min-width: 0;
            height: 28px;
            padding: 0 10px;
            font-size: 12px;
            line-height: 20px;
            font-weight: 500;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            text-align: center;
            white-space: nowrap;
            color: #24292f;
            background: linear-gradient(#f6f8fa, #f3f4f6);
            box-shadow: 0 1px 0 rgba(27, 31, 36, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.25);
            transition: background 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease, color 0.16s ease, opacity 0.16s ease;
            flex: 0 0 auto;
        }
        #tm-inline-editor .tm-inline-btn-icon {
            width: 12px;
            height: 12px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            flex: 0 0 auto;
        }
        #tm-inline-editor .tm-inline-btn-icon svg {
            width: 12px;
            height: 12px;
            display: block;
            overflow: visible;
        }
        #tm-inline-editor .tm-inline-btn-icon-alt {
            display: none;
        }
        #tm-inline-editor .tm-inline-btn-label {
            display: inline-block;
        }
        #tm-inline-editor .tm-inline-btn:hover {
            background: linear-gradient(#f3f4f6, #ebedf0);
            border-color: #afb8c1;
            box-shadow: 0 1px 0 rgba(27, 31, 36, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.25);
        }
        #tm-inline-editor .tm-inline-btn:active {
            background: #ebecf0;
            box-shadow: inset 0 1px 0 rgba(208, 215, 222, 0.2);
        }
        #tm-inline-editor .tm-inline-btn:focus-visible {
            outline: 2px solid rgba(9, 105, 218, 0.35);
            outline-offset: 0;
            box-shadow: 0 0 0 3px rgba(9, 105, 218, 0.15);
        }
        #tm-inline-editor .tm-inline-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            box-shadow: none;
        }
        #tm-inline-editor .tm-inline-btn:disabled:hover {
            box-shadow: none;
            border-color: #d0d7de;
            background: linear-gradient(#f6f8fa, #f3f4f6);
        }
        #tm-inline-editor .tm-inline-btn.tm-inline-btn-primary {
            color: #ffffff;
            background: linear-gradient(#2da44e, #2c974b);
            border-color: rgba(31, 136, 61, 0.4);
            box-shadow: 0 1px 0 rgba(27, 31, 36, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1);
        }
        #tm-inline-editor .tm-inline-btn.tm-inline-btn-primary:hover {
            background: linear-gradient(#2c974b, #298e46);
            border-color: rgba(31, 136, 61, 0.55);
        }
        #tm-inline-editor .tm-inline-btn.tm-inline-btn-active {
            color: #ffffff;
            background: linear-gradient(#1f883d, #1a7f37);
            border-color: rgba(31, 136, 61, 0.65);
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }
        #tm-inline-editor .tm-inline-btn.tm-inline-btn-warning {
            color: #cf222e;
            background: linear-gradient(#fff8f8, #fff1f0);
            border-color: rgba(207, 34, 46, 0.22);
            box-shadow: none;
        }
        #tm-inline-editor .tm-inline-btn.tm-inline-btn-warning:hover {
            background: linear-gradient(#ffefeb, #ffe6e0);
            border-color: rgba(207, 34, 46, 0.32);
        }
        #tm-inline-editor .tm-inline-btn.tm-inline-btn-ghost {
            background: linear-gradient(#f6f8fa, #f3f4f6);
            color: #24292f;
        }
        #tm-inline-editor .tm-inline-btn.tm-inline-btn-ghost:hover {
            background: linear-gradient(#f3f4f6, #ebedf0);
        }
        #tm-inline-editor .tm-inline-btn.tm-inline-btn-selected {
            color: #0969da;
            background: linear-gradient(#ddf4ff, #d8eefc);
            border-color: rgba(9, 105, 218, 0.24);
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
        }
        #tm-inline-editor .tm-inline-btn.tm-inline-btn-active .tm-inline-btn-icon-default,
        #tm-inline-editor .tm-inline-btn.tm-inline-btn-selected .tm-inline-btn-icon-default {
            display: none;
        }
        #tm-inline-editor .tm-inline-btn.tm-inline-btn-active .tm-inline-btn-icon-alt,
        #tm-inline-editor .tm-inline-btn.tm-inline-btn-selected .tm-inline-btn-icon-alt {
            display: inline-flex;
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
        .tm-inline-text-dialog-trigger {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 24px;
            height: 24px;
            margin-left: 6px;
            padding: 0 8px;
            border: none;
            border-radius: 999px;
            vertical-align: middle;
            color: #ffffff;
            background: linear-gradient(135deg, #198754, #157347);
            box-shadow: 0 6px 14px rgba(21, 128, 61, 0.24);
            font-size: 12px;
            font-weight: 700;
            line-height: 1;
            cursor: pointer;
            transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
        }
        .tm-inline-text-dialog-trigger:hover {
            transform: translateY(-1px);
            filter: brightness(1.03);
            box-shadow: 0 8px 18px rgba(21, 128, 61, 0.3);
        }
        .tm-inline-text-dialog-trigger:focus {
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
                bottom: 12px;
                right: 12px;
                max-width: calc(100vw - 24px);
            }
            .tm-inline-toolbar-panel {
                grid-auto-flow: row;
                justify-items: end;
                max-width: min(340px, calc(100vw - 24px));
                gap: 6px;
                padding: 7px;
            }
            .tm-inline-toolbar-group-main {
                padding-right: 0;
                border-right: none;
            }
            #tm-inline-editor .tm-inline-btn {
                height: 26px;
                padding: 0 9px;
                font-size: 11px;
                gap: 5px;
            }
            #tm-inline-editor .tm-inline-btn-icon,
            #tm-inline-editor .tm-inline-btn-icon svg {
                width: 11px;
                height: 11px;
            }
            #tm-inline-notifications {
                top: auto;
                right: 10px;
                left: 10px;
                bottom: 68px;
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
