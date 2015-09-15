/// <reference path="Prefix.d.ts" />
/// <reference path="TextureManager.ts" />
/// <reference path="RenderBufferManager.ts" />
/// <reference path="RendererCore.ts" />
module Hyper.Renderer
{
	interface GeometryTable
	{
		[id: string]: Geometry;	
	}
	
	export class GeometryManager
	{
		private table: GeometryTable;
		
		constructor(public renderer: RendererCore)
		{
			this.table = {};
		}
		
		dispose(): void
		{
			// TODO
		}
		
		get(source: any): Geometry
		{
			if (source instanceof THREE.BufferGeometry) {
				let g = this.table[source.id];
				if (!g) {
					g = new Geometry(this, source);
					this.table[source.id] = g;
				}
				return g;
			} else if (source instanceof THREE.Geometry) {
				let g = this.table[source.id];
				if (!g) {
					// TODO: support THREE.Geometry
					const bg = new THREE.BufferGeometry();
					bg.fromGeometry(source);
					g = this.get(bg); // TODO: super ugly hack (dispose doesn't work)
					this.table[source.id] = g;
				}
				return g;
			} else {
				throw new Error("please use BufferGeometry");
			}
		}
		
		flush(source: any): void
		{
			let g = this.table[source.id];
			if (g) {
				delete this.table[source.id];
				g.dispose();
			}
		}
	}
	
	export class Geometry extends THREE.EventDispatcher
	{
		private disposeHandler: () => void;
		attributes: GeometryAttribute[];
		indexAttribute: GeometryAttribute;
		numFaces: number;
		
		constructor(private manager: GeometryManager, public source: THREE.BufferGeometry)
		{
			super();
			
			source.addEventListener('dispose', this.disposeHandler = () => this.onDispose());
			
			const attrs = <any> source.attributes; // TS: three.d.ts wrong typing?
			const keys = source.attributesKeys;
			
			this.attributes = [];
			this.indexAttribute = null;
			this.numFaces = 0;
			
			for (const key of keys) {
				const attr: THREE.BufferAttribute = attrs[key];
				const gattr = new GeometryAttribute(manager.renderer, attr, key);
				this.attributes.push(gattr);
				
				if (gattr.isIndex) {
					this.indexAttribute = gattr;
					this.numFaces = attr.length / 3 | 0;
				}
			}
			
			if (this.indexAttribute == null) {
				this.numFaces = this.attributes[0].numElements / this.attributes[0].itemSize / 3 | 0;
			}
			
			this.update();
		}
		
		get id(): number
		{
			return this.source.id;
		}
		
		
		update(): void
		{
			for (const attr of this.attributes) {
				attr.update();
			}
		}
		
		onDispose(): void
		{
			this.manager.flush(this.source);
		}
		
		dispose(): void
		{
			for (const attr of this.attributes) {
				attr.dispose();
			}
			this.attributes = null;
			
			this.dispatchEvent({ type: 'disposed', target: this });
		}
	}
	
	export class GeometryAttribute
	{
		private buffer: WebGLBuffer;
		isIndex: boolean;
		isDynamic: boolean;
		
		constructor(private renderer: RendererCore, private source: THREE.BufferAttribute, public name: string)
		{
			this.buffer = null;
			
			this.isIndex = name == 'index';
			this.isDynamic = source instanceof THREE.DynamicBufferAttribute;
		}
		
		update(): void
		{
			const gl = this.renderer.gl;
			const type = this.isIndex ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER;
			
			if (!this.buffer) {
				this.buffer = gl.createBuffer();
				gl.bindBuffer(type, this.buffer);
				gl.bufferData(type, this.source.array,
					this.isDynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
			} else if (this.source.needsUpdate) {
				gl.bindBuffer(type, this.buffer);
				
				// TODO: sub-range update
				gl.bufferSubData(type, 0, this.source.array);
				
				this.source.needsUpdate = false;
			}
		}
		
		drawElements(): void
		{
			const gl = this.renderer.gl;
			const source = this.source;
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffer);
			gl.drawElements(gl.TRIANGLES, this.source.array.length, gl.UNSIGNED_SHORT, 0);
		}
		
		setupVertexAttrib(attribIndex: number): void
		{
			if (this.isIndex) {
				throw new Error();
			}
			
			const gl = this.renderer.gl;
			const source = this.source;
			gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
			gl.vertexAttribPointer(attribIndex, source.itemSize, gl.FLOAT, false, 0, 0);
		}
		
		get itemSize(): number
		{
			return this.source.itemSize;
		}
		
		get numElements(): number
		{
			return this.source.array.length;
		}
		
		dispose(): void
		{
			if (this.buffer) {
				this.renderer.gl.deleteBuffer(this.buffer);
				this.buffer = null;
			}
		}
	}
}