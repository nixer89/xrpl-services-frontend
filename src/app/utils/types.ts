import { XummPostPayloadBodyJson } from 'xumm-api';

export interface GenericBackendPostRequest {
    options?: {
        frontendId?: string,
        web?: boolean,
        pushDisabled?: boolean,
        referer?: string,
        xrplAccount?: string,
        signinToValidate?: boolean,
        issuing?: boolean
    },
    payload: XummPostPayloadBodyJson
}

export interface TransactionValidation {
    success: boolean,
    testnet: boolean,
    txid?: string,
    error?: boolean,
    message?: string,
    payloadExpired?: boolean,
    noValidationTimeFrame?: boolean,
    redirect?: boolean,
    account?: string,
    payloadId?: string
}

export interface AccountInfoChanged {
    info: any,
    mode: boolean
}

export interface AccountObjectsChanged {
    object: any,
    mode: boolean
}

export interface XrplAccountChanged {
    account: string,
    mode: boolean
}