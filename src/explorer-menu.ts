// SPDX-License-Identifier: MIT
import { TFolder, type TAbstractFile, type Plugin, type Menu, type MenuItem } from 'obsidian';
export function registerBulkMenus(plugin: Plugin, open: (mode: 'add' | 'remove', targets: TAbstractFile[]) => void): void {
    const seen = new WeakMap<Menu, {
        targets: TAbstractFile[];
        items: MenuItem[];
    }>();
    const title = (mode: 'add' | 'remove', folder: boolean) => `${mode === 'add' ? 'Add properties to' : 'Remove properties from'} ${folder ? "folder's notes" : 'selected notes'}…`;
    const add = (menu: Menu, targets: TAbstractFile[], folder: boolean) => {
        const existing = seen.get(menu);
        if (existing) {
            if (!folder) {
                existing.targets = targets;
                existing.items.forEach((item, i) => item.setTitle(title(i === 0 ? 'add' : 'remove', false)));
            }
            return;
        }
        const entry = { targets, items: [] as MenuItem[] };
        seen.set(menu, entry);
        for (const mode of ['add', 'remove'] as const)
            menu.addItem(item => { entry.items.push(item); return item.setTitle(title(mode, folder)).setIcon(mode === 'add' ? 'list-plus' : 'list-minus').onClick(() => open(mode, entry.targets)); });
    };
    plugin.registerEvent(plugin.app.workspace.on('file-menu', (menu, file) => { if (file instanceof TFolder)
        add(menu, [file], true); }));
    plugin.registerEvent(plugin.app.workspace.on('files-menu', (menu, files) => { if (files.length > 1)
        add(menu, files, false); }));
}
