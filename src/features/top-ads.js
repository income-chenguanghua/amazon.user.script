import { GM_addStyle } from '$';

const amazonTopAdSelectors = ['#nav-swmslot', '#navSwmHoliday'];
const amazonTopAdSelectorText = amazonTopAdSelectors.join(', ');

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

export function startAmazonTopAdCleanup() {
    GM_addStyle(`
        ${amazonTopAdSelectors.join(',\n        ')} {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
        }
    `);

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
