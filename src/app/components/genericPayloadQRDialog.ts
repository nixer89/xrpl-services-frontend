import { Component, OnInit, Inject } from "@angular/core";
import { XummService } from '../services/xumm.service';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { DeviceDetectorService } from 'ngx-device-detector';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { GenericBackendPostRequest, TransactionValidation } from '../utils/types'
import { XummPostPayloadResponse } from 'xumm-api'
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
    transactionInfo:any;
    memoInput: string;

    isDarkTheme:boolean = false;

    websocket: WebSocketSubject<any>;
    payloadUUID: string;
    showError: boolean = false;
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
            this.genericPayload.payload.txjson.Memos = [{Memo: {MemoType: Buffer.from("[https://xumm.community]Memo", 'utf8').toString('hex').toUpperCase(), MemoData: Buffer.from(this.memoInput.trim(), 'utf8').toString('hex').toUpperCase()}}];
        }

        this.googleAnalytics.analyticsEventEmitter(this.genericPayload.payload.txjson.TransactionType.toLowerCase()+'_transaction', 'sendToXummGeneric', 'generic_payload_dialog_component');

        let xummResponse:XummPostPayloadResponse;
        try {
            xummResponse = await this.xummApi.submitPayload(this.genericPayload);
            //console.log("xummResponse: " + JSON.stringify(xummResponse)); 
            if(!xummResponse || !xummResponse.uuid) {
                this.loading = false;
                this.backendNotAvailable = true;
                this.showError = true;
                setTimeout(() => this.handleFailedTransaction(), 3000);
            }
        } catch (err) {
            //console.log(JSON.stringify(err));
            this.loading = false;
            this.backendNotAvailable = true;
            this.showError = true;
            setTimeout(() => this.handleFailedTransaction(), 3000);
        }

        this.payloadUUID = xummResponse.uuid;
        this.pushed = xummResponse.pushed;

        if(!this.deviceDetector.isDesktop() && xummResponse.next.always) {
            window.location.href = xummResponse.next.always;
            this.dialogRef.close({redirect: true});
        }
        else {
            this.qrLink = xummResponse.refs.qr_png;
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
                    if(this.genericPayload.payload.txjson.TransactionType.toLowerCase() === 'payment' && !this.genericPayload.options.issuing) {
                        txInfo = await this.xummApi.checkTimedPaymentReferer(message.payload_uuidv4);
                    } else {
                        txInfo = await this.xummApi.validateTransaction(message.payload_uuidv4);
                    }
                    
                    //console.log("txInfo: " + JSON.stringify(txInfo));
                    this.waitingForPayment = false;

                    if(txInfo && txInfo.success) {
                        this.transactionSigned = true;
                        this.transactionInfo = txInfo;

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
        this.dialogRef.close(null);
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