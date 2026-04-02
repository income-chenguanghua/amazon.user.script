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
    charge_refund_total: ['refund total', 'refund', '退款', '返金', '払い戻し', 'reembolso', 'rimborso', 'remboursement', 'erstattung', 'rückerstattung', 'zwrot', 'iade', 'استرداد']
};

const PRODUCT_OVERVIEW_BRAND_SELECTORS = [
    '#productOverview_feature_div > div > table > tbody > tr.a-spacing-small.po-brand > td.a-span9 > span',
    '#poExpander > div.a-expander-content.a-expander-partial-collapse-content > div > table > tbody > tr.a-spacing-small.po-brand > td.a-span9 > span',
    '#topHighlight > div.a-section.a-spacing-small.a-spacing-top-small > table > tbody > tr.a-spacing-small.po-brand > td.a-span9 > span'
];

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

export function resolveChargeSummaryElements(keySuffix, part = 'value') {
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
