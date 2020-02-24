import { XummPostPayloadBodyJson } from 'xumm-api';

export interface GenericBackendPostRequest {
    options?: {
        frontendId?: string,
        web?: boolean,
        pushDisabled?: boolean,
        referer?: string,
        xrplAccount?: string,
        signinToValidate?: boolean
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
    xrplAccount?: string,
    redirect?: boolean
}