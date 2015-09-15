/// <reference path="Prefix.d.ts" />
/// <reference path="TextureManager.ts" />
/// <reference path="RenderBufferManager.ts" />
/// <reference path="RendererCore.ts" />
/// <reference path="Utils.ts" />
/// <reference path="GeometryManager.ts" />
/// <reference path="../Materials.ts" />
module Hyper.Renderer
{
	
	export class MaterialManager
	{
		private shaderTable: Utils.IntegerMap<Shader>;
		
		constructor(public core: RendererCore)
		{
			this.shaderTable = new Utils.IntegerMap<Shader>();
		}
		
		
		/** Overridable. */
		createShader(material: Material): Shader
		{
			return new Shader(this, material);
		}
		
		get(mat: THREE.Material): ShaderInstance
		{
			const id = mat.id;
			let matInst = importThreeJsMaterial(mat);
			let sh = this.shaderTable.get(matInst.material.id);
			if (!sh) {
				sh = this.createShader(matInst.material);
				
				sh.addEventListener('disposed', () => {
					this.shaderTable.remove(id);
				});
				
				this.shaderTable.set(id, sh);
			}
			
			return sh.getInstance(matInst);
		}
		
		dispose(): void
		{
			this.shaderTable.forEach((id, sh) => {
				sh.dispose();
			});
		}
		
	}
	
	export class Shader extends THREE.EventDispatcher
	{
		// linked list of ShaderInstance.
		// when this becomes empty, Shader is disposed.
		// (however, when Shader is created, the list is empty.)
		private insts: Utils.IntegerMap<ShaderInstance>;
		parameterTextureStages: string[];
		
		private geometryBindings: Utils.IdWeakMapWithDisposable<Geometry, ShaderGeometryBindings>;
		
		constructor(public manager: MaterialManager, public source: Material)
		{
			super();
			
			this.insts = new Utils.IntegerMap<ShaderInstance>();
			this.parameterUniformSetter_ = null;
			this.parameterTextureStages = [];
			
			const params = source.parameters;
			for (var name in params) {
				var param = params[name];
				if (param.type == MaterialParameterType.Texture2D) {
					this.parameterTextureStages.push(name);
				}
			}
			
			this.geometryBindings = new Utils.IdWeakMapWithDisposable<Geometry, ShaderGeometryBindings>();
			
		}
		dispose(): void
		{
			if (!this.insts.isEmpty) {
				this.insts.forEach((id, shInst) => {
					this.deleteInstance(id);
				});
				
				// (dispose will be called internally)
				return;
			}
			this.dispatchEvent({ type: 'disposed', target: undefined });
		}
		
		get glProgram(): GLProgram
		{
			throw new Error("must be overriden");
		}
		
		getGeometryBinding(geo: Geometry): ShaderGeometryBindings
		{
			const id = geo.source.id;
			
			let gb = this.geometryBindings.get(geo);
			if (gb == null) {
				gb = new ShaderGeometryBindings(this, geo);
				this.geometryBindings.set(geo, gb);
			}
			
			return gb;
		}
		
		getVertexAttributesUsedInShader(standardAttributes: string[], includeStandardAttributes: boolean): string[]
		{
			const attrs: string[] = [];
			const attrsIncluded: any = {};
			for (const attr of standardAttributes) {
				const actualName = 'a_' + attr;
				if (!attrsIncluded[actualName]) {
					if (includeStandardAttributes)
						attrs.push(actualName);
					attrsIncluded[actualName] = true;
				}
			}
			for (const attr of this.source.requiredVertexAttributes) {
				const actualName = 'a_' + attr;
				if (!attrsIncluded[actualName]) {
					attrs.push(actualName);
					attrsIncluded[actualName] = true;
				}
			}
			return attrs;
		}
		
		private parameterUniformSetter_: (matInst: MaterialInstance) => void;
		get parameterUniformSetter(): (matInst: MaterialInstance) => void
		{
			if (!this.parameterUniformSetter_) {
				const unifNames: string[] = [];
				const gl = this.manager.core.gl;
				const params = this.source.parameters;
				for (var name in params) {
					unifNames.push('p_' + name);
				}
				
				const texStages = this.parameterTextureStages;
				const unifMap = this.glProgram.getUniforms(unifNames);
				const parts: string[] = [];
				parts.push("(function (s, gl, tm) { return function (matInst) {");
				parts.push("var params = matInst.parameters;");
				let i = 0;
				for (var name in params) {
					var param = params[name];
					var unifName = 'p_' + name;
					// FIXME: possible XSS or something
					const v = `value${++i}`;
					parts.push(`var ${v} = params['${name}'];`);
					switch (param.type) {
						case MaterialParameterType.Float:
							parts.push(`gl.uniform1f(s.${unifName}, ${v});`);
							break;
						case MaterialParameterType.Float2:
							parts.push(`gl.uniform2f(s.${unifName}, ${v}[0], ${v}[1]);`);
							break;
						case MaterialParameterType.Float3:
							parts.push(`gl.uniform3f(s.${unifName}, ${v}[0], ${v}[1], ${v}[2]);`);
							break;
						case MaterialParameterType.Float4:
							parts.push(`gl.uniform4f(s.${unifName}, ${v}[0], ${v}[1], ${v}[2], ${v}[3]);`);
							break;
						case MaterialParameterType.Texture2D:
							const texStage = texStages.indexOf(name);
							parts.push(`gl.uniform1i(s.${unifName}, ${texStage});`);
							parts.push(`gl.activeTexture(gl.TEXTURE0 + ${texStage});`);
							parts.push(`tm.get(${v}).bind();`);
							break;
						default:
							throw new Error();
					}
				}
				// parts.push(`gl.activeTexture(0);`);
				parts.push("}; })");
				
				return this.parameterUniformSetter_ = 
					eval(parts.join('\n'))(unifMap, gl, this.manager.core.textures);
			}
			return this.parameterUniformSetter_;
		}
		
