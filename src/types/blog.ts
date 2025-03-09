export interface BlogPost {
  title: string;
  description: string;
  publishDate: Date;
  draft?: boolean;
  tags?: string[];
}
