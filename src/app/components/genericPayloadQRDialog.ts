import { Component, OnInit, Inject } from "@angular/core";
import { XummService } from '../services/xumm.service';
import {webSocket, WebSocketSubject} from 'rxjs/webSocket';
import { DeviceDetectorService } from 'ngx-device-detector';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

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

    constructor(
        private xummApi: XummService,
        private deviceDetector: DeviceDetectorService,
        public dialogRef: MatDialogRef<GenericPayloadQRDialog>,
        @Inject(MAT_DIALOG_DATA) public payload: any) {
    }

    async ngOnInit() {
        this.loading = true;

        //setting up xumm payload and waiting for websocket


        let refererURL:string;

        if(document.URL.includes('?')) {
            refererURL = document.URL.substring(0, document.URL.indexOf('?'));
        } else {
            refererURL = document.URL;
        }

        this.payload.referer = refererURL;

        let xummResponse:any;
        try {
            console.log("sending xumm payload: " + JSON.stringify(this.payload));
            xummResponse = await this.xummApi.submitPayload(this.payload);
            console.log(JSON.stringify(xummResponse)); 
        } catch (err) {
            console.log(JSON.stringify(err));
            this.loading = false;
            this.backendNotAvailable = true;
            this.showError = true;
            return;
        }

        this.payloadUUID = xummResponse.uuid;

        if(!this.deviceDetector.isDesktop() && xummResponse.next.always)
            window.location.href = xummResponse.next.always;
        else {
            this.qrLink = xummResponse.refs.qr_png;
            this.initSocket(xummResponse.refs.websocket_status);
        }
    }

    initSocket(url:string) {
        // register socket for receiving data:
        console.log("connecting socket to: " + url);
        this.websocket = webSocket(url);
        this.loading = false;
        this.waitingForPayment = true;
        this.websocket.asObservable().subscribe(async message => {
            console.log("message received: " + JSON.stringify(message));
            if(message.payload_uuidv4 && message.payload_uuidv4 === this.payloadUUID) {
                
                //get xrpl account
                let txInfo:any = await this.xummApi.validateTransaction(message.payload_uuidv4);
                
                if(txInfo && txInfo.success) {
                    this.transactionInfo = {};
                    this.transactionInfo.xrplAccount = txInfo.xrplAccoun;

                    if(txInfo.testnet)
                        this.transactionInfo.link = "https://test.bithomp.com/explorer/"+txInfo.xrplAccount;
                    else
                        this.transactionInfo.link = "https://bithomp.com/explorer/"+txInfo.xrplAccount;
                }
                this.waitingForPayment = false;

                if(txInfo.success) {
                    this.transactionSigned = true;

                    setTimeout(() => this.handleSuccessfullSignedAndSubmitted(), 3000);
                } else {
                    this.showError = true;
                    setTimeout(() => this.handleFailedSignIn(), 3000);
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
    
    handleSuccessfullSignedAndSubmitted() {
        this.dialogRef.close(this.transactionInfo);
    }

    handleFailedSignIn() {
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