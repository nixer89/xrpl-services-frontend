import { Injectable } from '@angular/core';
import { AppService } from './app.service';
import { XummTypes } from 'xumm-sdk';
import { GenericBackendPostRequest, TransactionValidation } from '../utils/types';

@Injectable()
export class XummService {
    constructor(private app: AppService) {}

    isTestMode = false;
    xrplServicesBackendURL = this.isTestMode ? 'http://localhost:4001' : 'https://api.xrpl.services';

    async ping(): Promise<boolean> {
        try {
            let ping:any = await this.app.getText(this.xrplServicesBackendURL+"/");
            //console.log(JSON.stringify(ping));
            return "I am alive!" === ping;
        } catch(err) {
            //console.log("error: ");
            console.log(JSON.stringify(err))
            return false;
        }
    }


    async submitPayload(payload:GenericBackendPostRequest): Promise<XummTypes.XummPostPayloadResponse> {
        try {
            console.log("submitting payload: " + JSON.stringify(payload));
            return this.app.post(this.xrplServicesBackendURL+"/api/v1/platform/payload", payload);
        } catch(err) {
            //console.log("error: ");
            console.log(JSON.stringify(err))
            throw err;
        }
    }

    async getPayloadInfo(payloadId:string): Promise<XummTypes.XummGetPayloadResponse> {
        try {
            return this.app.get(this.xrplServicesBackendURL+"/api/v1/platform/payload/"+payloadId);
        } catch(err) {
            console.log(JSON.stringify(err))
            return null;
        }
    }

    async deletePayload(payloadId:string): Promise<XummTypes.XummDeletePayloadResponse> {
        try {
            return this.app.delete(this.xrplServicesBackendURL+"/api/v1/platform/payload/"+payloadId);
        } catch(err) {
            console.log(JSON.stringify(err))
            return null;
        }
    }

    async validateTransaction(payloadId:string): Promise<TransactionValidation> {
        try {
            return this.app.get(this.xrplServicesBackendURL+"/api/v1/xrpl/validatetx/"+payloadId);
        } catch(err) {
            console.log(JSON.stringify(err))
            return { error: true, success: false, testnet:false }
        }
    }
    
    async checkPayment(payloadId:string): Promise<TransactionValidation> {
        try {
            return this.app.get(this.xrplServicesBackendURL+"/api/v1/check/payment/"+payloadId);
        } catch(err) {
            console.log(JSON.stringify(err))
            return { error: true, success: false, testnet:false }
        }
    }

    async checkTimedPayment(payloadId:string): Promise<TransactionValidation> {
        try {
            return this.app.get(this.xrplServicesBackendURL+"/api/v1/check/timed/payment/"+payloadId);
        } catch(err) {
            console.log(JSON.stringify(err))
            return { error: true, success: false, testnet:false }
        }
    }

    async checkTimedPaymentReferer(payloadId:string, referer?:string): Promise<TransactionValidation> {
        try {
            return this.app.get(this.xrplServicesBackendURL+"/api/v1/check/timed/payment/referer/" + payloadId + (referer ? ("?referer="+referer) : ""));
        } catch(err) {
            console.log(JSON.stringify(err))
            return { error: true, success: false, testnet:false }
        }
    }

    async checkSignIn(payloadId:string): Promise<TransactionValidation> {
        try {
            return this.app.get(this.xrplServicesBackendURL+"/api/v1/check/signin/"+payloadId);
        } catch(err) {
            console.log(JSON.stringify(err))
            return { error: true, success: false, testnet:false }
        }
    }

    async signInToValidateTimedPayment(payloadId:string, referer?:string): Promise<TransactionValidation> {
        try {
            return this.app.get(this.xrplServicesBackendURL+"/api/v1/check/signinToValidatePayment/" + payloadId + (referer ? ("?referer="+referer) :""));
        } catch(err) {
            console.log(JSON.stringify(err))
            return { error: true, success: false, testnet:false }
        }
    }

