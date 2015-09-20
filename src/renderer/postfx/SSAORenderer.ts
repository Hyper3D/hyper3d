/// <reference path="../Prefix.d.ts" />
/// <reference path="../core/RenderBufferManager.ts" />
/// <reference path="../core/RendererCore.ts" />
/// <reference path="../core/GLFramebuffer.ts" />
/// <reference path="../utils/Geometry.ts" />
/// <reference path="BilateralFilter.ts" />
module Hyper.Renderer
{
	export interface SSAOInput
	{
		g2: TextureRenderBufferInfo;
		linearDepth: TextureRenderBufferInfo;
		linearDepthHalf: TextureRenderBufferInfo;
	}
	export interface SSAOOutput
	{
		output: TextureRenderBufferInfo;
	}
	
	export class SSAORenderer
	{
		private bilateral: BilateralFilterRenderer;
		
		constructor(public renderer: RendererCore)
		{
			this.bilateral = new BilateralFilterRenderer(renderer);
		}
		
		dispose(): void
		{
			this.bilateral.dispose();
		}
		
		setupFilter(input: SSAOInput, ops: RenderOperation[]): SSAOOutput
		{
			const width = input.linearDepth.width;
			const height = input.linearDepth.height;
			
			
			const aoBuf = new TextureRenderBufferInfo("SSAO Raw Result", (width+1)>>1, (height+1)>>1,
				TextureRenderBufferFormat.R8);
			
			ops.push({
				inputs: {
					g2: input.g2,
					linearDepth: input.linearDepthHalf
				},
				outputs: {
					output: aoBuf
				},
				bindings: [],
				optionalOutputs: [],
				name: "SSAO",
				factory: (cfg) => new SSAORendererInstance(this,
					<TextureRenderBuffer> cfg.inputs['g2'],
					<TextureRenderBuffer> cfg.inputs['linearDepth'],
					<TextureRenderBuffer> cfg.outputs['output'])
			});
			
			const bilit1 = this.bilateral.setupFilter({
				input: aoBuf, 
				linearDepth: input.linearDepth
			}, {
				dir: BilateralFilterDirection.Horitonzal,
				outWidth: width,
				outHeight: height,
				kernelScale: 2		
			}, ops);
			
			const bilit2 = this.bilateral.setupFilter({
				input: bilit1.output, 
				linearDepth: input.linearDepth
			}, {
				dir: BilateralFilterDirection.Vertical,
				outWidth: width,
				outHeight: height,
				kernelScale: 2		
			}, ops);
			
			const outp: SSAOOutput = {
				output: bilit2.output
			};
			
			return outp;
		}
	}
	
	export class SSAORendererInstance implements RenderOperator
	{
		private fb: GLFramebuffer;
		private tmpMat: THREE.Matrix4;
		private projectionViewMat: THREE.Matrix4;
		private viewMat: THREE.Matrix4;
		private viewVec: ViewVectors;
		
		private program: {
			program: GLProgram;
			uniforms: GLProgramUniforms;
			attributes: GLProgramAttributes;		
		};
		
		
		constructor(
			private parent: SSAORenderer,
			private inG2: TextureRenderBuffer,
			private inLinearDepth: TextureRenderBuffer,
			private out: TextureRenderBuffer
		)
		{
			
			this.fb = GLFramebuffer.createFramebuffer(parent.renderer.gl, {
				depth: null,
				colors: [
					out.texture
				]
			});
			
			this.tmpMat = new THREE.Matrix4();
			this.projectionViewMat = new THREE.Matrix4();
			this.viewMat = null;
			this.viewVec = null;
			
			{
				const program = parent.renderer.shaderManager.get('VS_SSAO', 'FS_SSAO',
					['a_position']);
				this.program = {
					program,
					uniforms: program.getUniforms([
						'u_linearDepth', 'u_g2',
						'u_viewDirCoefX', 'u_viewDirCoefY', 'u_viewDirOffset',
						'u_sampleOffsetScale'
					]),
					attributes: program.getAttributes(['a_position'])
				};
			}
		}
		beforeRender(): void
		{
			this.viewMat = this.parent.renderer.currentCamera.matrixWorldInverse;
			this.projectionViewMat.multiplyMatrices(
				this.parent.renderer.currentCamera.projectionMatrix,
				this.parent.renderer.currentCamera.matrixWorldInverse
			);
			this.viewVec = computeViewVectorCoefFromProjectionMatrix(
				this.parent.renderer.currentCamera.projectionMatrix,
				this.viewVec
			);
		}
		perform(): void
		{
			const scene = this.parent.renderer.currentScene;
			this.fb.bind();
			
			const gl = this.parent.renderer.gl;
			gl.viewport(0, 0, this.out.width, this.out.height);
			this.parent.renderer.invalidateFramebuffer(gl.COLOR_ATTACHMENT0);
			this.parent.renderer.state.flags = 
				GLStateFlags.DepthWriteDisabled;
			
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, this.inG2.texture);
			gl.activeTexture(gl.TEXTURE1);
			gl.bindTexture(gl.TEXTURE_2D, this.inLinearDepth.texture);
			
			const kernelSize = Math.min(this.out.width, this.out.height) * 0.002;
			
			const p = this.program;
			p.program.use();
			gl.uniform1i(p.uniforms['u_g2'], 0);
			gl.uniform1i(p.uniforms['u_linearDepth'], 1);
			gl.uniform2f(p.uniforms['u_viewDirOffset'],
				this.viewVec.offset.x, this.viewVec.offset.y);
			gl.uniform2f(p.uniforms['u_viewDirCoefX'],
				this.viewVec.coefX.x, this.viewVec.coefX.y);
			gl.uniform2f(p.uniforms['u_viewDirCoefY'],
				this.viewVec.coefY.x, this.viewVec.coefY.y);
			gl.uniform2f(p.uniforms['u_sampleOffsetScale'],
				kernelSize / this.out.width, kernelSize / this.out.height);
				
			const quad = this.parent.renderer.quadRenderer;
			quad.render(p.attributes['a_position']);
		}
		afterRender(): void
		{
		}
		dispose(): void
		{
			this.fb.dispose();
		}
	}
}