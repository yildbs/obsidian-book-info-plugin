export type BookProviderId = 'yes24';

export interface BookSearchResult {
	id: string;
	providerId: BookProviderId;
	title: string;
	titleHtml?: string;
	subtitle?: string;
	authors: string[];
	publisher?: string;
	publishedDate?: string;
	productType?: string;
	category?: string;
	categoryPath?: string[];
	isbn?: string;
	thumbnailUrl?: string;
	url: string;
}

export interface BookMetadata extends BookSearchResult {
	pageCount?: number;
	description?: string;
}

export interface BookSearchProvider {
	id: BookProviderId;
	name: string;
	search(query: string): Promise<BookSearchResult[]>;
	getDetails(result: BookSearchResult): Promise<BookMetadata>;
}

export interface NoteCreationResult {
	notePath: string;
	thumbnailPath?: string;
}
