import { Component, OnInit, Inject } from "@angular/core";
import { XummService } from '../services/xumm.service';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { DeviceDetectorService } from 'ngx-device-detector';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { GenericBackendPostRequest, TransactionValidation } from '../utils/types'
import { XummTypes} from 'xumm-sdk'
import { GoogleAnalyticsService } from '../services/google-analytics.service';
import { LocalStorageService } from 'angular-2-local-storage';
import { OverlayContainer } from '@angular/cdk/overlay';

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

    constructor(
        private xummApi: XummService,
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

        window.scrollTo(0,0);
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

        if(this.memoInput && this.memoInput.trim().length > 0 && !this.genericPayload.payload.txjson.Memos) {
            this.genericPayload.payload.txjson.Memos = [{Memo: {MemoType: Buffer.from("[https://xumm.community]-Memo", 'utf8').toString('hex').toUpperCase(), MemoData: Buffer.from(this.memoInput.trim(), 'utf8').toString('hex').toUpperCase()}}];
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

                let anyresponse:any = xummResponse;
                if(anyresponse && anyresponse.error && anyresponse.message)
                    this.backendErrorMessage = anyresponse.message;
                else
                    this.backendErrorMessage = "Sorry, there was an error contacting the backend. Please try again later.";

                this.showError = true;
                setTimeout(() => this.handleFailedTransaction(), 5000);
                return;
            }
        } catch (err) {
            //console.log(JSON.stringify(err));
            this.loading = false;
            this.backendNotAvailable = true;
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
                    if(this.genericPayload.payload.txjson.TransactionType.toLowerCase() === 'payment' && this.genericPayload.payload.custom_meta && this.genericPayload.payload.custom_meta.blob) {
                        txInfo = await this.xummApi.validateEscrowPayment(message.payload_uuidv4);
                    } else if(this.genericPayload.payload.txjson.TransactionType.toLowerCase() === 'payment' && !this.genericPayload.options.issuing) {
                        txInfo = await this.xummApi.checkTimedPaymentReferer(message.payload_uuidv4, this.genericPayload.options.referer);
                    } else {
                        txInfo = await this.xummApi.validateTransaction(message.payload_uuidv4);
                    }
                    
                    console.log("txInfo: " + JSON.stringify(txInfo));
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