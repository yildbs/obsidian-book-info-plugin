import {
	App,
	ButtonComponent,
	DropdownComponent,
	FuzzySuggestModal,
	Modal,
	Notice,
	sanitizeHTMLToDom,
	Setting,
	TFile,
	TextComponent,
} from 'obsidian';
import { createBookNote } from '../noteCreator';
import { BookInfoPluginSettings } from '../settings';
import {
	BookProviderId,
	BookSearchProvider,
	BookSearchResult,
	NoteCreationResult,
} from '../types';

class TemplateNoteSuggestModal extends FuzzySuggestModal<TFile> {
	private readonly onChoose: (file: TFile) => void;

	constructor(app: App, onChoose: (file: TFile) => void) {
		super(app);
		this.onChoose = onChoose;
		this.setPlaceholder('Choose a template note');
	}

	getItems(): TFile[] {
		return this.app.vault.getMarkdownFiles();
	}

	getItemText(file: TFile): string {
		return file.path;
	}

	onChooseItem(file: TFile): void {
		this.onChoose(file);
	}
}

export class BookSearchModal extends Modal {
	private readonly providers: BookSearchProvider[];
	private readonly settings: BookInfoPluginSettings;
	private readonly defaultTemplate: string;
	private readonly saveSettings: () => Promise<void>;
	private selectedProviderId: BookProviderId;
	private selectedTemplateFile: TFile | undefined;
	private query = '';
	private resultContainerEl!: HTMLElement;
	private statusEl!: HTMLElement;
	private searchButton!: ButtonComponent;
	private queryInput!: TextComponent;
	private providerDropdown!: DropdownComponent;

	constructor({
		app,
		providers,
		settings,
		defaultTemplate,
		saveSettings,
	}: {
		app: App;
		providers: BookSearchProvider[];
		settings: BookInfoPluginSettings;
		defaultTemplate: string;
		saveSettings: () => Promise<void>;
	}) {
		super(app);
		this.providers = providers;
		this.settings = settings;
		this.defaultTemplate = defaultTemplate;
		this.saveSettings = saveSettings;
		this.selectedProviderId = settings.defaultProvider;
		this.selectedTemplateFile = this.getSavedTemplateFile();
		if (settings.defaultTemplatePath && !this.selectedTemplateFile) {
			this.settings.defaultTemplatePath = '';
			void this.saveSettings();
		}
	}

	onOpen(): void {
		const { contentEl } = this;
		this.modalEl.addClass('book-info-modal-shell');
		contentEl.empty();
		contentEl.addClass('book-info-modal');
		contentEl.createEl('h2', { text: 'Import book metadata' });

		this.renderSearchForm(contentEl);
		this.statusEl = contentEl.createDiv('book-info-status');
		this.resultContainerEl = contentEl.createDiv('book-info-results');
	}

	onClose(): void {
		this.modalEl.removeClass('book-info-modal-shell');
		this.contentEl.empty();
	}

	private renderSearchForm(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Search site')
			.setDesc('Choose where to search for book metadata.')
			.addDropdown((dropdown) => {
				this.providerDropdown = dropdown;
				for (const provider of this.providers) {
					dropdown.addOption(provider.id, provider.name);
				}
				dropdown
					.setValue(this.selectedProviderId)
					.onChange((value) => {
						this.selectedProviderId = value as BookProviderId;
					});
			});

		new Setting(containerEl)
			.setName('Book title')
			.setDesc('Enter a title to search.')
			.addText((text) => {
				this.queryInput = text;
				text
					.setPlaceholder('Book title')
					.setValue(this.query)
					.onChange((value) => {
						this.query = value;
					});
				text.inputEl.addEventListener('keydown', (event) => {
					if (event.key === 'Enter') {
						void this.search();
					}
				});
			});

		let chooseTemplateButton: ButtonComponent | undefined;

		new Setting(containerEl)
			.setName('Template note')
			.setDesc('Optional. If omitted, the default book template is used.')
			.addButton((button) => {
				chooseTemplateButton = button
					.setButtonText(this.getTemplateButtonText())
					.onClick(() => {
						new TemplateNoteSuggestModal(this.app, (file) => {
							this.selectedTemplateFile = file;
							this.settings.defaultTemplatePath = file.path;
							void this.saveSettings();
							chooseTemplateButton?.setButtonText(this.getTemplateButtonText());
						}).open();
					});
			})
			.addButton((button) =>
				button
					.setIcon('x')
					.setTooltip('Clear template note')
					.onClick(async () => {
						this.selectedTemplateFile = undefined;
						this.settings.defaultTemplatePath = '';
						await this.saveSettings();
						chooseTemplateButton?.setButtonText(this.getTemplateButtonText());
					}),
			);

		new Setting(containerEl).addButton((button) => {
			this.searchButton = button;
			button
				.setButtonText('Search')
				.setCta()
				.onClick(() => {
					void this.search();
				});
		});
	}