		getInstance(mat: MaterialInstance): ShaderInstance
		{
			let item = this.insts.get(mat.id);
			if (!item) {
				return this.insts.set(mat.id, new ShaderInstance(this, mat));
			}
			return item;
		}
		
		deleteInstance(id: number)
		{
			let inst = this.insts.get(id);
			if (inst) {
				inst.dispose();
				this.insts.remove(id);
			}
			
			if (this.insts.isEmpty) {
				this.dispose();
			}
		}
	}
	
	export class ShaderInstance
	{
		private disposeHandler: () => void;
		
		constructor(public shader: Shader, private source: MaterialInstance)
		{
			source.addEventListener('disposed', this.disposeHandler = () => {
				shader.deleteInstance(source.id);
			});
		}
		
		updateParameterUniforms(): void
		{
			this.shader.parameterUniformSetter(this.source);
		}
		
		dispose(): void
		{
			
		}
	}
	
	export class ShaderGeometryBindings
	{
		private bindings: ShaderGeometryBinding[];
		private vertexAttribMap: Utils.BitArray;
		
		constructor(private shader: Shader, geo: Geometry)
		{
			const geoAttrs = geo.attributes;
			const attrMap = shader.glProgram.getAttributes(geoAttrs.map((attr) => 'a_' + attr.name));
			this.bindings = [];
			this.vertexAttribMap = new Utils.BitArray();
			for (let i = 0; i < geoAttrs.length; ++i) {
				const geoAttr = geoAttrs[i];
				if (attrMap['a_' + geoAttr.name] != null) {
					this.bindings.push({
						index: attrMap['a_' + geoAttr.name],
						attr: geoAttr
					});
					this.vertexAttribMap.toggleOne(attrMap['a_' + geoAttr.name], true);
				}
			}
			
			if (this.bindings.length == 0) {
				throw new Error();
			}
		}
		
		setupVertexAttribs(): void
		{
			const core = this.shader.manager.core;
			const gl = core.gl;
			core.vertexAttribs.toggleAllWithArray(this.vertexAttribMap);
			
			const bindings = this.bindings;
			for (const bind of bindings) {
				bind.attr.setupVertexAttrib(bind.index);
			}
		}
		
		dispose(): void
		{
		}
	}
	
	interface ShaderGeometryBinding
	{
		index: number;
		attr: GeometryAttribute;
	}
	
	interface MaterialMap
	{
		[key: number]: Material;
	}
	const standardMaterials: MaterialMap = [];
	
	export interface StandardMaterialAttributes
	{
		hasMap: boolean;
		hasNormalMap: boolean;
		hasSpecularMap: boolean;
		hasAlphaMap: boolean;
	}
	
