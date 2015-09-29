/// <reference path="../Prefix.d.ts" />
/// <reference path="../utils/Utils.ts" />
/// <reference path="RendererCore.ts" />
/// <reference path="../utils/Map.ts" />
module Hyper.Renderer
{
	
	export interface RenderOperation
	{
		name: string;
		
		factory: (cfg: RenderOperationConfiguration) => RenderOperator;
		
		/** input buffers; must be distinct from each other and outputs. */
		inputs: RenderBufferInfos;
		
		/** output buffers; must be distinct from each other and inputs.
		 */
		outputs: RenderBufferInfos;
		
		/** use when some buffers in `inputs` can be the same as ones in `outputs`, 
		 * for example, by the use of ROP blending.
		 * [0, 0, 1, 2] means B(inputs[0]) == B(outputs[1]), B(inputs[0] == outputs[2]).
		 * for each pair [a, b], 
		 *   * 0 <= a < inputs.length
		 *   * 0 <= b < outputs.length
		 * for each pair of pairs [a, b], [c, d],
		 *   * a != c
		 *   * b != d
		 */
		bindings?: string[];
		
		optionalOutputs?: string[];
	}
	
	export interface RenderBufferInfos
	{
		[key: string]: RenderBufferInfo;
	}
	export interface RenderBuffers
	{
		[key: string]: RenderBuffer;
	}
	
	export interface RenderOperationConfiguration
	{
		inputs: RenderBuffers;
		outputs: RenderBuffers;
	}
	
	export function preprocessRenderOperations(ops: RenderOperation[]): RenderOperationRaw[]
	{
		return ops.map((op) => {
			const inKeys: string[] = [];
			const outKeys: string[] = [];
			for (const key in op.inputs) {
				if (op.inputs[key] == null) {
					continue;
				}
				inKeys.push(key);
			}
			for (const key in op.outputs) {
				if (op.outputs[key] == null) {
					continue;
				}
				outKeys.push(key);
			}
			
			const bindings: number[] = [];
			if (op.bindings) {
				for (let i = 0; i < op.bindings.length; i += 2) {
					bindings.push(inKeys.indexOf(op.bindings[i]));
					bindings.push(outKeys.indexOf(op.bindings[i + 1]));
				}
			}
			
			return {
				name: op.name,
				factory: (cfgraw: RenderOperationConfigurationRaw) => {
					const cfg: RenderOperationConfiguration = {
						inputs: {},
						outputs: {}	
					};
					for (let i = 0; i < inKeys.length; ++i) {
						cfg.inputs[inKeys[i]] = cfgraw.inputs[i];
					}
					for (let i = 0; i < outKeys.length; ++i) {
						cfg.outputs[outKeys[i]] = cfgraw.outputs[i];
					}
					if (!op.factory)
						return null;
					return op.factory(cfg);
				},
				inputs: inKeys.map((key) => op.inputs[key]),
				outputs: outKeys.map((key) => op.outputs[key]),
				bindings: bindings,
				optionalOutputs: op.optionalOutputs ?
					op.optionalOutputs.map((name) => outKeys.indexOf(name)) : []
			};
		});
	}
	
	interface RenderOperationRaw
	{
		name: string;
		
		factory: (cfg: RenderOperationConfigurationRaw) => RenderOperator;
		
		/** input buffers; must be distinct from each other and outputs. */
		inputs: RenderBufferInfo[];
		
		/** output buffers; must be distinct from each other and inputs.
		 */
		outputs: RenderBufferInfo[];
		
		/** use when some buffers in `inputs` can be the same as ones in `outputs`, 
		 * for example, by the use of ROP blending.
		 * [0, 0, 1, 2] means B(inputs[0]) == B(outputs[1]), B(inputs[0] == outputs[2]).
		 * for each pair [a, b], 
		 *   * 0 <= a < inputs.length
		 *   * 0 <= b < outputs.length
		 * for each pair of pairs [a, b], [c, d],
		 *   * a != c
		 *   * b != d
		 */
		bindings: number[];
		
