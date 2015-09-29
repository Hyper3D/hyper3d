/// <reference path="../Prefix.d.ts" />

module Hyper.Renderer
{
	

	export class IntegerMap<T>
	{
		private table: IntergerMapNode<T>[];
		private first: IntergerMapNode<T>;
		
		constructor()
		{
			this.table = [];
			this.first = null;
		}
		
		get isEmpty(): boolean
		{
			return this.first == null;
		}
		
		get(key: number, defaultValue?: T): T
		{
			const node = this.table[key];
			if (node) {
				return node.value;
			}
			return defaultValue;
		}
		
		set(key: number, value: T): T
		{
			let node = this.table[key];
			if (node) {
				node.value = value;
			} else {
				node = {
					key, value,
					prev: null,
					next: null	
				};
				if (this.first) {
					node.next = this.first;
					node.prev = this.first.prev;
					node.next.prev = node;
					node.prev.next = node;
				} else {
					this.first = node.prev = node.next = node;
				}
				this.table[key] = node;
			}
			return value;
		}	
		
		remove(key: number): boolean
		{
			const node = this.table[key];
			if (node) {
				delete this.table[key];
				if (this.first == node) {
					if (node.next == node) {
						this.first = null;
					} else {
						this.first = node.next;
					}
				}
				if (node.next != node) {
					node.next.prev = node.prev;
					node.prev.next = node.next;
				}
				return true;
			}
			return false;
		}
		
		forEach(cb: (key: number, value: T) => void): void
		{
			if (this.first) {
				let node = this.first;
				do {
					const next = node.next;
					cb(node.key, node.value);
					node = next;
				} while (node != this.first && this.first);
			}
		}
	}
	
	interface IntergerMapNode<T>
	{
		key: number;
		value: T;
		prev: IntergerMapNode<T>;
		next: IntergerMapNode<T>;
	}
	
}
