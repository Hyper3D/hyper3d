/// <reference path="../Prefix.d.ts" />
/// <reference path="TextureManager.ts" />
/// <reference path="../core/RenderBufferManager.ts" />
/// <reference path="../core/RendererCore.ts" />
/// <reference path="MaterialManager.ts" />
/// <reference path="BaseGeometryPassRenderer.ts" />
/// <reference path="../core/GLFramebuffer.ts" />
module Hyper.Renderer
{
	export interface ShadowPassOutput
	{
		shadowMaps: ShadowMapRenderBufferInfo;
	}
	
	export class ShadowMapRenderer
	{
		gpMaterials: GeometryPassMaterialManager;
		
		depthShadowMapTexture: WebGLTexture;
		colorShadowMapTexture: WebGLTexture; // to make framebuffer complete
		
		normalShadowMapFramebuffer: GLFramebuffer;
		
		constructor(public renderer: RendererCore)
		{
			this.gpMaterials = new GeometryPassMaterialManager(renderer, 'VS_ShadowMapGeometry', 'FS_ShadowMapGeometry');
			
			const gl = renderer.gl;
			
			this.depthShadowMapTexture = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, this.depthShadowMapTexture);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, 1024, 1024, 0,
				gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);
			
			this.colorShadowMapTexture = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, this.colorShadowMapTexture);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1024, 1024, 0,
				gl.RGBA, gl.UNSIGNED_BYTE, null);
				
			this.normalShadowMapFramebuffer = GLFramebuffer.createFramebuffer(gl, {
				depth: this.depthShadowMapTexture,
				colors: [this.colorShadowMapTexture]
			});
			
		}
		
		dispose(): void
		{
			this.gpMaterials.dispose();
			
			const gl = this.renderer.gl;
			gl.deleteTexture(this.depthShadowMapTexture);
			
			this.normalShadowMapFramebuffer.dispose();
		}
		
		setupShadowPass(ops: RenderOperation[]): ShadowPassOutput
		{
			const outp: ShadowPassOutput = {
				shadowMaps: new ShadowMapRenderBufferInfo()
			};
			
			ops.push({
				inputs: {},
				outputs: {
					shadowMaps: outp.shadowMaps
				},
				bindings: [],
				optionalOutputs: ['shadowMaps'],
				name: "Geometry Pass",
				factory: (cfg) => new ShadowGeometryPassRenderer(this,
					<ShadowMapRenderBufferImpl> cfg.outputs['shadowMaps'])
			});
			
			return outp;
		}
		
	}
	
	export enum ShadowMapType
	{
		Normal
	}
	
	export class ShadowMapRenderBufferInfo extends RenderBufferInfo
	{
		private bufferInfo: TextureRenderBufferInfo;
		
		constructor()
		{ 
			super("Shadow Maps");
			
			this.hash = 931810;
			this.cost = 0;
		}
		canMergeWith(o: RenderBufferInfo): boolean
		{
			if (o instanceof ShadowMapRenderBufferInfo) {
				return this == o;
			}
			return false;
		}
		create(manager: RenderBufferManager): ShadowMapRenderBuffer
		{
			return new ShadowMapRenderBufferImpl();
		}
		toString(): string
		{
			return "Shadow Maps Provider";
		}
	}
	
	export interface ShadowMapRenderBuffer extends RenderBuffer
	{
		service: ShadowMapRenderService;
	}
	
	export interface ShadowMapRenderService
	{
		/** Must be called in `beforeRender`. */
		prepareShadowMap(camera: THREE.Camera, type: ShadowMapType): void;
		
		/** Must be called in `perform`. */
		renderShadowMap(camera: THREE.Camera, type: ShadowMapType): void;
		currentShadowMapDepth: WebGLTexture;
		shadowMapWidth: number;
		shadowMapHeight: number;
	}
	
	class ShadowMapRenderBufferImpl implements ShadowMapRenderBufferImpl
	{
		service: ShadowMapRenderService;
		
		constructor()
		{
			this.service = null;
		}
		
		dispose(): void
		{
		}
	}
	
	class ShadowGeometryPassRenderer extends BaseGeometryPassRenderer 
		implements RenderOperator, ShadowMapRenderService
	{
		private fb: GLFramebuffer;
		
		constructor(
			private parent: ShadowMapRenderer,
			private outShadowMap: ShadowMapRenderBufferImpl
		)
		{
			super(parent.renderer, parent.gpMaterials, false);
			this.outShadowMap.service = this;
		}
		
		beforeRender(): void
		{
		}
		perform(): void
		{
		}
		afterRender(): void
		{
		}
		
		get currentShadowMapDepth(): WebGLTexture
		{
			return this.parent.depthShadowMapTexture;
		}
		get shadowMapWidth(): number
		{
			return 1024;
		}
		get shadowMapHeight(): number
		{
			return 1024;
		}
		
		prepareShadowMap(camera: THREE.Camera, type: ShadowMapType): void
		{
			// nothing to do for now
		}
		
		renderShadowMap(camera: THREE.Camera, type: ShadowMapType): void
		{
			const gl = this.parent.renderer.gl;
			this.parent.normalShadowMapFramebuffer.bind();
			gl.viewport(0, 0, this.shadowMapWidth, this.shadowMapHeight);
			this.parent.renderer.state.flags = GLStateFlags.DepthTestEnabled;
			gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);
			this.parent.renderer.state.flags = GLStateFlags.DepthTestEnabled |
				GLStateFlags.ColorWriteDisabled;
			
			this.renderGeometry(camera.matrixWorldInverse,
				camera.projectionMatrix);
		}
		
		dispose(): void
		{
			BaseGeometryPassRenderer.prototype.dispose.call(this);
		}
	}
	
}
