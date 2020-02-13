import { Injectable } from '@angular/core';
import { AppService } from './app.service';

@Injectable()
export class XummService {
    constructor(private app: AppService) {}

    isTestMode = false;
    xummBackendURL = this.isTestMode ? 'http://localhost:4001' : 'https://api.xumm.community';

    async submitPayload(payload:any): Promise<any> {
        try {
            console.log("submitting payload: " + JSON.stringify(payload));
            return this.app.post(this.xummBackendURL+"/api/v1/platform/payload", payload);
        } catch(err) {
            console.log(JSON.stringify(err))
            return { error: true }
        }
    }

    async getPayloadInfo(payloadId:string): Promise<any> {
        try {
            return this.app.get(this.xummBackendURL+"/api/v1/platform/payload/"+payloadId);
        } catch(err) {
            console.log(JSON.stringify(err))
            return { error: true }
        }
    }

    async deletePayload(payloadId:string): Promise<any> {
        try {
            return this.app.delete(this.xummBackendURL+"/api/v1/platform/payload/"+payloadId);
        } catch(err) {
            console.log(JSON.stringify(err))
            return { error: true }
        }
    }

    async validateTransaction(payloadId:string): Promise<any> {
        try {
            return this.app.get(this.xummBackendURL+"/api/v1/xrpl/validatetx/"+payloadId);
        } catch(err) {
            console.log(JSON.stringify(err))
            return { error: true }
        }
    }
    
    async checkPayment(payloadId:string): Promise<any> {
        try {
            return this.app.get(this.xummBackendURL+"/api/v1/check/payment/"+payloadId);
        } catch(err) {
            console.log(JSON.stringify(err))
            return { error: true }
        }
    }

    async checkTimedPayment(payloadId:string, referer:string): Promise<any> {
        try {
            return this.app.get(this.xummBackendURL+"/api/v1/check/timed/payment/referer/"+payloadId+"?referer="+referer);
        } catch(err) {
            console.log(JSON.stringify(err))
            return { error: true }
        }
    }

    async checkSignIn(payloadId:string): Promise<any> {
        try {
            return this.app.get(this.xummBackendURL+"/api/v1/check/signin/"+payloadId);
        } catch(err) {
            console.log(JSON.stringify(err))
            return { error: true }
        }
    }

    async signInToValidateTimedPayment(payloadId:any, referer:string): Promise<any> {
        try {
            return this.app.get(this.xummBackendURL+"/api/v1/check/signinToValidatePayment/"+payloadId+(referer ? "?referer="+referer:""));
        } catch(err) {
            console.log(JSON.stringify(err))
            return { error: true }
        }
    }
}