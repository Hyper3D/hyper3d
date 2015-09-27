module Hyper.Renderer
{
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