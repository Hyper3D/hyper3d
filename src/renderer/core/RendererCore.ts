/// <reference path="../Prefix.d.ts" />
/// <reference path="../render/TextureManager.ts" />
/// <reference path="RenderBufferManager.ts" />
/// <reference path="../render/GeometryRenderer.ts" />
/// <reference path="../render/ShadowMapRenderer.ts" />
/// <reference path="QuadRenderer.ts" />
/// <reference path="ShaderManager.ts" />
/// <reference path="JitterTexture.ts" />
/// <reference path="Visualizer.ts" />
/// <reference path="../utils/Utils.ts" />
/// <reference path="../utils/Geometry.ts" />
/// <reference path="../validator/SRGBValidator.ts" />
/// <reference path="../render/LightRenderer.ts" />
/// <reference path="../render/ReflectionRenderer.ts" />
/// <reference path="../render/HdrDemosaicFilter.ts" />
/// <reference path="../public/WebGLHyperRenderer.ts" />
/// <reference path="../postfx/SSAORenderer.ts" />
/// <reference path="../postfx/ResampleFilter.ts" />
/// <reference path="../postfx/ToneMappingFilter.ts" />
/// <reference path="../postfx/TemporalAAFilter.ts" />
/// <reference path="../postfx/BloomFilter.ts" />
/// <reference path="../postfx/MotionBlurFilter.ts" />
module Hyper.Renderer
{
	
	export enum HdrMode
	{
		FullHdr,
		MobileHdr
	}
	
	export class RendererCore
	{
		ext: THREE.WebGLExtensions;
		
		supportsSRGB: boolean;
		supportsHdrTexture: boolean;
		supportsHdrRenderingBuffer: boolean;
		hdrMode: HdrMode;
		
		textures: TextureManager;
		renderBuffers: RenderBufferManager;
		vertexAttribs: VertexAttribState;
		state: GLState;
		
		geometryRenderer: GeometryRenderer;
		shadowRenderer: ShadowMapRenderer;
		geometryManager: GeometryManager;
		uniformJitter: JitterTexture;
		gaussianJitter: JitterTexture;
		uniformDitherJitter: JitterTexture;
		gaussianDitherJitter: JitterTexture;
		quadRenderer: QuadRenderer;
		shaderManager: ShaderManager;
		passthroughRenderer: PassThroughRenderer;
		bufferVisualizer: BufferVisualizer;
		lightRenderer: LightRenderer;
		reflectionRenderer: ReflectionRenderer;
		hdrDemosaic: HdrDemosaicFilterRenderer;
		toneMapFilter: ToneMappingFilterRenderer;
		resampler: ResampleFilterRenderer;
		ssaoRenderer: SSAORenderer;
		temporalAA: TemporalAAFilterRenderer;
		bloom: BloomFilterRenderer;
		motionBlur: MotionBlurFilterRenderer;
		
		currentScene: THREE.Scene;
		currentCamera: THREE.Camera;
		depthFar: number;
		
		/** Objects removed from the scene tree are deleted as soon as possible.
		 * Setting this to true prevents this behavior.
		 * FIXME: no used
		 */
		deferGC: boolean;
		
		useFullResolutionGBuffer: boolean;
		
		width: number;
		height: number;
		
		renderWidth: number;
		renderHeight: number;
		
		constructor(public gl: WebGLRenderingContext, params: WebGLHyperRendererParameters)
		{
			this.useFullResolutionGBuffer = params.useFullResolutionGBuffer == null ? false :
				params.useFullResolutionGBuffer;
			
			this.ext = new THREE.WebGLExtensions(this.gl);
			this.ext.get('OES_texture_float');
			this.ext.get('OES_texture_float_linear');
			this.ext.get('OES_texture_half_float');
			this.ext.get('OES_texture_half_float_linear');
			this.ext.get('OES_standard_derivatives');
			this.ext.get('EXT_frag_depth');
			if (!this.ext.get('WEBGL_depth_texture')) {
				throw new Error("required WebGL extension WEBGL_depth_texture is not supported.");
			}
			
			this.supportsSRGB = !!(this.ext.get('EXT_sRGB'));
			this.supportsHdrTexture = !!(this.ext.get('OES_texture_half_float') && 
				this.ext.get('OES_texture_half_float_linear'));
			this.supportsHdrRenderingBuffer = !!(this.ext.get('WEBGL_color_buffer_float') &&
				this.ext.get('OES_texture_half_float'));
			this.hdrMode = this.supportsHdrRenderingBuffer ? HdrMode.FullHdr : HdrMode.MobileHdr;
			
			this.renderWidth = this.width = gl.drawingBufferWidth;
			this.renderHeight = this.height = gl.drawingBufferHeight;
			
			this.deferGC = false;
			this.depthFar = 1000;
			
			this.setup();
		}
		
