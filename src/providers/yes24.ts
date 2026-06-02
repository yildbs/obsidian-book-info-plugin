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

const htmlToText = (html: string): string => {
	const document = new DOMParser().parseFromString(html, 'text/html');
	return document.body.textContent ?? html;
};

const normalizeTitle = (title: string): string => {
	return htmlToText(title)
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

const parseProductType = (
	domain: string | undefined,
	resKeyGb: string | undefined,
): string | undefined => {
	if (domain === '03' || resKeyGb === '13') {
		return 'eBook';
	}

	if (domain === '01' || resKeyGb === '01') {
		return '국내도서';
	}

	if (domain === '02') {
		return '외국도서';
	}

	return undefined;
};

const parseBulletAuthors = (authorInfo: string | undefined): string[] => {
	if (!authorInfo) {
		return [];
	}

	const primaryAuthor = authorInfo
		.split('`')[0]
		?.replace(/<([^>]+)>/g, '$1')
		.replace(/\b(저|역|글|그림|편저|공저)\b/g, '')
		.replace(/\s+/g, ' ')
		.trim();

	return primaryAuthor ? [primaryAuthor] : [];
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
	const titleHtml = titleAnchor?.innerHTML.trim();

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
		titleHtml,
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
				SUB_TTL?: string;
				AUTH_INFO?: string;
				COMPANY2?: string;
				DOMAIN?: string;
				RES_KEY_GB?: string;
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
			titleHtml: title,
			subtitle: indexes.SUB_TTL || undefined,
			authors: parseBulletAuthors(indexes.AUTH_INFO),
			publisher: indexes.COMPANY2,
			productType: parseProductType(indexes.DOMAIN, indexes.RES_KEY_GB),
			thumbnailUrl: indexes.IMG_URL ? absoluteUrl(indexes.IMG_URL) : undefined,
			url: `${YES24_ORIGIN}/Product/Goods/${goodsNo}`,
		});
	}

	return results;
};

const parseJsonLdGenres = (html: Document): string[] => {
	for (const script of Array.from(
		html.querySelectorAll('script[type="application/ld+json"]'),
	)) {
		const rawJson = script.textContent?.trim();
		if (!rawJson) {
			continue;
		}

		try {
			const data = JSON.parse(rawJson) as {
				genre?: string | string[];
			};
			const genre = data.genre;

			if (Array.isArray(genre)) {
				return genre.map((item) => item.trim()).filter(Boolean);
			}

			if (genre) {
				return genre
					.split(/[,>]/)
					.map((item) => item.trim())
					.filter(Boolean);
			}
		} catch {
			continue;
		}
	}

	return [];
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
	const genres = parseJsonLdGenres(html);
	if (genres.length > 0) {
		return genres[0];
	}

	const categories = Array.from(
		html.querySelectorAll(
			'#infoset_goodsCate .infoSetCont_wrap dl:nth-child(1) dd ul li a',
		),
	)
		.map((category) => category.textContent?.replace(/\s+/g, '').trim() ?? '')
		.filter(Boolean);

	return categories.at(0);
};

const parseCategoryPath = (html: Document): string[] | undefined => {
	const genres = parseJsonLdGenres(html);
	return genres.length > 0 ? genres : undefined;
};

const parseProductTypeFromDetail = (
	html: Document,
	fallback: string | undefined,
): string | undefined => {
	return textOf(html, '#ulCategoryList .cateOn .txt') || fallback;
};

const enrichSearchResults = async (
	results: BookSearchResult[],
): Promise<BookSearchResult[]> => {
	return Promise.all(
		results.slice(0, 10).map(async (result) => {
			try {
				return await yes24Provider.getDetails(result);
			} catch {
				return result;
			}
		}),
	);
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
			return enrichSearchResults(results);
		}

		return enrichSearchResults(await parseBulletSearch(query));
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
			titleHtml: result.titleHtml,
			subtitle: subtitle || result.subtitle,
			authors: parseAuthors(html).length > 0 ? parseAuthors(html) : result.authors,
			publisher: textOf(html, '#yDetailTopWrap .gd_infoTop .gd_pub') || result.publisher,
			publishedDate:
				parseDate(textOf(html, '#yDetailTopWrap .gd_infoTop .gd_date')) ||
				result.publishedDate,
			productType: parseProductTypeFromDetail(html, result.productType),
			category: parseCategory(html) ?? result.category,
			categoryPath: parseCategoryPath(html) ?? result.categoryPath,
			isbn: parseIsbn(html) ?? result.isbn,
			thumbnailUrl: thumbnailUrl ? absoluteUrl(thumbnailUrl) : undefined,
			pageCount: parsePageCount(html),
			description: parseDescription(html),
			url: result.url,
		};
	},
};
