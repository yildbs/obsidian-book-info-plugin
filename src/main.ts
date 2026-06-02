import { Notice, Plugin } from 'obsidian';
import {
	BookInfoPluginSettings,
	BookInfoSettingTab,
	DEFAULT_SETTINGS,
} from './settings';
import { yes24Provider } from './providers/yes24';
import { BookSearchModal } from './ui/bookSearchModal';
import { BookSearchProvider } from './types';

export default class BookInfoPlugin extends Plugin {
	settings!: BookInfoPluginSettings;
	private providers!: BookSearchProvider[];
	private defaultTemplate = '';

	async onload(): Promise<void> {
		await this.loadSettings();
		await this.loadDefaultTemplate();
		this.providers = [yes24Provider];

		this.addRibbonIcon('book-open', 'Import book metadata', () => {
			this.openBookSearchModal();
		});

		this.addCommand({
			id: 'import-book-metadata',
			name: 'Import book metadata',
			icon: 'book-open',
			callback: () => {
				this.openBookSearchModal();
			},
		});

		this.addSettingTab(new BookInfoSettingTab(this.app, this));
	}

	onunload(): void {}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<BookInfoPluginSettings>,
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private async loadDefaultTemplate(): Promise<void> {
		const templatePath = `${this.manifest.dir}/default-book-template.md`;

		try {
			this.defaultTemplate = await this.app.vault.adapter.read(templatePath);
		} catch (error) {
			console.error('Failed to load default book template', error);
			new Notice('Default book template file is missing.');
			this.defaultTemplate = '';
		}
	}

	private openBookSearchModal(): void {
		if (this.providers.length === 0) {
			new Notice('No book search providers are available.');
			return;
		}

		new BookSearchModal({
			app: this.app,
			providers: this.providers,
			settings: this.settings,
			defaultTemplate: this.defaultTemplate,
			saveSettings: () => this.saveSettings(),
		}).open();
	}
}