		setup(): void
		{
			this.shaderManager = new ShaderManager(this);
			this.vertexAttribs = new VertexAttribState(this.gl);
			this.state = new GLState(this.gl);
			
			// this is required by WebGL comformance test
			this.quadRenderer = new QuadRenderer(this);
			
			// check capability
			if (this.supportsSRGB) {
				if (!validateSRGBCompliance(this)) {
					console.warn("WebGLHyperRenderer: defective EXT_sRGB detected; disabling sRGB support.");
					this.supportsSRGB = false;
				}
			}
			
			// set global shader parameters
			this.shaderManager.setGlobalParameter('globalUseFullResolutionGBuffer', this.useFullResolutionGBuffer);
			this.shaderManager.setGlobalParameter('globalSupportsSRGB', this.supportsSRGB);
			
			// global uniform values
			this.updateGlobalUniforms();
			
			this.textures = new TextureManager(this);
			this.geometryManager = new GeometryManager(this);
			this.renderBuffers = new RenderBufferManager(this);
			this.uniformJitter = new UniformJitterTexture(this.gl);
			this.gaussianJitter = new GaussianJitterTexture(this.gl);
			this.uniformDitherJitter = new DitherJitterTexture(this.gl);
			this.gaussianDitherJitter = new GaussianDitherJitterTexture(this.gl);
			this.geometryRenderer = new GeometryRenderer(this);
			this.shadowRenderer = new ShadowMapRenderer(this);
			this.passthroughRenderer = new PassThroughRenderer(this);
			this.bufferVisualizer = new BufferVisualizer(this);
			this.lightRenderer = new LightRenderer(this);
			this.reflectionRenderer = new ReflectionRenderer(this);
			this.hdrDemosaic = new HdrDemosaicFilterRenderer(this);
			this.ssaoRenderer = new SSAORenderer(this);
			this.resampler = new ResampleFilterRenderer(this);
			this.toneMapFilter = new ToneMappingFilterRenderer(this);
			this.temporalAA = new TemporalAAFilterRenderer(this);
			this.bloom = new BloomFilterRenderer(this);
			this.motionBlur = new MotionBlurFilterRenderer(this);
			
			this.compilePipeline();
		}
		
		private updateGlobalUniforms(): void
		{
			this.shaderManager.setGlobalUniform('globalRenderSize', [this.renderWidth, this.renderHeight]);
			this.shaderManager.setGlobalUniform('globalQuadRenderSize', [4 * this.renderWidth, 4 * this.renderHeight]);
			this.shaderManager.setGlobalUniform('globalDoubleRenderSize', [2 * this.renderWidth, 2 * this.renderHeight]);
			this.shaderManager.setGlobalUniform('globalHalfRenderSize', [0.5 * this.renderWidth, 0.5 * this.renderHeight]);
			this.shaderManager.setGlobalUniform('globalQuadInvRenderSize', [4 / this.renderWidth, 4 / this.renderHeight]);
			this.shaderManager.setGlobalUniform('globalDoubleInvRenderSize', [2 / this.renderWidth, 2 / this.renderHeight]);
			this.shaderManager.setGlobalUniform('globalInvRenderSize', [1 / this.renderWidth, 1 / this.renderHeight]);
			this.shaderManager.setGlobalUniform('globalHalfInvRenderSize', [0.5 / this.renderWidth, 0.5 / this.renderHeight]);
			this.shaderManager.setGlobalUniform('globalQuarterInvRenderSize', [0.25 / this.renderWidth, 0.25 / this.renderHeight]);
			this.shaderManager.setGlobalUniform('globalDepthFar', this.depthFar);
			this.shaderManager.setGlobalUniform('globalInvDepthFar', 1 / this.depthFar);
		}
		
