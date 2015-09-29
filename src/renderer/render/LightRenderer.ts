/// <reference path="../Prefix.d.ts" />
/// <reference path="TextureManager.ts" />
/// <reference path="../core/TypedRenderBuffers.ts" />
/// <reference path="../core/RendererCore.ts" />
/// <reference path="MaterialManager.ts" />
/// <reference path="../core/GLFramebuffer.ts" />
/// <reference path="GeometryRenderer.ts" />
/// <reference path="../utils/Geometry.ts" />
/// <reference path="../public/Lights.ts" />
module Hyper.Renderer
{
	export interface LightPassInput
	{
		g0: GBuffer0TextureRenderBufferInfo;
		g1: GBuffer1TextureRenderBufferInfo;
		g2: GBuffer2TextureRenderBufferInfo;
		g3: GBuffer3TextureRenderBufferInfo;
		depth: DepthTextureRenderBufferInfo;
		linearDepth: LinearDepthTextureRenderBufferInfo;
		ssao: TextureRenderBufferInfo;
		shadowMaps: ShadowMapRenderBufferInfo;
	}
	
	export interface LightPassOutput
	{
		lit: HdrMosaicTextureRenderBufferInfo;
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
				lit: new HdrMosaicTextureRenderBufferInfo("Lit Color Mosaicked", width, height,
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
					shadowMaps: input.shadowMaps,
					ssao: input.ssao
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
					<TextureRenderBuffer> cfg.inputs['ssao'],
					(<ShadowMapRenderBuffer> cfg.inputs['shadowMaps']).service,
					<TextureRenderBuffer> cfg.outputs['lit'])
			});
			return outp;
		}
		
	}
	
	const enum DirectionalLightProgramFlags
	{
		Default = 0,
		HasShadowMaps = 1 << 0	
	}
	
	const enum PointLightProgramFlags
	{
		Default = 0,
		HasShadowMaps = 1 << 0,
		IsFullScreen = 1 << 1
	}
	
	class LightPassRenderer implements RenderOperator
	{
		private fb: GLFramebuffer;
		private tmpMat: THREE.Matrix4;
		private projectionViewMat: THREE.Matrix4;
		private viewMat: THREE.Matrix4;
		private viewVec: ViewVectors;
		private totalAmbient: {
			r: number;
			g: number;
			b: number;	
		};
		
		private pointLightProgram: {
			program: GLProgram;
			uniforms: GLProgramUniforms;
			attributes: GLProgramAttributes;		
		}[];
		private directionalLightProgram: {
			program: GLProgram;
			uniforms: GLProgramUniforms;
			attributes: GLProgramAttributes;		
		}[];
		private ambientLightProgram: {
			program: GLProgram;
			uniforms: GLProgramUniforms;
			attributes: GLProgramAttributes;		
		};
		
		private frustumCorners: THREE.Vector3[];
		
		constructor(
			private parent: LightRenderer,
			private inG0: TextureRenderBuffer,
			private inG1: TextureRenderBuffer,
			private inG2: TextureRenderBuffer,
			private inG3: TextureRenderBuffer,
			private inLinearDepth: TextureRenderBuffer,
			private inDepth: TextureRenderBuffer,
			private inSSAO: TextureRenderBuffer,
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
			this.totalAmbient = {r: 0, g: 0, b: 0};
			this.directionalLightProgram = [];
			this.pointLightProgram = [];
			
			this.frustumCorners = [];
			for (let i = 0; i < 5; ++i) {
				this.frustumCorners.push(new THREE.Vector3());
			}
			
			for (let i = 0; i < 4; ++i) {
				const program = parent.renderer.shaderManager.get('VS_DeferredPointLight', 'FS_DeferredPointLight',
					['a_position'], {
						hasShadowMap: (i & PointLightProgramFlags.HasShadowMaps) != 0,
						isFullScreen: (i & PointLightProgramFlags.IsFullScreen) != 0
					});
				this.pointLightProgram.push({
					program,
					uniforms: program.getUniforms([
						'u_g0', 'u_g1', 'u_g2', 'u_linearDepth',
						'u_lightColor', 
						'u_viewDirCoefX', 'u_viewDirCoefY', 'u_viewDirOffset',
						'u_shadowMap', 'u_shadowMapMatrix', 
						'u_jitter', 'u_jitterScale', 'u_jitterAmount',
						'u_dither', 'u_ditherScale',
						
						'u_lightPos',
						'u_lightInfluenceRadius', 'u_lightInvInfluenceRadiusSquared',
						'u_minimumDistance',
						'u_invDistanceToJitter',
						'u_lightRadius',
						'u_lightLength',
						'u_lightDir'
					]),
					attributes: program.getAttributes(['a_position'])
				});
			}
			for (let i = 0; i < 2; ++i) {
				const program = parent.renderer.shaderManager.get('VS_DeferredDirectionalLight', 'FS_DeferredDirectionalLight',
					['a_position'], {
						hasShadowMap: (i & DirectionalLightProgramFlags.HasShadowMaps) != 0
					});
				this.directionalLightProgram.push({
					program,
					uniforms: program.getUniforms([
						'u_g0', 'u_g1', 'u_g2', 'u_linearDepth',
						'u_lightDir', 'u_lightColor', 
						'u_viewDirCoefX', 'u_viewDirCoefY', 'u_viewDirOffset',
						'u_shadowMap', 'u_shadowMapMatrix', 
						'u_jitter', 'u_jitterScale', 'u_jitterAmount',
						'u_dither', 'u_ditherScale'
					]),
					attributes: program.getAttributes(['a_position'])
				});
			}
			{
				const program = parent.renderer.shaderManager.get('VS_DeferredAmbientLight', 'FS_DeferredAmbientLight',
					['a_position']);
				this.ambientLightProgram = {
					program,
					uniforms: program.getUniforms([
						'u_g0', 'u_g1', 'u_g2', 'u_linearDepth', 'u_ssao',
						'u_lightColor', 
						'u_viewDirCoefX', 'u_viewDirCoefY', 'u_viewDirOffset',
						
						'u_dither', 'u_ditherScale'
					]),
					attributes: program.getAttributes(['a_position'])
				};
			}
		}
		beforeRender(): void
		{
			const scene = this.parent.renderer.currentScene;
			const currentCamera = this.parent.renderer.currentCamera;
			
			this.viewMat = currentCamera.matrixWorldInverse;
			this.projectionViewMat.multiplyMatrices(
				currentCamera.projectionMatrix,
				currentCamera.matrixWorldInverse
			);
			this.viewVec = computeViewVectorCoefFromProjectionMatrix(
				currentCamera.projectionMatrix,
				this.viewVec
			);
			this.totalAmbient.r = 0;
			this.totalAmbient.g = 0;
			this.totalAmbient.b = 0;
			
			// compute frustum corners
			const invViewMat = currentCamera.matrixWorld;
			const far = computeFarDepthFromProjectionMatrix(currentCamera.projectionMatrix);
			currentCamera.getWorldPosition(this.frustumCorners[4]);
			for (let i = 0; i < 4; ++i) {
				const fc = this.frustumCorners[i];
				fc.set(this.viewVec.offset.x, this.viewVec.offset.y, -1);
				if (i & 1) {
					fc.x += this.viewVec.coefX.x;
					fc.y += this.viewVec.coefX.y;
				} else {
					fc.x -= this.viewVec.coefX.x;
					fc.y -= this.viewVec.coefX.y;
				}
				if (i & 2) {
					fc.x += this.viewVec.coefY.x;
					fc.y += this.viewVec.coefY.y;
				} else {
					fc.x -= this.viewVec.coefY.x;
					fc.y -= this.viewVec.coefY.y;
				}
				fc.multiplyScalar(far);
				fc.applyMatrix4(invViewMat);
			}
			
			// traverse scene
			this.prepareTree(scene);
		}
		private setState(): void
		{
			const gl = this.parent.renderer.gl;
			this.fb.bind();
			this.parent.renderer.state.flags = 
				GLStateFlags.DepthTestEnabled |
				GLStateFlags.DepthWriteDisabled |
				GLStateFlags.BlendEnabled;
			gl.blendFunc(gl.ONE, gl.ONE); // additive
			gl.viewport(0, 0, this.outLit.width, this.outLit.height);
			
			// bind G-Buffer
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, this.inG0.texture);
			gl.activeTexture(gl.TEXTURE1);
			gl.bindTexture(gl.TEXTURE_2D, this.inG1.texture);
			gl.activeTexture(gl.TEXTURE2);
			gl.bindTexture(gl.TEXTURE_2D, this.inG2.texture);
			gl.activeTexture(gl.TEXTURE3);
			gl.bindTexture(gl.TEXTURE_2D, this.parent.renderer.uniformJitter.texture);
			gl.activeTexture(gl.TEXTURE4);
			gl.bindTexture(gl.TEXTURE_2D, this.inLinearDepth.texture);
			// TEXTURE5: (none)
			// TEXTURE6: shadow maps
			// TEXTURE7: light texture
		}
		perform(): void
		{
			const scene = this.parent.renderer.currentScene;
			this.setState();
			this.fb.bind();
			
			const gl = this.parent.renderer.gl;
			gl.clearColor(0, 0, 0, 0);
			gl.clear(gl.COLOR_BUFFER_BIT);
			
			const jitter = this.parent.renderer.gaussianJitter;
			const vpMat = this.projectionViewMat;
			
			// setup common uniforms
			for (const p of this.pointLightProgram) {
				p.program.use();
				gl.uniform1i(p.uniforms['u_g0'], 0);
				gl.uniform1i(p.uniforms['u_g1'], 1);
				gl.uniform1i(p.uniforms['u_g2'], 2);
				gl.uniform1i(p.uniforms['u_dither'], 3);
				gl.uniform2f(p.uniforms['u_ditherScale'],
					this.outLit.width / jitter.size / 4,
					this.outLit.height / jitter.size / 4);
				gl.uniform1i(p.uniforms['u_linearDepth'], 4);
				gl.uniform1i(p.uniforms['u_jitter'], 5);
				// u_jitterScale == u_ditherScale
				gl.uniform1i(p.uniforms['u_shadowMap'], 6);
				gl.uniform2f(p.uniforms['u_viewDirOffset'],
					this.viewVec.offset.x, this.viewVec.offset.y);
				gl.uniform2f(p.uniforms['u_viewDirCoefX'],
					this.viewVec.coefX.x, this.viewVec.coefX.y);
				gl.uniform2f(p.uniforms['u_viewDirCoefY'],
					this.viewVec.coefY.x, this.viewVec.coefY.y);
				gl.uniformMatrix4fv(p.uniforms['u_viewProjectionMatrix'], false,
					vpMat.elements);
			}
			for (const p of this.directionalLightProgram) {
				p.program.use();
				gl.uniform1i(p.uniforms['u_g0'], 0);
				gl.uniform1i(p.uniforms['u_g1'], 1);
				gl.uniform1i(p.uniforms['u_g2'], 2);
				gl.uniform1i(p.uniforms['u_dither'], 3);
				gl.uniform2f(p.uniforms['u_ditherScale'],
					this.outLit.width / jitter.size / 4,
					this.outLit.height / jitter.size / 4);
				gl.uniform1i(p.uniforms['u_linearDepth'], 4);
				gl.uniform1i(p.uniforms['u_jitter'], 5);
				// u_jitterScale == u_ditherScale
				gl.uniform1i(p.uniforms['u_shadowMap'], 6);
				gl.uniform2f(p.uniforms['u_viewDirOffset'],
					this.viewVec.offset.x, this.viewVec.offset.y);
				gl.uniform2f(p.uniforms['u_viewDirCoefX'],
					this.viewVec.coefX.x, this.viewVec.coefX.y);
				gl.uniform2f(p.uniforms['u_viewDirCoefY'],
					this.viewVec.coefY.x, this.viewVec.coefY.y);
			}
			{
				const p = this.ambientLightProgram;
				p.program.use();
				gl.uniform1i(p.uniforms['u_g0'], 0);
				gl.uniform1i(p.uniforms['u_g1'], 1);
				gl.uniform1i(p.uniforms['u_g2'], 2);
				gl.uniform1i(p.uniforms['u_dither'], 3);
				gl.uniform2f(p.uniforms['u_ditherScale'],
					this.outLit.width / jitter.size / 4,
					this.outLit.height / jitter.size / 4);
				gl.uniform1i(p.uniforms['u_linearDepth'], 4);
				gl.uniform1i(p.uniforms['u_ssao'], 5);
				gl.uniform2f(p.uniforms['u_viewDirOffset'],
					this.viewVec.offset.x, this.viewVec.offset.y);
				gl.uniform2f(p.uniforms['u_viewDirCoefX'],
					this.viewVec.coefX.x, this.viewVec.coefX.y);
				gl.uniform2f(p.uniforms['u_viewDirCoefY'],
					this.viewVec.coefY.x, this.viewVec.coefY.y);
			}
			
			// traverse scene
			this.renderTree(scene);
			
			// do ambient light
			{
				const t = this.totalAmbient;
				if (t.r > 0 || t.g > 0 || t.b > 0) {
					const p = this.ambientLightProgram;
					p.program.use();
					
					gl.activeTexture(gl.TEXTURE5);
					gl.bindTexture(gl.TEXTURE_2D, this.inSSAO.texture);
					
					gl.uniform3f(p.uniforms['u_lightColor'], t.r, t.g, t.b);
					
					const quad = this.parent.renderer.quadRenderer;
					gl.depthFunc(gl.GREATER);	
					quad.render(p.attributes['a_position']);
					gl.depthFunc(gl.LESS);
				}
			}
		}
		private prepareTree(obj: THREE.Object3D): void
		{
			if (obj instanceof THREE.Light) {
				this.prepareLight(obj);
			}
			
			for (const child of obj.children) {
				this.prepareTree(child);
			}
		}
		private prepareLight(light: THREE.Light): void
		{
			if (light instanceof THREE.DirectionalLight) {
				if (light.castShadow) {
					const camera: THREE.OrthographicCamera = light.shadowCamera = 
						<THREE.OrthographicCamera>light.shadowCamera 
						|| new THREE.OrthographicCamera(-1, 1, 1, -1);
					
					// decide shadow map axis direction
					const lightDir = tmpV3a.copy(light.position).normalize();
					const texU = tmpV3b;
					if (Math.abs(lightDir.z) > 0.5) {
						texU.set(1, 0, 0);
					} else {
						texU.set(0, 0, 1);
					}
					texU.cross(lightDir).normalize();
					const texV = tmpV3c.crossVectors(texU, lightDir).normalize();
					texU.crossVectors(texV, lightDir);
					
					// compute frustrum limit
					let minX = 0, maxX = 0, minY = 0, maxY = 0;
					let minZ = 0, maxZ = 0;
					for (let i = 0; i < 5; ++i) {
						const p = this.frustumCorners[i];
						const px = p.dot(texU);
						const py = p.dot(texV);
						const pz = p.dot(lightDir);
						
						if (i == 0) {
							minX = maxX = px;
							minY = maxY = py;
							minZ = maxZ = pz;
						} else {
							minX = Math.min(minX, px); maxX = Math.max(maxX, px);
							minY = Math.min(minY, py); maxY = Math.max(maxY, py);
							minZ = Math.min(minZ, pz); maxZ = Math.max(maxZ, pz);
						}
					}
					
					// extend near limit
					minZ -= light.shadowCameraNear; // FIXME: incorrect usage of shadowCameraNear
					
					// make matricies
					const midX = (minX + maxX) * 0.5;
					const midY = (minY + maxY) * 0.5;
					const camMat = camera.matrixWorldInverse;
					camMat.set(texU.x, texU.y, texU.z, -midX,
							   texV.x, texV.y, texV.z, -midY,
							   lightDir.x, lightDir.y, lightDir.z, 0,
							   0, 0, 0, 1);
					camera.matrixWorld.getInverse(camMat);
					camera.projectionMatrix.makeOrthographic(minX - midX, maxX - midX, maxY - midY, minY - midY, minZ, maxZ);
					
					const gen = this.inShadowMaps;
					gen.prepareShadowMap(light.shadowCamera, ShadowMapType.Normal);
				}
			}
			
			if (light instanceof THREE.PointLight) {
				if (light.castShadow) {
					let near = 0.1;
					
					if (light instanceof PointLight){
						near = light.shadowCameraNear;
					}
					
					const camera: THREE.CubeCamera = (<any>light).shadowCamera = 
						<THREE.CubeCamera>(<any>light).shadowCamera 
						|| new THREE.CubeCamera(near, light.distance, 1024); // FIXME: what about infinite distance point light?
					
					camera.position.copy(light.getWorldPosition(tmpV3a));
					camera.updateMatrixWorld(true);
					
					const gen = this.inShadowMaps;
					gen.prepareShadowMap((<any>light).shadowCamera, ShadowMapType.Normal);
				}
			}
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
				const hasShadowMap = light.castShadow;
				
				if (hasShadowMap && light.shadowCamera) {
					const gen = this.inShadowMaps;
					gen.renderShadowMap(light.shadowCamera, ShadowMapType.Normal);
					
					this.setState(); // ShadowMapRenderService might change the state
					gl.activeTexture(gl.TEXTURE6);
					gl.bindTexture(gl.TEXTURE_2D, gen.currentShadowMapDepth);
				}
				
				let flags = DirectionalLightProgramFlags.Default;
				if (hasShadowMap) {
					flags |= DirectionalLightProgramFlags.HasShadowMaps;
				}
				const p = this.directionalLightProgram[flags];
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
				
				if (hasShadowMap) {
					const gen = this.inShadowMaps;
					
					tmpM2.multiplyMatrices(light.shadowCamera.projectionMatrix,
						light.shadowCamera.matrixWorldInverse);
					tmpM.multiplyMatrices(tmpM2, this.parent.renderer.currentCamera.matrixWorld);
					tmpM2.makeScale(.5, .5, .5).multiply(tmpM);
					tmpM3.makeTranslation(.5, .5, .5).multiply(tmpM2);
					gl.uniformMatrix4fv(p.uniforms['u_shadowMapMatrix'], false, tmpM3.elements);
					
					gl.activeTexture(gl.TEXTURE5);
					gl.bindTexture(gl.TEXTURE_2D, this.parent.renderer.gaussianJitter.texture);
					
					gl.uniform2f(p.uniforms['u_jitterAmount'], 8 / gen.shadowMapWidth, 8 / gen.shadowMapHeight);
				}
				
				const quad = this.parent.renderer.quadRenderer;
				gl.depthFunc(gl.GREATER);
				quad.render(p.attributes['a_position']);
				gl.depthFunc(gl.LESS);
			}
			
			if (light instanceof THREE.PointLight) {
				let radius = light.distance;
				
				if (radius == 0) {
					radius = Infinity;
				}
				
				const isFullScreen = true; // TODO
				let hasShadowMap = light.castShadow;
				const shadowCamera: THREE.CubeCamera =
					(<any>light).shadowCamera;
				
				if (hasShadowMap && shadowCamera) {
					const gen = this.inShadowMaps;
					gen.renderShadowMap(shadowCamera, ShadowMapType.Normal);
					
					this.setState(); // ShadowMapRenderService might change the state
					gl.activeTexture(gl.TEXTURE6);
					gl.bindTexture(gl.TEXTURE_CUBE_MAP, gen.currentCubeShadowDistanceMap);
				} else {
					hasShadowMap = false;
				}
				
				const pos = light.getWorldPosition(tmpV3b);
				pos.applyMatrix4(this.viewMat);
				
				let flags = PointLightProgramFlags.Default;
				if (isFullScreen) {
					flags |= PointLightProgramFlags.IsFullScreen;
				}
				if (hasShadowMap) {
					flags |= PointLightProgramFlags.HasShadowMaps;
				}
				
				const p = this.pointLightProgram[flags];
				p.program.use();
				
				colorR *= light.intensity;
				colorG *= light.intensity;
				colorB *= light.intensity;
				
				// light shape
				if (light instanceof PointLight) {
					gl.uniform1f(p.uniforms['u_lightRadius'], light.radius);
					gl.uniform1f(p.uniforms['u_lightLength'], light.length * 0.5);
					gl.uniform1f(p.uniforms['u_invDistanceToJitter'], 1 / light.radius); // FIXME: maybe not correct
					if (light.length > 0) {
						// Z-axis oriented
						tmpV3a.set(0, 0, 1).transformDirection(light.matrixWorld).normalize();
						gl.uniform3f(p.uniforms['u_lightDir'], tmpV3a.x, tmpV3a.y, tmpV3a.z);
						tmpV3a.multiplyScalar(light.length * 0.5);
						pos.sub(tmpV3a);
					} else {
						gl.uniform3f(p.uniforms['u_lightDir'], 0, 0, 0);
					}
				} else {
					gl.uniform1f(p.uniforms['u_lightRadius'], 0);
					gl.uniform1f(p.uniforms['u_lightLength'], 0);
					gl.uniform3f(p.uniforms['u_lightDir'], 0, 0, 0);
					gl.uniform1f(p.uniforms['u_invDistanceToJitter'], 0);
				}
				
				gl.uniform3f(p.uniforms['u_lightPos'], pos.x, pos.y, pos.z);
				gl.uniform1f(p.uniforms['u_lightInfluenceRadius'], radius);
				gl.uniform1f(p.uniforms['u_lightInvInfluenceRadiusSquared'], 1 / (radius * radius));
				gl.uniform1f(p.uniforms['u_minimumDistance'], 0.1 * light.intensity); // FIXME
				
				gl.uniform3f(p.uniforms['u_lightColor'], colorR, colorG, colorB);
				
				if (hasShadowMap) {
					const gen = this.inShadowMaps;
					const scl = 1 / light.distance;
					
					tmpM2.getInverse(shadowCamera.matrixWorld);
					tmpM.multiplyMatrices(tmpM2, this.parent.renderer.currentCamera.matrixWorld);
					tmpM3.makeScale(scl, scl, scl).multiply(tmpM);
					gl.uniformMatrix4fv(p.uniforms['u_shadowMapMatrix'], false, tmpM3.elements);
					
					gl.activeTexture(gl.TEXTURE5);
					gl.bindTexture(gl.TEXTURE_2D, this.parent.renderer.gaussianJitter.texture);
					
					gl.uniform2f(p.uniforms['u_jitterAmount'], 
						16 / gen.cubeShadowDistanceMapSize, 16 / gen.cubeShadowDistanceMapSize);
				}
				
				gl.depthFunc(gl.GREATER);
				if (isFullScreen) {
					const quad = this.parent.renderer.quadRenderer;
					quad.render(p.attributes['a_position']);
				} else {
					// TODO: light geometry cull
				}
				gl.depthFunc(gl.LESS);
			}
			
			if (light instanceof THREE.SpotLight) {
				// TODO: spot light
			}
			
			if (light instanceof THREE.AmbientLight) {
				const t = this.totalAmbient;
				t.r += colorR;
				t.g += colorG;
				t.b += colorB;
			}
		}
		
		afterRender(): void
		{
			/*
			// debug: dump shadow maps
			const pt = this.parent.renderer.passthroughRenderer;
			const gl = this.parent.renderer.gl;
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, this.inShadowMaps.currentShadowMapDepth);
			
			this.parent.renderer.state.flags = 
				GLStateFlags.BlendEnabled;
			
			gl.blendFunc(gl.DST_COLOR, gl.ZERO);
			pt.render(); // */
		}
		dispose(): void
		{
			this.fb.dispose();
		}
	}
}
