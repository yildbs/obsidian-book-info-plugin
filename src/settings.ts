import { App, PluginSettingTab, Setting } from 'obsidian';
import BookInfoPlugin from './main';
import { BookProviderId } from './types';

export interface BookInfoPluginSettings {
	defaultProvider: BookProviderId;
	openAfterCreate: boolean;
}

export const DEFAULT_SETTINGS: BookInfoPluginSettings = {
	defaultProvider: 'yes24',
	openAfterCreate: true,
};

export class BookInfoSettingTab extends PluginSettingTab {
	plugin: BookInfoPlugin;

	constructor(app: App, plugin: BookInfoPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl).setName('Defaults').setHeading();

		new Setting(containerEl)
			.setName('Default search site')
			.setDesc('Choose the default provider for book searches.')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('yes24', 'YES24')
					.setValue(this.plugin.settings.defaultProvider)
					.onChange(async (value) => {
						this.plugin.settings.defaultProvider = value as BookProviderId;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Open created note')
			.setDesc('Open the new book note after metadata is imported.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.openAfterCreate)
					.onChange(async (value) => {
						this.plugin.settings.openAfterCreate = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
