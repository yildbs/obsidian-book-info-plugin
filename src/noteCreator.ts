import { App, requestUrl, TFile } from 'obsidian';
import { formatDateCompact, renderTemplate } from './template';
import { BookMetadata, NoteCreationResult } from './types';

const normalizeFolderPath = (path: string | undefined): string => {
	const trimmed = (path ?? '').trim();

	if (!trimmed || trimmed === '/' || trimmed === './') {
		return '';
	}

	return trimmed.replace(/^\/+/, '').replace(/\/+$/, '');
};

const imageExtensionFromUrl = (url: string): string => {
	const path = new URL(url).pathname.toLowerCase();

	if (path.endsWith('.png')) {
		return 'png';
	}

	if (path.endsWith('.webp')) {
		return 'webp';
	}

	if (path.endsWith('.gif')) {
		return 'gif';
	}

	return 'jpg';
};

const joinPath = (...parts: string[]): string => {
	return parts.filter(Boolean).join('/');
};

const getAttachmentFolderPath = (app: App): string => {
	const configuredPath = (app.vault as unknown as {
		getConfig?: (key: string) => string | undefined;
	}).getConfig?.('attachmentFolderPath');

	return normalizeFolderPath(configuredPath);
};

const ensureFolder = async (app: App, folderPath: string): Promise<void> => {
	if (!folderPath) {
		return;
	}

	const parts = folderPath.split('/').filter(Boolean);
	let currentPath = '';

	for (const part of parts) {
		currentPath = joinPath(currentPath, part);
		const existing = app.vault.getAbstractFileByPath(currentPath);

		if (!existing) {
			await app.vault.createFolder(currentPath);
		}
	}
};

const createUniqueNotePath = (app: App, baseName: string): string => {
	let path = `${baseName}.md`;
	let index = 1;

	while (app.vault.getAbstractFileByPath(path)) {
		path = `${baseName}_${index}.md`;
		index += 1;
	}

	return path;
};

const downloadThumbnail = async (
	app: App,
	book: BookMetadata,
	baseName: string,
): Promise<string | undefined> => {
	if (!book.thumbnailUrl) {
		return undefined;
	}

	const attachmentFolderPath = getAttachmentFolderPath(app);
	const extension = imageExtensionFromUrl(book.thumbnailUrl);
	const thumbnailPath = joinPath(attachmentFolderPath, `${baseName}.${extension}`);

	await ensureFolder(app, attachmentFolderPath);
	const response = await requestUrl({ url: book.thumbnailUrl });
	await app.vault.createBinary(thumbnailPath, response.arrayBuffer);

	return thumbnailPath;
};

const readTemplate = async (
	app: App,
	templateFile: TFile | undefined,
	defaultTemplate: string,
): Promise<string> => {
	if (!templateFile) {
		return defaultTemplate;
	}

	return app.vault.read(templateFile);
};

export const createBookNote = async ({
	app,
	book,
	defaultTemplate,
	templateFile,
}: {
	app: App;
	book: BookMetadata;
	defaultTemplate: string;
	templateFile?: TFile;
}): Promise<NoteCreationResult> => {
	const createdAt = new Date();
	const timestamp = Date.now();
	const baseName = `${formatDateCompact(createdAt)}_${timestamp}`;
	const notePath = createUniqueNotePath(app, baseName);
	const template = await readTemplate(app, templateFile, defaultTemplate);

	let thumbnailPath: string | undefined;
	let thumbnailEmbed = book.thumbnailUrl ? `![](${book.thumbnailUrl})` : '';

	try {
		thumbnailPath = await downloadThumbnail(app, book, baseName);
		if (thumbnailPath) {
			thumbnailEmbed = `![[${thumbnailPath}|200]]`;
		}
	} catch (error) {
		console.error('Failed to download book thumbnail', error);
	}

	const content = renderTemplate(template, {
		book,
		createdAt,
		timestamp,
		thumbnailEmbed,
	});

	await app.vault.create(notePath, content);

	return {
		notePath,
		thumbnailPath,
	};
};
