import {
    getPaymentCardEndingValue,
    getChargeSummaryValue,
    resolveBusinessAddressElements,
    resolveBusinessNameElements,
    resolveChargeSummaryElements,
    resolveOfferDisplayBrandElements,
    resolvePaymentCardEndingElements,
    resolveProductOverviewBrandElements,
    setChargeSummaryValue,
    setPaymentCardEndingValue
} from '../features/resolvers.js';

export const defaultFieldConfigs = [
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
        name: '信用卡尾号',
        keySuffix: 'payment_card_last4',
        watchSelectors: [
            '.pmts-payments-instrument-list',
            '[data-testid="payment-instrument-text-wrapper"]'
        ],
        resolveElements: () => resolvePaymentCardEndingElements(),
        multiple: true,
        editMode: 'dialog',
        dialogButtonLabel: '改',
        getValue: getPaymentCardEndingValue,
        setValue: setPaymentCardEndingValue
    },
    {
        name: '发货信息',
        keySuffix: 'checkout_ships_from',
        selector: '#checkout-item-block-panel .lineitem-container .product-description-column p.a-spacing-none > span.a-size-small',
        multiple: true
    },
    {
        name: '小计',
        keySuffix: 'charge_subtotal',
        watchSelectors: ['[data-component="chargeSummary"]'],
        resolveElements: () => resolveChargeSummaryElements('charge_subtotal'),
        getValue: getChargeSummaryValue,
        setValue: setChargeSummaryValue
    },
    {
        name: '运费',
        keySuffix: 'charge_shipping',
        watchSelectors: ['[data-component="chargeSummary"]'],
        resolveElements: () => resolveChargeSummaryElements('charge_shipping'),
        getValue: getChargeSummaryValue,
        setValue: setChargeSummaryValue
    },
    {
        name: '税前总计',
        keySuffix: 'charge_total_before_tax',
        watchSelectors: ['[data-component="chargeSummary"]'],
        resolveElements: () => resolveChargeSummaryElements('charge_total_before_tax'),
        getValue: getChargeSummaryValue,
        setValue: setChargeSummaryValue
    },
    {
        name: '预估税费',
        keySuffix: 'charge_estimated_tax',
        watchSelectors: ['[data-component="chargeSummary"]'],
        resolveElements: () => resolveChargeSummaryElements('charge_estimated_tax'),
        getValue: getChargeSummaryValue,
        setValue: setChargeSummaryValue
    },
    {
        name: '总计',
        keySuffix: 'charge_grand_total',
        watchSelectors: ['[data-component="chargeSummary"]'],
        resolveElements: () => resolveChargeSummaryElements('charge_grand_total'),
        getValue: getChargeSummaryValue,
        setValue: setChargeSummaryValue
    },
    {
        name: '退款总计标签',
        keySuffix: 'charge_refund_total_label',
        watchSelectors: ['[data-component="chargeSummary"]'],
        resolveElements: () => resolveChargeSummaryElements('charge_refund_total_label', 'label')
    },
    {
        name: '退款总计',
        keySuffix: 'charge_refund_total',
        watchSelectors: ['[data-component="chargeSummary"]'],
        resolveElements: () => resolveChargeSummaryElements('charge_refund_total'),
        getValue: getChargeSummaryValue,
        setValue: setChargeSummaryValue
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
        selector: '#acrCustomerReviewText',
        editMode: 'dialog',
        dialogButtonLabel: '改'
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
    }
];
