// Registry of available Style Grammars. Add a JSON file and list it here.
import type { StyleGrammar } from '../engine/types';
import swiss from './swiss-lecture.json';
import industrial from './neo-industrial.json';

export const GRAMMARS: StyleGrammar[] = [swiss as unknown as StyleGrammar, industrial as unknown as StyleGrammar];

export const grammarById = (id: string | null): StyleGrammar => GRAMMARS.find((g) => g.id === id) ?? GRAMMARS[0];
