import { BookMetadata } from './types';

export interface TemplateContext {
	book: BookMetadata;
	createdAt: Date;
	timestamp: number;
	thumbnailEmbed: string;
}

const pad = (value: number) => value.toString().padStart(2, '0');

export const formatDateCompact = (date: Date): string => {
	return [
		date.getFullYear().toString(),
		pad(date.getMonth() + 1),
		pad(date.getDate()),
	].join('');
};

export const formatDateDashed = (date: Date): string => {
	return [
		date.getFullYear().toString(),
		pad(date.getMonth() + 1),
		pad(date.getDate()),
	].join('-');
};

const singleLine = (value: string | undefined): string => {
	return (value ?? '').replace(/\s+/g, ' ').trim();
};

export const renderTemplate = (
	template: string,
	{ book, createdAt, timestamp, thumbnailEmbed }: TemplateContext,
): string => {
	const authors = book.authors.map(singleLine).filter(Boolean).join(', ');
	const replacements: Record<string, string> = {
		'<@YYYYMMDD@>': formatDateCompact(createdAt),
		'<@YYYY-MM-DD@>': formatDateDashed(createdAt),
		'<@TIMESTAMP@>': timestamp.toString(),
		'<@BOOKTITLE@>': singleLine(book.title),
		'<@BOOKSUBTITLE@>': singleLine(book.subtitle),
		'<@BOOKAUTHOR@>': authors,
		'<@BOOKAUTHORS@>': authors,
		'<@BOOKPUBLISHER@>': singleLine(book.publisher),
		'<@BOOKPUBLISHEDDATE@>': singleLine(book.publishedDate),
		'<@BOOKCATEGORY@>': singleLine(book.category),
		'<@BOOKISBN@>': singleLine(book.isbn),
		'<@BOOKPAGE@>': book.pageCount?.toString() ?? '',
		'<@BOOKDESCRIPTION@>': singleLine(book.description),
		'<@BOOKURL@>': book.url,
		'<@BOOKTHUMBNAILURL@>': book.thumbnailUrl ?? '',
		'<@BOOKTHUMBNAIL@>': thumbnailEmbed,
	};

	return Object.entries(replacements).reduce((content, [token, value]) => {
		return content.replaceAll(token, value);
	}, template);
};
