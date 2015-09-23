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
				t = new Texture2D(this, tex);
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
			this.textureTarget = 0;
			
			this.textureHandle = manager.gl.createTexture();
			
			source.addEventListener('dispose', this.disposeHandler = () => this.onDisposed());
		}
		
		setupCommon(): void
		{
			
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
		
		setup(): void
		{
			if (this.setupDone) {
				return;
			}
			
			// FIXME: compressed texture
			
			const image = this.source.image;
			if (image.width == 0) {
				// not loaded yet
				return;
			}
			
			this.setupDone = true;
			
			// Setup texture object
			const gl = this.manager.gl;
			gl.bindTexture(this.textureTarget, this.textureHandle);
			this.setupCommon();
			
			gl.texImage2D(this.textureTarget, 0, 
				this.manager.internalFormatForTexture(this.source),
				this.source.image.width, this.source.image.height, 0,
				this.manager.formatForTexture(this.source),
				this.manager.typeForTexture(this.source),
				image);
				
			if (this.source.generateMipmaps) {
				gl.generateMipmap(this.textureTarget);
			}
			
		}
		
		bind(): void
		{
			this.setup();
			const gl = this.manager.gl;
			gl.bindTexture(this.textureTarget, this.textureHandle);
		}
	}
}