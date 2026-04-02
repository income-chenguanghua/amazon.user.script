import { GM_getValue, GM_setValue } from '$';

import { defaultFieldConfigs } from '../config/field-configs.js';
import { cloneFieldConfig } from './utils.js';

export class StorageManager {
    #defaultList = defaultFieldConfigs;

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
