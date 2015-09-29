/// <reference path="../Prefix.d.ts" />
/// <reference path="RendererCore.ts" />
/// <reference path="GLProgram.ts" />
/// <reference path="../utils/Utils.ts" />
module Hyper.Renderer
{
	
	export interface GlobalShaderUniformSubscriber
	{
		updateGlobalUniforms(): void;
	}
	
	export interface ShaderManager extends IDisposable
	{
		/** Read-only. */
		globalParameters: any;
		
		/** Sets the preprocessor constant value used by all shaders. Its name is prefixed by 'c_'. */
		setGlobalParameter(name: string, value: any): void;
		
		/** Sets the uniform value used by all shaders. Its name is prefixed by 'u_'. */
		setGlobalUniform(name: string, isFP: boolean, c1: number, c2?: number, c3?: number, c4?: number): void;
		
		subscribeGlobalUniforms(program: GLProgram): GlobalShaderUniformSubscriber;
		
		/** 
		 * Gets GLProgram for the specified combination of shaders.
		 * Do not dispose the returned GLProgram.
		 */
		get(vert: string, frag: string, attributes: string[], parameters?: any): GLProgram;
	}
	
	interface GlobalUniform
	{
		name: string;
		value: number[];
		isIntegral: boolean;
	}
	
	interface GlobalUniformMapping
	{
		index: WebGLUniformLocation;
		unif: GlobalUniform;
	}
	
	class GlobalShaderUniformSubscriberImpl
	{
		private lastGlobalUniformVersion: any;
		private lastGlobalUniformStructureVersion: any;
		private globalUniforms: GlobalUniformMapping[];
		
		constructor(private program: GLProgram, private manager: ShaderManagerImpl)
		{
			this.lastGlobalUniformStructureVersion = null;
			this.lastGlobalUniformVersion = null;
			this.globalUniforms = null;
		}
		
		updateGlobalUniforms(): void
		{
			const sm = this.manager;
			if (sm.globalUniformVersion === this.lastGlobalUniformVersion) {
				return;
			}
			this.lastGlobalUniformVersion = sm.globalUniformVersion;
			
			if (sm.globalUniformStructureVersion != this.lastGlobalUniformStructureVersion) {
				this.lastGlobalUniformStructureVersion = sm.globalUniformStructureVersion;
				const locs = this.program.getUniforms(sm.globalUniforms.map((u) => 'u_' + u.name));
				const mapping: GlobalUniformMapping[] = [];
				for (const unif of sm.globalUniforms) {
					let loc = locs['u_' + unif.name];
					if (loc != null) {
						mapping.push({
							index: loc,
							unif: unif
						});
					}
				}	
				this.globalUniforms = mapping;
			}
			
			const gl = this.manager.core.gl;
			for (const mapping of this.globalUniforms) {
				const value = mapping.unif.value;
				
				if (mapping.unif.isIntegral) {
					switch (value.length) {
						case 1:
							gl.uniform1i(mapping.index, value[0]);
							break;
						case 2:
							gl.uniform2i(mapping.index, value[0], value[1]);
							break;
						case 3:
							gl.uniform3i(mapping.index, value[0], value[1], value[2]);
							break;
						case 4:
							gl.uniform4i(mapping.index, value[0], value[1], value[2], value[3]);
							break;
						default:
							throw new Error();
					}
				} else {
					switch (value.length) {
						case 1:
							gl.uniform1f(mapping.index, value[0]);
							break;
						case 2:
							gl.uniform2f(mapping.index, value[0], value[1]);
							break;
						case 3:
							gl.uniform3f(mapping.index, value[0], value[1], value[2]);
							break;
						case 4:
							gl.uniform4f(mapping.index, value[0], value[1], value[2], value[3]);
							break;
						default:
							throw new Error();
					}
				}
			}
		}
	}
	
	export function createShaderManager(core: RendererCore): ShaderManager
	{
		return new ShaderManagerImpl(core);
	}
	
	class ShaderManagerImpl implements ShaderManager
	{
		private programs: ProgramTable;
		private frags: ShaderTable;
		private verts: ShaderTable;
		
		/** do not modify */
		globalParameters: any;
		
		/** do not modify */
		globalUniforms: GlobalUniform[];
		/** do not modify */
		globalUniformStructureVersion: {};
		/** do not modify */
		globalUniformVersion: {};
		/** do not modify */
		globalUniformMap: any;
		
		constructor(public core: RendererCore)
		{
			this.programs = {};
			this.frags = {};
			this.verts = {};
			this.globalParameters = {};
			this.globalUniforms = [];
			this.globalUniformStructureVersion = {};
			this.globalUniformVersion = {};
			this.globalUniformMap = [];
		}
		
		dispose(): void
		{
			
		}
		
		subscribeGlobalUniforms(program: GLProgram): GlobalShaderUniformSubscriber
		{
			return new GlobalShaderUniformSubscriberImpl(program, this);
		}
		
		setGlobalParameter(name: string, value: any): void
		{
			this.globalParameters[name] = value;
		}
		
		setGlobalUniform(name: string, isFP: boolean, c1: number, c2?: number, c3?: number, c4?: number): void
		{
			let index = this.globalUniformMap[name];
			let unif: GlobalUniform;
			if (index == null) {
				index = this.globalUniforms.length;
				this.globalUniformMap[name] = index;
				this.globalUniforms.push(unif = {
					name: name,
					value: [0],
					isIntegral: !isFP
				});
				this.globalUniformStructureVersion = {};
			}
			
			const arr = this.globalUniforms[index].value;
			arr[0] = c1;
			if (c2 != null) {
				arr[1] = c2;
				if (c3 != null) {
					arr[2] = c3;
					if (c4 != null) {
						arr[3] = c4;
					} else if (arr.length > 3) {
						arr.length = 3;
					}
				} else if (arr.length > 2) {
					arr.length = 2;
				}
			} else if (arr.length > 1) {
				arr.length = 1;
			}
			
			this.globalUniformVersion = {};
		}
		
		private getShader(table: ShaderTable, type: number, name: string, parameters: any): GLShader
		{
			let keyParts = [name];
			for (const key in parameters) {
				keyParts.push(key);
				keyParts.push(String(parameters[key]));
			}
			const key = keyParts.join('_');
			let sh = table[key];
			if (!sh) {
				const src = GLShader.preprocess(this.core, [{
					requires: [name],
					source: ""
				}], parameters, type);
				sh = GLShader.compile(this.core, type, src);
				table[key] = sh;
			}
			return sh;
		}
		
		/** Gets GLProgram for the specified combination of shaders.
		 * Do not dispose the returned GLProgram.
		 */
		get(vert: string, frag: string, attributes: string[], parameters?: any): GLProgram
		{
			let keyParts = [vert, '-', frag];
			for (const key in parameters) {
				keyParts.push(key);
				keyParts.push(String(parameters[key]));
			}
			const key = keyParts.join('_');
			
			const gl = this.core.gl;
			let prog = this.programs[key];
			if (!prog) {
				prog = GLProgram.link(this.core, [
					this.getShader(this.verts, gl.VERTEX_SHADER, vert, parameters),
					this.getShader(this.verts, gl.FRAGMENT_SHADER, frag, parameters)
				], attributes);
				
				this.programs[key] = prog;
			}
			return prog;
		}
	}
	
	interface ProgramTable
	{
		[key: string]: GLProgram;
	}
	
	interface ShaderTable
	{
		[key: string]: GLShader;
	}
}
