/// <reference path="../Prefix.d.ts" />
/// <reference path="RendererCore.ts" />
/// <reference path="GLProgram.ts" />
module Hyper.Renderer
{
	export interface GlobalUniform
	{
		name: string;
		value: any;
	}
	
	export class ShaderManager
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
		
		constructor(private core: RendererCore)
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
		
		/** Sets the preprocessor constant value used by all shaders. Its name is prefixed by 'c_'. */
		setGlobalParameter(name: string, value: any): void
		{
			this.globalParameters[name] = value;
		}
		
		/** Sets the uniform value used by all shaders. Its name is prefixed by 'u_'. */
		setGlobalUniform(name: string, value: any): void
		{
			if (value == null) {
				return;
			}
			let index = this.globalUniformMap[name];
			let unif: GlobalUniform;
			if (index == null) {
				index = this.globalUniforms.length;
				this.globalUniformMap[name] = index;
				this.globalUniforms.push(unif = {
					name: name,
					value: value
				});
				this.globalUniformStructureVersion = {};
			} else {
				this.globalUniforms[index].value = value;
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
