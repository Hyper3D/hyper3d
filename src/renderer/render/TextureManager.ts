/// <reference path="../Prefix.d.ts" />
/// <reference path="../core/RendererCore.ts" />
/// <reference path="../utils/Utils.ts" />
module Hyper.Renderer
{
	export class TextureManager
	{
		gl: WebGLRenderingContext;
		private map: Utils.IdWeakMapWithDisposable<THREE.Texture, Texture>;
		
		constructor(private core: RendererCore)
		{
			this.gl = core.gl;
			this.map = new Utils.IdWeakMapWithDisposable<THREE.Texture, Texture>();
		}
		
		dispose(): void
		{
			this.map.dispose();
		}
		
		get(tex: THREE.Texture): Texture
		{
			let t = this.map.get(tex);
			if (t == null) {
				if (tex instanceof THREE.CubeTexture) {
					t = new TextureCube(this, tex);
				} else {
					t = new Texture2D(this, tex);
				}
				this.map.set(tex, t);
			}
			return t;
		}
		
		flush(tex: THREE.Texture): void
		{
			this.map.remove(tex);
		}
		
		internalFormatForTexture(threeTex: THREE.Texture): number
		{
			switch (threeTex.format) {
				case THREE.RGBAFormat:
					return this.gl.RGBA;
				default:
					throw new Error(`unsupported format: ${threeTex.format}`);
			}	
		}
		formatForTexture(threeTex: THREE.Texture): number
		{
			switch (threeTex.format) {
				case THREE.RGBAFormat:
					return this.gl.RGBA;
				default:
					throw new Error(`unsupported format: ${threeTex.format}`);
			}	
		}
		typeForTexture(threeTex: THREE.Texture): number
		{
			switch (threeTex.type) {
				case THREE.UnsignedByteType:
					return this.gl.UNSIGNED_BYTE;
				default:
					throw new Error(`unsupported type: ${threeTex.type}`);
			}	
		}
	}	
	
	interface TextureMap
	{
		[id: number]: Texture;
	}
	
	class Texture
	{
		textureHandle: WebGLTexture;
		disposeHandler: () => void;
		
		constructor(public manager: TextureManager,
			public source: THREE.Texture,
			public textureTarget: number)
		{
			this.textureHandle = manager.gl.createTexture();
			
			source.addEventListener('dispose', this.disposeHandler = () => this.onDisposed());
		}
		
		setupCommon(): void
		{
			const gl = this.manager.gl;
			
			gl.texParameteri(this.textureTarget, gl.TEXTURE_MAG_FILTER, gl.LINEAR_MIPMAP_LINEAR);
			gl.texParameteri(this.textureTarget, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
		}
		
		private onDisposed(): void
		{
			this.manager.flush(this.source);
		}
		
		dispose(): void
		{
			this.manager.gl.deleteTexture(this.textureHandle);
			this.source.removeEventListener('dispose', this.disposeHandler);
			this.textureHandle = null;
		}
		
		bind(): void
		{
			throw new Error("not implemented");
		}
	}
	
	class Texture2D extends Texture
	{
		setupDone: boolean;
		
		constructor(manager: TextureManager,
			source: THREE.Texture)
		{
			super(manager, source, manager.gl.TEXTURE_2D);
			
			this.setupDone = false;
		}
		
		setup(): boolean
		{
			if (this.setupDone) {
				return true;
			}
			
			// FIXME: compressed texture
			
			let image = this.source.image;
			if (image == null || image.width == 0) {
				// not loaded yet
				return false;
			}
			
			this.setupDone = true;
			
			// Setup texture object
			const gl = this.manager.gl;
			gl.bindTexture(this.textureTarget, this.textureHandle);
			this.setupCommon();
			gl.texParameteri(this.textureTarget, gl.TEXTURE_WRAP_S, gl.REPEAT);
			gl.texParameteri(this.textureTarget, gl.TEXTURE_WRAP_T, gl.REPEAT);
			
			
			// Check size limitation
			const maxSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
			if (image.width > maxSize || image.height > maxSize) {
				// need to resize
				image = resizeImage(image, maxSize, maxSize);
			}
			
			gl.texImage2D(this.textureTarget, 0, 
				this.manager.internalFormatForTexture(this.source),
				this.manager.formatForTexture(this.source),
				this.manager.typeForTexture(this.source),
				image);
				
			if (this.source.generateMipmaps) {
				gl.generateMipmap(this.textureTarget);
			}
			
			return true;
		}
		
		bind(): void
		{
			const gl = this.manager.gl;
			if (!this.setup()) {
				// TODO: load dummy image
			}
			gl.bindTexture(this.textureTarget, this.textureHandle);
		}
	}
	
	class TextureCube extends Texture
	{
		setupDone: boolean;
		
		constructor(manager: TextureManager,
			source: THREE.CubeTexture)
		{
			super(manager, source, manager.gl.TEXTURE_CUBE_MAP);
			
			this.setupDone = false;
		}
		
		setup(): boolean
		{
			if (this.setupDone) {
				return true;
			}
			
			// FIXME: compressed texture
			
			const images = this.source.image;
			for (let i = 0; i < 6; ++i) {
				const image = images[i];
				if (image == null || image.width == 0) {
					// not loaded yet
					return false;
				}
			}
			
			this.setupDone = true;
			
			// Setup texture object
			const gl = this.manager.gl;
			gl.bindTexture(this.textureTarget, this.textureHandle);
			this.setupCommon();
			gl.texParameteri(this.textureTarget, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(this.textureTarget, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			
			// Check size limitation
			const maxSize = gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE);
			if (images[0].width > maxSize || images[0].height > maxSize) {
				// need to resize
				for (let i = 0; i < 6; ++i) {
					images[i] = resizeImage(images[i], maxSize, maxSize);
				}
			}
			
			for (let i = 0; i < 6; ++i) {
				const image = images[i];
				gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, 
					this.manager.internalFormatForTexture(this.source),
					this.manager.formatForTexture(this.source),
					this.manager.typeForTexture(this.source),
					image);
			}
				
			if (this.source.generateMipmaps) {
				gl.generateMipmap(this.textureTarget);
			}
			
			return true;
		}
		
		bind(): void
		{
			const gl = this.manager.gl;
			if (!this.setup()) {
				// TODO: load dummy image
			}
			gl.bindTexture(this.textureTarget, this.textureHandle);
		}
	}
	
	function resizeImage(image: any, width: number, height: number): any
	{
		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		
		const context = canvas.getContext('2d');
		context.drawImage(image, 0, 0, width, height);
		
		return canvas;
	}
}