	private getTemplateButtonText(): string {
		return this.selectedTemplateFile?.path ?? 'Choose template';
	}

	private getSavedTemplateFile(): TFile | undefined {
		const path = this.settings.defaultTemplatePath;
		if (!path) {
			return undefined;
		}

		const file = this.app.vault.getAbstractFileByPath(path);
		return file instanceof TFile ? file : undefined;
	}

	private getProvider(): BookSearchProvider | undefined {
		return this.providers.find((provider) => provider.id === this.selectedProviderId);
	}

	private async search(): Promise<void> {
		const query = this.query.trim();
		const provider = this.getProvider();

		if (!provider) {
			new Notice('Search provider is not available.');
			return;
		}

		if (!query) {
			new Notice('Enter a book title to search.');
			this.queryInput.inputEl.focus();
			return;
		}

		this.setBusy(true, 'Searching...');
		this.resultContainerEl.empty();

		try {
			const results = await provider.search(query);
			if (results.length === 0) {
				this.statusEl.setText('No results found.');
				return;
			}

			this.statusEl.setText(`${results.length} result(s) found.`);
			this.renderResults(results);
		} catch (error) {
			console.error('Book search failed', error);
			this.statusEl.setText('Search failed.');
			new Notice('Book search failed.');
		} finally {
			this.setBusy(false);
		}
	}

	private renderResults(results: BookSearchResult[]): void {
		this.resultContainerEl.empty();

		for (const result of results) {
			const itemEl = this.resultContainerEl.createDiv('book-info-result');
			const thumbnailEl = itemEl.createDiv('book-info-result-thumbnail');

			if (result.thumbnailUrl) {
				thumbnailEl.createEl('img', {
					attr: {
						src: result.thumbnailUrl,
						alt: result.title,
					},
				});
			}

			const bodyEl = itemEl.createDiv('book-info-result-body');
			const titleEl = bodyEl.createDiv('book-info-result-title');
			this.renderResultTitle(titleEl, result);

			if (result.subtitle) {
				bodyEl.createDiv({
					cls: 'book-info-result-subtitle',
					text: result.subtitle,
				});
			}

			bodyEl.createDiv({
				cls: 'book-info-result-meta',
				text: this.formatResultMeta(result),
			});

			this.renderResultTags(bodyEl, result);

			new ButtonComponent(itemEl)
				.setButtonText('Select')
				.setCta()
				.onClick(() => {
					void this.createNoteFromResult(result);
				});
		}
	}

	private renderResultTitle(
		containerEl: HTMLElement,
		result: BookSearchResult,
	): void {
		if (!result.titleHtml) {
			containerEl.setText(result.title);
			return;
		}

		containerEl.appendChild(sanitizeHTMLToDom(result.titleHtml));
	}

	private renderResultTags(
		containerEl: HTMLElement,
		result: BookSearchResult,
	): void {
		const tags = [
			result.productType,
			result.category,
			result.categoryPath?.slice(1).join(' > '),
			result.isbn ? `ISBN ${result.isbn}` : undefined,
		].filter((tag): tag is string => Boolean(tag));

		if (tags.length === 0) {
			return;
		}

		const tagListEl = containerEl.createDiv('book-info-result-tags');
		for (const tag of tags) {
			tagListEl.createSpan({
				cls: 'book-info-result-tag',
				text: tag,
			});
		}
	}

	private formatResultMeta(result: BookSearchResult): string {
		return [
			result.authors.join(', '),
			result.publisher,
			result.publishedDate,
		]
			.filter(Boolean)
			.join(' · ');
	}

	private async createNoteFromResult(result: BookSearchResult): Promise<void> {
		const provider = this.getProvider();
		if (!provider) {
			new Notice('Search provider is not available.');
			return;
		}

		this.setBusy(true, 'Importing metadata...');

		try {
			const book = await provider.getDetails(result);
			const creationResult = await createBookNote({
				app: this.app,
				book,
				defaultTemplate: this.defaultTemplate,
				templateFile: this.selectedTemplateFile,
			});
			await this.openCreatedNote(creationResult);
			new Notice(`Book note created: ${creationResult.notePath}`);
			this.close();
		} catch (error) {
			console.error('Failed to create book note', error);
			new Notice('Failed to create book note.');
			this.statusEl.setText('Failed to create book note.');
		} finally {
			this.setBusy(false);
		}
	}

	private async openCreatedNote(result: NoteCreationResult): Promise<void> {
		if (!this.settings.openAfterCreate) {
			return;
		}

		const file = this.app.vault.getAbstractFileByPath(result.notePath);
		if (file instanceof TFile) {
			await this.app.workspace.getLeaf(false).openFile(file);
		}
	}

	private setBusy(isBusy: boolean, message?: string): void {
		this.searchButton?.setDisabled(isBusy);
		this.providerDropdown?.setDisabled(isBusy);
		this.queryInput?.setDisabled(isBusy);

		if (message) {
			this.statusEl?.setText(message);
		}
	}
}
