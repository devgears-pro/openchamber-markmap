export type EditErrorCode = 'E_NODE' | 'E_CAPABILITY' | 'E_LABEL' | 'E_SPLICE' | 'E_SHAPE' | 'E_LEVEL' | 'E_CYCLE' | 'E_INDENT';
export declare class EditError extends Error {
    code: EditErrorCode;
    nodeId?: string;
    constructor(code: EditErrorCode, message: string, nodeId?: string);
}
