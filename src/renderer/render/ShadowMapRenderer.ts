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
		shadowMapsDepth: ShadowMapRenderBufferInfo;
		shadowMapsColor: ShadowMapRenderBufferInfo;
	}
	
	export class ShadowMapRenderer
	{
		gpMaterials: GeometryPassMaterialManager;
		
		constructor(public renderer: RendererCore)
		{
			this.gpMaterials = new GeometryPassMaterialManager(renderer);
		}
		
		dispose(): void
		{
			this.gpMaterials.dispose();
		}
		
		setupShadowPass(ops: RenderOperation[]): ShadowPassOutput
		{
			const outp: ShadowPassOutput = {
				shadowMapsDepth: new ShadowMapRenderBufferInfo(ShadowMapType.Depth),
				shadowMapsColor: new ShadowMapRenderBufferInfo(ShadowMapType.Color)
			};
			
			ops.push({
				inputs: {},
				outputs: {
					shadowMapsDepth: outp.shadowMapsDepth,
					shadowMapsColor: outp.shadowMapsColor
				},
				bindings: [],
				optionalOutputs: ['shadowMapsDepth', 'shadowMapsColor'],
				name: "Geometry Pass",
				factory: (cfg) => new ShadowGeometryPassRenderer(this,
					<ShadowMapRenderBufferImpl> cfg.outputs['shadowMapsDepth'],
					<ShadowMapRenderBufferImpl> cfg.outputs['shadowMapsColor'])
			});
			
			return outp;
		}
		
	}
	
	export enum ShadowMapType
	{
		Depth,
		Color
	}
	
	export class ShadowMapRenderBufferInfo extends RenderBufferInfo
	{
		private bufferInfo: TextureRenderBufferInfo;
		
		constructor(private shadowMapType: ShadowMapType)
		{ 
			super("Shadow Maps");
			
			this.hash = 931810;
			this.cost = 2048 * 2048;
			switch (shadowMapType) {
				case ShadowMapType.Depth:
					this.cost *= 2;
					this.bufferInfo = new TextureRenderBufferInfo("Shadow Maps: Depth", 2048, 2048,
						TextureRenderBufferFormat.Depth);
					break;
				case ShadowMapType.Color:
					this.cost *= 4;
					this.bufferInfo = new TextureRenderBufferInfo("Shadow Maps: Color", 2048, 2048,
						TextureRenderBufferFormat.Depth);
					break;
			}
		}
		canMergeWith(o: RenderBufferInfo): boolean
		{
			if (o instanceof ShadowMapRenderBufferInfo) {
				return this == o || this.shadowMapType == o.shadowMapType;
			}
			return false;
		}
		create(manager: RenderBufferManager): ShadowMapRenderBuffer
		{
			return new ShadowMapRenderBufferImpl(this.bufferInfo.create(manager));
		}
		toString(): string
		{
			let fmtStr: string = `${this.shadowMapType}`;
			switch (this.shadowMapType) {
				case ShadowMapType.Depth:
					fmtStr = "Depth";
					break;
				case ShadowMapType.Color:
					fmtStr = "Color";
					break;
			}
			return `${fmtStr} Provider`;
		}
	}
	
	export interface ShadowMapRenderBuffer extends RenderBuffer
	{
		service: ShadowMapRenderService;
	}
	
	export interface ShadowMapRenderService
	{
		
	}
	
	class ShadowMapRenderBufferImpl implements ShadowMapRenderBufferImpl
	{
		service: ShadowMapRenderService;
		
		constructor(private tex: TextureRenderBuffer)
		{
			
		}
		
		dispose(): void
		{
			this.tex.dispose();
		}
	}
	
	class ShadowGeometryPassRenderer extends BaseGeometryPassRenderer implements RenderOperator
	{
		private fb: GLFramebuffer;
		
		constructor(
			private parent: ShadowMapRenderer,
			private outShadowMapDepth: ShadowMapRenderBufferImpl,
			private outShadowMapColor: ShadowMapRenderBufferImpl
		)
		{
			super(parent.renderer, parent.gpMaterials);
			
			if (outShadowMapDepth) {
				outShadowMapDepth.service = this;
			}
			if (outShadowMapColor) {
				outShadowMapColor.service = this;
			}
			
			/*this.fb = GLFramebuffer.createFramebuffer(parent.renderer.gl, {
				depth: outDepth.texture,
				colors: [
					outMosaic.texture
				]
			});*/
			
		}
		
		beforeRender(): void
		{
		}
		perform(): void
		{
			// TODO
			/*const scene = this.parent.renderer.currentScene;
			this.fb.bind();
			
			const gl = this.parent.renderer.gl;
			gl.viewport(0, 0, this.outMosaic.width, this.outMosaic.height);
			gl.clearColor(0, 0, 0, 0);
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
			this.parent.renderer.state.flags = GLStateFlags.DepthTestEnabled;
			this.renderGeometry(this.parent.renderer.currentCamera.matrixWorldInverse,
				this.parent.renderer.currentCamera.projectionMatrix);*/
		}
		afterRender(): void
		{
			
		}
		
		dispose(): void
		{
			// this.fb.dispose();
			
			BaseGeometryPassRenderer.prototype.dispose.call(this);
		}
	}
	
}
