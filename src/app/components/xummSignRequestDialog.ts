import { Component, Inject, OnInit } from "@angular/core";
import { XummService } from '../services/xumm.service';
import { webSocket, WebSocketSubject} from 'rxjs/webSocket';
import { DeviceDetectorService } from 'ngx-device-detector';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { XummTypes } from 'xumm-sdk';
import { GenericBackendPostRequest, TransactionValidation } from '../utils/types'
import { GoogleAnalyticsService } from '../services/google-analytics.service';
import { LocalStorageService } from 'angular-2-local-storage';
import { OverlayContainer } from '@angular/cdk/overlay';

@Component({
    selector: "xummSignRequestDialog",
    templateUrl: "xummSignRequestDialog.html"
})
export class XummSignDialogComponent implements OnInit{

    qrLink:string;
    payloadLink:string;

    websocket: WebSocketSubject<any>;
    payloadUUID: string;
    showError: boolean = false;
    waitingForPayment:boolean = false;
    showQR:boolean = false;
    requestExpired:boolean = false;
    backendNotAvailable:boolean = false;
    loading:boolean = false;
    transactionSigned:boolean = false;
    hasBlob:boolean = false;

    constructor(
        private xummApi: XummService,
        private deviceDetector: DeviceDetectorService,
        @Inject(MAT_DIALOG_DATA) public data: any,
        public dialogRef: MatDialogRef<XummSignDialogComponent>,
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
        this.loading = true;

        let refererURL:string;

        if(document.URL.includes('?')) {
            refererURL = document.URL.substring(0, document.URL.indexOf('?'));
        } else {
            refererURL = document.URL;
        }
        //setting up xumm payload and waiting for websocket
        let backendPayload:GenericBackendPostRequest = {
            options: {
                web: this.deviceDetector.isDesktop(),
                referer: refererURL,
                signinToValidate: true
            },
            payload: {
                options: {
                    expire: 5
                },
                txjson: {
                    TransactionType: "SignIn"
                },
                custom_meta: {
                }
            }
        }

        //set account and force it
        if(this.data.xrplAccount) {
            backendPayload.options.xrplAccount = this.data.xrplAccount;
            backendPayload.payload.txjson.Account = this.data.xrplAccount;
            backendPayload.payload.options.forceAccount = true;
        }

        if(this.data.instruction) {
            backendPayload.payload.custom_meta.instruction = this.data.instruction;
        }

        if(this.data.blob) {
            this.hasBlob = true;
            backendPayload.payload.custom_meta.blob = this.data.blob;
        }

        this.googleAnalytics.analyticsEventEmitter(backendPayload.payload.txjson.TransactionType.toLowerCase(), 'sendToXummSignIn', 'signin_dialog_component');

        let xummResponse:XummTypes.XummPostPayloadResponse;
        try {
            //console.log("sending xumm payload: " + JSON.stringify(xummPayload));
            xummResponse = await this.xummApi.submitPayload(backendPayload);
            //console.log(JSON.stringify(xummResponse));
            if(!xummResponse || !xummResponse.uuid) {
                this.loading = false;
                this.showError = true;
                setTimeout(() => this.handleFailedSignIn(null), 3000);
            }
        } catch (err) {
            //console.log(JSON.stringify(err));
            this.loading = false;
            this.backendNotAvailable = true;
            this.showError = true;
            setTimeout(() => this.handleFailedSignIn(null), 3000);
        }

        this.payloadUUID = xummResponse.uuid;

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
        //console.log("connecting socket to: " + url);
        //console.log("connecting websocket");
        this.websocket = webSocket(url);
        this.loading = false;
        this.waitingForPayment = true;
        this.websocket.asObservable().subscribe(async message => {
            //console.log("message received: " + JSON.stringify(message));
            if(message.payload_uuidv4 && message.payload_uuidv4 === this.payloadUUID) {
                
                if(message.signed) {
                    let transactionResult:TransactionValidation;
                    if(!this.hasBlob)
                        transactionResult = await this.xummApi.checkSignIn(message.payload_uuidv4);
                    else
                        transactionResult = await this.xummApi.validateEscrowSignInToDelete(message.payload_uuidv4);

                    console.log("sign result: " + JSON.stringify(transactionResult));
                    
                    this.waitingForPayment = false;

                    if(this.websocket) {
                        this.websocket.unsubscribe();
                        this.websocket.complete();
                    }

                    if(transactionResult && transactionResult.success) {
                        this.transactionSigned = true;
                        
                        setTimeout(() => this.handleSuccessfullSignIn(transactionResult.account, message.payload_uuidv4), 3000);
                    } else {
                        this.showError = true;
                        setTimeout(() => this.handleFailedSignIn(transactionResult), 3000);
                    }
                } else {
                    this.waitingForPayment = false;
                    this.showError = true;
                    setTimeout(() => this.handleFailedSignIn(null), 3000);
                }

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
    
    handleSuccessfullSignIn(xrplAccount: string, payloadId: string) {
        this.dialogRef.close({ success: true, testnet: false, account: xrplAccount, payloadId: payloadId});
    }

    handleFailedSignIn(result: TransactionValidation) {
        this.websocket = null;
        this.dialogRef.close(result);
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