		dispose(): void
		{
			this.motionBlur.dispose();
			this.bloom.dispose();
			this.temporalAA.dispose();
			this.toneMapFilter.dispose();
			this.resampler.dispose();
			this.ssaoRenderer.dispose();
			this.hdrDemosaic.dispose();
			this.reflectionRenderer.dispose();
			this.lightRenderer.dispose();
			this.bufferVisualizer.dispose();
			this.passthroughRenderer.dispose();
			this.geometryRenderer.dispose();
			this.shadowRenderer.dispose();
			this.textures.dispose();
			this.quadRenderer.dispose();
			this.geometryManager.dispose();
			this.renderBuffers.dispose();
			this.uniformDitherJitter.dispose();
			this.gaussianDitherJitter.dispose();
			this.uniformJitter.dispose();
			this.gaussianJitter.dispose();
			this.shaderManager.dispose();
		}
		
		compilePipeline(): void
		{
			const ops: RenderOperation[] = [];
			const gbuffer = this.geometryRenderer.setupGeometryPass(this.width, this.height, ops);
			const linearDepthHalf = this.resampler.setupFilter(gbuffer.linearDepth, {
				outWidth: (gbuffer.linearDepth.width + 1) >> 1,
				outHeight: (gbuffer.linearDepth.height + 1) >> 1,
				type: ResampleFilterType.Nearest
			}, ops);
			
			const shadowMaps = this.shadowRenderer.setupShadowPass(ops);
			
			const ssao = this.ssaoRenderer.setupFilter({
				g2: gbuffer.g2,
				linearDepth: gbuffer.linearDepth,
				linearDepthHalf: linearDepthHalf
			}, ops);
			
			const lightBuf = this.lightRenderer.setupLightPass({
				g0: gbuffer.g0,
				g1: gbuffer.g1,
				g2: gbuffer.g2,
				g3: gbuffer.g3,	
				linearDepth: gbuffer.linearDepth,	
				depth: gbuffer.depth,	
				shadowMaps: shadowMaps.shadowMaps,
				ssao: ssao.output
			}, ops);
			
			const reflections = this.reflectionRenderer.setupReflectionPass({
				g0: gbuffer.g0,
				g1: gbuffer.g1,
				g2: gbuffer.g2,
				g3: gbuffer.g3,	
				linearDepth: gbuffer.linearDepth,	
				depth: gbuffer.depth,	
				ssao: ssao.output,
				lit: lightBuf.lit
			}, ops);
			
			let demosaiced = this.hdrDemosaic.setupFilter(reflections.lit, {
				halfSized: false
			}, ops);
			
			demosaiced = this.motionBlur.setupFilter({
				color: demosaiced,
				g0: gbuffer.g0,
				g1: gbuffer.g1,
				linearDepth: gbuffer.linearDepth
			}, {
				maxBlur: Math.max(this.renderWidth, this.renderHeight) / 50
			}, ops);
			
			demosaiced = this.bloom.setupFilter(demosaiced, ops);
			
			let toneMapped = this.toneMapFilter.setupFilter(demosaiced, ops);
			
			toneMapped = this.temporalAA.setupFilter({
				color: toneMapped,
				linearDepth: gbuffer.linearDepth,
				g0: gbuffer.g0, g1: gbuffer.g1
			}, ops);
			
			const visualizedBuf = toneMapped;
			const visualized = this.bufferVisualizer.setupColorVisualizer(visualizedBuf, ops);
			
			// const visualized = this.bufferVisualizer.setupGBufferVisualizer(gbuffer, GBufferAttributeType.Velocity, ops);
			
			console.log(this.renderBuffers.dumpRenderOperation(ops));
			
			this.renderBuffers.setup(ops, [visualized]);
			
		}
		
