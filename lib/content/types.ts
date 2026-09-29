export type Site = {
  id: string;
  name: string;
  description: string;
  language: string;
  base_url: string;
  base_path: string;
};

export type Topic = {
  id: string;
  title: string;
  description: string;
  status?: string;
};

export type Category = {
  id: string;
  title: string;
};

export type ArticleReview = {
  last_reviewed?: string;
  [key: string]: unknown;
};

export type PathMembership = {
  path_id: string;
  module_id: string;
};

export type Article = {
  schema_version: number;
  id: string;
  title: string;
  description: string;
  type: string;
  domain: string;
  category?: string;
  tags: string[];
  difficulty: string;
  learning_paths: PathMembership[];
  prerequisites: string[];
  related: string[];
  labs: string[];
  authors?: string[];
  status: string;
  url: string;
  legacy_urls: string[];
  review?: ArticleReview;
  created_at?: string;
  updated_at?: string;
  metadata_file: string;
  source: string;
  bodyHtml: string;
  bodyText: string;
  headings: ArticleHeading[];
  bodyIds: Set<string>;
};

export type ArticleHeading = {
  level: 2 | 3;
  id: string;
  title: string;
};

export type PathModule = {
  id: string;
  title: string;
  order: number;
  domain: string;
  category: string;
  group?: string;
  article_ids: string[];
  legacy_index_urls?: string[];
  articles: Article[];
};

export type LearningPath = {
  id: string;
  title: string;
  description: string;
  status?: string;
  modules: PathModule[];
};

export type Catalog = {
  site: Site;
  topics: Topic[];
  categories: Category[];
  paths: LearningPath[];
  articles: Article[];
  topicById: Map<string, Topic>;
  categoryById: Map<string, Category>;
  pathById: Map<string, LearningPath>;
  articleById: Map<string, Article>;
  articleByUrl: Map<string, Article>;
};

export type LegacyRedirect = {
  source: string;
  destination: string;
  kind: 'article' | 'path-module';
};
