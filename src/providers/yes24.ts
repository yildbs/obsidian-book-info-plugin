import { requestUrl } from 'obsidian';
import { BookMetadata, BookSearchProvider, BookSearchResult } from '../types';

const YES24_ORIGIN = 'https://www.yes24.com';

const textOf = (root: ParentNode, selector: string): string => {
	return root.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
};

const attrOf = (
	root: ParentNode,
	selector: string,
	attribute: string,
): string | undefined => {
	return root.querySelector(selector)?.getAttribute(attribute) ?? undefined;
};

const absoluteUrl = (url: string): string => {
	if (url.startsWith('//')) {
		return `https:${url}`;
	}

	if (url.startsWith('http://') || url.startsWith('https://')) {
		return url;
	}

	return `${YES24_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
};

const extractBookId = (url: string): string => {
	return url.match(/\/Goods\/(\d+)/)?.[1] ?? url;
};

const normalizeTitle = (title: string): string => {
	return title
		.replace(/\(.*?\)/g, '')
		.replace(/\[.*?\]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
};

const parseDate = (value: string): string => {
	const match = value.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
	if (!match) {
		return value.trim();
	}

	const [, year, month, day] = match;
	if (!year || !month || !day) {
		return value.trim();
	}

	return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

const parseSearchAuthors = (item: Element): string[] => {
	const authors = Array.from(
		item.querySelectorAll('.info_auth a, .gd_auth a, a[href*="Author"]'),
	)
		.map((author) => author.textContent?.trim() ?? '')
		.filter(Boolean);

	return [...new Set(authors)];
};

const parseSearchItem = (item: Element): BookSearchResult | undefined => {
	const titleAnchor = item.querySelector<HTMLAnchorElement>('a.gd_name');
	const href = titleAnchor?.getAttribute('href');
	const title = titleAnchor?.textContent?.trim();

	if (!href || !title) {
		return undefined;
	}

	const publisher = textOf(item, '.info_pub, .gd_pub');
	const publishedDate = parseDate(textOf(item, '.info_date, .gd_date'));
	const thumbnailUrl =
		attrOf(item, 'img', 'data-original') ?? attrOf(item, 'img', 'src');
	const url = absoluteUrl(href);

	return {
		id: extractBookId(url),
		providerId: 'yes24',
		title: normalizeTitle(title),
		authors: parseSearchAuthors(item),
		publisher,
		publishedDate,
		thumbnailUrl: thumbnailUrl ? absoluteUrl(thumbnailUrl) : undefined,
		url,
	};
};

const parseBulletSearch = async (query: string): Promise<BookSearchResult[]> => {
	const response = await requestUrl({
		url: `${YES24_ORIGIN}/Product/searchapi/bulletsearch/goods?query=${encodeURIComponent(query)}`,
	});
	const data = JSON.parse(response.text) as {
		lstSearchKeywordResult?: Array<{
			GOODDS_INDEXES?: {
				GOODS_NO?: string | number;
				GOODS_NM?: string;
				AUTH_NM?: string;
				PUB_NM?: string;
				IMG_URL?: string;
			};
		}>;
	};

	const results: BookSearchResult[] = [];
	for (const item of data.lstSearchKeywordResult ?? []) {
		const indexes = item.GOODDS_INDEXES;
		const goodsNo = indexes?.GOODS_NO?.toString();
		const title = indexes?.GOODS_NM;

		if (!goodsNo || !title) {
			continue;
		}

		results.push({
			id: goodsNo,
			providerId: 'yes24',
			title: normalizeTitle(title),
			authors: indexes.AUTH_NM ? [indexes.AUTH_NM] : [],
			publisher: indexes.PUB_NM,
			thumbnailUrl: indexes.IMG_URL ? absoluteUrl(indexes.IMG_URL) : undefined,
			url: `${YES24_ORIGIN}/Product/Goods/${goodsNo}`,
		});
	}

	return results;
};

const parseAuthors = (html: Document): string[] => {
	const selectors = [
		'#yDetailTopWrap .gd_infoTop .gd_pubArea .gd_auth > a',
		'#yDetailTopWrap .gd_infoTop .gd_pubArea .gd_auth .moreAuthLi a',
	];
	const authors = selectors.flatMap((selector) =>
		Array.from(html.querySelectorAll(selector)).map(
			(author) => author.textContent?.trim() ?? '',
		),
	);

	return [...new Set(authors.filter(Boolean))];
};

const parsePageCount = (html: Document): number | undefined => {
	const specificText = textOf(html, '#infoset_specific');
	const match = specificText.match(/(\d{1,5})쪽/);
	return match?.[1] ? Number(match[1]) : undefined;
};

const parseIsbn = (html: Document): string | undefined => {
	const specificText = textOf(html, '#infoset_specific');
	return specificText.match(/ISBN13\s*(\d{10,13})/)?.[1];
};

const parseDescription = (html: Document): string | undefined => {
	const description = textOf(
		html,
		'#infoset_introduce .infoSetCont_wrap .infoWrap_txt div',
	);
	return description || undefined;
};

const parseCategory = (html: Document): string | undefined => {
	const categories = Array.from(
		html.querySelectorAll(
			'#infoset_goodsCate .infoSetCont_wrap dl:nth-child(1) dd ul li a',
		),
	)
		.map((category) => category.textContent?.replace(/\s+/g, '').trim() ?? '')
		.filter(Boolean);

	return categories.at(0);
};

export const yes24Provider: BookSearchProvider = {
	id: 'yes24',
	name: 'YES24',

	async search(query: string): Promise<BookSearchResult[]> {
		const response = await requestUrl({
			url: `${YES24_ORIGIN}/Product/Search?domain=BOOK&query=${encodeURIComponent(query)}`,
		});
		const html = new DOMParser().parseFromString(response.text, 'text/html');
		const items = Array.from(html.querySelectorAll('#yesSchList > li'));
		const results = items
			.map(parseSearchItem)
			.filter((result): result is BookSearchResult => result !== undefined);

		if (results.length > 0) {
			return results;
		}

		return parseBulletSearch(query);
	},

	async getDetails(result: BookSearchResult): Promise<BookMetadata> {
		const response = await requestUrl({ url: result.url });
		const html = new DOMParser().parseFromString(response.text, 'text/html');

		const mainTitle =
			textOf(html, '#yDetailTopWrap .gd_infoTop h2') || result.title;
		const subtitle = textOf(html, '#yDetailTopWrap .gd_infoTop h3');
		const title = normalizeTitle(mainTitle);
		const thumbnailUrl =
			attrOf(html, '#yDetailTopWrap .topColLft .gd_3dGrp .gd_img img', 'src') ??
			attrOf(html, '#yDetailTopWrap .topColLft span em img', 'src') ??
			result.thumbnailUrl;

		return {
			...result,
			title,
			subtitle: subtitle || result.subtitle,
			authors: parseAuthors(html).length > 0 ? parseAuthors(html) : result.authors,
			publisher: textOf(html, '#yDetailTopWrap .gd_infoTop .gd_pub') || result.publisher,
			publishedDate:
				parseDate(textOf(html, '#yDetailTopWrap .gd_infoTop .gd_date')) ||
				result.publishedDate,
			category: parseCategory(html) ?? result.category,
			isbn: parseIsbn(html) ?? result.isbn,
			thumbnailUrl: thumbnailUrl ? absoluteUrl(thumbnailUrl) : undefined,
			pageCount: parsePageCount(html),
			description: parseDescription(html),
			url: result.url,
		};
	},
};
