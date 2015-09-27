/// <reference path="../Prefix.d.ts" />
/// <reference path="TextureManager.ts" />
/// <reference path="../core/RenderBufferManager.ts" />
/// <reference path="../core/RendererCore.ts" />
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
					const bg = makeBufferGeometryFromGeometry(source);
					g = this.get(bg); // TODO: dispose doesn't work
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
	
	function makeBufferGeometryFromGeometry(geo: THREE.Geometry): THREE.BufferGeometry
	{
		const bg = new THREE.BufferGeometry();
		geo.addEventListener('disposed', () =>{
			bg.dispose();
		});
		bg.fromGeometry(geo);
		
		// some attributes are not added with fromGeometry
		const faces = geo.faces;
		if (geo.skinWeights && !bg.getAttribute('skinWeights') &&
			geo.skinWeights.length > 0) {
			const buf: THREE.Vector4[] = <any> geo.skinWeights;
			const arr = new Float32Array(faces.length * 12);
			for (let i = 0; i < faces.length; ++i) {
				const face = faces[i];
				let idx = face.a;
				arr[i * 12] =     buf[idx].x;
				arr[i * 12 + 1] = buf[idx].y;
				arr[i * 12 + 2] = buf[idx].z;
				arr[i * 12 + 3] = buf[idx].w;
				idx = face.b;
				arr[i * 12 + 4] = buf[idx].x;
				arr[i * 12 + 5] = buf[idx].y;
				arr[i * 12 + 6] = buf[idx].z;
				arr[i * 12 + 7] = buf[idx].w;
				idx = face.c;
				arr[i * 12 + 8] = buf[idx].x;
				arr[i * 12 + 9] = buf[idx].y;
				arr[i * 12 + 10] = buf[idx].z;
				arr[i * 12 + 11] = buf[idx].w;
			}
			const attr = new THREE.BufferAttribute(arr, 4);
			bg.addAttribute('skinWeights', attr);
		}
		if (geo.skinIndices && !bg.getAttribute('skinIndices') &&
			geo.skinIndices.length > 0) {
			const buf: THREE.Vector4[] = <any> geo.skinIndices;
			const arr = new Float32Array(faces.length * 12);
			for (let i = 0; i < faces.length; ++i) {
				const face = faces[i];
				let idx = face.a;
				arr[i * 12] =     buf[idx].x;
				arr[i * 12 + 1] = buf[idx].y;
				arr[i * 12 + 2] = buf[idx].z;
				arr[i * 12 + 3] = buf[idx].w;
				idx = face.b;
				arr[i * 12 + 4] = buf[idx].x;
				arr[i * 12 + 5] = buf[idx].y;
				arr[i * 12 + 6] = buf[idx].z;
				arr[i * 12 + 7] = buf[idx].w;
				idx = face.c;
				arr[i * 12 + 8] = buf[idx].x;
				arr[i * 12 + 9] = buf[idx].y;
				arr[i * 12 + 10] = buf[idx].z;
				arr[i * 12 + 11] = buf[idx].w;
			}
			const attr = new THREE.BufferAttribute(arr, 4);
			bg.addAttribute('skinIndices', attr);
		}
		
		return bg;
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