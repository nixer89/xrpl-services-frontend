import { Component, OnInit, ViewChild } from '@angular/core';
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
import { DeviceDetectorService } from 'ngx-device-detector';
import { MatStepper } from '@angular/material/stepper';

@Component({
  selector: 'easyIOU',
  templateUrl: './easyIOU.html',
})
export class EasyIOU implements OnInit {

  private ACCOUNT_FLAG_DEFAULT_RIPPLE:number = 8;

  constructor(
    private matDialog: MatDialog,
    private xummApi: XummService,
    private googleAnalytics: GoogleAnalyticsService,
    private device: DeviceDetectorService) {

  }

  checkBoxTwoAccounts:boolean = false;
  checkBoxSufficientFunds:boolean = false;
  checkBoxFiveXrp:boolean = false;
  checkBoxNetwork:boolean = false;
  checkBoxNoLiability:boolean = false;

  checkBoxIssuingText:boolean = false;

  xrplAccount_Info:any;
  websocket: WebSocketSubject<any>;
  isTestMode:boolean = false;

  private issuerAccount: string;
  //private issuerAccount: string;
  validIssuer:boolean = false;

  currencyCode:string;
  limit:number;
  validCurrencyCode:boolean = false;
  validLimit:boolean = false;

  transactionSuccessfull: Subject<void> = new Subject<void>();

  paymentNotSuccessfull:boolean = false;
  paymentNotFound: boolean = false;
  loadingIssuerAccount:boolean = false;

  needDefaultRipple:boolean = true;
  recipientAddress:string;
  recipientTrustlineSet:boolean = false;
  weHaveIssued:boolean = false;

  @ViewChild('stepper', {static: false}) stepper: MatStepper;

  ngOnInit(): void {
    this.loadAccountData();
  }

  isDektop(): boolean {
    return this.device.isDesktop();
  }

  getIssuer(): string {
    return this.issuerAccount;
  }

  payForIOU() {
    let genericBackendRequest:GenericBackendPostRequest = {
      payload: {
        txjson: {
          TransactionType: "Payment"
        },
        custom_meta: {
          instruction: "Please pay with the account you want to issue your IOU from!"
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

      if(info && info.success && info.account && (!info.testnet || this.isTestMode)) {
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
        console.log("login to validate payment: " + JSON.stringify(checkPayment));
        if(checkPayment && checkPayment.success && (!checkPayment.testnet || this.isTestMode)) {
          this.issuerAccount = info.account;
          this.validIssuer = true;
          this.paymentNotSuccessfull = false;
          this.paymentNotFound = false;
          await this.loadAccountData();
        } else {
          this.issuerAccount = info.account;
          this.validIssuer = true;
          this.paymentNotFound = true;
          this.loadingIssuerAccount = false;
        }
      } else if(info && info.account) {
        this.issuerAccount = info.account;
        this.validIssuer = true;
        this.paymentNotFound = true;
        this.loadingIssuerAccount = false;
      } else {
        this.issuerAccount = null;
        this.validIssuer = false;
        this.loadingIssuerAccount = false;
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
          instruction: "- Set 'DefaultRipple' flag to the issuing account\n\n- Please sign with the ISSUER account!"
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

      if(info && info.success && info.account && info.testnet == this.isTestMode) {
         await this.loadAccountData();
      } else {

      }
    });
  }

  checkChangesCurrencyCode() {
    this.validCurrencyCode = this.currencyCode && /^[A-Z]{3}$/.test(this.currencyCode) && this.currencyCode != "XRP";
  }

  checkChangesLimit() {
    this.validLimit = this.limit && this.limit > 0 && Number.isInteger(Number(this.limit)) && /^[\d]{1,15}$/.test(this.limit.toString());
  }

  setTrustline() {
    let genericBackendRequest:GenericBackendPostRequest = {
      payload: {
        txjson: {
          TransactionType: "TrustSet",
          Flags: 131072, //no ripple
          LimitAmount: {
            currency: this.currencyCode.trim(),
            issuer: this.issuerAccount.trim(),
            value: this.limit.toString().trim()
          }
        },
        custom_meta: {
          instruction: "- Set TrustLine between IOU recipient and issuer\n\n- Please sign with the RECIPIENT account!"
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

      if(info && info.success && info.account && info.testnet == this.isTestMode) {
         this.recipientTrustlineSet = true;
         this.recipientAddress = info.account;
      } else {
        this.recipientTrustlineSet = false;
      }
    });
  }

  issueIOU() {
    let genericBackendRequest:GenericBackendPostRequest = {
      options: {
        issuing: true
      },
      payload: {
        txjson: {
          TransactionType: "Payment",
          Destination: this.recipientAddress,
          Amount: {
            currency: this.currencyCode.trim(),
            issuer: this.issuerAccount.trim(),
            value: this.limit.toString().trim()
          }
        },
        custom_meta: {
          instruction: "- Issuing " + this.limit + " " + this.currencyCode + " to: " + this.recipientAddress + "\n\n- Please sign with the ISSUER account!"
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

      if(info && info.success && info.account && info.testnet == this.isTestMode) {
        this.weHaveIssued = true;
      } else {
        this.weHaveIssued = false;
      }
    });
  }

  moveNext() {
    // complete the current step
    this.stepper.selected.completed = true;
    this.stepper.selected.editable = false;
    // move to next step
    this.stepper.next();
    this.stepper.selected.editable = true;
  }

  moveBack() {
    console.log("steps: " + this.stepper.steps.length);
    // move to previous step
    this.stepper.selected.completed = false;
    this.stepper.selected.editable = false;

    this.stepper.steps.forEach((item, index) => {
      if(index == this.stepper.selectedIndex-1 && this.stepper.selectedIndex-1 >= 0) {
        item.editable = true;
        item.completed = false;
      }
    })

    switch(this.stepper.selectedIndex) {
      case 0: break;
      case 1: {
        this.checkBoxFiveXrp = this.checkBoxNetwork = this.checkBoxSufficientFunds = this.checkBoxTwoAccounts = this.checkBoxNoLiability = false;
        break;
      }
      case 2: {
        this.isTestMode = false;
        break;
      }
      case 3: {
        this.currencyCode = null;
        this.limit = null;
        this.validCurrencyCode = false;
        this.validLimit = false;
      }
      case 4: {
        this.issuerAccount = this.xrplAccount_Info = null;
        this.validIssuer = false;
        this.paymentNotFound = this.paymentNotSuccessfull = false;
        break;
      }
      case 5: {
        this.needDefaultRipple = true;
        break;
      }
      case 6: {
        this.recipientTrustlineSet = false;
        this.recipientAddress = null;
        break;
      }
      case 7: {
        this.weHaveIssued = false;
      }
      case 8: break;
    }

    this.stepper.previous();
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

  reset() {
    this.isTestMode = false;
    this.checkBoxFiveXrp = this.checkBoxNetwork = this.checkBoxSufficientFunds = this.checkBoxTwoAccounts = this.checkBoxNoLiability = false;
    this.currencyCode = null;
    this.limit = null;
    this.validCurrencyCode = false;
    this.validLimit = false;
    this.issuerAccount = this.xrplAccount_Info = null;
    this.validIssuer = false;
    this.paymentNotFound = this.paymentNotSuccessfull = false;
    this.needDefaultRipple = true;
    this.recipientTrustlineSet = false;
    this.recipientAddress = null;
    this.weHaveIssued = false;
    this.stepper.reset();

  }

}
