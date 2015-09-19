/// <reference path="../Prefix.d.ts" />
/// <reference path="TextureManager.ts" />
/// <reference path="../core/RenderBufferManager.ts" />
/// <reference path="../core/RendererCore.ts" />
/// <reference path="MaterialManager.ts" />
/// <reference path="../core/GLFramebuffer.ts" />
/// <reference path="GeometryRenderer.ts" />
/// <reference path="../utils/Geometry.ts" />
module Hyper.Renderer
{
	export interface LightPassInput
	{
		g0: TextureRenderBufferInfo;
		g1: TextureRenderBufferInfo;
		g2: TextureRenderBufferInfo;
		g3: TextureRenderBufferInfo;
		depth: TextureRenderBufferInfo;
		linearDepth: TextureRenderBufferInfo;
		shadowMapsDepth: ShadowMapRenderBufferInfo;
	}
	
	export interface LightPassOutput
	{
		lit: TextureRenderBufferInfo;
	}
	
	export class LightRenderer
	{
		constructor(public renderer: RendererCore)
		{
		}
		
		dispose(): void
		{
		}
		
		setupLightPass(input: LightPassInput, ops: RenderOperation[]): LightPassOutput
		{
			const width = input.g0.width;
			const height = input.g0.height;
			
			const outp: LightPassOutput = {
				lit: new TextureRenderBufferInfo("Lit Color Mosaicked", width, height,
					this.renderer.supportsSRGB ?
						TextureRenderBufferFormat.SRGBA8 :
						TextureRenderBufferFormat.RGBA8)
			};
			
			const depthCullEnabled =
				input.depth.width == width &&
				input.depth.height == height &&
				input.depth.isDepthBuffer;
			
			ops.push({
				inputs: {
					g0: input.g0,
					g1: input.g1,
					g2: input.g2,
					g3: input.g3,
					linearDepth: input.linearDepth,
					depth: depthCullEnabled ? input.depth : null,
					shadowMapsDepth: input.shadowMapsDepth
				},
				outputs: {
					lit: outp.lit
				},
				bindings: [],
				optionalOutputs: [],
				name: "Light Pass",
				factory: (cfg) => new LightPassRenderer(this,
					<TextureRenderBuffer> cfg.inputs['g0'],
					<TextureRenderBuffer> cfg.inputs['g1'],
					<TextureRenderBuffer> cfg.inputs['g2'],
					<TextureRenderBuffer> cfg.inputs['g3'],
					<TextureRenderBuffer> cfg.inputs['linearDepth'],
					<TextureRenderBuffer> cfg.inputs['depth'],
					<ShadowMapRenderService> cfg.inputs['shadowMapsDepth'],
					<TextureRenderBuffer> cfg.outputs['lit'])
			});
			return outp;
		}
		
	}
	
	class LightPassRenderer implements RenderOperator
	{
		private fb: GLFramebuffer;
		private tmpMat: THREE.Matrix4;
		private projectionViewMat: THREE.Matrix4;
		private viewMat: THREE.Matrix4;
		private viewVec: ViewVectors;
		
