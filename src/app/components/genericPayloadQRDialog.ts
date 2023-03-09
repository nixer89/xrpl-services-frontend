import { Component, OnInit, Inject } from "@angular/core";
import { XummService } from '../services/xumm.service';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { DeviceDetectorService } from 'ngx-device-detector';
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/legacy-dialog';
import { GenericBackendPostRequest, TransactionValidation } from '../utils/types'
import { XummTypes} from 'xumm-sdk'
import { GoogleAnalyticsService } from '../services/google-analytics.service';
import { LocalStorageService } from 'angular-2-local-storage';
import { OverlayContainer } from '@angular/cdk/overlay';
import { AppService } from "../services/app.service";

@Component({
    selector: "genericPayloadQRDialog",
    templateUrl: "genericPayloadQRDialog.html",
    styleUrls: ['./genericPayloadQRDialog.scss']
})
export class GenericPayloadQRDialog implements OnInit {

    qrLink:string;
    payloadLink:string;
    transactionInfo:TransactionValidation;
    memoInput: string;

    isDarkTheme:boolean = false;

    websocket: WebSocketSubject<any>;
    payloadUUID: string;
    showError: boolean = false;
    backendErrorMessage:string = null;
    waitingForPayment:boolean = false;
    showQR:boolean = false;
    requestExpired:boolean = false;
    backendNotAvailable:boolean = false;
    loading:boolean = false;
    transactionSigned:boolean = false;
    pushed:boolean = false;
    isOverview:boolean = true;

    loadingKYC:boolean = false;
    loadingKycFailed:boolean = false;
    showKyc:boolean = false;
    hasKyc:boolean = false;

    tokenWarningAccepted:boolean = false;

    constructor(
        private xummApi: XummService,
        private app: AppService,
        private deviceDetector: DeviceDetectorService,
        public dialogRef: MatDialogRef<GenericPayloadQRDialog>,
        @Inject(MAT_DIALOG_DATA) public genericPayload: GenericBackendPostRequest,
        private googleAnalytics: GoogleAnalyticsService,
        private localStorage: LocalStorageService,
        private overlayContainer: OverlayContainer) {
        }

    async ngOnInit() {
        if(this.localStorage && !this.localStorage.get("darkMode")) {
            this.overlayContainer.getContainerElement().classList.remove('dark-theme');
            this.overlayContainer.getContainerElement().classList.add('light-theme');
        } else {
            this.overlayContainer.getContainerElement().classList.remove('light-theme');
            this.overlayContainer.getContainerElement().classList.add('dark-theme');
        }

        if(!this.genericPayload?.payload?.custom_meta?.blob?.addWarningXumm)
            this.tokenWarningAccepted = true;

        this.loadKycData();

        window.scrollTo(0,0);
    }

    async loadKycData() {
        this.loadingKYC = true;
        try {
            if(this.genericPayload?.payload?.txjson?.TransactionType === "TrustSet") {
                this.showKyc = true;
                let issuer:string = this.genericPayload.payload.txjson.LimitAmount['issuer'];

                let kycResponse = await this.app.get("https://api.xrpldata.com/api/v1/kyc/"+issuer)

                //console.log(JSON.stringify(kycResponse));

                this.hasKyc = kycResponse && kycResponse.kyc;

                this.loading = false;
            }
        } catch(err) {
            //fallback to xumm api in case of error
            try {
                if(this.genericPayload?.payload?.txjson?.TransactionType === "TrustSet") {
                    this.showKyc = true;
                    let issuer:string = this.genericPayload.payload.txjson.LimitAmount['issuer'];
    
                    let kycResponse = await this.app.get("https://xumm.app/api/v1/platform/kyc-status/"+issuer+"?include_globalid=true")
    
                    //console.log(JSON.stringify(kycResponse));
    
                    this.hasKyc = kycResponse && kycResponse.kycApproved;
    
                    this.loading = false;
                }
            } catch(err) {
                console.log(JSON.stringify(err));
                this.loadingKycFailed = true;
            }
        }
        this.loadingKYC = false;
    }

