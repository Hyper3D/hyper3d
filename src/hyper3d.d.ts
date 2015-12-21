declare module Hyper
{
    export interface WebGLHyperRendererLogParameters
    {
        core: boolean;
        shader: boolean;

        [topic: string]: boolean;
    }

    export interface WebGLHyperRendererCreationParameters
    {
        canvas?: HTMLCanvasElement;
        useFullResolutionGBuffer?: boolean;
        useFPBuffer?: boolean;
        log?: WebGLHyperRendererLogParameters | boolean;
    }

    export interface WebGLHyperRendererParameters
    {
        bloomAmount: number;
        bloomSaturation: number;
        bloomTexture: THREE.Texture;
        motionBlurAmount: number;
        vignette: number;
        autoExposureEnabled: boolean;
        exposureBias: number;
        color: THREE.Vector3;
        highlightCrush: number;
        contrast: number;
    }
    export class ReflectionProbe extends THREE.Object3D
    {
        distance: number;
        decayDistance: number;
        priority: number;

        texture: THREE.CubeTexture;

        constructor();
    }

    export class WebGLHyperRenderer implements THREE.Renderer
    {
        constructor(params?: WebGLHyperRendererCreationParameters);

        render(scene: THREE.Scene, camera: THREE.Camera): void;
        setSize(width:number, height:number, updateStyle?:boolean): void;
        domElement: HTMLCanvasElement;
        
        parameters: WebGLHyperRendererParameters;
    }

    export enum MaterialShadingModel
    {
        // deferred shaded models
        Unlit = 0,
        Opaque = 1,
        ClearCoat = 2,

        // forward pass only
        Transparent = 3
    }

    export enum MaterialParameterType
    {
        Float = 0,
        Float2 = 1,
        Float3 = 2,
        Float4 = 3,
        Texture2D = 4,
        TextureCube = 5
    }

    export interface MaterialParameter
    {
        type: MaterialParameterType;
        default?: any;
    }

    export interface MaterialParameters
    {
        [name: string]: MaterialParameter;
    }

    export interface MaterialCreationParameters
    {
        shadingModel: MaterialShadingModel;
        shader?: string;
        parameters?: MaterialParameters;
        requiredVertexAttributes?: string[];
    }
    export class Material
    {
        id: number;

        constructor(params: MaterialCreationParameters);
    }

    export interface MaterialParameterAssignments
    {
        [name: string]: any;
    }

    export class MaterialInstance extends THREE.Material
    {
        parameters: MaterialParameterAssignments;
        material: Material;

        constructor(material: Material, assignments?: MaterialParameterAssignments);
    }
}

declare module "hyper3d" {
    export = Hyper;
}