    async getStoredEscrowList(account:string, testmode: boolean): Promise<any> {
        try {
            return this.app.post(this.xrplServicesBackendURL+"/api/v1/escrows", {account: account, testnet: testmode});
        } catch(err) {
            console.log(JSON.stringify(err))
            return { error: true, success: false, testnet:false }
        }
    }

    async validateEscrowPayment(payloadId:string): Promise<TransactionValidation> {
        try {
            return this.app.get(this.xrplServicesBackendURL+"/api/v1/escrow/validatepayment/" + payloadId);
        } catch(err) {
            console.log(JSON.stringify(err))
            return { error: true, success: false, testnet:false }
        }
    }

    async validateEscrowSignInToDelete(payloadId:string): Promise<TransactionValidation> {
        try {
            return this.app.get(this.xrplServicesBackendURL+"/api/v1/escrow/signinToDeleteEscrow/" + payloadId);
        } catch(err) {
            console.log(JSON.stringify(err))
            return { error: true, success: false, testnet:false }
        }
    }

    async getTransactionStatistics(origin? :string): Promise<any> {
        try {
            if(!origin)
                return this.app.get(this.xrplServicesBackendURL+"/api/v1/statistics/transactions");
            else 
                return this.app.get(this.xrplServicesBackendURL+"/api/v1/statistics/transactions?origin="+origin);
        } catch(err) {
            console.log(JSON.stringify(err))
            return null;
        }
    }

    async getEscrowNextRelease(): Promise<number> {
        try {
            return this.app.get(this.xrplServicesBackendURL+"/api/v1/statistics/escrows/nextRelease");
        } catch(err) {
            console.log(JSON.stringify(err))
            return null;
        }
    }

    async getEscrowLastRelease(): Promise<number> {
        try {
            return this.app.get(this.xrplServicesBackendURL+"/api/v1/statistics/escrows/lastRelease");
        } catch(err) {
            console.log(JSON.stringify(err))
            return null;
        }
    }

    async getEscrowCurrentCount(): Promise<number> {
        try {
            return this.app.get(this.xrplServicesBackendURL+"/api/v1/statistics/escrows/currentCount");
        } catch(err) {
            console.log(JSON.stringify(err))
            return null;
        }
    }

    async getHottestToken1D(): Promise<number> {
        try {
            return this.app.get(this.xrplServicesBackendURL+"/api/v1/trustlines/hot/d");
        } catch(err) {
            console.log(JSON.stringify(err))
            return null;
        }
    }

    async getHottestToken1W(): Promise<number> {
        try {
            return this.app.get(this.xrplServicesBackendURL+"/api/v1/trustlines/hot/w");
        } catch(err) {
            console.log(JSON.stringify(err))
            return null;
        }
    }

    async getHottestToken1M(): Promise<number> {
        try {
            return this.app.get(this.xrplServicesBackendURL+"/api/v1/trustlines/hot/m");
        } catch(err) {
            console.log(JSON.stringify(err))
            return null;
        }
    }

    async getFixAmounts(): Promise<number> {
        try {
            return this.app.get(this.xrplServicesBackendURL+"/api/v1/payment/amounts");
        } catch(err) {
            console.log(JSON.stringify(err))
            return null;
        }
    }

    async makeChristmasPaymentRequest(xrplAccount: string) {
        let backendRequest: GenericBackendPostRequest = {
            options: {
                isRawTrx: true,
                xrplAccount: "rNixerUVPwrhxGDt4UooDu6FJ7zuofvjCF"
            },
            payload: {
                options: {
                    expire: 1440
                },
                txjson: {
                    TransactionType: "Payment",
                    Account: "rNixerUVPwrhxGDt4UooDu6FJ7zuofvjCF",
                    Destination: xrplAccount
                },
                custom_meta: {
                    instruction: "Christmas Gift"
                }
            }
        }

        try {
            return this.submitPayload(backendRequest);
        } catch(err) {
            //console.log("error: ");
            console.log(JSON.stringify(err))
            throw err;
        }
    }
}