import { GM_addStyle, GM_getValue, GM_setValue, unsafeWindow } from '$';

(function () {
    'use strict';
    const amazonRetailHostPattern = /(^|\.)amazon\.(?:com|[a-z]{2,3}|com\.[a-z]{2}|co\.[a-z]{2})$/i;
    const currentHostname = window.location && window.location.hostname ? window.location.hostname : '';
    if (!amazonRetailHostPattern.test(currentHostname)) {
        console.warn('Amazon 页面元素内联编辑助手（含顶部广告移除）: 非亚马逊页面，未启动。');
        return;
    }

    const amazonTopAdSelectors = ['#nav-swmslot', '#navSwmHoliday'];
    const amazonTopAdSelectorText = amazonTopAdSelectors.join(', ');

    GM_addStyle(`
        ${amazonTopAdSelectors.join(',\n        ')} {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
        }
    `);

    function removeAmazonTopAdsFromNode(node) {
        if (!(node instanceof Element)) return 0;

        let removedCount = 0;

        try {
            if (typeof node.matches === 'function' && node.matches(amazonTopAdSelectorText)) {
                node.remove();
                return 1;
            }

            if (typeof node.querySelectorAll === 'function') {
                node.querySelectorAll(amazonTopAdSelectorText).forEach((element) => {
                    element.remove();
                    removedCount += 1;
                });
            }
        } catch (error) {
            console.warn('移除 Amazon 顶部广告失败:', error);
        }

        return removedCount;
    }

    function removeAmazonTopAds(root = document) {
        if (root instanceof Element) {
            return removeAmazonTopAdsFromNode(root);
        }

        let removedCount = 0;
        try {
            document.querySelectorAll(amazonTopAdSelectorText).forEach((element) => {
                element.remove();
                removedCount += 1;
            });
        } catch (error) {
            console.warn('移除 Amazon 顶部广告失败:', error);
        }
        return removedCount;
    }

    function startAmazonTopAdCleanup() {
        const cleanup = () => removeAmazonTopAds();
        cleanup();

        const observerRoot = document.documentElement || document;
        if (!observerRoot) return;

        const mutationObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (!mutation || mutation.type !== 'childList' || !mutation.addedNodes) continue;
                mutation.addedNodes.forEach((node) => {
                    removeAmazonTopAdsFromNode(node);
                });
            }
        });

        mutationObserver.observe(observerRoot, {
            childList: true,
            subtree: true
        });

        const stopCleanupObserver = () => mutationObserver.disconnect();
        window.addEventListener('DOMContentLoaded', cleanup, { once: true });
        window.addEventListener('load', () => {
            cleanup();
            window.setTimeout(stopCleanupObserver, 4000);
        }, { once: true });
        window.setTimeout(stopCleanupObserver, 15000);
    }

    startAmazonTopAdCleanup();

    const CHARGE_SUMMARY_LABEL_ALIASES = {
        charge_subtotal: ['subtotal', '小计', '小計', 'sous-total', 'zwischensumme', 'subtotale', 'ara toplam'],
        charge_shipping: ['shipping', 'shipping & handling', 'delivery', 'delivery charges', '运费', '配送', '送料', 'livraison', 'versand', 'spedizione', 'envio', 'envío', 'frete', 'verzending', 'frakt', 'dostawa', 'kargo'],
        charge_total_before_tax: ['total before tax', 'before tax', 'pretax', '税前', 'avant taxes', 'vor steuern', 'antes de impuestos', 'imposte escluse', 'vergiler haric'],
        charge_estimated_tax: ['estimated tax', 'estimated vat', 'estimated gst', 'tax to be collected', 'vat to be collected', '税费', '税額', 'consumption tax', 'impuestos estimados', 'taxe estimee', 'voraussichtliche steuer', 'imposta stimata', 'szacowany podatek'],
        charge_refund_total: ['refund total', 'refund', '退款', '返金', '払い戻し', 'reembolso', 'rimborso', 'remboursement', 'erstattung', 'rückerstattung', 'zwrot', 'iade', 'استرداد']
    };

    function normalizeTextContent(value) {
        let text = String(value || '');
        try {
            text = text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
        } catch (error) {
            // Ignore normalization failures and keep the original text.
        }
        return text
            .replace(/[\s\u00a0]+/g, ' ')
            .replace(/[：:]/g, '')
            .trim()
            .toLowerCase();
    }

    function getConfigSelectorList(config) {
        if (!config) return [];
        if (Array.isArray(config.selector)) {
            return config.selector.filter((item) => typeof item === 'string' && item.trim());
        }
        return typeof config.selector === 'string' && config.selector.trim()
            ? [config.selector]
            : [];
    }

    function getConfigWatchSelectorList(config) {
        if (!config) return [];
        if (Array.isArray(config.watchSelectors)) {
            return config.watchSelectors.filter((item) => typeof item === 'string' && item.trim());
        }
        if (typeof config.watchSelector === 'string' && config.watchSelector.trim()) {
            return [config.watchSelector];
        }
        return getConfigSelectorList(config);
    }

    function normalizeResolvedElements(elements) {
        if (!elements) return [];
        const list = Array.isArray(elements) ? elements : [elements];
        const result = [];
        const seen = new Set();

        list.forEach((element) => {
            if (!(element instanceof HTMLElement) || seen.has(element)) return;
            seen.add(element);
            result.push(element);
        });

        return result;
    }

    function cloneFieldConfig(config) {
        if (!config || typeof config !== 'object') return config;

        return {
            ...config,
            selector: Array.isArray(config.selector) ? [...config.selector] : config.selector,
            watchSelectors: Array.isArray(config.watchSelectors) ? [...config.watchSelectors] : config.watchSelectors
        };
    }

    function getChargeSummaryRows() {
        const rows = [];
        const seen = new Set();

        document.querySelectorAll('[data-component="chargeSummary"]').forEach((container) => {
            const listItemCandidates = container.querySelectorAll('li');
            const candidates = listItemCandidates.length > 0
                ? listItemCandidates
                : container.querySelectorAll('.od-line-item-row');
            candidates.forEach((row) => {
                if (!(row instanceof HTMLElement) || seen.has(row)) return;

                const labelElement = row.querySelector('.od-line-item-row-label, [class*="line-item-row-label"]');
                const valueElement = row.querySelector('.od-line-item-row-content, [class*="line-item-row-content"]');
                if (!(labelElement instanceof HTMLElement) || !(valueElement instanceof HTMLElement)) return;

                const labelText = normalizeTextContent(labelElement.textContent);
                const valueText = normalizeTextContent(valueElement.textContent);
                if (!labelText && !valueText) return;

                seen.add(row);
                rows.push({
                    row,
                    labelElement,
                    valueElement,
                    labelText,
                    valueText
                });
            });
        });

        return rows;
    }

    function rowMatchesAlias(row, aliases) {
        if (!row || !Array.isArray(aliases) || aliases.length === 0) return false;
        return aliases.some((alias) => {
            const normalizedAlias = normalizeTextContent(alias);
            return normalizedAlias && row.labelText.includes(normalizedAlias);
        });
    }

    function getChargeSummaryRowByKey(keySuffix) {
        const rows = getChargeSummaryRows();
        if (rows.length === 0) return null;

        const aliasMatch = rowMatchesAlias;
        const refundRow = rows.find((row) => aliasMatch(row, CHARGE_SUMMARY_LABEL_ALIASES.charge_refund_total)) || null;

        if (keySuffix === 'charge_refund_total' || keySuffix === 'charge_refund_total_label') {
            if (refundRow) return refundRow;
            return rows.length >= 6 ? rows[rows.length - 1] : null;
        }

        const directAliases = CHARGE_SUMMARY_LABEL_ALIASES[keySuffix];
        if (Array.isArray(directAliases)) {
            const matchedRow = rows.find((row) => aliasMatch(row, directAliases));
            if (matchedRow) return matchedRow;
        }

        if (keySuffix === 'charge_grand_total') {
            if (refundRow) {
                const refundIndex = rows.indexOf(refundRow);
                return refundIndex > 0 ? rows[refundIndex - 1] : refundRow;
            }
            return rows[rows.length - 1] || null;
        }

        const fallbackIndexMap = {
            charge_subtotal: 0,
            charge_shipping: 1,
            charge_total_before_tax: 2,
            charge_estimated_tax: 3
        };

        const fallbackIndex = fallbackIndexMap[keySuffix];
        return Number.isInteger(fallbackIndex) && rows[fallbackIndex]
            ? rows[fallbackIndex]
            : null;
    }

    function resolveChargeSummaryElements(keySuffix, part = 'value') {
        const row = getChargeSummaryRowByKey(keySuffix);
        if (!row) return [];
        if (part === 'row') return [row.row];
        if (part === 'label') return row.labelElement ? [row.labelElement] : [];
        return row.valueElement ? [row.valueElement] : [];
    }

    function getSellerInfoContainer() {
        return document.querySelector('#page-section-detail-seller-info .a-box-inner');
    }

    function getSellerInfoRows() {
        const container = getSellerInfoContainer();
        if (!(container instanceof HTMLElement)) return [];
        return Array.from(container.querySelectorAll(':scope > .a-row')).filter((row) => row instanceof HTMLElement);
    }

    function getBusinessNameRow() {
        return getSellerInfoRows().find((row) => row.querySelector('span.a-text-bold + span')) || null;
    }

    function getBusinessAddressLabelRow() {
        const rows = getSellerInfoRows();
        for (let index = 0; index < rows.length; index += 1) {
            const row = rows[index];
            if (!(row instanceof HTMLElement) || !row.querySelector('span.a-text-bold')) continue;

            let next = row.nextElementSibling;
            while (next instanceof HTMLElement && next.classList.contains('a-spacing-none')) {
                if (next.classList.contains('indent-left')) {
                    return row;
                }
                next = next.nextElementSibling;
            }
        }
        return null;
    }

    function resolveBusinessNameElements(part = 'value') {
        const row = getBusinessNameRow();
        if (!(row instanceof HTMLElement)) return [];
        if (part === 'label') {
            return normalizeResolvedElements(row.querySelector('span.a-text-bold'));
        }
        return normalizeResolvedElements(row.querySelector('span.a-text-bold + span'));
    }

    function resolveBusinessAddressElements(part = 'value') {
        const row = getBusinessAddressLabelRow();
        if (!(row instanceof HTMLElement)) return [];
        if (part === 'label') {
            return normalizeResolvedElements(row.querySelector('span.a-text-bold'));
        }

        const values = [];
        let next = row.nextElementSibling;
        while (next instanceof HTMLElement && next.classList.contains('a-spacing-none')) {
            if (!next.classList.contains('indent-left')) break;
            next.querySelectorAll('span').forEach((span) => values.push(span));
            next = next.nextElementSibling;
        }
        return normalizeResolvedElements(values);
    }

    function resolveOfferDisplayBrandElements() {
        const candidates = collectElementsFromSelectors([
            '#sellerProfileTriggerId',
            '#seller-name'
        ]);
        const preferred = pickPreferredValueElement(candidates);
        return preferred ? [preferred] : [];
    }

    const PRODUCT_OVERVIEW_BRAND_SELECTORS = [
        '#productOverview_feature_div > div > table > tbody > tr.a-spacing-small.po-brand > td.a-span9 > span',
        '#poExpander > div.a-expander-content.a-expander-partial-collapse-content > div > table > tbody > tr.a-spacing-small.po-brand > td.a-span9 > span',
        '#topHighlight > div.a-section.a-spacing-small.a-spacing-top-small > table > tbody > tr.a-spacing-small.po-brand > td.a-span9 > span'
    ];

    function resolveProductOverviewBrandElements() {
        return collectElementsFromSelectors(PRODUCT_OVERVIEW_BRAND_SELECTORS);
    }

    class StorageManager {
        #defaultList = [
            {
                name: '订单日期',
                keySuffix: 'order_date',
                selector: '[data-component="orderDate"]'
            },
            {
                name: '订单号',
                keySuffix: 'order_id',
                selector: '[data-component="orderId"]'
            },
            {
                name: '收货地址',
                keySuffix: 'shipping_address_lines',
                selector: '[data-component="shippingAddress"] .a-list-item',
                multiple: true
            },
            {
                name: '预计送达日期',
                keySuffix: 'checkout_delivery_date',
                selector: '#checkout-item-block-panel h2.address-promise-text span.break-word'
            },
            {
                name: '配送选项日期',
                keySuffix: 'checkout_delivery_option_date',
                selector: [
                    '#col-delivery-group .rcx-checkout-delivery-option-a-control-row-new .col-delivery-message span.a-text-bold',
                    '.rcx-checkout-delivery-option-a-control-row .delivery-promise-text'
                ],
                multiple: true
            },
            {
                name: '配送选项费用',
                keySuffix: 'checkout_delivery_option_price',
                selector: [
                    '#col-delivery-group .rcx-checkout-delivery-option-a-control-row-new .col-delivery-price span',
                    '.rcx-checkout-delivery-option-a-control-row .delivery-option-text'
                ],
                multiple: true
            },
            {
                name: '发货信息',
                keySuffix: 'checkout_ships_from',
                selector: '#checkout-item-block-panel .lineitem-container .product-description-column p.a-spacing-none > span.a-size-small',
                multiple: true
            },
            // {
            //     name: '订单汇总区域',
            //     keySuffix: 'charge_summary',
            //     selector: '[data-component="chargeSummary"]',
            //     noHighlight: true
            // },
            {
                name: '小计',
                keySuffix: 'charge_subtotal',
                selector: '[data-component="chargeSummary"] li:nth-of-type(1) .od-line-item-row-content .a-color-base',
                watchSelectors: ['[data-component="chargeSummary"]'],
                resolveElements: () => resolveChargeSummaryElements('charge_subtotal')
            },
            {
                name: '运费',
                keySuffix: 'charge_shipping',
                selector: '[data-component="chargeSummary"] li:nth-of-type(2) .od-line-item-row-content .a-color-base',
                watchSelectors: ['[data-component="chargeSummary"]'],
                resolveElements: () => resolveChargeSummaryElements('charge_shipping')
            },
            {
                name: '税前总计',
                keySuffix: 'charge_total_before_tax',
                selector: '[data-component="chargeSummary"] li:nth-of-type(3) .od-line-item-row-content .a-color-base',
                watchSelectors: ['[data-component="chargeSummary"]'],
                resolveElements: () => resolveChargeSummaryElements('charge_total_before_tax')
            },
            {
                name: '预估税费',
                keySuffix: 'charge_estimated_tax',
                selector: '[data-component="chargeSummary"] li:nth-of-type(4) .od-line-item-row-content .a-color-base',
                watchSelectors: ['[data-component="chargeSummary"]'],
                resolveElements: () => resolveChargeSummaryElements('charge_estimated_tax')
            },
            {
                name: '总计',
                keySuffix: 'charge_grand_total',
                selector: '[data-component="chargeSummary"] li:nth-of-type(5) .od-line-item-row-content .a-color-base',
                watchSelectors: ['[data-component="chargeSummary"]'],
                resolveElements: () => resolveChargeSummaryElements('charge_grand_total')
            },
            {
                name: '退款总计标签',
                keySuffix: 'charge_refund_total_label',
                selector: '[data-component="chargeSummary"] li:nth-of-type(6) .od-line-item-row-label .a-size-base',
                watchSelectors: ['[data-component="chargeSummary"]'],
                resolveElements: () => resolveChargeSummaryElements('charge_refund_total_label', 'label')
            },
            {
                name: '退款总计',
                keySuffix: 'charge_refund_total',
                selector: '[data-component="chargeSummary"] li:nth-of-type(6) .od-line-item-row-content .a-color-base',
                watchSelectors: ['[data-component="chargeSummary"]'],
                resolveElements: () => resolveChargeSummaryElements('charge_refund_total')
            },
            {
                name: '商品标题',
                keySuffix: 'order_item_title',
                selector: [
                    '[data-component="itemTitle"]',
                    '#checkout-item-block-panel [data-csa-c-slot-id="checkout-item-block-itemPrimaryTitle"] .lineitem-title-text'
                ],
                multiple: true
            },
            {
                name: '商家信息',
                keySuffix: 'ordered_merchant',
                selector: [
                    '[data-component="orderedMerchant"]',
                    '#checkout-item-block-panel .lineitem-seller-section a span.break-word'
                ],
                multiple: true
            },
            {
                name: '退货信息',
                keySuffix: 'item_return_eligibility',
                selector: '[data-component="itemReturnEligibility"]',
                multiple: true
            },
            {
                name: '单价',
                keySuffix: 'unit_price',
                selector: '[data-component="unitPrice"]',
                multiple: true
            },
            {
                name: '订单商品图片',
                keySuffix: 'order_item_image',
                selector: [
                    '[data-component="itemImage"] img',
                    '#checkout-item-block-panel [data-csa-c-slot-id="checkout-item-block-productImage"] img'
                ],
                type: 'image',
                multiple: true
            },
            {
                name: '配送信息 1 (PDM)',
                keySuffix: 'delivery_pdm',
                selector: '[data-csa-c-content-id="DEXUnifiedCXPDM"]'
            },
            {
                name: '配送信息 2 (SDM)',
                keySuffix: 'delivery_sdm',
                selector: '[data-csa-c-content-id="DEXUnifiedCXSDM"]'
            },
            {
                name: '品牌/卖家 (报价区)',
                keySuffix: 'brand_offer_display',
                watchSelectors: ['#sellerProfileTriggerId', '#seller-name'],
                resolveElements: () => resolveOfferDisplayBrandElements()
            },
            {
                name: '品牌 (商品概览)',
                keySuffix: 'brand_product_overview',
                watchSelectors: ['#productOverview_feature_div', '#poExpander', '#topHighlight', '#voyagerNorthstarATF'],
                resolveElements: () => resolveProductOverviewBrandElements()
            },
            {
                name: '品牌信息',
                keySuffix: 'byline_info',
                selector: [
                    '#bylineInfo',
                    '#seller-info-storefront-link > span > a'
                ]
            },
            {
                name: '评论数',
                keySuffix: 'customer_review_count',
                selector: '#acrCustomerReviewText'
            },
            {
                name: 'Business Name 标签',
                keySuffix: 'business_name_label',
                selector: '#page-section-detail-seller-info .a-box-inner > .a-row.a-spacing-none:nth-of-type(2) > span.a-text-bold',
                watchSelectors: ['#page-section-detail-seller-info .a-box-inner'],
                resolveElements: () => resolveBusinessNameElements('label')
            },
            {
                name: 'Business Name',
                keySuffix: 'business_name',
                selector: '#page-section-detail-seller-info .a-box-inner > .a-row.a-spacing-none:nth-of-type(2) > span.a-text-bold + span',
                watchSelectors: ['#page-section-detail-seller-info .a-box-inner'],
                resolveElements: () => resolveBusinessNameElements('value')
            },
            {
                name: 'Business Address 标签',
                keySuffix: 'business_address_label',
                selector: '#page-section-detail-seller-info .a-box-inner > .a-row.a-spacing-none:nth-of-type(3) > span.a-text-bold',
                watchSelectors: ['#page-section-detail-seller-info .a-box-inner'],
                resolveElements: () => resolveBusinessAddressElements('label')
            },
            {
                name: 'Business Address',
                keySuffix: 'business_address',
                selector: '#page-section-detail-seller-info .a-box-inner > .a-row.a-spacing-none.indent-left > span',
                watchSelectors: ['#page-section-detail-seller-info .a-box-inner'],
                resolveElements: () => resolveBusinessAddressElements('value'),
                multiple: true
            },
            {
                name: '商品标题 (卡片页)',
                keySuffix: 'product_card_title',
                selector: '#product-title > span > a > h5'
            },
            {
                name: '商品价格 (卡片页)',
                keySuffix: 'product_card_price',
                selector: '#product-price > span'
            },
            {
                name: '商品图片 (卡片页)',
                keySuffix: 'product_card_image',
                selector: [
                    'img#product-p0-image',
                    '#product-p0-image img'
                ],
                type: 'image'
            },
            {
                name: '商品标题 (详情页)',
                keySuffix: 'product_title',
                selector: '#productTitle'
            },
            {
                name: '五点描述 (详情页)',
                keySuffix: 'product_feature_bullets',
                selector: '#feature-bullets ul.a-unordered-list.a-vertical.a-spacing-mini li > span.a-list-item',
                multiple: true
            },
            {
                name: '主预览图 (详情页)',
                keySuffix: 'product_main_preview_image',
                selector: [
                    '#mediaBlock_feature_div #landingImage',
                    '#mediaBlock_feature_div #imgTagWrapperId img'
                ],
                type: 'image'
            },
            {
                name: '缩略预览图 (详情页)',
                keySuffix: 'product_thumb_preview_images',
                selector: '#mediaBlock_feature_div #altImages img',
                type: 'image',
                multiple: true
            },

        ];

        constructor() {
            this.prefix = 'tm_inline_editor_';
        }

        savePersistent(key, data) {
            try {
                GM_setValue(this.prefix + key, JSON.stringify(data));
                return true;
            } catch (error) {
                console.error('保存数据失败:', key, error);
                return false;
            }
        }

        loadPersistent(key, defaultValue = null) {
            try {
                const stored = GM_getValue(this.prefix + key, null);
                return stored ? JSON.parse(stored) : defaultValue;
            } catch (error) {
                console.error('读取数据失败:', key, error);
                return defaultValue;
            }
        }

        getDefaultList() {
            return this.#defaultList.map((item) => cloneFieldConfig(item));
        }

        loadValueMap() {
            const stored = this.loadPersistent('dataMap', null);
            if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
                return stored;
            }

            const legacyList = this.loadPersistent('data', null);
            if (Array.isArray(legacyList) && legacyList.length > 0) {
                const migrated = {};
                legacyList.forEach((item, index) => {
                    if (!item || item.value === undefined || item.value === null) return;
                    const selectors = Array.isArray(item.selector) ? item.selector : [item.selector];
                    const suffix = item.keySuffix || selectors[0] || `legacy_${index}`;
                    migrated[suffix] = item.value;
                });
                this.savePersistent('dataMap', migrated);
                return migrated;
            }

            return {};
        }

        saveValueMap(map) {
            return this.savePersistent('dataMap', map);
        }

        clearValueMap() {
            return this.saveValueMap({});
        }
    }

    class NotificationManager {
        constructor() {
            this.container = document.createElement('div');
            this.container.id = 'tm-inline-notifications';
            document.body.appendChild(this.container);
        }

        show(message, type = 'info', duration = 2600) {
            const notification = document.createElement('div');
            const safeType = ['success', 'error', 'warning', 'info'].includes(type) ? type : 'info';
            notification.className = `tm-inline-notification tm-inline-notification-${safeType}`;
            notification.setAttribute('role', safeType === 'error' ? 'alert' : 'status');
            notification.textContent = message;
            this.container.appendChild(notification);

            setTimeout(() => {
                notification.style.animation = 'tm-inline-slide-out 0.3s ease forwards';
                setTimeout(() => notification.remove(), 280);
            }, duration);
        }
    }


    function findElementsBySelector(selector) {
        if (!selector) return [];
        const uniqueElements = new Set();

        try {
            document.querySelectorAll(selector).forEach((element) => {
                if (element instanceof HTMLElement) {
                    uniqueElements.add(element);
                }
            });
        } catch (error) {
            console.warn('CSS 选择器解析失败:', selector, error);
        }

        return Array.from(uniqueElements.values());
    }



    function collectElementsFromSelectors(selectors) {
        const selectorList = Array.isArray(selectors) ? selectors : [selectors];
        const results = [];
        const seen = new Set();

        selectorList
            .filter(Boolean)
            .forEach((selector) => {
                findElementsBySelector(selector).forEach((element) => {
                    if (!element || seen.has(element)) return;
                    seen.add(element);
                    results.push(element);
                });
            });

        return results;
    }

    function collectElementsFromConfig(config) {
        if (!config) return [];

        const results = [];
        const seen = new Set();

        collectElementsFromSelectors(getConfigSelectorList(config)).forEach((element) => {
            if (!element || seen.has(element)) return;
            seen.add(element);
            results.push(element);
        });

        if (typeof config.resolveElements === 'function') {
            try {
                normalizeResolvedElements(config.resolveElements()).forEach((element) => {
                    if (!element || seen.has(element)) return;
                    seen.add(element);
                    results.push(element);
                });
            } catch (error) {
                console.warn('解析动态元素失败:', config.keySuffix || config.name || config.selector, error);
            }
        }

        return results;
    }

    function extractElementValue(element) {
        if (!element) return '';

        if (element instanceof HTMLImageElement) {
            return element.src || '';
        }

        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
            return element.value;
        }

        if (element.childElementCount > 0) {
            return element.innerHTML.trim();
        }

        return (element.textContent || '').trim();
    }

    function isElementLikelyVisible(element) {
        if (!(element instanceof HTMLElement)) return false;
        if (!element.isConnected) return false;

        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') {
            return false;
        }

        const rect = element.getBoundingClientRect();
        return rect.width > 0 || rect.height > 0;
    }

    function pickPreferredValueElement(elements) {
        if (!Array.isArray(elements) || elements.length === 0) return null;

        const visibleElement = elements.find((element) => isElementLikelyVisible(element));
        return visibleElement || elements[0] || null;
    }

    function getEditedElementWithChangedValue(elements, editedElements) {
        if (!Array.isArray(elements) || elements.length === 0 || !(editedElements instanceof Map)) {
            return null;
        }

        for (const element of elements) {
            const state = editedElements.get(element);
            if (!state || !Object.prototype.hasOwnProperty.call(state, 'originalValue')) {
                continue;
            }

            const currentValue = extractElementValue(element);
            if (!isEqualValue(state.originalValue, currentValue)) {
                return element;
            }
        }

        return null;
    }

    function isEqualValue(currentValue, nextValue) {
        if (Array.isArray(currentValue) && Array.isArray(nextValue)) {
            if (currentValue.length !== nextValue.length) return false;
            for (let i = 0; i < currentValue.length; i++) {
                if (currentValue[i] !== nextValue[i]) return false;
            }
            return true;
        }
        return currentValue === nextValue;
    }

    function isThumbnailLikeImage(element) {
        if (!(element instanceof HTMLImageElement)) return false;
        return Boolean(element.closest('#altImages, li.imageThumbnail, #ivThumbs, #ivThumbs360, #ivThumbsDimensions'));
    }

    function isSameDocumentAnchorHref(href) {
        const rawHref = typeof href === 'string' ? href.trim() : '';
        if (!rawHref) return true;

        const loweredHref = rawHref.toLowerCase();
        if (loweredHref === '#' || loweredHref.startsWith('#') || loweredHref.startsWith('javascript:')) {
            return true;
        }

        try {
            const targetUrl = new URL(rawHref, window.location.href);
            const currentUrl = new URL(window.location.href);
            return Boolean(targetUrl.hash) &&
                targetUrl.origin === currentUrl.origin &&
                targetUrl.pathname === currentUrl.pathname &&
                targetUrl.search === currentUrl.search;
        } catch (error) {
            return false;
        }
    }

    function shouldAllowAnchorInteraction(anchor) {
        if (!(anchor instanceof HTMLAnchorElement)) return false;
        if (anchor.getAttribute('role') === 'button') return true;
        if (anchor.hasAttribute('aria-controls')) return true;
        if (anchor.hasAttribute('data-action')) return true;
        if (anchor.hasAttribute('data-a-expander-toggle')) return true;
        if (anchor.closest('.a-expander-container, .a-declarative')) return true;
        return isSameDocumentAnchorHref(anchor.getAttribute('href'));
    }

    function parseCssSize(value) {
        const parsed = Number.parseFloat(value || '');
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    }

    function clamp(value, min, max) {
        const n = Number.isFinite(value) ? value : min;
        return Math.min(max, Math.max(min, n));
    }

    function getStableImageSize(element) {
        if (!(element instanceof HTMLImageElement)) {
            return { width: 40, height: 40 };
        }

        if (isThumbnailLikeImage(element)) {
            const altColumn = element.closest('#altImages');
            if (altColumn instanceof HTMLElement) {
                const altWidth = Math.round(altColumn.getBoundingClientRect().width);
                if (altWidth > 0) {
                    const size = clamp(altWidth, 24, 72);
                    return { width: size, height: size };
                }
            }

            const thumbHost = element.closest('li.imageThumbnail, .ivThumb, .a-button-thumbnail');
            if (thumbHost instanceof HTMLElement) {
                const hostRect = thumbHost.getBoundingClientRect();
                const hostWidth = Math.round(hostRect.width);
                const hostHeight = Math.round(hostRect.height);
                if (hostWidth > 0 || hostHeight > 0) {
                    const size = clamp(Math.max(hostWidth, hostHeight), 24, 72);
                    return { width: size, height: size };
                }
            }
        }

        const rect = element.getBoundingClientRect();
        let width = Math.round(rect.width);
        let height = Math.round(rect.height);

        if ((!width || !height) && element.parentElement instanceof HTMLElement) {
            const parentRect = element.parentElement.getBoundingClientRect();
            if (!width) {
                width = Math.round(parentRect.width);
            }
            if (!height) {
                height = Math.round(parentRect.height);
            }
        }

        if (!width || !height) {
            const computed = window.getComputedStyle(element);
            if (!width) {
                width = Math.round(parseCssSize(computed.width));
            }
            if (!height) {
                height = Math.round(parseCssSize(computed.height));
            }
        }

        if (!width) width = 40;
        if (!height) height = 40;

        if (isThumbnailLikeImage(element)) {
            width = clamp(width, 24, 72);
            height = clamp(height, 24, 72);
        }

        return { width, height };
    }

    function applyImageDisplayConstraints(element) {
        if (!(element instanceof HTMLImageElement)) return;

        if (isThumbnailLikeImage(element)) {
            const { width, height } = getStableImageSize(element);
            element.style.setProperty('--tm-thumb-w', `${width}px`);
            element.style.setProperty('--tm-thumb-h', `${height}px`);
            element.style.width = `${width}px`;
            element.style.height = `${height}px`;
            element.style.maxWidth = `${width}px`;
            element.style.maxHeight = `${height}px`;
            element.style.minWidth = `${width}px`;
            element.style.minHeight = `${height}px`;
            element.style.objectFit = 'cover';
            element.style.objectPosition = 'center center';
            element.classList.add('tm-inline-thumb-fixed-image');
            return;
        }

        if (element.closest && element.closest('#mediaBlock_feature_div')) {
            if (!element.style.objectFit) {
                element.style.objectFit = 'contain';
            }
            if (!element.style.objectPosition) {
                element.style.objectPosition = 'center center';
            }
            element.classList.add('tm-inline-main-fixed-image');
        }
    }

    function applyImageSource(element, expected) {
        if (!(element instanceof HTMLImageElement)) return;
        const sameSource = element.src === expected;
        const alreadyApplied = element.dataset && element.dataset.tmInlineAppliedSrc === expected;

        if (!sameSource) {
            element.src = expected;
        }

        if (!alreadyApplied) {
            element.removeAttribute('srcset');
            element.removeAttribute('sizes');
            if (element.dataset && Object.prototype.hasOwnProperty.call(element.dataset, 'oldHires')) {
                element.dataset.oldHires = expected;
            }
            if (element.dataset) {
                element.dataset.tmInlineAppliedSrc = expected;
            }
        }

        if (!alreadyApplied &&
            !element.classList.contains('tm-inline-thumb-fixed-image') &&
            !element.classList.contains('tm-inline-main-fixed-image')) {
            applyImageDisplayConstraints(element);
        }
    }

    class TextObserver {
        constructor(dataList) {
            this.dataList = Array.isArray(dataList) ? dataList : [];
            this.mutationObserver = null;
            this.intervalId = null;
            this.isActive = false;
            this.dataResolver = null;
            this.pendingApplyTimer = null;
            this.pendingFrameId = null;
            this.applyInProgress = false;
            this.lastApplyAt = 0;
            this.minApplyIntervalMs = 220;
            this.mutationDebounceMs = 120;
            this.fallbackIntervalMs = 20000;
            this.activeSelectorText = '';
        }

        start() {
            if (this.isActive) return;
            this.refreshDataList();
            if (!this.hasActiveData()) return;
            this.isActive = true;
            this.scheduleApply(0);
            this.setupMutationObserver();
            this.startIntervalChecker();
            console.log('🔍 文本观察者已启动');
        }

        stop() {
            if (!this.isActive) return;
            this.isActive = false;
            if (this.mutationObserver) {
                this.mutationObserver.disconnect();
                this.mutationObserver = null;
            }
            if (this.intervalId) {
                clearInterval(this.intervalId);
                this.intervalId = null;
            }
            if (this.pendingApplyTimer) {
                clearTimeout(this.pendingApplyTimer);
                this.pendingApplyTimer = null;
            }
            if (this.pendingFrameId !== null && typeof cancelAnimationFrame === 'function') {
                cancelAnimationFrame(this.pendingFrameId);
                this.pendingFrameId = null;
            }
            console.log('⏹️ 文本观察者已停止');
        }



        setDataResolver(resolver) {
            if (typeof resolver === 'function') {
                this.dataResolver = resolver;
                this.refreshDataList();
            } else {
                this.dataResolver = null;
                this.dataList = [];
                this.activeSelectorText = '';
            }
        }

        #safeResolveData() {
            if (!this.dataResolver) return null;
            try {
                const resolved = this.dataResolver();
                return Array.isArray(resolved) ? resolved : null;
            } catch (error) {
                console.warn('数据解析函数执行失败:', error);
                return null;
            }
        }

        refreshDataList() {
            const resolved = this.#safeResolveData();
            if (resolved) {
                this.dataList = resolved;
            }
            this.activeSelectorText = this.buildActiveSelectorText(this.dataList);
            return this.dataList;
        }

        hasActiveData() {
            return Array.isArray(this.dataList) && this.dataList.length > 0;
        }

        buildActiveSelectorText(dataList) {
            if (!Array.isArray(dataList) || dataList.length === 0) return '';

            const selectors = [];
            const seen = new Set();

            dataList.forEach((item) => {
                const selectorList = getConfigWatchSelectorList(item);
                selectorList
                    .filter(Boolean)
                    .forEach((selector) => {
                        if (seen.has(selector)) return;
                        seen.add(selector);
                        selectors.push(selector);
                    });
            });

            return selectors.join(', ');
        }

        scheduleApply(delay = this.mutationDebounceMs) {
            if (!this.isActive) return;
            if (this.pendingApplyTimer) return;

            const elapsed = Date.now() - this.lastApplyAt;
            const throttleWait = elapsed >= this.minApplyIntervalMs
                ? 0
                : (this.minApplyIntervalMs - elapsed);
            const wait = Math.max(delay, throttleWait);

            this.pendingApplyTimer = setTimeout(() => {
                this.pendingApplyTimer = null;
                if (!this.isActive) return;

                if (typeof requestAnimationFrame === 'function') {
                    this.pendingFrameId = requestAnimationFrame(() => {
                        this.pendingFrameId = null;
                        this.applyAll();
                    });
                    return;
                }

                this.applyAll();
            }, wait);
        }

        hasRelevantMutations(mutations) {
            for (const mutation of mutations) {
                if (!mutation || mutation.type !== 'childList') continue;
                if (!this.hasRelevantNodes(mutation.addedNodes) && !this.hasRelevantNodes(mutation.removedNodes)) {
                    continue;
                }
                return true;
            }
            return false;
        }

        hasRelevantNodes(nodeList) {
            if (!nodeList || nodeList.length === 0 || !this.activeSelectorText) return false;

            for (const node of nodeList) {
                if (!(node instanceof Element)) continue;
                if (node.id === 'tm-inline-editor' || node.id === 'tm-inline-notifications') continue;
                if (typeof node.closest === 'function') {
                    if (node.closest('#tm-inline-editor') || node.closest('#tm-inline-notifications')) {
                        continue;
                    }
                }
                if (this.nodeTouchesActiveSelector(node)) {
                    return true;
                }
            }

            return false;
        }

        nodeTouchesActiveSelector(node) {
            if (!(node instanceof Element) || !this.activeSelectorText) return false;

            try {
                if (typeof node.matches === 'function' && node.matches(this.activeSelectorText)) {
                    return true;
                }
                if (typeof node.closest === 'function' && node.closest(this.activeSelectorText)) {
                    return true;
                }
                if (typeof node.querySelector === 'function' && node.querySelector(this.activeSelectorText)) {
                    return true;
                }
            } catch (error) {
                console.warn('检查变更节点时选择器执行失败:', error);
                return true;
            }

            return false;
        }

        applyAll() {
            if (!this.isActive) return;
            if (this.applyInProgress) return;

            this.applyInProgress = true;
            if (this.dataResolver) {
                this.refreshDataList();
            }
            try {
                if (!this.hasActiveData()) {
                    this.stop();
                    return;
                }

                const elementCache = new Map();
                this.dataList.forEach((item) => {
                    if (!item || item.value === undefined || item.value === null) return;
                    const selectors = getConfigSelectorList(item);
                    const selectorKey = item.keySuffix
                        ? `dynamic:${item.keySuffix}`
                        : selectors.join('\u0000');
                    let elements = elementCache.get(selectorKey);
                    if (!elements) {
                        elements = collectElementsFromConfig(item);
                        elementCache.set(selectorKey, elements);
                    }
                    if (item.multiple) {
                        const values = Array.isArray(item.value) ? item.value : [item.value];
                        elements.forEach((element, index) => {
                            if (!element) return;
                            if (element.dataset && element.dataset.tmInlineEditing === '1') return;
                            if (values[index] === undefined) return;
                            this.applyValueToElement(element, values[index], item.type);
                        });
                        return;
                    }

                    elements.forEach((element) => {
                        if (!element) return;
                        if (element.dataset && element.dataset.tmInlineEditing === '1') return;
                        this.applyValueToElement(element, item.value, item.type);
                    });
                });
            } finally {
                this.applyInProgress = false;
                this.lastApplyAt = Date.now();
            }
        }

        applyValueToElement(element, value, type = 'text') {
            if (value === undefined || value === null) return;
            const expected = typeof value === 'string' ? value : String(value);

            if (type === 'image' || element instanceof HTMLImageElement) {
                if (!(element instanceof HTMLImageElement)) return;
                applyImageSource(element, expected);
                return;
            }

            if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
                if (element.value !== expected) {
                    element.value = expected;
                    element.dispatchEvent(new Event('input', { bubbles: true }));
                    element.dispatchEvent(new Event('change', { bubbles: true }));
                }
                return;
            }

            const hasHtml = /<[^>]+>/.test(expected);
            if (hasHtml) {
                if (element.innerHTML.trim() !== expected.trim()) {
                    element.innerHTML = expected;
                }
            } else {
                if ((element.textContent || '').trim() !== expected.trim()) {
                    element.textContent = expected;
                }
            }
        }

        setupMutationObserver() {
            if (this.mutationObserver) return;
            this.mutationObserver = new MutationObserver((mutations) => {
                if (!this.isActive) return;
                if (!this.hasRelevantMutations(mutations)) return;
                this.scheduleApply(this.mutationDebounceMs);
            });

            this.mutationObserver.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        startIntervalChecker() {
            if (this.intervalId) return;
            this.intervalId = setInterval(() => this.scheduleApply(0), this.fallbackIntervalMs);
        }
    }

    class InlineEditManager {
        constructor(storage, notification, textObserver, fieldConfigs, initialValueMap = {}) {
            this.storage = storage;
            this.notification = notification;
            this.textObserver = textObserver;
            this.fieldConfigs = Array.isArray(fieldConfigs) ? fieldConfigs : [];
            this.valueMap = initialValueMap && typeof initialValueMap === 'object' ? { ...initialValueMap } : {};
            this.isEditing = false;
            this.hidden = this.storage.loadPersistent('hidden', false) === true;
            this.refundRowHidden = this.storage.loadPersistent('refundRowHidden', false) === true;
            this.boundAnchorInterceptor = (event) => this.handleAnchorClick(event);
            this.editedElements = new Map();
            this.initialEditLabel = '编辑';
            this.imageInput = null;
            this.activeImageElement = null;
            this.pageKey = this.getPageKey();
            this.originalDocumentTitle = document.title || '';
            this.refundToggleBtn = null;
            this.titleEditBtn = null;
            this.toolbarTriggerBtn = null;
            this.panelOpen = false;
            this.editMutationObserver = null;
            this.pendingEditableSyncTimer = null;
            this.editMutationDebounceMs = 120;
            this.editWatchSelectorText = this.buildEditWatchSelectorText();
            this.boundOutsideClickHandler = (event) => this.handleOutsideClick(event);

            this.migrateLegacyFieldStorage();

            this.createUI();
            this.setPanelOpen(false);
            this.setupDynamicStyles();
            this.applyRefundRowState(true);
            this.attachEvents();
            this.setupImageInput();
            this.injectShowFunction();
            this.applyStoredDocumentTitle();

            if (this.toggleBtn) {
                this.initialEditLabel = this.toggleBtn.textContent || this.initialEditLabel;
            }

            if (this.textObserver && typeof this.textObserver.setDataResolver === 'function') {
                this.textObserver.setDataResolver(() => this.getRuntimeDataList());
            }

            if (this.hidden) {
                this.container.style.display = 'none';
                console.log('🫥 编辑按钮已隐藏，可在控制台执行 show() 恢复');
            }
        }

        createUI() {
            this.container = document.createElement('div');
            this.container.id = 'tm-inline-editor';
            this.container.innerHTML = `
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
            document.body.appendChild(this.container);

            this.toggleBtn = this.container.querySelector('#tm-edit-toggle');
            this.titleEditBtn = this.container.querySelector('#tm-edit-title');
            this.refundToggleBtn = this.container.querySelector('#tm-edit-toggle-refund');
            this.resetBtn = this.container.querySelector('#tm-edit-reset');
            this.hideBtn = this.container.querySelector('#tm-edit-hide');
            this.toolbarTriggerBtn = this.container.querySelector('#tm-inline-toolbar-trigger');
        }

        attachEvents() {
            if (this.toggleBtn) {
                this.toggleBtn.addEventListener('click', () => this.handleEditButtonClick());
            }
            if (this.titleEditBtn) {
                this.titleEditBtn.addEventListener('click', () => this.handleTitleEdit());
            }
            if (this.resetBtn) {
                this.resetBtn.addEventListener('click', () => this.handleReset());
            }
            if (this.refundToggleBtn) {
                this.refundToggleBtn.addEventListener('click', () => this.toggleRefundRowVisibility());
            }
            if (this.hideBtn) {
                this.hideBtn.addEventListener('click', () => this.hideButton());
            }
            if (this.toolbarTriggerBtn) {
                this.toolbarTriggerBtn.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    this.togglePanelOpen();
                });
            }
            document.addEventListener('click', this.boundOutsideClickHandler);
        }

        setPanelOpen(nextOpen) {
            this.panelOpen = Boolean(nextOpen);
            if (this.container) {
                this.container.classList.toggle('tm-inline-panel-open', this.panelOpen);
            }
            if (this.toolbarTriggerBtn) {
                this.toolbarTriggerBtn.setAttribute('aria-expanded', this.panelOpen ? 'true' : 'false');
            }
        }

        togglePanelOpen(force) {
            const nextOpen = typeof force === 'boolean' ? force : !this.panelOpen;
            this.setPanelOpen(nextOpen);
        }

        handleOutsideClick(event) {
            if (!this.panelOpen) return;
            const target = event.target;
            if (target instanceof Node && this.container && this.container.contains(target)) {
                return;
            }
            this.setPanelOpen(false);
        }

        setupImageInput() {
            if (this.imageInput) return;
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.style.display = 'none';
            input.addEventListener('change', async () => {
                const file = input.files && input.files[0];
                if (!file || !this.activeImageElement) {
                    this.activeImageElement = null;
                    input.value = '';
                    return;
                }
                try {
                    const dataUrl = await this.readFileAsDataUrl(file);
                    if (typeof dataUrl !== 'string') {
                        throw new Error('无效图片数据');
                    }
                    applyImageSource(this.activeImageElement, dataUrl);
                    this.notification.show('图片已更新，点击“完成”保存。', 'success');
                } catch (error) {
                    console.error('读取图片失败:', error);
                    this.notification.show('图片读取失败，请重试。', 'error');
                } finally {
                    this.activeImageElement = null;
                    input.value = '';
                }
            });
            document.body.appendChild(input);
            this.imageInput = input;
        }

        readFileAsDataUrl(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(reader.error || new Error('读取失败'));
                reader.readAsDataURL(file);
            });
        }

        handleEditButtonClick() {
            this.setPanelOpen(false);
            if (this.isEditing) {
                this.exitEditMode(true);
                return;
            }

            this.enterEditMode();
        }

        getDocumentTitleStorageKey() {
            return this.buildStorageKeyFromSuffix('document_title');
        }

        getStoredDocumentTitle() {
            const storageKey = this.getDocumentTitleStorageKey();
            if (!storageKey) return '';
            const storedTitle = this.valueMap[storageKey];
            return typeof storedTitle === 'string' ? storedTitle.trim() : '';
        }

        applyDocumentTitle(title) {
            const nextTitle = typeof title === 'string' && title.trim()
                ? title.trim()
                : this.originalDocumentTitle;
            if (!nextTitle) return;
            document.title = nextTitle;
            const titleElement = document.querySelector('title');
            if (titleElement && titleElement.textContent !== nextTitle) {
                titleElement.textContent = nextTitle;
            }
        }

        applyStoredDocumentTitle() {
            const storedTitle = this.getStoredDocumentTitle();
            if (storedTitle) {
                this.applyDocumentTitle(storedTitle);
            }
        }

        handleTitleEdit() {
            this.setPanelOpen(false);
            const storageKey = this.getDocumentTitleStorageKey();
            if (!storageKey) {
                this.notification.show('标题保存键生成失败。', 'error');
                return;
            }

            const currentTitle = this.getStoredDocumentTitle() || document.title || this.originalDocumentTitle;
            const input = window.prompt(
                '请输入新的页面标题。\n留空并确认可恢复默认标题。',
                currentTitle
            );

            if (input === null) return;

            const nextTitle = input.trim();
            if (nextTitle) {
                const previousTitle = this.valueMap[storageKey];
                this.valueMap[storageKey] = nextTitle;
                const saved = this.storage.saveValueMap(this.valueMap);
                if (saved) {
                    this.applyDocumentTitle(nextTitle);
                    this.notification.show('页面标题已更新。', 'success');
                    return;
                }

                if (previousTitle === undefined) {
                    delete this.valueMap[storageKey];
                } else {
                    this.valueMap[storageKey] = previousTitle;
                }
                this.notification.show('标题保存失败，请查看控制台。', 'error');
                return;
            }

            const hadCustomTitle = Object.prototype.hasOwnProperty.call(this.valueMap, storageKey);
            const previousTitle = this.valueMap[storageKey];
            delete this.valueMap[storageKey];

            const saved = hadCustomTitle ? this.storage.saveValueMap(this.valueMap) : true;
            if (saved) {
                this.applyDocumentTitle(this.originalDocumentTitle);
                this.notification.show(hadCustomTitle ? '已恢复默认标题。' : '当前没有自定义标题。', hadCustomTitle ? 'success' : 'info');
                return;
            }

            if (previousTitle !== undefined) {
                this.valueMap[storageKey] = previousTitle;
            }
            this.notification.show('标题恢复失败，请查看控制台。', 'error');
        }

        refreshButtonStates() {
            if (this.toggleBtn) {
                this.toggleBtn.textContent = this.isEditing ? '完成' : this.initialEditLabel;
                this.toggleBtn.disabled = false;
            }
        }

        applyRefundRowState(updateLabel = false) {
            document.querySelectorAll('.tm-inline-refund-row-hidden').forEach((row) => {
                row.classList.remove('tm-inline-refund-row-hidden');
            });

            if (this.refundRowHidden) {
                resolveChargeSummaryElements('charge_refund_total', 'row').forEach((row) => {
                    row.classList.add('tm-inline-refund-row-hidden');
                });
            }

            if (updateLabel && this.refundToggleBtn) {
                this.refundToggleBtn.textContent = this.refundRowHidden ? '显示退款行' : '隐藏退款行';
            }
        }

        toggleRefundRowVisibility() {
            this.setPanelOpen(false);
            this.refundRowHidden = !this.refundRowHidden;
            this.storage.savePersistent('refundRowHidden', this.refundRowHidden);
            this.applyRefundRowState(true);
            this.notification.show(this.refundRowHidden ? '已隐藏退款总计行。' : '已显示退款总计行。', 'info');
        }

        enterEditMode() {
            if (this.isEditing) return;
            this.textObserver.stop();
            this.isEditing = true;
            document.body.classList.add('tm-editing-mode');
            if (this.toggleBtn) {
                this.toggleBtn.classList.add('tm-inline-btn-active');
            }
            this.refreshButtonStates();
            document.addEventListener('click', this.boundAnchorInterceptor, true);

            const elements = this.collectTargetElements();
            elements.forEach(({ element, config }) => this.makeEditable(element, config));
            this.startEditMutationObserver();

            if (elements.length === 0) {
                this.notification.show('未找到可编辑的元素，请检查选择器配置。', 'warning');
            } else {
                this.notification.show('编辑模式已开启：可直接改文字；点击图片角标“换”可替换，左键预览保留。', 'info');
            }
        }

        exitEditMode(saveChanges = true) {
            if (!this.isEditing) return;

            try {
                if (saveChanges) {
                    const values = this.collectEditedValues();
                    let dirty = false;
                    Object.entries(values).forEach(([key, value]) => {
                        if (!isEqualValue(this.valueMap[key], value)) {
                            this.valueMap[key] = value;
                            dirty = true;
                        }
                    });

                    const saved = dirty ? this.storage.saveValueMap(this.valueMap) : true;
                    if (saved) {
                        this.notification.show(dirty ? '修改已保存并应用。' : '没有检测到新的修改。', dirty ? 'success' : 'info');
                    } else {
                        this.notification.show('保存失败，请查看控制台。', 'error');
                    }
                } else {
                    this.notification.show('已退出编辑模式，修改未保存。', 'info');
                }
            } catch (error) {
                console.error('退出编辑模式失败:', error);
                this.notification.show('保存失败，请查看控制台。', 'error');
            } finally {
                this.isEditing = false;
                document.body.classList.remove('tm-editing-mode');
                try {
                    this.restoreElements();
                } catch (error) {
                    console.warn('恢复元素状态失败:', error);
                }
                try {
                    this.cleanupLooseEditingMarks();
                } catch (error) {
                    console.warn('清理残留标记失败:', error);
                }
                const activeElement = document.activeElement;
                if (activeElement && activeElement instanceof HTMLElement) {
                    activeElement.blur();
                }
                this.stopEditMutationObserver();
                document.removeEventListener('click', this.boundAnchorInterceptor, true);
                if (this.toggleBtn) {
                    this.toggleBtn.classList.remove('tm-inline-btn-active');
                }
                this.refreshButtonStates();
                if (this.textObserver) {
                    this.textObserver.start();
                }
            }
        }

        hideButton() {
            this.setPanelOpen(false);
            if (this.isEditing) {
                this.exitEditMode(false);
            }
            this.hidden = true;
            document.body.classList.remove('tm-editing-mode'); // Ensure clean state
            this.storage.savePersistent('hidden', true);
            this.container.style.display = 'none';
            this.notification.show('编辑按钮已隐藏，在控制台执行 show() 可重新显示。', 'info');
        }

        showButton() {
            this.setPanelOpen(false);
            this.hidden = false;
            this.storage.savePersistent('hidden', false);
            this.container.style.display = 'flex';
            this.refreshButtonStates();
            console.log('✅ 编辑按钮已显示');
        }

        handleReset() {
            this.setPanelOpen(false);
            const confirmed = window.confirm('确定要删除所有保存的内容并刷新页面吗？');
            if (!confirmed) return;

            if (this.isEditing) {
                this.exitEditMode(false);
            }

            const cleared = this.storage.clearValueMap();
            if (cleared) {
                this.valueMap = {};
                this.applyDocumentTitle(this.originalDocumentTitle);
                this.notification.show('已清除所有保存内容，页面即将刷新。', 'warning');
                setTimeout(() => window.location.reload(), 600);
            } else {
                this.notification.show('重置失败，请查看控制台。', 'error');
            }
        }

        collectTargetElements() {
            const targets = [];
            const seen = new Set();

            this.fieldConfigs.forEach((item) => {
                const elements = this.resolveElementsFromConfig(item);
                elements.forEach((element) => {
                    if (!element || seen.has(element)) return;
                    seen.add(element);
                    targets.push({ element, config: item });
                });
            });

            return targets;
        }

        buildEditWatchSelectorText() {
            const selectors = [];
            const seen = new Set();

            this.fieldConfigs.forEach((config) => {
                this.getWatchSelectorsFromConfig(config)
                    .filter(Boolean)
                    .forEach((selector) => {
                        if (seen.has(selector)) return;
                        seen.add(selector);
                        selectors.push(selector);
                    });
            });

            return selectors.join(', ');
        }

        nodeTouchesEditTarget(node) {
            if (!(node instanceof Element)) return false;
            if (!this.editWatchSelectorText) return true;

            try {
                if (typeof node.matches === 'function' && node.matches(this.editWatchSelectorText)) {
                    return true;
                }
                if (typeof node.closest === 'function' && node.closest(this.editWatchSelectorText)) {
                    return true;
                }
                if (typeof node.querySelector === 'function' && node.querySelector(this.editWatchSelectorText)) {
                    return true;
                }
            } catch (error) {
                console.warn('检查编辑区变更节点时选择器执行失败:', error);
                return true;
            }

            return false;
        }

        hasRelevantEditMutations(mutations) {
            for (const mutation of mutations) {
                if (!mutation || mutation.type !== 'childList') continue;
                if (this.hasRelevantEditNodes(mutation.addedNodes) || this.hasRelevantEditNodes(mutation.removedNodes)) {
                    return true;
                }
            }
            return false;
        }

        hasRelevantEditNodes(nodeList) {
            if (!nodeList || nodeList.length === 0) return false;

            for (const node of nodeList) {
                if (!(node instanceof Element)) continue;
                if (node.id === 'tm-inline-editor' || node.id === 'tm-inline-notifications') continue;
                if (typeof node.closest === 'function') {
                    if (node.closest('#tm-inline-editor') || node.closest('#tm-inline-notifications')) {
                        continue;
                    }
                }
                if (this.nodeTouchesEditTarget(node)) {
                    return true;
                }
            }

            return false;
        }

        scheduleEditableSync(delay = this.editMutationDebounceMs) {
            if (!this.isEditing || this.pendingEditableSyncTimer) return;

            this.pendingEditableSyncTimer = setTimeout(() => {
                this.pendingEditableSyncTimer = null;
                this.syncEditableTargets();
            }, delay);
        }

        syncEditableTargets() {
            if (!this.isEditing) return;
            this.collectTargetElements().forEach(({ element, config }) => {
                this.makeEditable(element, config);
            });
        }

        startEditMutationObserver() {
            if (this.editMutationObserver || !document.body) return;

            this.editMutationObserver = new MutationObserver((mutations) => {
                if (!this.isEditing) return;
                if (!this.hasRelevantEditMutations(mutations)) return;
                this.scheduleEditableSync(this.editMutationDebounceMs);
            });

            this.editMutationObserver.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        stopEditMutationObserver() {
            if (this.editMutationObserver) {
                this.editMutationObserver.disconnect();
                this.editMutationObserver = null;
            }
            if (this.pendingEditableSyncTimer) {
                clearTimeout(this.pendingEditableSyncTimer);
                this.pendingEditableSyncTimer = null;
            }
        }

        getSelectorsFromConfig(config) {
            return getConfigSelectorList(config);
        }

        getWatchSelectorsFromConfig(config) {
            return getConfigWatchSelectorList(config);
        }

        resolveElementsFromConfig(config) {
            return collectElementsFromConfig(config);
        }

        buildStorageKey(config) {
            if (!config) return null;
            const suffixSource = config.keySuffix ||
                (Array.isArray(config.selector) ? config.selector[0] : config.selector);
            const suffix = typeof suffixSource === 'string' ? suffixSource.trim() : '';
            if (!suffix) return null;

            return `${this.pageKey}__${suffix}`;
        }

        buildStorageKeyFromSuffix(keySuffix) {
            const suffix = typeof keySuffix === 'string' ? keySuffix.trim() : '';
            return suffix ? `${this.pageKey}__${suffix}` : null;
        }

        migrateLegacyFieldStorage() {
            const migrations = [
                {
                    from: 'brand',
                    to: ['brand_offer_display', 'brand_product_overview']
                }
            ];

            let dirty = false;

            migrations.forEach((migration) => {
                const fromKey = this.buildStorageKeyFromSuffix(migration.from);
                if (!fromKey || !Object.prototype.hasOwnProperty.call(this.valueMap, fromKey)) {
                    return;
                }

                const legacyValue = this.valueMap[fromKey];
                migration.to.forEach((suffix) => {
                    const toKey = this.buildStorageKeyFromSuffix(suffix);
                    if (!toKey || Object.prototype.hasOwnProperty.call(this.valueMap, toKey)) {
                        return;
                    }
                    this.valueMap[toKey] = legacyValue;
                    dirty = true;
                });

                delete this.valueMap[fromKey];
                dirty = true;
            });

            if (dirty) {
                this.storage.saveValueMap(this.valueMap);
            }
        }

        getRuntimeDataList() {
            return this.fieldConfigs.reduce((result, config) => {
                const storageKey = this.buildStorageKey(config);
                if (!storageKey || !Object.prototype.hasOwnProperty.call(this.valueMap, storageKey)) {
                    return result;
                }

                const value = this.valueMap[storageKey];
                if (value === undefined || value === null) {
                    return result;
                }

                result.push({
                    keySuffix: config.keySuffix,
                    selector: this.getSelectorsFromConfig(config),
                    watchSelectors: this.getWatchSelectorsFromConfig(config),
                    resolveElements: typeof config.resolveElements === 'function'
                        ? () => this.resolveElementsFromConfig(config)
                        : undefined,
                    multiple: Boolean(config.multiple),
                    type: config.type,
                    value
                });
                return result;
            }, []);
        }

        getPageKey() {
            try {
                const href = window.location && window.location.href ? window.location.href : '';
                const clean = href.split('#')[0] || href;
                return encodeURIComponent(clean);
            } catch (error) {
                console.warn('获取页面地址失败:', error);
                return 'unknown_page';
            }
        }

        collectEditedValues() {
            const values = {};

            this.fieldConfigs.forEach((config) => {
                const storageKey = this.buildStorageKey(config);
                if (!storageKey) {
                    return;
                }

                const elements = this.resolveElementsFromConfig(config);

                if (config.multiple) {
                    if (elements.length > 0) {
                        values[storageKey] = elements.map((element) => extractElementValue(element));
                    }
                    return;
                }

                const changedElement = getEditedElementWithChangedValue(elements, this.editedElements);
                const preferredElement = changedElement || pickPreferredValueElement(elements);
                if (!preferredElement) {
                    return;
                }

                const value = extractElementValue(preferredElement);
                if (value !== undefined && value !== null) {
                    values[storageKey] = value;
                }
            });

            return values;
        }

        findImageTriggerHost(element) {
            if (!(element instanceof HTMLElement)) return null;

            const host = element.closest('#imgTagWrapperId, .imgTagWrapper, li.imageThumbnail, [data-component="itemImage"], .a-button-text, .a-list-item');
            if (host instanceof HTMLElement) {
                return host;
            }

            return element.parentElement instanceof HTMLElement ? element.parentElement : null;
        }

        makeEditable(element, config) {
            if (!element || this.editedElements.has(element)) return;

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
                    if (!this.imageInput) return;
                    this.activeImageElement = element;
                    this.imageInput.value = '';
                    this.imageInput.click();
                };

                const keyHandler = (event) => {
                    if (!event) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                        openReplaceDialog(event);
                    }
                };

                const host = this.findImageTriggerHost(element);
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
                    // Fallback: host 不可用时退化为绑定右键替换。
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
            this.editedElements.set(element, state);
        }

        restoreElements() {
            this.editedElements.forEach((state, element) => {
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
                        // fallback contextmenu handler
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
                } else {
                    if (state.contentEditable === null || state.contentEditable === undefined) {
                        element.removeAttribute('contenteditable');
                    } else {
                        element.setAttribute('contenteditable', state.contentEditable);
                    }
                }
            });

            this.editedElements.clear();
            this.activeImageElement = null;
            if (this.imageInput) {
                this.imageInput.value = '';
            }
            this.cleanupLooseEditingMarks();
        }

        cleanupLooseEditingMarks(root = document) {
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

        handleAnchorClick(event) {
            if (!this.isEditing) return;
            const replaceTrigger = event.target && event.target.closest && event.target.closest('.tm-inline-image-replace-trigger');
            if (replaceTrigger) return;
            const anchor = event.target && event.target.closest('a');
            if (!anchor) return;
            if (shouldAllowAnchorInteraction(anchor)) return;
            const editingImage = event.target && event.target.closest('img[data-tm-inline-editing="1"]');
            if (editingImage) return;
            if (this.container && this.container.contains(anchor)) return;
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
        }

        injectShowFunction() {
            const showHandler = () => this.showButton();

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

        setupDynamicStyles() {
            const rules = [];
            this.fieldConfigs.forEach(config => {
                if (config.hideInView) {
                    const selectors = this.getWatchSelectorsFromConfig(config);
                    selectors.forEach(selector => {
                        // When NOT in editing mode, hide these elements
                        rules.push(`body:not(.tm-editing-mode) ${selector} { display: none !important; }`);
                    });
                }
            });

            if (rules.length > 0) {
                GM_addStyle(rules.join('\n'));
            }
        }
    }

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

    function bootstrapInlineEditor() {
        if (bootstrapInlineEditor.started) return;
        bootstrapInlineEditor.started = true;

        const storage = new StorageManager();
        const notification = new NotificationManager();

        const fieldConfigs = storage.getDefaultList();
        const valueMap = storage.loadValueMap();

        const textObserver = new TextObserver([]);
        const inlineEditManager = new InlineEditManager(storage, notification, textObserver, fieldConfigs, valueMap);

        try {
            window.tmInlineEditor = inlineEditManager;
            if (typeof unsafeWindow !== 'undefined') {
                unsafeWindow.tmInlineEditor = inlineEditManager;
            }
        } catch (error) {
            console.warn('无法注入 tmInlineEditor 实例:', error);
        }

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

})();
