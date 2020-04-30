import { Component, OnInit, ViewChild } from '@angular/core';
import { Encode } from 'xrpl-tagged-address-codec';
import { MatDialog } from '@angular/material/dialog';
import { XummSignDialogComponent } from '../xummSignRequestDialog';
import { GenericPayloadQRDialog } from '../genericPayloadQRDialog';
import { XummService } from '../../services/xumm.service'
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { Subject } from 'rxjs';
import { TransactionValidation, GenericBackendPostRequest } from '../../utils/types';
import { GoogleAnalyticsService } from '../../services/google-analytics.service';
import * as flagUtil from '../../utils/flagutils';
import { DeviceDetectorService } from 'ngx-device-detector';
import { MatStepper } from '@angular/material/stepper';

@Component({
  selector: 'issueMoreIOU',
  templateUrl: './issueMoreIOU.html',
})
export class IssueMoreIOU implements OnInit {

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

  issuerAccount: string = "rwAmSBNQcpscqz1ZeVbvtvHFDfVsoJAAgg";
  //private issuerAccount: string;
  validIssuer:boolean = true;

  currencyCode:string;
  limit:number;
  validCurrencyCode:boolean = false;
  validLimit:boolean = false;

  transactionSuccessfull: Subject<void> = new Subject<void>();
  loadingIssuerAccount:boolean = false;

  recipientAddress:string;

  weHaveIssued:boolean = false;

  issuerAccountChangedSubject: Subject<string> = new Subject<string>();
  networkChangedSubject: Subject<boolean> = new Subject<boolean>();

  ngOnInit(): void {
    this.validIssuer = true;
    this.issuerAccountChangedSubject.next(this.issuerAccount);
  }

  getIssuer(): string {
    return this.issuerAccount;
  }

  signInWithIssuer() {
    const dialogRef = this.matDialog.open(XummSignDialogComponent, {
      width: 'auto',
      height: 'auto;',
      data: {xrplAccount: null}
    });

    dialogRef.afterClosed().subscribe(async (info:TransactionValidation) => {
      console.log('The signin dialog was closed: ' + JSON.stringify(info));
      this.loadingIssuerAccount = true;

      if(info && info.success && info.account && this.isValidXRPAddress(info.account)) {
        this.issuerAccount = info.account;
        this.validIssuer = true;
        this.loadingIssuerAccount = false;
        this.issuerAccountChangedSubject.next(this.issuerAccount);
      } else {
        this.issuerAccount = null;
        this.validIssuer = false;
        this.loadingIssuerAccount = false;
        this.issuerAccountChangedSubject.next(null);
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
      this.websocket = webSocket(this.isTestMode ? 'wss://s.altnet.rippletest.net' : 'wss://xrpl.ws');

      this.websocket.asObservable().subscribe(async message => {
        //console.log("websocket message: " + JSON.stringify(message));
        if(message.status && message.type && message.type === 'response') {
          if(message.status === 'success') {
            if(message.result && message.result.account_data) {
              this.xrplAccount_Info = message.result.account_data;
              console.log("xrplAccount_Info: " + JSON.stringify(this.xrplAccount_Info));
              this.issuerAccountChangedSubject.next(this.xrplAccount_Info.Account);
            }

          } else {
            if(message.request.command === 'account_info') {
              this.xrplAccount_Info = message;
              this.issuerAccountChangedSubject.next(null);
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

  onIssuedCurrencyFound(iou:any) {
    this.currencyCode = iou.currency;
    this.checkChangesCurrencyCode();
  }

  checkChangesCurrencyCode() {
    this.validCurrencyCode = this.currencyCode && /^[A-Z]{3}$/.test(this.currencyCode) && this.currencyCode != "XRP";
  }

  checkChangesLimit() {
    this.validLimit = this.limit && this.limit > 0 && Number.isInteger(Number(this.limit)) && /^[\d]{1,15}$/.test(this.limit.toString());
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

  clearIssuerAccount() {
    this.issuerAccount = null;
    this.loadingIssuerAccount = false;
    this.validIssuer = false;
    this.xrplAccount_Info = null;
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
    this.recipientAddress = null;
    this.weHaveIssued = false;
  }

}
