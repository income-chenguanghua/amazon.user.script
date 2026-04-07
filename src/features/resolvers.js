import {
    collectElementsFromSelectors,
    normalizeResolvedElements,
    normalizeTextContent,
    pickPreferredValueElement
} from '../core/utils.js';

const CHARGE_SUMMARY_LABEL_ALIASES = {
    charge_subtotal: ['subtotal', '小计', '小計', 'sous-total', 'zwischensumme', 'subtotale', 'ara toplam'],
    charge_shipping: ['shipping', 'shipping & handling', 'delivery', 'delivery charges', '运费', '配送', '送料', 'livraison', 'versand', 'spedizione', 'envio', 'envío', 'frete', 'verzending', 'frakt', 'dostawa', 'kargo'],
    charge_total_before_tax: ['total before tax', 'before tax', 'pretax', '税前', 'avant taxes', 'vor steuern', 'antes de impuestos', 'imposte escluse', 'vergiler haric'],
    charge_estimated_tax: ['estimated tax', 'estimated vat', 'estimated gst', 'tax to be collected', 'vat to be collected', '税费', '税額', 'consumption tax', 'impuestos estimados', 'taxe estimee', 'voraussichtliche steuer', 'imposta stimata', 'szacowany podatek'],
    charge_grand_total: ['grand total', 'order total', 'gesamtsumme', '总计', '合计', '付款总额', 'importe total', 'totale', 'montant total', 'gesamtkosten'],
    charge_refund_total: ['refund total', 'refund', '退款', '返金', '払い戻し', 'reembolso', 'rimborso', 'remboursement', 'erstattung', 'rückerstattung', 'zwrot', 'iade', 'استرداد']
};

const PRODUCT_OVERVIEW_BRAND_SELECTORS = [
    '#productOverview_feature_div > div > table > tbody > tr.a-spacing-small.po-brand > td.a-span9 > span',
    '#poExpander > div.a-expander-content.a-expander-partial-collapse-content > div > table > tbody > tr.a-spacing-small.po-brand > td.a-span9 > span',
    '#topHighlight > div.a-section.a-spacing-small.a-spacing-top-small > table > tbody > tr.a-spacing-small.po-brand > td.a-span9 > span'
];

const LEGACY_PAYMENT_CARD_ENDING_SELECTORS = [
    '.pmts-payments-instrument-detail-box-paystationpaymentmethod .a-color-base'
];

const MODERN_PAYMENT_CARD_TEXT_WRAPPER_SELECTOR = '[data-testid="payment-instrument-text-wrapper"]';
const MODERN_PAYMENT_CARD_NUMBER_SELECTOR = '[data-testid="payment-instrument-number"]';

function normalizeInlineText(value) {
    return String(value || '').replace(/[\s\u00a0]+/g, ' ').trim();
}

function extractInlineTextFromHtml(value) {
    const template = document.createElement('template');
    template.innerHTML = String(value || '');
    return normalizeInlineText(template.content.textContent);
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
            const valueContainerElement = row.querySelector('.od-line-item-row-content, [class*="line-item-row-content"]');
            const valueElement = valueContainerElement instanceof HTMLElement
                ? pickPreferredValueElement(
                    Array.from(
                        valueContainerElement.querySelectorAll(
                            '.a-color-base, .a-size-base, .a-text-bold, span'
                        )
                    ).filter((element) => element instanceof HTMLElement)
                ) || valueContainerElement
                : null;
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
    if (!Number.isInteger(fallbackIndex) || !rows[fallbackIndex]) {
        return null;
    }

    if (keySuffix === 'charge_total_before_tax') {
        return rows.length >= 4 ? rows[fallbackIndex] : null;
    }

    if (keySuffix === 'charge_estimated_tax') {
        return rows.length >= 5 ? rows[fallbackIndex] : null;
    }

    return rows[fallbackIndex];
}