		optionalOutputs: number[];
	}
	
	interface RenderOperationConfigurationRaw
	{
		inputs: RenderBuffer[];
		outputs: RenderBuffer[];
	}
	
	export interface RenderOperator extends IDisposable
	{
		beforeRender(): void;
		perform(): void;
		afterRender(): void;
	}
	
	/** Information needed to realize RenderBuffer.
	 * Two equvalence relations are defined:
	 *   * refrence equality.
	 *   * "mergability" equality.
	 */
	export class RenderBufferInfo
	{
		constructor(private name_: string)
		{
			this.num = 0;
			this.hash = 0;
			this.cost = 0;
		}
		// at least canMergeWith(this) must be true
		canMergeWith(o: RenderBufferInfo): boolean
		{
			return this == o;
		}
		create(manager: RenderPipeline): RenderBuffer
		{
			throw new Error("not implemented");
		}
		toString(): string
		{
			throw new Error("not implemented");
		}
		
		// TODO: refactor these and toString
		get name(): string
		{
			return this.name_ + ": " + this.toString();
		}
		set name(newName: string)
		{
			this.name_ = newName;
		}
		
		// initialize these values in the derived class constructor. 
		// do not modify these values after instantiation.
		hash: number;
		cost: number;
		
		// do not touch.
		num: number;
	}
	
	
	// Realized render buffers.
	export interface RenderBuffer extends IDisposable
	{
	}
	
	/** Map whose equivalence is defined with `RenderBufferInfo#canMergeWith`. */
	class RenderBufferInfoMap<T> extends Map<RenderBufferInfo, T>
	{
		computeHash(key: RenderBufferInfo): number
		{
			return key.hash;
		}
		
		equals(key1: RenderBufferInfo, key2: RenderBufferInfo): boolean
		{
			return key1.canMergeWith(key2);
		}
	}
	
	interface RenderBufferAllocation
	{
		info: RenderBufferInfo;
		index: number;
		
		// used in RenderBufferAllocationMap
		next: RenderBufferAllocation;
	}
	
	class RenderBufferAllocationEstimationMap
	{
		maxNumAllocated: number;
		numAllocated: number;
		constructor()
		{
			this.maxNumAllocated = 0;
			this.numAllocated = 0;
		}
		get(): void
		{
			this.numAllocated += 1;
			this.maxNumAllocated = Math.max(this.maxNumAllocated, this.numAllocated);
		}
		release(): void
		{
			this.numAllocated -= 1;
		}
	}
	class RenderBufferAllocationMap
	{
		maxNumAllocated: number;
		numAllocated: number;
		private firstFree: RenderBufferAllocation;
		
		constructor(public info: RenderBufferInfo)
		{
			this.maxNumAllocated = 0;
			this.numAllocated = 0;
			this.firstFree = null;
		}
		
		get(): RenderBufferAllocation
		{
			this.numAllocated += 1;
			if (this.firstFree == null) {
				const index = this.maxNumAllocated++;
				return {
					info: this.info,
					index: index,
					next: null
				};
			} else {
				const t = this.firstFree;
				this.firstFree = t.next;
				return t;
			}
		}
		
		release(allocation: RenderBufferAllocation): void
		{
			allocation.next = this.firstFree;
			this.firstFree = allocation;
			this.numAllocated -= 1;
			if (this.numAllocated < 0)
				throw new Error();
		}
	}
	class RenderBufferInfoAllocationEstimationMap extends RenderBufferInfoMap<RenderBufferAllocationEstimationMap>
	{
		getOrCreate(key: RenderBufferInfo): RenderBufferAllocationEstimationMap
		{
			let ret = this.get(key);
			if (ret == null) {
				ret = new RenderBufferAllocationEstimationMap();
				this.set(key, ret);
			}
			return ret;
		}
	}
	class RenderBufferInfoAllocationMap extends RenderBufferInfoMap<RenderBufferAllocationMap>
	{
		getOrCreate(key: RenderBufferInfo): RenderBufferAllocationMap
		{
			let ret = this.get(key);
			if (ret == null) {
				ret = new RenderBufferAllocationMap(key);
				this.set(key, ret);
			}
			return ret;
		}
	}
	
