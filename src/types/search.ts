export type KeywordSearchBookChunk = {
  id: string;
  book_id: string;
  book_version_id: string;
  content: string;
  chapters: number[]; // chapter indices
  index: number; // page index
  page: number;
  volume?: string | null;
};

export type VectorSearchBookChunk = {
  id: string;
  book_id: string;
  book_version_id: string;
  prev_id?: string | null;
  next_id?: string | null;
  chunk_content: string;
  chunk_embedding: number[];
  chapters: number[]; // chapter indices
  pages: {
    index: number;
    page: number;
    volume?: string | null;
  }[];
};
