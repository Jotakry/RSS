export interface Feed {
  id: string;
  url: string;
  title: string;
  icon?: string;
}

export interface Article {
  id: string;
  feedId: string;
  title: string;
  link: string;
  pubDate: string;
  content: string; // Plain text snippet or full content depending on RSS
  contentSnippet: string;
  author?: string;
  thumbnail?: string;
}

export interface FeedState {
  feeds: Feed[];
  articles: Article[];
  isLoading: boolean;
  error: string | null;
}

export interface FilterState {
  keywords: string;
}