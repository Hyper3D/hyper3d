module Hyper.Utils
{
	export interface IDisposable
	{
		dispose(): void;
	}

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
				} while (node != this.first);
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
	
	export class IdWeakMap<K extends EventDispatcherWithId, T>
	{
		private map: IntegerMap<IdWeakMapItem<K, T>>;
		private disposeHandler: () => void;
		
		constructor()
		{
			this.map = new IntegerMap<IdWeakMapItem<K, T>>();
		}
		
		get isEmpty(): boolean
		{
			return this.map.isEmpty;
		}
		
		disposeValue(value: T): void
		{
		}
		
		get(key: K): T
		{
			const item = this.map.get(key.id);
			if (item) {
				if (item.key != key) {
					throw new Error();
				}
				return item.value;
			} else {
				return null;
			}
		}
		
		set(key: K, value: T): T
		{
			const item = this.map.get(key.id);
			if (item) {
				if (item.key != key) {
					throw new Error();
				}
				item.value = value;
			} else {
				const id = key.id;
				const handler = () => this.onItemDisposed(id);
				key.addEventListener('disposed', handler);
				this.map.set(key.id, {
					key, value,
					handler: handler
				});
			}
			
			return value;
		}
		
		remove(key: K): boolean
		{
			const item = this.map.get(key.id);
			if (item == null) {
				return false;
			}
			if (item.key != key) {
				throw new Error();
			}
			this.map.remove(key.id);
			item.key.removeEventListener('disposed', item.handler);
			this.disposeValue(item.value);
			return true;
		}
		
		dispose(): void
		{
			this.map.forEach((id, item) => {
				item.key.removeEventListener('disposed', item.handler);
				this.disposeValue(item.value);
				this.map.remove(id);
			});
		}
		
		onItemDisposed(id: number): void
		{
			const item = this.map.get(id);
			this.map.remove(id);
			item.key.removeEventListener('disposed', item.handler);
			this.disposeValue(item.value);
		}
	}
	
	interface IdWeakMapItem<K extends EventDispatcherWithId, T>
	{
		key: K;
		value: T;
		handler: () => void;
	}
	
	export interface EventDispatcherWithId extends THREE.EventDispatcher
	{
		id: number;
	}
	
	export class IdWeakMapWithDisposable<K extends EventDispatcherWithId, T extends IDisposable> extends IdWeakMap<K, T>
	{
		disposeValue(value: T): void
		{
			value.dispose();
		}
	}
	
	export class BitArray
	{
		private map: Int32Array; // each element is 16-bit; upper half is zero except during an operation
		private range: number;
		
		constructor()
		{
			this.map = new Int32Array([0]);
			this.range = 0;
		}
		
		private reserve(count: number): void
		{
			const map = this.map;
			if ((map.length << 4) < count) {
				this.map = new Int32Array((count + 3) >> 4);
				this.map.set(map);
			}
		}
		
		private setRange(newRange: number): void
		{
			this.reserve(newRange << 4);
			
			const range = this.range;
			const map = this.map;
			
			this.range = newRange;
			
			if (newRange > range) {
				for (let i = range; i < newRange; ++i) {
					map[i] = 0;
				}
			} else if (newRange < range) {
				for (let i = newRange; i < range; ++i) {
					let mapentry = map[i];
					for (let j = 0; j < 16; j += 4) {
						let submap = (mapentry >> j) & 0xf;
						if (submap) {
							for (let k = 0; k < 4; ++k) {
								if (submap & (1 << k)) {
									this.onToggledFalse(j + k + (i << 4));
								}
							}
						}
					}
				}
			}
		}
		
		onToggledTrue(index: number): void { }
		onToggledFalse(index: number): void { }
		
		toggleOne(index: number, enable: boolean): void
		{
			this.reserve(index + 1);
			
			const map = this.map;
			const mapMask = 1 << (index & 15);
			const mapIndex = index >> 4;
			if (enable) {
				if (mapIndex >= this.range) {
					for (let i = mapIndex - 1; i >= this.range; --i) {
						map[i] = 0;
					}
					this.range = mapIndex + 1;
					map[mapIndex] = mapMask;
					this.onToggledTrue(index);
				} else if ((map[mapIndex] & mapMask) == 0) {
					map[mapIndex] |= mapMask;
					this.onToggledTrue(index);
				}
			} else {
				if (mapIndex >= this.range) {
					return;
				}
				if (map[mapIndex] & mapMask) {
					map[mapIndex] &= ~mapMask;
					this.onToggledFalse(index);
				}
			}
		}
		
		toggleAllWithTrueIndex(...numbers: number[]): void
		{
			if (numbers.length == 0) {
				this.setRange(0);
				return;	
			}
			
			const maxIndex = Math.max.apply(Math, numbers);
			const range = (maxIndex + 16) >> 4;
			this.reserve(maxIndex + 1);
			this.setRange(range);
			
			const map = this.map;
			for (const num of numbers) {
				map[num >> 4] |= 0x10000 << (num & 15);
			}
			
			for (let i = 0; i < range; ++i) {
				let mapentry = map[i];
				let old = mapentry & 0xffff;
				let nw = mapentry >>> 16;
				let diff = old ^ nw;
				map[i] = nw; // always update so that upper 16-bit is cleared
				if (!diff) {
					continue;
				}
				
				for (let j = 0; j < 16; j += 4) {
					let subdiff = (diff >> j) & 0xf;
					if (!subdiff) {
						continue;
					}
					for (let k = 0; k < 4; ++k) {
						if (subdiff & (1 << k)) {
							if (nw & (1 << (j + k))) {
								this.onToggledTrue(j + k + (i << 4));
							} else {
								this.onToggledFalse(j + k + (i << 4));
							}
						}
					}
				}
			}
			
		}
		
		toggleAllWithArray(src: BitArray): void
		{
			const srcRange = src.range;
			
			this.reserve(srcRange << 4);
			this.setRange(srcRange);
			
			const srcMap = src.map;
			const map = this.map;
			
			for (let i = 0; i < srcRange; ++i) {
				let old = map[i];
				let nw = srcMap[i];
				let diff = old ^ nw;
				if (!diff) {
					continue;
				}
				map[i] = nw;
				
				for (let j = 0; j < 16; j += 4) {
					let subdiff = (diff >> j) & 0xf;
					if (!subdiff) {
						continue;
					}
					for (let k = 0; k < 4; ++k) {
						if (subdiff & (1 << k)) {
							if (nw & (1 << (j + k))) {
								this.onToggledTrue(j + k + (i << 4));
							} else {
								this.onToggledFalse(j + k + (i << 4));
							}
						}
					}
				}
			}
		}
	}
}
