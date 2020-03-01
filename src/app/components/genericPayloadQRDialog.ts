import { Component, OnInit, Inject } from "@angular/core";
import { XummService } from '../services/xumm.service';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { DeviceDetectorService } from 'ngx-device-detector';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { GenericBackendPostRequest, TransactionValidation } from '../utils/types'
import { XummPostPayloadResponse } from 'xumm-api'

@Component({
    selector: "genericPayloadQRDialog",
    templateUrl: "genericPayloadQRDialog.html"
})
export class GenericPayloadQRDialog implements OnInit {

    qrLink:string;

    transactionInfo:any;

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

    constructor(
        private xummApi: XummService,
        private deviceDetector: DeviceDetectorService,
        public dialogRef: MatDialogRef<GenericPayloadQRDialog>,
        @Inject(MAT_DIALOG_DATA) public genericPayload: GenericBackendPostRequest) {
    }

    async ngOnInit() {
        this.loading = true;

        this.genericPayload.options.web = this.deviceDetector.isDesktop();

        let refererURL:string;

        if(document.URL.includes('?')) {
            refererURL = document.URL.substring(0, document.URL.indexOf('?'));
        } else {
            refererURL = document.URL;
        }

        this.genericPayload.options.referer = refererURL;

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
        this.websocket = webSocket(url);
        this.loading = false;
        this.waitingForPayment = true;
        this.websocket.asObservable().subscribe(async message => {
//            console.log("message received: " + JSON.stringify(message));
            if(message.payload_uuidv4 && message.payload_uuidv4 === this.payloadUUID) {
                
                //get xrpl account
                let txInfo:TransactionValidation = await this.xummApi.validateTransaction(message.payload_uuidv4);
                
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