	function getStandardMaterial(attrs: StandardMaterialAttributes): Material
	{
		let key = 0;
		if (attrs.hasMap) 			key |= 1;
		if (attrs.hasNormalMap) 	key |= 1 << 1;
		if (attrs.hasSpecularMap) 	key |= 1 << 2;
		if (attrs.hasAlphaMap) 		key |= 1 << 3;
		
		let mat = standardMaterials[key];
		if (!mat) {
			const parts: string[] = [];
			const vertAttrs: string[] = [];
			const params: MaterialParameters = {
				color: {
					type: MaterialParameterType.Float3,
					default: [1, 1, 1]
				},
				emissive: {
					type: MaterialParameterType.Float3,
					default: [1, 1, 1]
				},
				specular: {
					type: MaterialParameterType.Float,
					default: [1]
				},
				metal: {
					type: MaterialParameterType.Float,
					default: [0]	
				},
				roughness: {
					type: MaterialParameterType.Float,
					default: [0.5]
				}
			};
			
			if (attrs.hasAlphaMap) {
				params['alphaMap'] = {
					type: MaterialParameterType.Texture2D	
				};
				parts.push(`float alphaMap = texture2D(p_alphaMap, v_uv).y;`);
				parts.push(`if (alphaMap < 0.5) discard;`); // FIXME: hoge
			}
			
			parts.push(`m_albedo = p_color;`);
			parts.push(`m_roughness = p_roughness;`);
			parts.push(`m_metallic = p_metal;`);
			parts.push(`m_specular = p_specular;`);
			parts.push(`m_emissive = p_emissive;`);
			if (attrs.hasMap) {
				params['map'] = {
					type: MaterialParameterType.Texture2D	
				};
				parts.push(`m_albedo *= texture2D(p_map, v_uv);`);
			}
			if (attrs.hasNormalMap) {
				params['normalMap'] = {
					type: MaterialParameterType.Texture2D	
				};
				parts.push(`m_normal = texture2D(p_normalMap, v_uv).xyz;`);
			}
			if (attrs.hasSpecularMap) {
				params['specularMap'] = {
					type: MaterialParameterType.Texture2D	
				};
				parts.push(`float specularMap = texture2D(p_specularMap, v_uv).y;`);
				parts.push(`m_roughness = mix(1., m_roughness, specularMap);`);
			}
			
			if (attrs.hasAlphaMap || attrs.hasMap ||
				attrs.hasNormalMap || attrs.hasSpecularMap) {
				vertAttrs.push('uv');
			}
			
			mat = new Material({
				shadingModel: MaterialShadingModel.Opaque,
				shader: parts.join('\n'),
				parameters: params,
				requiredVertexAttributes: vertAttrs
			});
			
			standardMaterials[key] = mat;
		}
		return mat;
	}
	
	export function getUniformDeclarationsForMaterial(mat: Material): string
	{
		const parts: string[] = [];
		
		for (const name in mat.parameters) {
			const param = mat.parameters[name];
			
			// FIXME: precision
			switch (param.type) {
				case MaterialParameterType.Float:
					parts.push(`uniform float p_${name};`);
					break;
				case MaterialParameterType.Float2:
					parts.push(`uniform vec2 p_${name};`);
					break;
				case MaterialParameterType.Float3:
					parts.push(`uniform vec3 p_${name};`);
					break;
				case MaterialParameterType.Float4:
					parts.push(`uniform vec4 p_${name};`);
					break;
				case MaterialParameterType.Texture2D:
					parts.push(`uniform sampler2D p_${name};`);
					break;
			}
		}
		
		return parts.join('\n');
	}
	
	class ImportedMaterialInstance extends MaterialInstance
	{
		private disposeHandler: () => void;
		
		constructor(mat: Material, private source: THREE.Material)
		{
			super(mat);
			
			source.addEventListener('disposed', this.disposeHandler = () => this.onSourceDisposed());
		}
		
		onSourceDisposed(): void
		{
			this.dispose();
		}
		
		dispose(): void
		{
			this.source.removeEventListener('disposed', this.disposeHandler);
			this.source = null;
			MaterialInstance.prototype.dispose.call(this);
		}
	}
	
	const importedMaterialsCache = new Utils.IntegerMap<MaterialInstance>();
	
	function importThreeJsMaterial(mat: THREE.Material): MaterialInstance
	{
		if (importedMaterialsCache.get(mat.id)) {
			return importedMaterialsCache.get(mat.id);
		}
		
		if (mat instanceof THREE.MeshPhongMaterial) {
			const hMat = getStandardMaterial({
				hasMap: mat.map != null,
				hasAlphaMap: mat.alphaMap != null,
				hasNormalMap: mat.normalMap != null,
				hasSpecularMap: mat.specularMap != null
			});
			
			const inst = new ImportedMaterialInstance(hMat, mat);
			inst.parameters['color'] = [mat.color.r, mat.color.g, mat.color.b];
			inst.parameters['emissive'] = [mat.emissive.r, mat.emissive.g, mat.emissive.b];
			inst.parameters['specular'] = Math.max(mat.specular.r, mat.specular.g, mat.specular.b);
			inst.parameters['metal'] = mat.metal ? 1 : 0;
			inst.parameters['roughness'] = 1 / (mat.shininess + 1);
			if (mat.map) {
				inst.parameters['map'] = mat.map;
			}
			if (mat.alphaMap) {
				inst.parameters['alphaMap'] = mat.alphaMap;
			}
			if (mat.normalMap) {
				inst.parameters['normalMap'] = mat.normalMap;
			}
			if (mat.specularMap) {
				inst.parameters['specularMap'] = mat.specularMap;
			}
			
			importedMaterialsCache.set(mat.id, inst);
			
			inst.addEventListener('disposed', () => {
				importedMaterialsCache.remove(mat.id);
			});
			
			return inst;
		} else if (mat instanceof MaterialInstance) {
			return mat;
		} else {
			throw new Error(`
＿人人人人人人人人人人人人人人人人人人人人人人人人＿
＞splatted by an unknown type of material!＜
￣Y^Y^Y^Y^Y^Y^Y^Y^Y^Y^Y^Y^Y^Y^Y^Y^Y^Y^Y^Y^￣

　　⊂⊃
　　⏜
　／　＼
 ) X X (
  ധധധ
　 　㇎
　　　㇉
`);
		}
	}
}
