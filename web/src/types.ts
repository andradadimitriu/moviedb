export type Movie = {
  id: string;
  title: string;
  author: string;
  year?: number;
  description: string;
  main_actors: string[];
  genre: string[];
  is_seen: boolean;
  created_at: string;
};

export type NewMovie = {
  title: string;
  author: string;
  year?: number;
  description: string;
  main_actors: string;
  genre: string;
  is_seen: boolean;
};

export type Filters = {
  q: string;
  genre: string;
  actor: string;
  year_from: string;
  year_to: string;
  unseenOnly: boolean;
};
