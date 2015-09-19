/// <reference path="../Prefix.d.ts" />
/// <reference path="../render/TextureManager.ts" />
/// <reference path="RenderBufferManager.ts" />
/// <reference path="../render/GeometryRenderer.ts" />
/// <reference path="QuadRenderer.ts" />
/// <reference path="ShaderManager.ts" />
/// <reference path="../utils/Utils.ts" />
/// <reference path="../validator/SRGBValidator.ts" />
/// <reference path="../render/LightRenderer.ts" />
/// <reference path="../public/WebGLHyperRenderer.ts" />
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
		geometryManager: GeometryManager;
		quadRenderer: QuadRenderer;
		shaderManager: ShaderManager;
		passthroughRenderer: PassThroughRenderer;
		bufferVisualizer: BufferVisualizer;
		lightRenderer: LightRenderer;
		
		currentScene: THREE.Scene;
		currentCamera: THREE.Camera;
		
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
			this.geometryRenderer = new GeometryRenderer(this);
			this.passthroughRenderer = new PassThroughRenderer(this);
			this.bufferVisualizer = new BufferVisualizer(this);
			this.lightRenderer = new LightRenderer(this);
			
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
			this.shaderManager.setGlobalUniform('globalDepthFar', 1000); // FIXME
		}
		
		dispose(): void
		{
			this.lightRenderer.dispose();
			this.bufferVisualizer.dispose();
			this.passthroughRenderer.dispose();
			this.geometryRenderer.dispose();
			this.textures.dispose();
			this.quadRenderer.dispose();
			this.geometryManager.dispose();
			this.renderBuffers.dispose();
			this.shaderManager.dispose();
		}
		
		compilePipeline(): void
		{
			const ops: RenderOperation[] = [];
			const gbuffer = this.geometryRenderer.setupGeometryPass(this.width, this.height, ops);
			
			const lightBuf = this.lightRenderer.setupLightPass(gbuffer, ops);
			
			const visualizedBuf = lightBuf.lit;
			const visualized = this.bufferVisualizer.setupColorVisualizer(visualizedBuf, ops);
			
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
			width = Math.max(width | 0, 1);
			height = Math.max(height | 0, 1);
			
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
					!(diff & GLStateFlags.ColorRedWriteDisabled),
					!(diff & GLStateFlags.ColorGreenWriteDisabled),
					!(diff & GLStateFlags.ColorBlueWriteDisabled),
					!(diff & GLStateFlags.ColorAlphaWriteDisabled)
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
		private passthroughProgram: GLProgram;
		private passthroughUniforms: GLProgramUniforms;
		private passthroughAttrs: GLProgramAttributes;
		
		constructor(private core: RendererCore)
		{
			const gl = core.gl;
			this.passthroughProgram = core.shaderManager.get('VS_Passthrough', 'FS_Passthrough', [
				'a_position'
			]);
			this.passthroughUniforms = this.passthroughProgram.getUniforms(['u_uvScale', 'u_texture']);
			this.passthroughAttrs = this.passthroughProgram.getAttributes([
				"a_position"
			]);
		}
		
		dispose(): void
		{ }
		
		render(): void
		{
			const gl = this.core.gl;
			this.passthroughProgram.use();
			gl.uniform4f(this.passthroughUniforms['u_uvScale'], 0.5, 0.5, 0.5, 0.5);
			gl.uniform1i(this.passthroughUniforms['u_texture'], 0);
			this.core.quadRenderer.render(this.passthroughAttrs['a_position']);
		}
	}
	
	class BufferVisualizer
	{
		constructor(private core: RendererCore)
		{		
		}
		
		dispose(): void
		{
		}
		
		setupColorVisualizer(input: TextureRenderBufferInfo, ops: RenderOperation[]): DummyRenderBufferInfo
		{
			const outp = new DummyRenderBufferInfo("Visualized Output");
			
			ops.push({
				inputs: {
					input: input
				},
				outputs: {
					output: outp
				},
				optionalOutputs: ['output'],
				name: "Visualize Color Buffer",
				factory: (cfg) => new ColorBufferVisualizerInstance(
					this.core,
					<TextureRenderBuffer> cfg.inputs['input'])
			});
			
			return outp;
		}
	}
	
	class ColorBufferVisualizerInstance implements RenderOperator
	{
		private program: GLProgram;
		private uniforms: GLProgramUniforms;
		private attributes: GLProgramAttributes;
		
		constructor(private core: RendererCore,
			private input: TextureRenderBuffer)
		{
			this.program = core.shaderManager.get('VS_Passthrough', 'FS_VisualizeColor', [
				'a_position'
			]);
			this.attributes = this.program.getAttributes(['a_position']);
			this.uniforms = this.program.getUniforms(['u_texture', 'u_uvScale']);
		}
		dispose(): void
		{
			
		}
		beforeRender(): void
		{ }
		perform(): void
		{
			const gl = this.core.gl;
			
			// bind default framebuffer
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, this.input.texture);
			
			this.program.use();
			gl.uniform1i(this.uniforms['u_texture'], 0);
			gl.uniform4f(this.uniforms['u_uvScale'], 0.5, 0.5, 0.5, 0.5);
			
			gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
			gl.clearColor(0, 0, 0, 1);
			gl.clear(gl.COLOR_BUFFER_BIT);
			this.core.state.flags = GLStateFlags.Default;
			
			const quad = this.core.quadRenderer;
			quad.render(this.attributes['a_position']);
		}
		afterRender(): void
		{ }
	}
}
