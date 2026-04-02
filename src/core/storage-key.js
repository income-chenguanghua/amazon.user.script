export function buildStorageKey(pageKey, config) {
    if (!config) return null;
    const suffixSource = config.keySuffix ||
        (Array.isArray(config.selector) ? config.selector[0] : config.selector);
    const suffix = typeof suffixSource === 'string' ? suffixSource.trim() : '';
    if (!suffix) return null;

    return `${pageKey}__${suffix}`;
}

export function buildStorageKeyFromSuffix(pageKey, keySuffix) {
    const suffix = typeof keySuffix === 'string' ? keySuffix.trim() : '';
    return suffix ? `${pageKey}__${suffix}` : null;
}