		invalidateFramebuffer(...attachments: number[]): void
		{
			// FIXME: variadic functions in TypeScript comes with dynamic allocation...
			// FIXME: this is only needed on TBR like mobile GPUs
			let bits: number = 0;
			const gl = this.gl;
			for (let i = 0; i < attachments.length; ++i) {
				switch (attachments[i]) {
					case gl.COLOR_ATTACHMENT0:
						bits |= gl.COLOR_BUFFER_BIT;
						break;
					case gl.DEPTH_ATTACHMENT:
						bits |= gl.DEPTH_BUFFER_BIT;
						break;
				}
			}
			gl.clear(bits);
		}
		
        render(scene: THREE.Scene, camera: THREE.Camera): void
		{
			const gl = this.gl;
			this.currentScene = scene;
			this.currentCamera = camera;
			
			this.uniformJitter.update();
			this.gaussianJitter.update();
			this.uniformDitherJitter.update();
			this.gaussianDitherJitter.update();
			
			// compute depth far
			{
				const proj = camera.projectionMatrix;
				const newDepthFar = computeFarDepthFromProjectionMatrix(proj)
				if (newDepthFar != this.depthFar) {
					this.depthFar = newDepthFar;
					this.updateGlobalUniforms();
				}
			}
			
			if (scene.autoUpdate) {
				scene.updateMatrixWorld(false);
			}
			if (!camera.parent) {
				camera.updateMatrixWorld(false);
			}
			
			// update skeletons
			scene.traverse((obj) => {
				if (obj instanceof THREE.SkinnedMesh) {
					obj.skeleton.update();
				}
			});
			
			camera.matrixWorldInverse.getInverse(camera.matrixWorld);
			
			this.renderBuffers.render();
		}
        setSize(width:number, height:number): void
		{
			if (width & 1) {
				throw new Error("width cannot be odd");
			}
			if (height & 1) {
				throw new Error("height cannot be odd");
			}
			
			width = Math.max(width | 0, 2);
			height = Math.max(height | 0, 2);
			
			this.renderWidth = this.width = width;
			this.renderHeight = this.height = height;
			
			// global uniform values
			this.updateGlobalUniforms();
			
			this.compilePipeline();
		}
	}	
	
	class VertexAttribState extends Utils.BitArray
	{
		constructor(private gl: WebGLRenderingContext)
		{
			super();
		}
		
		onToggledTrue(index: number): void 
		{ 
			this.gl.enableVertexAttribArray(index);
		}
		onToggledFalse(index: number): void 
		{
			this.gl.disableVertexAttribArray(index);
		}
	}
	
	export const enum GLStateFlags
	{
		Default = 0,
		
		DepthTestEnabled = 1 << 0,
		DepthWriteDisabled = 1 << 1,
		StencilTestEnabled = 1 << 2,
		BlendEnabled = 1 << 3,
		
		ColorRedWriteDisabled = 1 << 4,
		ColorGreenWriteDisabled = 1 << 5,
		ColorBlueWriteDisabled = 1 << 6,
		ColorAlphaWriteDisabled = 1 << 7,
		ColorRGBWriteDisabled = ColorRedWriteDisabled|ColorGreenWriteDisabled|ColorBlueWriteDisabled,
		ColorWriteDisabled = ColorRGBWriteDisabled | ColorAlphaWriteDisabled,
		
		CullFaceDisabled = 1 << 8,
		
		FrontFaceCW = 1 << 9
	}
	
	class GLState
	{
		private flags_: GLStateFlags;
		
		constructor(private gl: WebGLRenderingContext)
		{
			gl.disable(gl.DEPTH_TEST);
			gl.disable(gl.STENCIL_TEST);
			gl.disable(gl.BLEND);
			gl.depthMask(true);
			gl.colorMask(true, true, true, true);
			gl.enable(gl.CULL_FACE);
			gl.frontFace(gl.CCW);
			
			this.flags_ = 0;
		}
		
		get flags(): GLStateFlags
		{
			return this.flags_;
		}
		
