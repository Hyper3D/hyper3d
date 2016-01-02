
declare interface WebGLTimerQueryEXT
{
}

declare interface EXTDisjointTimerQuery
{
    QUERY_COUNTER_BITS_EXT: number;
    CURRENT_QUERY_EXT: number;
    QUERY_RESULT_EXT: number;
    QUERY_RESULT_AVAILABLE_EXT: number;
    TIME_ELAPSED_EXT: number;
    TIMESTAMP_EXT: number;
    GPU_DISJOINT_EXT: number;

    createQueryEXT(): WebGLTimerQueryEXT;
    deleteQueryEXT(query: WebGLTimerQueryEXT): void;
    isQueryEXT(query: WebGLTimerQueryEXT): boolean;
    beginQueryEXT(target: number, query: WebGLTimerQueryEXT): void;
    endQueryEXT(target: number): void;
    queryCounterEXT(query: WebGLTimerQueryEXT, target: number): void;
    getQueryEXT(target: number, pname: number): any;
    getQueryObjectEXT(query: WebGLTimerQueryEXT, pname: number): any;
}

