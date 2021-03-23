import { Injectable } from '@angular/core';
import { AppService } from './app.service';
import { XummTypes } from 'xumm-sdk';
import { GenericBackendPostRequest, TransactionValidation } from '../utils/types';

@Injectable()
export class XummService {
    constructor(private app: AppService) {}

    isTestMode = false;
    xummBackendURL = this.isTestMode ? 'http://localhost:4001' : 'https://api.xumm.community';

    async submitPayload(payload:GenericBackendPostRequest): Promise<XummTypes.XummPostPayloadResponse> {
        try {
            console.log("submitting payload: " + JSON.stringify(payload));
            return this.app.post(this.xummBackendURL+"/api/v1/platform/payload", payload);
        } catch(err) {
            //console.log("error: ");
            console.log(JSON.stringify(err))
            return null;
        }
    }

    async getPayloadInfo(payloadId:string): Promise<XummTypes.XummGetPayloadResponse> {
        try {
            return this.app.get(this.xummBackendURL+"/api/v1/platform/payload/"+payloadId);
        } catch(err) {
            console.log(JSON.stringify(err))
            return null;
        }
    }

    async deletePayload(payloadId:string): Promise<XummTypes.XummDeletePayloadResponse> {
        try {
            return this.app.delete(this.xummBackendURL+"/api/v1/platform/payload/"+payloadId);
        } catch(err) {
            console.log(JSON.stringify(err))
            return null;
        }
    }

    async validateTransaction(payloadId:string): Promise<TransactionValidation> {
        try {
            return this.app.get(this.xummBackendURL+"/api/v1/xrpl/validatetx/"+payloadId);
        } catch(err) {
            console.log(JSON.stringify(err))
            return { error: true, success: false, testnet:false }
        }
    }
    
    async checkPayment(payloadId:string): Promise<TransactionValidation> {
        try {
            return this.app.get(this.xummBackendURL+"/api/v1/check/payment/"+payloadId);
        } catch(err) {
            console.log(JSON.stringify(err))
            return { error: true, success: false, testnet:false }
        }
    }

    async checkTimedPayment(payloadId:string): Promise<TransactionValidation> {
        try {
            return this.app.get(this.xummBackendURL+"/api/v1/check/timed/payment/"+payloadId);
        } catch(err) {
            console.log(JSON.stringify(err))
            return { error: true, success: false, testnet:false }
        }
    }

    async checkTimedPaymentReferer(payloadId:string, referer?:string): Promise<TransactionValidation> {
        try {
            return this.app.get(this.xummBackendURL+"/api/v1/check/timed/payment/referer/" + payloadId + (referer ? ("?referer="+referer) : ""));
        } catch(err) {
            console.log(JSON.stringify(err))
            return { error: true, success: false, testnet:false }
        }
    }

    async checkSignIn(payloadId:string): Promise<TransactionValidation> {
        try {
            return this.app.get(this.xummBackendURL+"/api/v1/check/signin/"+payloadId);
        } catch(err) {
            console.log(JSON.stringify(err))
            return { error: true, success: false, testnet:false }
        }
    }

    async signInToValidateTimedPayment(payloadId:string, referer?:string): Promise<TransactionValidation> {
        try {
            return this.app.get(this.xummBackendURL+"/api/v1/check/signinToValidatePayment/" + payloadId + (referer ? ("?referer="+referer) :""));
        } catch(err) {
            console.log(JSON.stringify(err))
            return { error: true, success: false, testnet:false }
        }
    }

    async getStoredEscrowList(account:string, testmode: boolean): Promise<any> {
        try {
            return this.app.post(this.xummBackendURL+"/api/v1/escrows", {account: account, testnet: testmode});
        } catch(err) {
            console.log(JSON.stringify(err))
            return { error: true, success: false, testnet:false }
        }
    }

    async validateEscrowPayment(payloadId:string): Promise<TransactionValidation> {
        try {
            return this.app.get(this.xummBackendURL+"/api/v1/escrow/validatepayment/" + payloadId);
        } catch(err) {
            console.log(JSON.stringify(err))
            return { error: true, success: false, testnet:false }
        }
    }

    async validateEscrowSignInToDelete(payloadId:string): Promise<TransactionValidation> {
        try {
            return this.app.get(this.xummBackendURL+"/api/v1/escrow/signinToDeleteEscrow/" + payloadId);
        } catch(err) {
            console.log(JSON.stringify(err))
            return { error: true, success: false, testnet:false }
        }
    }

    async getTransactionStatistics(): Promise<any> {
        try {
            return this.app.get(this.xummBackendURL+"/api/v1/statistics/transactions");
        } catch(err) {
            console.log(JSON.stringify(err))
            return null;
        }
    }
}