import { Component, OnInit } from "@angular/core";
import { XummService } from '../services/xumm.service';
import {webSocket, WebSocketSubject} from 'rxjs/webSocket';
import { DeviceDetectorService } from 'ngx-device-detector';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
    selector: "xummSignRequestDialog",
    templateUrl: "xummSignRequestDialog.html"
})
export class XummSignDialogComponent implements OnInit{

    qrLink:string;

    xrplAccount:string;

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
        public dialogRef: MatDialogRef<XummSignDialogComponent>) {
    }

    async ngOnInit() {
        this.loading = true;

        //setting up xumm payload and waiting for websocket
        let xummPayload:any = {
            web: this.deviceDetector.isDesktop(),
            options: {
                expire: 1
            },
	        txjson: {
                TransactionType: "SignIn"
            }
        }

        let refererURL:string;

        if(document.URL.includes('?')) {
            refererURL = document.URL.substring(0, document.URL.indexOf('?'));
        } else {
            refererURL = document.URL;
        }

        xummPayload.referer = refererURL;
        xummPayload.signinToValidate = true;

        let xummResponse:any;
        try {
            console.log("sending xumm payload: " + JSON.stringify(xummPayload));
            xummResponse = await this.xummApi.submitPayload(xummPayload);
            console.log(JSON.stringify(xummResponse));
            if(!xummResponse || xummResponse.error) {
                this.loading = false;
                this.showError = true;
                setTimeout(() => this.handleFailedSignIn(), 3000);
            }
        } catch (err) {
            console.log(JSON.stringify(err));
            this.loading = false;
            this.backendNotAvailable = true;
            this.showError = true;
            setTimeout(() => this.handleFailedSignIn(), 3000);
        }

        this.payloadUUID = xummResponse.uuid;

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
        //console.log("connecting socket to: " + url);
        this.websocket = webSocket(url);
        this.loading = false;
        this.waitingForPayment = true;
        this.websocket.asObservable().subscribe(async message => {
            //console.log("message received: " + JSON.stringify(message));
            if(message.payload_uuidv4 && message.payload_uuidv4 === this.payloadUUID) {
                
                let transactionResult = await this.xummApi.checkSignIn(message.payload_uuidv4);
                console.log(transactionResult);
                
                this.waitingForPayment = false;
                if(transactionResult && transactionResult.success) {
                    this.transactionSigned = true;
                    //get xrpl account
                    let payloadInfo:any = await this.xummApi.getPayloadInfo(message.payload_uuidv4);
                    this.xrplAccount = payloadInfo.response.account;

                    setTimeout(() => this.handleSuccessfullSignIn(), 3000);
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
    
    handleSuccessfullSignIn() {
        this.dialogRef.close(this.xrplAccount);
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