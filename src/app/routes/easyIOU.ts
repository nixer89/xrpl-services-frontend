import { Component, OnInit } from '@angular/core';
import { Encode } from 'xrpl-tagged-address-codec';
import { MatDialog } from '@angular/material/dialog';
import { XummSignDialogComponent } from '../components/xummSignRequestDialog';
import { GenericPayloadQRDialog } from '../components/genericPayloadQRDialog';
import { XummService } from '../services/xumm.service'
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { Subject } from 'rxjs';
import { TransactionValidation, GenericBackendPostRequest } from '../utils/types';
import { GoogleAnalyticsService } from '../services/google-analytics.service';
import * as flagUtil from '../utils/flagutils';

@Component({
  selector: 'easyIOU',
  templateUrl: './easyIOU.html',
})
export class EasyIOU implements OnInit {

  private ACCOUNT_FLAG_DEFAULT_RIPPLE:number = 8;

  constructor(
    private matDialog: MatDialog,
    private xummApi: XummService,
    private googleAnalytics: GoogleAnalyticsService) {

  }

  currentStep:number = 0;
  checkBoxTwoAccounts:boolean = false;
  checkBoxSufficientFunds:boolean = false;
  checkBoxFiveXrp:boolean = false;
  checkBoxNetwork:boolean = false;

  xrplAccount_Info:any;
  websocket: WebSocketSubject<any>;
  isTestMode:boolean = true;

  private issuerAccount: string = "rBnjStKwLFmpSye3z4hJkrB1Lhk45RuWnG";
  //private issuerAccount: string;
  validIssuer:boolean = true;

  transactionSuccessfull: Subject<void> = new Subject<void>();

  paymentNotSuccessfull:boolean = false;
  paymentNotFound: boolean = false;
  loadingIssuerAccount:boolean = false;

  needDefaultRipple:boolean = true;

  ngOnInit(): void {
    this.loadAccountData();
  }

  getIssuer(): string {
    return this.issuerAccount;
  }

  payForIOU() {
    let genericBackendRequest:GenericBackendPostRequest = {
      payload: {
        txjson: {
          TransactionType: "Payment"
        }
      }
    } 
    
    const dialogRef = this.matDialog.open(GenericPayloadQRDialog, {
      width: 'auto',
      height: 'auto;',
      data: genericBackendRequest
    });

    dialogRef.afterClosed().subscribe(async (info:TransactionValidation) => {
      console.log('The generic dialog was closed: ' + JSON.stringify(info));

      if(info && info.success && info.account) {
        if(this.isValidXRPAddress(info.account))
          this.issuerAccount = info.account;
          this.validIssuer = true;
          this.paymentNotSuccessfull = false;
          this.paymentNotFound = false;
          await this.loadAccountData();
      } else {
        this.paymentNotSuccessfull = true;
      }
    });
  }

  loginForIOU() {
    const dialogRef = this.matDialog.open(XummSignDialogComponent, {
      width: 'auto',
      height: 'auto;',
      data: {xrplAccount: null}
    });

    dialogRef.afterClosed().subscribe(async (info:TransactionValidation) => {
      console.log('The signin dialog was closed: ' + JSON.stringify(info));
      this.loadingIssuerAccount = true;

      if(info && info.success && info.account && this.isValidXRPAddress(info.account)) {
        let checkPayment:TransactionValidation = await this.xummApi.signInToValidateTimedPayment(info.payloadId,null);
        if(checkPayment && checkPayment.success && !checkPayment.testnet || this.isTestMode) {
          this.issuerAccount = info.account;
          this.validIssuer = true;
          this.paymentNotSuccessfull = false;
          this.paymentNotFound = false;
          await this.loadAccountData();
        } else {
          this.issuerAccount = info.account;
          this.validIssuer = true;
          this.paymentNotFound = true;
          this.loadingIssuerAccount = true;
        }
      } else {
        this.issuerAccount = info.account;
        this.validIssuer = true;
        this.paymentNotFound = true;
        this.loadingIssuerAccount = true;
      }
    });
  }
  
  isValidXRPAddress(address: string): boolean {
    try {
      //console.log("encoding address: " + address);
      let xAddress = Encode({account: address});
      //console.log("xAddress: " + xAddress);
      return xAddress && xAddress.length > 0;
    } catch(err) {
      //no valid address
      //console.log("err encoding " + err);
      return false;
    }
  }

  async loadAccountData() {
    if(this.issuerAccount) {
      this.loadingIssuerAccount = true;
      this.googleAnalytics.analyticsEventEmitter('loading_account_data', 'easy_iou', 'easy_iou_component');

      if(this.websocket) {
        this.websocket.unsubscribe();
        this.websocket.complete();
      }

      //console.log("connecting websocket");
      this.websocket = webSocket(this.isTestMode ? 'wss://testnet.xrpl-labs.com' : 'wss://xrpl.ws');

      this.websocket.asObservable().subscribe(async message => {
        //console.log("websocket message: " + JSON.stringify(message));
        if(message.status && message.type && message.type === 'response') {
          if(message.status === 'success') {
            if(message.result && message.result.account_data) {
              this.xrplAccount_Info = message.result.account_data;
              console.log("xrplAccount_Info: " + JSON.stringify(this.xrplAccount_Info));
              console.log("this.needDefaultRipple: " + this.needDefaultRipple);
              this.needDefaultRipple = !flagUtil.isDefaultRippleEnabled(this.xrplAccount_Info.Flags)
              console.log("this.needDefaultRipple: " + this.needDefaultRipple);
            }

          } else {
            if(message.request.command === 'account_info') {
              this.xrplAccount_Info = message;
            }
          }

        } else {
          this.xrplAccount_Info = null;
        }
        this.loadingIssuerAccount = false;

      });

      let account_info_request:any = {
        command: "account_info",
        account: this.issuerAccount,
        "strict": true,
      }

      this.websocket.next(account_info_request);
    }
  }

  sendDefaultRipple() {
    let genericBackendRequest:GenericBackendPostRequest = {
      options: {
        xrplAccount: this.issuerAccount
      },
      payload: {
        txjson: {
          TransactionType: "AccountSet",
          SetFlag: this.ACCOUNT_FLAG_DEFAULT_RIPPLE
        },
        custom_meta: {
          instruction: "- Set 'DefaultRipple' flag to your account"
        }
      }
    } 
    
    const dialogRef = this.matDialog.open(GenericPayloadQRDialog, {
      width: 'auto',
      height: 'auto;',
      data: genericBackendRequest
    });

    dialogRef.afterClosed().subscribe(async (info:TransactionValidation) => {
      console.log('The generic dialog was closed: ' + JSON.stringify(info));

      if(info && info.success && info.account) {
         await this.loadAccountData();
      }
    });
  }

  clearIssuerAccount() {
    this.issuerAccount = null;
    this.loadingIssuerAccount = false;
    this.paymentNotFound = false;
    this.paymentNotSuccessfull = false;
    this.validIssuer = false;
    this.xrplAccount_Info = null;
    this.needDefaultRipple = true;
  }

}