    async sendToXumm() {
        this.loading = true;
        this.isOverview = false;

        //set expiry time to 5 minutes
        if(!this.genericPayload.payload.options)
            this.genericPayload.payload.options = {};
        
        this.genericPayload.payload.options.expire = 5;

        if(!this.genericPayload.options)
            this.genericPayload.options = {};

        this.genericPayload.options.web = this.deviceDetector.isDesktop();

        if(!this.genericPayload.options.referer) {
            let refererURL:string;

            if(document.URL.includes('?')) {
                refererURL = document.URL.substring(0, document.URL.indexOf('?'));
            } else {
                refererURL = document.URL;
            }

            this.genericPayload.options.referer = refererURL;
        }

        if(this.genericPayload?.payload?.custom_meta?.blob?.isDonation) {
            let memoText = this.memoInput;
            
            if(!memoText || memoText.trim().length == 0)
                memoText = "Sending Love to xrpl.services"

            this.genericPayload.payload.txjson.Memos = [{Memo: {MemoType: Buffer.from("[https://xrpl.services]-Memo", 'utf8').toString('hex').toUpperCase(), MemoData: Buffer.from(memoText, 'utf8').toString('hex').toUpperCase()}}]
        } else if(this.memoInput && this.memoInput.trim().length > 0 && !this.genericPayload.payload.txjson.Memos) {
            this.genericPayload.payload.txjson.Memos = [{Memo: {MemoType: Buffer.from("[https://xrpl.services]-Memo", 'utf8').toString('hex').toUpperCase(), MemoData: Buffer.from(this.memoInput.trim(), 'utf8').toString('hex').toUpperCase()}}];
        }

        //set account and force it
        if(this.genericPayload.options.xrplAccount) {
            this.genericPayload.payload.txjson.Account = this.genericPayload.options.xrplAccount;
            this.genericPayload.payload.options.forceAccount = true;
        }

        if(this.genericPayload.payload.txjson.TransactionType)
            this.googleAnalytics.analyticsEventEmitter(this.genericPayload.payload.txjson.TransactionType.toLowerCase()+'_transaction', 'sendToXummGeneric', 'generic_payload_dialog_component');

        let xummResponse:XummTypes.XummPostPayloadResponse;
        try {
            xummResponse = await this.xummApi.submitPayload(this.genericPayload);
            //console.log("xummResponse: " + JSON.stringify(xummResponse)); 
            if(!xummResponse || !xummResponse.uuid) {
                this.loading = false;
                this.backendNotAvailable = true;

                this.backendErrorMessage = "Sorry, there was an error contacting the backend. Please try again later!";

                this.showError = true;
                setTimeout(() => this.handleFailedTransaction(), 5000);
                return;
            }
        } catch (err) {
            //console.log(JSON.stringify(err));
            this.loading = false;
            this.backendNotAvailable = true;

            if(err && (typeof err === 'string')) {
                this.backendErrorMessage = err;
            } else if(err && err.message && (typeof err.message === 'string')) {
                this.backendErrorMessage = err.message;
            } else {
                this.backendErrorMessage = "Sorry, there was an error contacting the backend. Please try again later!";
            }

            this.showError = true;
            setTimeout(() => this.handleFailedTransaction(), 5000);
            return;
        }

        this.payloadUUID = xummResponse.uuid;
        this.pushed = xummResponse.pushed;

        if(!this.deviceDetector.isDesktop() && xummResponse.next.always) {
            window.location.href = xummResponse.next.always;
            this.dialogRef.close({redirect: true});
        }
        else {
            this.qrLink = xummResponse.refs.qr_png;
            this.payloadLink = xummResponse.next.always;
            this.initSocket(xummResponse.refs.websocket_status);
        }
    }

    initSocket(url:string) {
        // register socket for receiving data:
        //console.log("connecting websocket");
        this.websocket = webSocket(url);
        this.loading = false;
        this.waitingForPayment = true;
        this.websocket.asObservable().subscribe(async message => {
            //console.log("message received: " + JSON.stringify(message));
            if(message.payload_uuidv4 && message.payload_uuidv4 === this.payloadUUID) {
                
                if(message.signed) {
                    //get xrpl account
                    let txInfo:TransactionValidation;
                    if(this.genericPayload.payload.txjson.TransactionType.toLowerCase() === 'payment' && this.genericPayload.payload.custom_meta && this.genericPayload.payload.custom_meta.blob
                        && this.genericPayload.payload.custom_meta.blob.account && this.genericPayload.payload.custom_meta.blob.sequence && this.genericPayload.payload.custom_meta.blob.finishafter) {
                        txInfo = await this.xummApi.validateEscrowPayment(message.payload_uuidv4);
                    } else if(this.genericPayload.payload.txjson.TransactionType.toLowerCase() === 'payment' && !this.genericPayload.options.issuing && !this.genericPayload.payload.custom_meta?.blob?.isDonation) {
                        txInfo = await this.xummApi.checkTimedPaymentReferer(message.payload_uuidv4, this.genericPayload.options.referer);
                    } else {
                        txInfo = await this.xummApi.validateTransaction(message.payload_uuidv4);
                    }
                    
                    //console.log("txInfo: " + JSON.stringify(txInfo));
                    this.waitingForPayment = false;

                    this.transactionInfo = txInfo;

                    if(txInfo && txInfo.success) {
                        this.transactionSigned = true;
                        this.transactionInfo.payloadId = message.payload_uuidv4;

                        setTimeout(() => this.handleSuccessfullTransaction(), 3000);
                    } else {
                        this.showError = true;
                        setTimeout(() => this.handleFailedTransaction(), 3000);
                    }
                } else {
                    this.waitingForPayment = false;
                    this.showError = true;
                    setTimeout(() => this.handleFailedTransaction(), 3000);
                }

                this.websocket.unsubscribe();
                this.websocket.complete();
            } else if(message.expired || message.expires_in_seconds <= 0) {
                this.showError = true;
                this.waitingForPayment = false;
                this.requestExpired = true;
                this.websocket.unsubscribe();
                this.websocket.complete();
            } else if(message.opened) {
                this.showQR = false;
                this.qrLink = null;
            }
        });
    }
    
    handleSuccessfullTransaction() {
        if(this.websocket) {
            this.websocket.unsubscribe();
            this.websocket.complete();
        }
        
        this.websocket = null;
        this.dialogRef.close(this.transactionInfo);
    }

    handleFailedTransaction() {
        if(this.websocket) {
            this.websocket.unsubscribe();
            this.websocket.complete();
        }

        this.websocket = null;
        this.dialogRef.close(this.transactionInfo);
    }

    QRLoaded() {
        this.showQR = true;
    }

    closeIt() {
        if(this.websocket) {
            this.websocket.unsubscribe();
            this.websocket.complete();
        }

        this.websocket = null;
        this.dialogRef.close(null);
    }
}