export function resolveChargeSummaryElements(keySuffix, part = 'value') {
    const row = getChargeSummaryRowByKey(keySuffix);
    if (!row) return [];
    if (part === 'row') return [row.row];
    if (part === 'label') return row.labelElement ? [row.labelElement] : [];
    return row.valueElement ? [row.valueElement] : [];
}

export function getChargeSummaryValue(element) {
    if (!(element instanceof HTMLElement)) return '';
    return normalizeInlineText(element.textContent);
}

export function setChargeSummaryValue(element, value) {
    if (!(element instanceof HTMLElement)) return;
    const nextValue = typeof value === 'string' && /<[^>]+>/.test(value)
        ? extractInlineTextFromHtml(value)
        : normalizeInlineText(value);
    element.textContent = nextValue;
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

export function resolveBusinessNameElements(part = 'value') {
    const row = getBusinessNameRow();
    if (!(row instanceof HTMLElement)) return [];
    if (part === 'label') {
        return normalizeResolvedElements(row.querySelector('span.a-text-bold'));
    }
    return normalizeResolvedElements(row.querySelector('span.a-text-bold + span'));
}

export function resolveBusinessAddressElements(part = 'value') {
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

export function resolveOfferDisplayBrandElements() {
    const candidates = collectElementsFromSelectors([
        '#sellerProfileTriggerId',
        '#seller-name'
    ]);
    const preferred = pickPreferredValueElement(candidates);
    return preferred ? [preferred] : [];
}

export function resolveProductOverviewBrandElements() {
    return collectElementsFromSelectors(PRODUCT_OVERVIEW_BRAND_SELECTORS);
}

function getModernPaymentCardNumberElement(element) {
    if (!(element instanceof HTMLElement)) return null;
    if (element.matches(MODERN_PAYMENT_CARD_NUMBER_SELECTOR)) {
        return element;
    }

    const numberElement = element.querySelector(MODERN_PAYMENT_CARD_NUMBER_SELECTOR);
    return numberElement instanceof HTMLElement ? numberElement : null;
}

function normalizePaymentCardEndingValue(value) {
    const normalized = normalizeInlineText(value);
    if (!normalized) return '';

    const trailingMatch = normalized.match(/(?:ending\s+in|[•*]{2,})\s*(.+)$/i);
    return trailingMatch ? trailingMatch[1].trim() : normalized;
}

export function resolvePaymentCardEndingElements() {
    const legacyElements = collectElementsFromSelectors(LEGACY_PAYMENT_CARD_ENDING_SELECTORS).filter((element) => {
        const text = normalizeInlineText(element.textContent);
        return /ending\s+in\s+.+/i.test(text);
    });

    const modernElements = collectElementsFromSelectors([MODERN_PAYMENT_CARD_TEXT_WRAPPER_SELECTOR])
        .map((wrapper) => getModernPaymentCardNumberElement(wrapper))
        .filter((element) => {
            const text = normalizeInlineText(element.textContent);
            return Boolean(text);
        });

    return normalizeResolvedElements([...legacyElements, ...modernElements]);
}

export function getPaymentCardEndingValue(element) {
    const modernNumberElement = getModernPaymentCardNumberElement(element);
    if (modernNumberElement) {
        return normalizePaymentCardEndingValue(modernNumberElement.textContent);
    }

    const text = normalizeInlineText(element && element.textContent);
    const match = text.match(/ending\s+in\s+(.+)$/i);
    return match ? match[1].trim() : text;
}

export function setPaymentCardEndingValue(element, value) {
    if (!(element instanceof HTMLElement)) return;

    const nextSuffix = normalizePaymentCardEndingValue(value);
    const modernNumberElement = getModernPaymentCardNumberElement(element);
    if (modernNumberElement) {
        modernNumberElement.textContent = nextSuffix;
        return;
    }

    const currentText = normalizeInlineText(element.textContent);
    const prefixMatch = currentText.match(/^(.*?ending\s+in)\s+.+$/i);
    const prefix = prefixMatch ? prefixMatch[1].trim() : 'ending in';

    element.textContent = nextSuffix ? `${prefix} ${nextSuffix}` : prefix;
}
