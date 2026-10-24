import { describe, it, expect, beforeEach } from 'vitest';
import { ThinkTagSplitter } from '../../Helpers/ThinkTagSplitter';

describe('ThinkTagSplitter', () => {
    let splitter: ThinkTagSplitter;

    beforeEach(() => {
        splitter = new ThinkTagSplitter();
    });

    const splitAll = (chunks: string[]) => {
        const splits = [...chunks.map(chunk => splitter.split(chunk)), splitter.flush()];
        return {
            content: splits.map(split => split.content).join(''),
            thought: splits.map(split => split.thought).join('')
        };
    };

    it('should pass through text without tags', () => {
        expect(splitter.split('Plain answer')).toEqual({ content: 'Plain answer', thought: '' });
    });

    it('should separate a think block in a single chunk', () => {
        expect(splitter.split('<think>Reasoning</think>Answer')).toEqual({ content: 'Answer', thought: 'Reasoning' });
    });

    it('should handle tags split at every position across chunks', () => {
        const text = '<think>Reasoning</think>Answer';
        for (let index = 1; index < text.length; index++) {
            splitter.reset();
            expect(splitAll([text.slice(0, index), text.slice(index)])).toEqual({ content: 'Answer', thought: 'Reasoning' });
        }
    });

    it('should hold back a possible partial tag until it is ruled out', () => {
        expect(splitter.split('a <')).toEqual({ content: 'a ', thought: '' });
        expect(splitter.split('b')).toEqual({ content: '<b', thought: '' });
    });

    it('should flush held back text into the side it belongs to', () => {
        splitter.split('<think>Unfinished </th');
        expect(splitter.flush()).toEqual({ content: '', thought: '</th' });
    });

    it('should keep text outside tags that is not a tag prefix', () => {
        expect(splitAll(['1 < 2 and <b>bold</b>'])).toEqual({ content: '1 < 2 and <b>bold</b>', thought: '' });
    });

    it('should forget an open think block after reset', () => {
        splitter.split('<think>Unfinished');
        splitter.reset();
        expect(splitter.split('Answer')).toEqual({ content: 'Answer', thought: '' });
    });
});