	interface RenderBufferBinding
	{
		info: RenderBufferInfo;
		allocated: RenderBufferAllocation;
	}
	
	interface RenderBufferBindingWithWritability
	{
		binding: RenderBufferBinding;
		
		useCount: number;
	}
	
	interface RenderPhase
	{
		operation: RenderOperationRaw;
		inputs: RenderBufferAllocation[];
		outputs: RenderBufferAllocation[];
	}
	interface RealizedRenderBufferGroup
	{
		renderBuffers: RenderBuffer[];
	}
	
	export function dumpRenderOperationAsDot(raw: RenderOperation[]): string
	{
		// alloc variable index
		let addedInfos: boolean[] = [];
		let infos: RenderBufferInfo[] = [];
		{
			let index = 0;
		
			for (const op of raw) {
				for (const info in op.inputs) {
					if (!op.inputs[info]) continue;
					op.inputs[info].num = index++;
				}
				for (const info in op.outputs) {
					if (!op.outputs[info]) continue;
					op.outputs[info].num = index++;
				}
			}
			for (const op of raw) {
				for (const info in op.inputs) {
					if (!op.inputs[info]) continue;
					const num = op.inputs[info].num;
					if (!addedInfos[num]) {
						addedInfos[num] = true;
						infos.push(op.inputs[info]);
					}
				}
				for (const info in op.outputs) {
					if (!op.outputs[info]) continue;
					const num = op.outputs[info].num;
					if (!addedInfos[num]) {
						addedInfos[num] = true;
						infos.push(op.outputs[info]);
					}
				}
			}
		}
		
		const parts: string[] = [];
		parts.push("digraph G {");
		parts.push(`rankdir="TB";\n`);
		parts.push("node [shape=none];\n");
		
		
		let nextID = 1;
		function getID(obj: any)
		{
			if (!obj.id) {
				obj.id = nextID++;
				
			}
			return "n-" + obj.id;
		}
		
		function writeRBI(rb: RenderBufferInfo)
		{
			parts.push(`"${getID(rb)}" [ label="${rb.name}", shape=none ];\n`);
		}
		
		// make sure all render buffer info is assigned a ID
		for (const info of infos) {
			getID(info);
			writeRBI(info);
		}
		
		for (const op of raw) {
			const id = getID(op);
			parts.push(`"${id}" [ label=<<table border="1" cellborder="0" cellpadding="3" bgcolor="white">`);
			const inputs: string[] = [];
			const outputs: string[] = [];
			
			for (const key in op.inputs) {
				inputs.push(key);
			}
			for (const key in op.outputs) {
				outputs.push(key);
			}
			const rows = Math.max(inputs.length, outputs.length);
			parts.push(`<TR><TD bgcolor="black" align="center" colspan="2"><font color="white">`);
			parts.push(`${op.name}</font></TD></TR>`);
			for (let i = 0; i < rows; ++i) {
				parts.push(`<tr>`);
				if (i < inputs.length) {
					parts.push(`<td align="left" port="in-${inputs[i]}">${inputs[i]}</td>`);
				} else {
					parts.push(`<td align="left"></td>`);
				}
				if (i < outputs.length) {
					parts.push(`<td align="right" port="out-${outputs[i]}">${outputs[i]}</td>`);
				} else {
					parts.push(`<td align="right"></td>`);
				}
				parts.push(`</tr>`);
			}
			parts.push(`</table>>];\n`);
			
			for (const key of inputs) {
				const conn = op.inputs[key];
				if (!conn) continue;
				parts.push(`"${getID(conn)}" -> "${id}":"in-${key}";\n`);
			}
			for (const key of outputs) {
				const conn = op.outputs[key];
				if (!conn) continue;
				parts.push(`"${id}":"out-${key}" -> "${getID(conn)}";\n`);
			}
		}
		parts.push("}");
		
		return parts.join('');
	}
	
