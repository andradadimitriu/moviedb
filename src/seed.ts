import { es, ensureIndex, INDEX } from './es';
import { backfillTitleVectors, existsEach, NewMovie } from './movies';

type Seed = [title: string, year: number, author: string, actors: string[], genre: string[], description: string, seen?: boolean];

const seeds: Seed[] = [
  ['The Matrix', 1999, 'The Wachowskis', ['Keanu Reeves', 'Laurence Fishburne', 'Carrie-Anne Moss'], ['sci-fi', 'action'], 'A hacker learns that the world he lives in is a simulation and joins the rebellion against its machine overlords.', true],
  ['Inception', 2010, 'Christopher Nolan', ['Leonardo DiCaprio', 'Joseph Gordon-Levitt', 'Elliot Page', 'Tom Hardy'], ['sci-fi', 'thriller'], 'A thief who steals secrets from dreams is hired to plant an idea in a target\'s mind instead.', true],
  ['The Revenant', 2015, 'Alejandro G. Iñárritu', ['Leonardo DiCaprio', 'Tom Hardy'], ['drama', 'adventure'], 'A frontiersman left for dead after a bear attack fights his way back through the wilderness.'],
  ['Arrival', 2016, 'Denis Villeneuve', ['Amy Adams', 'Jeremy Renner', 'Forest Whitaker'], ['sci-fi', 'drama'], 'A linguist races to understand the language of alien visitors before tensions between nations boil over.'],
  ['Heat', 1995, 'Michael Mann', ['Al Pacino', 'Robert De Niro', 'Val Kilmer'], ['crime', 'thriller'], 'A relentless LA detective and a disciplined professional thief circle each other across the city.', true],
  ['The Godfather', 1972, 'Francis Ford Coppola', ['Marlon Brando', 'Al Pacino', 'James Caan'], ['crime', 'drama'], 'The aging head of a mafia family hands power to his reluctant youngest son.', true],
  ['Pulp Fiction', 1994, 'Quentin Tarantino', ['John Travolta', 'Uma Thurman', 'Samuel L. Jackson', 'Bruce Willis'], ['crime'], 'Interlocking stories of hitmen, a boxer and a gangster\'s wife in Los Angeles.', true],
  ['The Shawshank Redemption', 1994, 'Frank Darabont', ['Tim Robbins', 'Morgan Freeman'], ['drama'], 'A banker serving a life sentence forms a lasting friendship and quietly plans for freedom.'],
  ['Parasite', 2019, 'Bong Joon Ho', ['Song Kang-ho', 'Lee Sun-kyun', 'Cho Yeo-jeong'], ['thriller', 'drama', 'comedy'], 'A poor family schemes its way into the household of a wealthy one, with unexpected consequences.'],
  ['Spirited Away', 2001, 'Hayao Miyazaki', ['Rumi Hiiragi', 'Miyu Irino'], ['animation', 'fantasy'], 'A girl trapped in a spirit world works at a bathhouse to free herself and her parents.'],
  ['The Dark Knight', 2008, 'Christopher Nolan', ['Christian Bale', 'Heath Ledger', 'Aaron Eckhart'], ['action', 'crime'], 'Batman faces the Joker, a criminal mastermind who wants to watch Gotham descend into chaos.', true],
  ['Interstellar', 2014, 'Christopher Nolan', ['Matthew McConaughey', 'Anne Hathaway', 'Jessica Chastain'], ['sci-fi', 'drama'], 'Astronauts travel through a wormhole in search of a new home for a dying Earth.'],
  ['Blade Runner 2049', 2017, 'Denis Villeneuve', ['Ryan Gosling', 'Harrison Ford', 'Ana de Armas'], ['sci-fi'], 'A replicant blade runner uncovers a secret that could upend what is left of society.'],
  ['La La Land', 2016, 'Damien Chazelle', ['Ryan Gosling', 'Emma Stone'], ['musical', 'romance'], 'A jazz pianist and an aspiring actress fall in love while chasing their dreams in Los Angeles.'],
  ['Whiplash', 2014, 'Damien Chazelle', ['Miles Teller', 'J.K. Simmons'], ['drama', 'music'], 'A young drummer is pushed to his limits by a ruthless music conservatory instructor.'],
  ['The Wolf of Wall Street', 2013, 'Martin Scorsese', ['Leonardo DiCaprio', 'Jonah Hill', 'Margot Robbie'], ['comedy', 'crime', 'biography'], 'The rise and fall of a stockbroker whose firm is built on fraud and excess.'],
  ['Goodfellas', 1990, 'Martin Scorsese', ['Ray Liotta', 'Robert De Niro', 'Joe Pesci'], ['crime', 'drama'], 'Decades in the life of a mob associate, from street hustler to informant.'],
  ['Taxi Driver', 1976, 'Martin Scorsese', ['Robert De Niro', 'Jodie Foster'], ['crime', 'drama'], 'A lonely, unstable cab driver in New York drifts toward violence.'],
  ['Mad Max: Fury Road', 2015, 'George Miller', ['Tom Hardy', 'Charlize Theron', 'Nicholas Hoult'], ['action', 'adventure'], 'In a desert wasteland, a rebel warrior and a drifter flee a tyrant across a deadly road.'],
  ['Get Out', 2017, 'Jordan Peele', ['Daniel Kaluuya', 'Allison Williams'], ['horror', 'thriller'], 'A young man\'s visit to his girlfriend\'s family estate turns increasingly sinister.'],
  ['The Grand Budapest Hotel', 2014, 'Wes Anderson', ['Ralph Fiennes', 'Tony Revolori', 'Saoirse Ronan'], ['comedy'], 'A legendary concierge and his lobby boy are caught up in the theft of a priceless painting.'],
  ['Amélie', 2001, 'Jean-Pierre Jeunet', ['Audrey Tautou', 'Mathieu Kassovitz'], ['romance', 'comedy'], 'A shy Parisian waitress secretly sets out to improve the lives of the people around her.'],
  ['Alien', 1979, 'Ridley Scott', ['Sigourney Weaver', 'Tom Skerritt', 'John Hurt'], ['sci-fi', 'horror'], 'The crew of a commercial spaceship is hunted by a deadly creature they brought aboard.'],
  ['Gladiator', 2000, 'Ridley Scott', ['Russell Crowe', 'Joaquin Phoenix', 'Connie Nielsen'], ['action', 'drama'], 'A betrayed Roman general fights as a gladiator to avenge his family.', true],
  ['Her', 2013, 'Spike Jonze', ['Joaquin Phoenix', 'Scarlett Johansson', 'Amy Adams'], ['romance', 'sci-fi', 'drama'], 'A lonely writer falls in love with an artificially intelligent operating system.'],
  ['Joker', 2019, 'Todd Phillips', ['Joaquin Phoenix', 'Robert De Niro', 'Zazie Beetz'], ['crime', 'drama', 'thriller'], 'A failed comedian\'s descent into madness sparks unrest in Gotham City.'],
  ['Toy Story', 1995, 'John Lasseter', ['Tom Hanks', 'Tim Allen'], ['animation', 'comedy'], 'A cowboy doll feels threatened when a flashy space ranger toy becomes the new favourite.', true],
  ['Forrest Gump', 1994, 'Robert Zemeckis', ['Tom Hanks', 'Robin Wright', 'Gary Sinise'], ['drama', 'romance'], 'A kind-hearted man unwittingly witnesses and shapes decades of American history.'],
  ['Catch Me If You Can', 2002, 'Steven Spielberg', ['Leonardo DiCaprio', 'Tom Hanks', 'Christopher Walken'], ['crime', 'biography'], 'A young con artist forges millions in cheques while an FBI agent pursues him.'],
  ['Everything Everywhere All at Once', 2022, 'Daniel Kwan, Daniel Scheinert', ['Michelle Yeoh', 'Ke Huy Quan', 'Jamie Lee Curtis'], ['sci-fi', 'comedy', 'action'], 'A laundromat owner must connect with parallel versions of herself to save the multiverse.'],
  ['Oppenheimer', 2023, 'Christopher Nolan', ['Cillian Murphy', 'Emily Blunt', 'Robert Downey Jr.', 'Matt Damon'], ['drama', 'biography', 'history'], 'The story of the physicist who led the development of the atomic bomb.'],
  ['Dune: Part Two', 2024, 'Denis Villeneuve', ['Timothée Chalamet', 'Zendaya', 'Rebecca Ferguson'], ['sci-fi', 'adventure'], 'Paul Atreides unites with the Fremen to seek revenge on those who destroyed his family.'],
];

async function main() {
  await ensureIndex();

  // A seed counts as present when a movie with the same title + year + author exists (ignoring case and accents).
  const exists = await existsEach(seeds.map(([title, year, author]) => ({ title, year, author })));

  const created_at = new Date().toISOString();
  const docs = seeds
    .filter((_, i) => !exists[i])
    .map(([title, year, author, main_actors, genre, description, seen]) => ({
      ...NewMovie.parse({ title, year, author, main_actors, genre, description, is_seen: seen ?? false }),
      created_at,
    }));

  if (docs.length === 0) {
    console.log(`All ${seeds.length} seed movies already exist in "${INDEX}".`);
    return;
  }

  const res = await es.bulk({
    index: INDEX,
    refresh: 'wait_for',
    operations: docs.flatMap((doc) => [{ index: {} }, doc]),
  });
  if (res.errors) throw new Error('Some movies failed to index: ' + JSON.stringify(res.items.filter((i) => i.index?.error)));

  console.log(`Added ${docs.length} movies to "${INDEX}" (${seeds.length - docs.length} already existed).`);
  console.log(`Added title vectors to ${await backfillTitleVectors()} movies.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