		private directionalLightProgram: {
			program: GLProgram;
			uniforms: GLProgramUniforms;
			attributes: GLProgramAttributes;		
		};
		
		
		constructor(
			private parent: LightRenderer,
			private inG0: TextureRenderBuffer,
			private inG1: TextureRenderBuffer,
			private inG2: TextureRenderBuffer,
			private inG3: TextureRenderBuffer,
			private inLinearDepth: TextureRenderBuffer,
			private inDepth: TextureRenderBuffer,
			private inShadowMaps: ShadowMapRenderService,
			private outLit: TextureRenderBuffer
		)
		{
			
			this.fb = GLFramebuffer.createFramebuffer(parent.renderer.gl, {
				depth: inDepth ? inDepth.texture : null,
				colors: [
					outLit.texture
				]
			});
			
			this.tmpMat = new THREE.Matrix4();
			this.projectionViewMat = new THREE.Matrix4();
			this.viewMat = null;
			this.viewVec = null;
			
			{
				const program = parent.renderer.shaderManager.get('VS_DeferredDirectionalLight', 'FS_DeferredDirectionalLight',
					['a_position']);
				this.directionalLightProgram = {
					program,
					uniforms: program.getUniforms([
						'u_g0', 'u_g1', 'u_g2', 'u_g3', 'u_linearDepth', 
						'u_lightDir', 'u_lightColor', 
						'u_viewDirCoefX', 'u_viewDirCoefY', 'u_viewDirOffset'
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
			gl.viewport(0, 0, this.outLit.width, this.outLit.height);
			gl.clearColor(0, 0, 0, 0);
			gl.clear(gl.COLOR_BUFFER_BIT);
			this.parent.renderer.state.flags = 
				// GLStateFlags.DepthTestEnabled |
				GLStateFlags.DepthWriteDisabled |
				GLStateFlags.BlendEnabled;
			gl.blendFunc(gl.ONE, gl.ONE); // additive
			
			// bind G-Buffer
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, this.inG0.texture);
			gl.activeTexture(gl.TEXTURE1);
			gl.bindTexture(gl.TEXTURE_2D, this.inG1.texture);
			gl.activeTexture(gl.TEXTURE2);
			gl.bindTexture(gl.TEXTURE_2D, this.inG2.texture);
			gl.activeTexture(gl.TEXTURE3);
			gl.bindTexture(gl.TEXTURE_2D, this.inG3.texture);
			gl.activeTexture(gl.TEXTURE4);
			gl.bindTexture(gl.TEXTURE_2D, this.inLinearDepth.texture);
			
			// setup common uniforms
			{
				const p = this.directionalLightProgram;
				p.program.use();
				gl.uniform1i(p.uniforms['u_g0'], 0);
				gl.uniform1i(p.uniforms['u_g1'], 1);
				gl.uniform1i(p.uniforms['u_g2'], 2);
				gl.uniform1i(p.uniforms['u_g3'], 3);
				gl.uniform1i(p.uniforms['u_linearDepth'], 4);
				gl.uniform2f(p.uniforms['u_viewDirOffset'],
					this.viewVec.offset.x, this.viewVec.offset.y);
				gl.uniform2f(p.uniforms['u_viewDirCoefX'],
					this.viewVec.coefX.x, this.viewVec.coefX.y);
				gl.uniform2f(p.uniforms['u_viewDirCoefY'],
					this.viewVec.coefY.x, this.viewVec.coefY.y);
			}
			
			this.renderTree(scene);
		}
		private renderTree(obj: THREE.Object3D): void
		{
			if (obj instanceof THREE.Light) {
				this.renderLight(obj);
			}
			
			for (const child of obj.children) {
				this.renderTree(child);
			}
		}
		private renderLight(light: THREE.Light): void
		{
			const gl = this.parent.renderer.gl;
			let colorR = light.color.r;
			let colorG = light.color.g;
			let colorB = light.color.b;
			
			if (light instanceof THREE.DirectionalLight) {
				const p = this.directionalLightProgram;
				p.program.use();
				
				colorR *= light.intensity;
				colorG *= light.intensity;
				colorB *= light.intensity;
				
				const dir = light.position;
				tmpVec.set(dir.x, dir.y, dir.z, 0.);
				tmpVec.applyMatrix4(this.parent.renderer.currentCamera.matrixWorldInverse);
				tmpVec.normalize();
				gl.uniform3f(p.uniforms['u_lightDir'], tmpVec.x, tmpVec.y, tmpVec.z);
				
				gl.uniform3f(p.uniforms['u_lightColor'], colorR, colorG, colorB);
				
				const quad = this.parent.renderer.quadRenderer;
				gl.depthFunc(gl.GREATER);	
				quad.render(p.attributes['a_position']);
				gl.depthFunc(gl.LESS);
			}
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