		set flags(newValue: GLStateFlags)
		{
			const diff = newValue ^ this.flags_;
			if (!diff) {
				return;
			}
			
			const gl = this.gl;
			if (diff & GLStateFlags.DepthTestEnabled) {
				if (newValue & GLStateFlags.DepthTestEnabled) {
					gl.enable(gl.DEPTH_TEST);
				} else {
					gl.disable(gl.DEPTH_TEST);
				}
			}
			if (diff & GLStateFlags.DepthWriteDisabled) {
				if (newValue & GLStateFlags.DepthWriteDisabled) {
					gl.depthMask(false);
				} else {
					gl.depthMask(true);
				}
			}
			if (diff & GLStateFlags.ColorWriteDisabled) {
				gl.colorMask(
					!(newValue & GLStateFlags.ColorRedWriteDisabled),
					!(newValue & GLStateFlags.ColorGreenWriteDisabled),
					!(newValue & GLStateFlags.ColorBlueWriteDisabled),
					!(newValue & GLStateFlags.ColorAlphaWriteDisabled)
				);
			}
			if (diff & GLStateFlags.StencilTestEnabled) {
				if (newValue & GLStateFlags.StencilTestEnabled) {
					gl.enable(gl.STENCIL_TEST);
				} else {
					gl.disable(gl.STENCIL_TEST);
				}
			}
			if (diff & GLStateFlags.BlendEnabled) {
				if (newValue & GLStateFlags.BlendEnabled) {
					gl.enable(gl.BLEND);
				} else {
					gl.disable(gl.BLEND);
				}
			}
			if (diff & GLStateFlags.CullFaceDisabled) {
				if (newValue & GLStateFlags.CullFaceDisabled) {
					gl.disable(gl.CULL_FACE);
				} else {
					gl.enable(gl.CULL_FACE);
				}
			}
			if (diff & GLStateFlags.FrontFaceCW) {
				if (newValue & GLStateFlags.FrontFaceCW) {
					gl.frontFace(gl.CW);
				} else {
					gl.frontFace(gl.CCW);
				}
			}
			
			this.flags_ = newValue;
		}
		
	}
	
	class PassThroughRenderer
	{
		private normal: {
			program: GLProgram;
			uniforms: GLProgramUniforms;
			attrs: GLProgramAttributes;
		};
		private modulated: {
			program: GLProgram;
			uniforms: GLProgramUniforms;
			attrs: GLProgramAttributes;
		};
		
		constructor(private core: RendererCore)
		{
			const gl = core.gl;
			
			{
				const p = core.shaderManager.get('VS_Passthrough', 'FS_Passthrough', [
					'a_position'
				]);
				this.normal = {
					program: p,
					uniforms: p.getUniforms(['u_uvScale', 'u_texture']),
					attrs: p.getAttributes([
						"a_position"
					])
				};
			}
			{
				const p = core.shaderManager.get('VS_Passthrough', 'FS_PassthroughModulated', [
					'a_position'
				]);
				this.modulated = {
					program: p,
					uniforms: p.getUniforms(['u_uvScale', 'u_texture', 'u_modulation']),
					attrs: p.getAttributes([
						"a_position"
					])
				};
			}
		}
		
		dispose(): void
		{ }
		
		render(): void
		{
			const gl = this.core.gl;
			const p = this.normal;
			p.program.use();
			gl.uniform4f(p.uniforms['u_uvScale'], 0.5, 0.5, 0.5, 0.5);
			gl.uniform1i(p.uniforms['u_texture'], 0);
			this.core.quadRenderer.render(p.attrs['a_position']);
		}
		
		renderModulated(r: number, g: number, b: number, a: number): void
		{
			const gl = this.core.gl;
			const p = this.modulated;
			p.program.use();
			gl.uniform4f(p.uniforms['u_uvScale'], 0.5, 0.5, 0.5, 0.5);
			gl.uniform1i(p.uniforms['u_texture'], 0);
			gl.uniform4f(p.uniforms['u_modulation'], r, g, b, a);
			this.core.quadRenderer.render(p.attrs['a_position']);
		}
	}
	
}