	export class RenderPipeline
	{
		private renderBuffers: RenderBufferInfoMap<RealizedRenderBufferGroup>;
		private phases: RenderPhase[];
		private operators: RenderOperator[];
		
		outputBuffers: RenderBuffer[];
		
		constructor(public core: RendererCore)
		{
			this.renderBuffers = new RenderBufferInfoMap<RealizedRenderBufferGroup>();
			this.phases = [];
			this.operators = [];
			this.outputBuffers = [];
		}
		
		dispose(): void
		{
			this.clearPipeline();
			this.releaseAll();
		}
		
		setup(preprocOpsRaw: RenderOperation[], output: RenderBufferInfo[]): void
		{
			const preprocOps = preprocessRenderOperations(preprocOpsRaw);
			
			this.clearPipeline();
			
			// alloc variable index
			{
				let index = 0;
				for (const op of preprocOps) {
					for (const info of op.inputs) {
						info.num = index++;
					}
					for (const info of op.outputs) {
						info.num = index++;
					}
				}
			}
			// scan actually used render operation
			let ops: RenderOperationRaw[] = [];
			{
				let needed: RenderBufferInfo[] = [];
				let neededMap: RenderBufferInfo[] = [];
				for (const info of output) {
					needed.push(info);
					neededMap[info.num] = info;
				}
				while (needed.length > 0) {
					const newNeededMap: RenderBufferInfo[] = [];
					let couldExecute = false;
					
					for (const info of needed) {
						newNeededMap[info.num] = info;
					}
					
					for (let i = 0; i < preprocOps.length; ++i) {
						const op = preprocOps[i];
						let required = false;
						for (const outInfo of op.outputs) {
							if (neededMap[outInfo.num]) {
								required = true;
							}
						}
						
						// execute this operator
						if (required) {
							if (ops.indexOf(op) < 0) // FIXME: slow O(n^2)
								ops.push(op);
							for (const outInfo of op.outputs) {
								newNeededMap[outInfo.num] = null;
							}
							for (const inInfo of op.inputs) {
								if (!newNeededMap[inInfo.num]) {
									newNeededMap[inInfo.num] = inInfo;
								}
							}
							couldExecute = true;
						}
					}
					if (!couldExecute) {
						throw new Error(`no driver for one of "${needed.map((n)=>n.name).join(', ')}"`);
					}
					neededMap = newNeededMap;
					
					const newNeeded: RenderBufferInfo[] = [];
					for (const key in newNeededMap) {
						if (newNeededMap[key])
							newNeeded.push(newNeededMap[key]);
					}
					needed = newNeeded;
				}
			}
			
			// use heuristics greedy algorithm to schedule the rendering operation
			const allocMap = new RenderBufferInfoAllocationMap();
			const allocEstimationMap = new RenderBufferInfoAllocationEstimationMap();
			const needed: RenderBufferBindingWithWritability[] = [];
			const phases: RenderPhase[] = [];
			const outputAllocation: RenderBufferBinding[] = [];
			const remainingOps = ops.slice(0);
			const maxUseCount: number[] = []; // max useCount for each RenderBuffer
			
			// compute maxUseCount
			{
				let index = 0;
				for (const op of ops) {
					for (const info of op.inputs) {
						maxUseCount[info.num] = (maxUseCount[info.num] || 0) + 1;
					}
				}
			}
			
			// outputs
			for (const info of output) {
				const alloc = {
					info: info,
					allocated: allocMap.getOrCreate(info).get()
				};
				needed.push({
					binding: alloc,
					useCount: 1
				});
				outputAllocation.push(alloc);
				maxUseCount[info.num] = (maxUseCount[info.num] || 0) + 1;
			}
			
			// add rendering phase from last to first until no intermedate buffer is missing.
			// this loop will terminate at some point iff ops is acyclic.
			let iii = 1000;
			while (needed.length > 0) {
					if ((--iii) == 0)
						throw new Error("bad");
				let bestIndex = -1, bestCost = -1;
				for (let i = 0; i < remainingOps.length; ++i) {
					const op = remainingOps[i];
					
					// does executing this operation computes some of needed variable?
					let fail = false;
					for (const output of op.outputs) {
						if (!maxUseCount[output.num]) {
							// output is simply discarded
							continue;
						}
						
						let used = false;
						for (const neededOne of needed) {
							if (maxUseCount[neededOne.binding.info.num] != neededOne.useCount) {
								// some other operation which have not been found needs this value.
								// that is; we are computing this too late.
								continue;
							}
							if (neededOne.binding.info === output) {
								used = true;
								break;
							}
						}
						
						if (!used) {
							fail = true;
							break;
						}
					}
					
					if (fail) {
						continue;
					}
					
					// this op is executable.
					// estimate the cost.
					let cost = 0;
					const capacityCostWeight = 5; // heuristics
					const countCostWeight = 1;
					let willbeAddedToNeeded: boolean[] = [];
					
					for (let j = 0; j < op.inputs.length; ++j) {
						const info = op.inputs[j];
						const actualAllocation = allocMap.getOrCreate(info);
						const estimatedAllocation = allocEstimationMap.getOrCreate(info);
						estimatedAllocation.numAllocated = actualAllocation.numAllocated;
						estimatedAllocation.maxNumAllocated = actualAllocation.maxNumAllocated;
					}
					for (let j = 0; j < op.inputs.length; ++j) {
						const input = op.inputs[j];
						
						// is bound to output?
						let bound = -1;
						for (let k = 0; k < op.bindings.length; k += 2) {
							if (op.bindings[k] == j) {
								if (bound != -1) {
									throw new Error(`operation "%s" has invalid bindings`);
								}
								bound = op.bindings[k + 1];
							}
						}
						
						if (bound >= 0) {
							// if the buffer is not used for other things,
							// the operation can be done in-place.
							for (const binding of needed) {
								if (binding.binding.info == input) {
									// out-place
									bound = -1;
									break;
								}
							}
						}
						
						if (bound < 0) {
							// not bound to output; need to allocate input buffer
							let found = false;
							for (const e of needed) {
								if (e.binding.info == input) {
									found = true;
								}
							}
							if (!found && !willbeAddedToNeeded[input.num]) {
								const estimatedAllocation = allocEstimationMap.getOrCreate(input);
								const oldMaxNumAlloc = estimatedAllocation.maxNumAllocated;
								estimatedAllocation.get();
								cost += input.cost * (estimatedAllocation.maxNumAllocated - oldMaxNumAlloc) * capacityCostWeight;
								cost += input.cost * countCostWeight;
								willbeAddedToNeeded[input.num] = true;
							}
						}
						
					}
					
					// deallocate output buffers
					for (let j = 0; j < op.outputs.length; ++j) {
						const output = op.outputs[j];
						
						// is bound to input?
						let bound = -1;
						for (let k = 0; k < op.bindings.length; k += 2) {
							if (op.bindings[k + 1] == j) {
								if (bound != -1) {
									throw new Error(`operation "%s" has invalid bindings`);
								}
								bound = op.bindings[k];
							}
						}
						
						if (bound >= 0) {
							// if the buffer is not used for other things,
							// the operation can be done in-place.
							for (const binding of needed) {
								if (binding.binding.info == op.inputs[bound]) {
									// out-place
									bound = -1;
									break;
								}
							}
						}
						
						if (bound < 0) {
							// not bound to input; need to deallocate input buffer?
							const estimatedAllocation = allocEstimationMap.getOrCreate(output);
							const oldMaxNumAlloc = estimatedAllocation.maxNumAllocated;
							estimatedAllocation.release();
							cost += output.cost * (estimatedAllocation.maxNumAllocated - oldMaxNumAlloc) * capacityCostWeight;
							cost -= countCostWeight;
						}
					}
					
					if (bestIndex == -1 || cost < bestCost) {
						bestIndex = i;
						bestCost = cost;
					}
				} 
				
				// now best operation should be found
				if (bestIndex == -1) {
					throw new Error(`unrealizable dependency graph; remaining needed variables = ${
						needed.map((n) => n.binding.info.name).join(', ')
					}`);
				}
				
				{
					const op = remainingOps[bestIndex];
					remainingOps.splice(bestIndex, 1);
					
					const phase: RenderPhase = {
						operation: op,
						inputs: [],
						outputs: []
					};
					
					// bind outputs
					for (let k = 0; k < op.outputs.length; ++k) {
						const output = op.outputs[k];
						if (!maxUseCount[output.num]) {
							// optional?
							if (op.optionalOutputs.indexOf(k) >= 0) {
								// output is simply discarded
								phase.outputs.push(null);
							} else {
								// needs temporary buffer
								// FIXME: what if this is bound to input...?
								const alloc = allocMap.getOrCreate(output).get();
								phase.outputs.push(alloc);
							}
							continue;
						}
						
						// (at most one element should match...)
						// and delete from "needed"
						let match = false;
						for (let j = needed.length - 1; j >= 0; --j) {
							if (needed[j].binding.info == output) {
								if (needed[j].useCount != maxUseCount[output.num]) {
									throw new Error();
								}
								phase.outputs.push(needed[j].binding.allocated);
								needed.splice(j, 1);
								match = true;
								break;
							}
						}
						if (!match) {
							throw new Error();
						}
					}
					
					// bind inputs
					for (let k = 0; k < op.inputs.length; ++k) {
						const input = op.inputs[k];
						
						// is bound to output?
						let bound = -1;
						for (let j = 0; j < op.bindings.length; j += 2) {
							if (op.bindings[j] == k) {
								if (bound != -1) {
									throw new Error(`operation "%s" has invalid bindings`);
								}
								bound = op.bindings[j + 1];
							}
						}
						
						if (bound >= 0) {
							// if the buffer is not used for other things,
							// the operation can be done in-place.
							for (const binding of needed) {
								if (binding.binding.info == input) {
									// out-place
									bound = -1;
									break;
								}
							}
							
							if (bound >= 0) {
								// in-place (this is good!)
								phase.inputs.push(phase.outputs[bound]);
								needed.push({
									binding: {
										info: input,
										allocated: phase.outputs[bound]
									},
									useCount: 1
								});
								continue;
							}
						}
						
						let found = false;
						for (const binding of needed) {
							if (binding.binding.info == input) {
								binding.useCount += 1;
								phase.inputs.push(binding.binding.allocated);
								found = true;
								break;
							}
						}
						if (!found) {
							// allocate
							const alloc = allocMap.getOrCreate(input).get();
							phase.inputs.push(alloc);
							// console.log(`${op.name}: allocated ${alloc.info} ${alloc.index}`);
							
							needed.push({
								binding: {
									info: input,
									allocated: alloc
								},
								useCount: 1
							});
						}
						
					}
					
					if (phase.inputs.length != op.inputs.length ||
						phase.outputs.length != op.outputs.length)
						throw new Error();
						
					/*console.log(`--- OP ${op.name} ---`);
					for (let i = 0; i < op.inputs.length; ++i) {
						console.log(`IN  ${i} : ${phase.inputs[i].info}[${phase.inputs[i].index}]`);
					}
					for (let i = 0; i < op.outputs.length; ++i) {
						console.log(`OUT ${i} : ${phase.outputs[i].info}[${phase.outputs[i].index}]`);
					}*/
					
					// deallocate output
					for (let j = 0; j < op.outputs.length; ++j) {
						const output = op.outputs[j];
						
						// is bound to output?
						let bound = -1;
						for (let k = 0; k < op.bindings.length; k += 2) {
							if (op.bindings[k + 1] == j) {
								if (bound != -1) {
									throw new Error(`operation "${op.name}" has invalid bindings`);
								}
								bound = op.bindings[k];
							}
						}
						
						if (bound >= 0) {
							if (phase.inputs[bound] != phase.outputs[j]) {
								bound = -1;
							}
						}
						
						if (bound < 0) {
							// not bound to output
							// console.log(`${op.name}: deallocated ${phase.outputs[j].info} ${phase.outputs[j].index}`);
							if (phase.outputs[j]) 
								allocMap.getOrCreate(phase.outputs[j].info).release(phase.outputs[j]);
						}
					}
					
					phases.unshift(phase);
				}
				
			}
			
			this.phases = phases;
			
			console.log("--- Pipeline Compilation Done ----");
			for (const phase of phases) {
				console.log(phase.outputs.map((a)=> a ? `${a.info}[${a.index}]` : '_').join(', ') +
					" := " + phase.operation.name + "(" +
					phase.inputs.map((a)=>`${a.info}[${a.index}]`).join(', ') + ")");
			}
			let ttlCost = 0;
			allocMap.forEach((info, allocMapEntry) => {
				console.log(`${allocMapEntry.info.toString()} (cost=${allocMapEntry.info.cost}) x ${allocMapEntry.maxNumAllocated} = ` +
					`${allocMapEntry.maxNumAllocated * allocMapEntry.info.cost}`);
				ttlCost += allocMapEntry.maxNumAllocated * allocMapEntry.info.cost;
			});
			console.log(`Total Cost = ${ttlCost}`);
			
			// realize buffers.
			// first, delet unneeded buffers
			this.renderBuffers.forEach((info, buffer) => {
				const allocMapEntry = allocMap.get(info);
				const requiredCount = allocMapEntry ? allocMapEntry.maxNumAllocated : 0;
				const buffers = buffer.renderBuffers;
				while (buffers.length > requiredCount) {
					const e = buffers.pop();
					e.dispose();
				}
			});
			
			const newRenderBuffers = new RenderBufferInfoMap<RealizedRenderBufferGroup>();
			allocMap.forEach((info, allocMapEntry) => {
				const existingRenderBufferEntry = this.renderBuffers.get(info);
				const existingBuffers = existingRenderBufferEntry ? existingRenderBufferEntry.renderBuffers : [];
				const requiredCount = allocMapEntry.maxNumAllocated;
				while (existingBuffers.length < requiredCount) {
					existingBuffers.push(info.create(this));
				}
				newRenderBuffers.set(info, {
					renderBuffers: existingBuffers
				});
			});
			
			// realize each render phase's input/output.
			this.operators = phases.map((phase) => 
				phase.operation.factory({
					inputs: phase.inputs.map((input) => newRenderBuffers.get(input.info).renderBuffers[input.index]),
					outputs: phase.outputs.map((output) => output ? newRenderBuffers.get(output.info).renderBuffers[output.index] : null)
				}));
			this.outputBuffers = outputAllocation.map((alloc) => newRenderBuffers.get(alloc.info).renderBuffers[alloc.allocated.index]);
			
			this.renderBuffers = newRenderBuffers;
		}
		
		render(): void
		{
			for (const op of this.operators) {
				op.beforeRender();
			}	
			for (const op of this.operators) {
				op.perform();
			}	
			for (const op of this.operators) {
				op.afterRender();
			}	
		}
		
		private clearPipeline(): void 
		{
			for (const op of this.operators) {
				op.dispose();
			}	
			this.operators = [];
			this.outputBuffers = [];
		}
		
		releaseAll(): void
		{
			// FIXME: we really don't have to release non-image buffers when window was resized
			this.renderBuffers.forEach((info, buffer) => {
				for (const buf of buffer.renderBuffers) {
					buf.dispose();
				}
			})
			this.renderBuffers = new RenderBufferInfoMap<RealizedRenderBufferGroup>();
		}
		
	}	
	
}