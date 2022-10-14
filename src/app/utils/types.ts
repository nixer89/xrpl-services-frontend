import { XummTypes } from 'xumm-sdk';

export interface GenericBackendPostRequestOptions {
    frontendId?: string,
    web?: boolean,
    pushDisabled?: boolean,
    referer?: string,
    xrplAccount?: string,
    signinToValidate?: boolean,
    issuing?: boolean,
    isRawTrx?: boolean
}

export interface GenericBackendPostRequest {
    options?: GenericBackendPostRequestOptions,
    payload: XummTypes.XummPostPayloadBodyJson
}

export interface TransactionValidation {
    success: boolean,
    testnet: boolean,
    transactionType?: string,
    txid?: string,
    error?: boolean,
    message?: string,
    payloadExpired?: boolean,
    noValidationTimeFrame?: boolean,
    redirect?: boolean,
    account?: string,
    payloadId?: string,
    originalPayload?: XummTypes.XummGetPayloadResponse
}

export interface AccountInfoChanged {
    info: any,
    accountReserve: number,
    ownerReserve: number,
    nodeUrl: string
}

export interface AccountObjectsChanged {
    objects: any[],
    nodeUrl: string
}

export interface XrplAccountChanged {
    account: string,
    nodeUrl: string
}

export interface Token {
    currency: string,
    amount: number,
    trustlines?: number,
    holders?: number,
    offers?: number,
    created?: any,
    self_assessment?: any
}

export interface TrustLine {
    account:string,
    balance: string,
    currency: string,
    limit: string,
    limit_peer: string,
    no_ripple: boolean,
    balanceN?: number,
    limitN?: number
}

export interface TransactionTemplate {
    transactionType: string,
    docLink: string,
    requiresAmendment: boolean,
    codeSamples: any[]
}

export interface TokenIssuer {
    account: string,
    currencyCode: string,
    currencyCodeUTF8: string,
    amount: number,
    trustlines: number,
    holders: number,
    offers: number,
    verified: boolean,
    kyc?: boolean,
    username?: string,
    resolvedBy?: string
    twitter?: string,
    domain?: string,
    isHot?: boolean,
    newTrustlines?: number,
    created?: any,
    self_assessment?: any
}

export interface NftIssuer {
    account: string,
    currencyCode: string,
    currencyCodeUTF8: string,
    amount: number,
    shownAmount: number,
    trustlines: number,
    holders: number,
    offers: number,
    verified: boolean,
    kyc?: boolean,
    username?: string,
    resolvedBy?: string
    twitter?: string,
    domain?: string,
    isHot?: boolean,
    newTrustlines?: number,
    created?: any
}

export interface IssuerVerification {
    resolvedBy: string,
    account: string,
    verified: boolean,
    kyc?: boolean,
    created?: any,
    domain?: string,
    username?: string,
    twitter?: string
}

export interface XrplCurrency {
    currencyCode:string,
    currencyCodeUTF8:string
}

export interface RippleState {
    Balance: {
        currency: string,
        issuer: string,
        value: string
    },
    Flags: number,
    HighLimit: {
        currency: string,
        issuer: string,
        value: string
    },
    HighNode: string,
    LedgerEntryType: string,
    LowLimit: {
        currency: string,
        issuer: string,
        value: string
    },
    LowNode: string,
    PreviousTxnID: string,
    PreviousTxnLgrSeq: number,
    index: string
}

export interface SimpleTrustLine {
    account:string,
    balance: number,
    currency: string,
    limit: string,
    limit_peer: string,
    no_ripple: boolean,
    isFrozen: boolean,
    currencyN: string,
    balanceN?: number
}