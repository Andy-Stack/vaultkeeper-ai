import { describe, it, expect } from 'vitest';
import { IndexSet } from '../../Types/IndexSet';

describe('IndexSet', () => {
	describe('initial state', () => {
		it('should start empty', () => {
			const set = new IndexSet<string, number>();

			expect(set.count).toBe(0);
			expect(set.allElements).toEqual([]);
		});

		it('should return undefined for get/getAt and false for contains on an empty set', () => {
			const set = new IndexSet<string, number>();

			expect(set.get('missing')).toBeUndefined();
			expect(set.getAt(0)).toBeUndefined();
			expect(set.contains('missing')).toBe(false);
		});
	});

	describe('set', () => {
		it('should add a new key/value pair and increase count', () => {
			const set = new IndexSet<string, number>();

			set.set('a', 1);

			expect(set.count).toBe(1);
			expect(set.get('a')).toBe(1);
			expect(set.contains('a')).toBe(true);
		});

		it('should append subsequent entries in insertion order', () => {
			const set = new IndexSet<string, number>();

			set.set('a', 1);
			set.set('b', 2);
			set.set('c', 3);

			expect(set.allElements).toEqual([1, 2, 3]);
			expect(set.getAt(0)).toBe(1);
			expect(set.getAt(1)).toBe(2);
			expect(set.getAt(2)).toBe(3);
		});

		it('should overwrite the value for an existing key without changing count or position', () => {
			const set = new IndexSet<string, number>();

			set.set('a', 1);
			set.set('b', 2);
			set.set('a', 100);

			expect(set.count).toBe(2);
			expect(set.get('a')).toBe(100);
			expect(set.allElements).toEqual([100, 2]);
		});
	});

	describe('get / getAt / contains', () => {
		it('should return the stored value for a known key', () => {
			const set = new IndexSet<string, string>();
			set.set('key', 'value');

			expect(set.get('key')).toBe('value');
		});

		it('should return undefined for an unknown key', () => {
			const set = new IndexSet<string, string>();
			set.set('key', 'value');

			expect(set.get('other')).toBeUndefined();
		});

		it('should return the element at a given positional index', () => {
			const set = new IndexSet<string, string>();
			set.set('a', 'x');
			set.set('b', 'y');

			expect(set.getAt(1)).toBe('y');
		});

		it('should return undefined for an out-of-range index', () => {
			const set = new IndexSet<string, string>();
			set.set('a', 'x');

			expect(set.getAt(5)).toBeUndefined();
			expect(set.getAt(-1)).toBeUndefined();
		});

		it('should reflect true/false correctly via contains', () => {
			const set = new IndexSet<string, string>();
			set.set('a', 'x');

			expect(set.contains('a')).toBe(true);
			expect(set.contains('b')).toBe(false);
		});
	});

	describe('delete', () => {
		it('should remove the only element and reset count to zero', () => {
			const set = new IndexSet<string, number>();
			set.set('a', 1);

			set.delete('a');

			expect(set.count).toBe(0);
			expect(set.contains('a')).toBe(false);
			expect(set.get('a')).toBeUndefined();
			expect(set.allElements).toEqual([]);
		});

		it('should be a no-op when deleting a key that does not exist', () => {
			const set = new IndexSet<string, number>();
			set.set('a', 1);

			set.delete('missing');

			expect(set.count).toBe(1);
			expect(set.get('a')).toBe(1);
		});

		it('should delete the last element without disturbing earlier elements', () => {
			const set = new IndexSet<string, number>();
			set.set('a', 1);
			set.set('b', 2);
			set.set('c', 3);

			set.delete('c');

			expect(set.count).toBe(2);
			expect(set.allElements).toEqual([1, 2]);
			expect(set.get('a')).toBe(1);
			expect(set.get('b')).toBe(2);
		});

		it('should swap the last element into the removed slot when deleting from the middle', () => {
			const set = new IndexSet<string, number>();
			set.set('a', 1);
			set.set('b', 2);
			set.set('c', 3);

			set.delete('a');

			// 'c' (the last element) should have been swapped into index 0
			expect(set.count).toBe(2);
			expect(set.allElements).toEqual([3, 2]);
			expect(set.get('c')).toBe(3);
			expect(set.get('b')).toBe(2);
			expect(set.contains('a')).toBe(false);
			expect(set.getAt(0)).toBe(3);
			expect(set.getAt(1)).toBe(2);
		});

		it('should keep the swapped key retrievable and correctly indexed after a middle delete', () => {
			const set = new IndexSet<string, number>();
			set.set('a', 1);
			set.set('b', 2);
			set.set('c', 3);
			set.set('d', 4);

			set.delete('b');

			// 'd' swapped into b's old slot (index 1)
			expect(set.allElements).toEqual([1, 4, 3]);
			expect(set.get('d')).toBe(4);
			expect(set.getAt(1)).toBe(4);

			// Deleting the swapped key afterwards should work correctly too
			set.delete('d');
			expect(set.allElements).toEqual([1, 3]);
			expect(set.get('a')).toBe(1);
			expect(set.get('c')).toBe(3);
		});

		it('should allow re-adding a key after it has been deleted', () => {
			const set = new IndexSet<string, number>();
			set.set('a', 1);
			set.delete('a');
			set.set('a', 99);

			expect(set.count).toBe(1);
			expect(set.get('a')).toBe(99);
		});

		it('should support deleting every element one by one down to empty', () => {
			const set = new IndexSet<string, number>();
			set.set('a', 1);
			set.set('b', 2);
			set.set('c', 3);

			set.delete('a');
			set.delete('b');
			set.delete('c');

			expect(set.count).toBe(0);
			expect(set.allElements).toEqual([]);
		});
	});

	describe('rename', () => {
		it('should move an existing key to a new key while preserving its value and position', () => {
			const set = new IndexSet<string, number>();
			set.set('a', 1);
			set.set('b', 2);

			set.rename('a', 'z');

			expect(set.contains('a')).toBe(false);
			expect(set.contains('z')).toBe(true);
			expect(set.get('z')).toBe(1);
			expect(set.allElements).toEqual([1, 2]);
			expect(set.getAt(0)).toBe(1);
		});

		it('should be a no-op when the old key does not exist', () => {
			const set = new IndexSet<string, number>();
			set.set('a', 1);

			set.rename('missing', 'z');

			expect(set.count).toBe(1);
			expect(set.contains('z')).toBe(false);
			expect(set.contains('a')).toBe(true);
		});

		it('should be a no-op when old and new keys are the same', () => {
			const set = new IndexSet<string, number>();
			set.set('a', 1);

			set.rename('a', 'a');

			expect(set.get('a')).toBe(1);
			expect(set.count).toBe(1);
		});

		it('should be a no-op when the new key already exists', () => {
			const set = new IndexSet<string, number>();
			set.set('a', 1);
			set.set('b', 2);

			set.rename('a', 'b');

			expect(set.get('a')).toBe(1);
			expect(set.get('b')).toBe(2);
			expect(set.count).toBe(2);
		});

		it('should allow deleting an element by its new key after rename', () => {
			const set = new IndexSet<string, number>();
			set.set('a', 1);
			set.set('b', 2);

			set.rename('a', 'z');
			set.delete('z');

			expect(set.count).toBe(1);
			expect(set.contains('z')).toBe(false);
			expect(set.get('b')).toBe(2);
		});

		it('should allow setting a new value on an element by its new key after rename', () => {
			const set = new IndexSet<string, number>();
			set.set('a', 1);

			set.rename('a', 'z');
			set.set('z', 42);

			expect(set.count).toBe(1);
			expect(set.get('z')).toBe(42);
		});
	});

	describe('clear', () => {
		it('should remove all elements and reset count to zero', () => {
			const set = new IndexSet<string, number>();
			set.set('a', 1);
			set.set('b', 2);

			set.clear();

			expect(set.count).toBe(0);
			expect(set.allElements).toEqual([]);
			expect(set.contains('a')).toBe(false);
			expect(set.get('a')).toBeUndefined();
			expect(set.getAt(0)).toBeUndefined();
		});

		it('should allow adding new elements after clearing', () => {
			const set = new IndexSet<string, number>();
			set.set('a', 1);
			set.clear();
			set.set('b', 2);

			expect(set.count).toBe(1);
			expect(set.get('b')).toBe(2);
			expect(set.contains('a')).toBe(false);
		});

		it('should be safe to call on an already-empty set', () => {
			const set = new IndexSet<string, number>();

			expect(() => set.clear()).not.toThrow();
			expect(set.count).toBe(0);
		});
	});

	describe('allElements', () => {
		it('should reflect live state after mutations', () => {
			const set = new IndexSet<string, number>();
			set.set('a', 1);
			set.set('b', 2);

			const snapshotBefore = set.allElements;
			expect(snapshotBefore).toEqual([1, 2]);

			set.set('c', 3);

			expect(set.allElements).toEqual([1, 2, 3]);
		});
	});

	describe('with non-primitive keys', () => {
		it('should support object identity as keys', () => {
			const set = new IndexSet<object, string>();
			const keyA = {};
			const keyB = {};

			set.set(keyA, 'first');
			set.set(keyB, 'second');

			expect(set.get(keyA)).toBe('first');
			expect(set.get(keyB)).toBe('second');
			expect(set.contains({})).toBe(false); // different object identity
		});
	});
});
