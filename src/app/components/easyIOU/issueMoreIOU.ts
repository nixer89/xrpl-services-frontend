import { Component, OnInit, ViewChild } from '@angular/core';
import { Encode } from 'xrpl-tagged-address-codec';
import { MatDialog } from '@angular/material/dialog';
import { XummSignDialogComponent } from '../xummSignRequestDialog';
import { GenericPayloadQRDialog } from '../genericPayloadQRDialog';
import { XummService } from '../../services/xumm.service'
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { Subject } from 'rxjs';
import { TransactionValidation, GenericBackendPostRequest, XrplAccountChanged } from '../../utils/types';
import { GoogleAnalyticsService } from '../../services/google-analytics.service';
import * as flagUtil from '../../utils/flagutils';
import { DeviceDetectorService } from 'ngx-device-detector';
import { MatStepper } from '@angular/material/stepper';
import { isNumber } from 'util';

interface TrustLine {
  account:string,
  balance: string,
  currency: string,
  limit: string,
  limit_peer: string,
  no_ripple: boolean
}

@Component({
  selector: 'issueMoreIOU',
  templateUrl: './issueMoreIOU.html',
})
export class IssueMoreIOU implements OnInit {

  constructor(
    private matDialog: MatDialog,
    private googleAnalytics: GoogleAnalyticsService) {
  }

  @ViewChild('inpdestination', {static: false}) inpdestination;
  destinationInput: string;

  checkBoxTwoAccounts:boolean = false;
  checkBoxSufficientFunds:boolean = false;
  checkBoxFiveXrp:boolean = false;
  checkBoxNetwork:boolean = false;
  checkBoxNoLiability:boolean = false;

  checkBoxIssuingText:boolean = false;

  websocket: WebSocketSubject<any>;
  isTestMode:boolean = false;

  issuerAccount: string;
  //private issuerAccount: string;
  validIssuer:boolean = false;
  validAddress:boolean = false;

  currencyCode:string;
  numberOfTokens:number;
  validCurrencyCode:boolean = false;
  validNumberOfTokens:boolean = false;
  notEnoughLimit:boolean = false;

  recipientToIssuerTrustLine:TrustLine;
  loadingRecipientToIssuerTL:boolean = false;
  noTrustLineFound:boolean = false;

  recipientAccountNotFound:boolean = false;

  transactionSuccessfull: Subject<void> = new Subject<void>();
  loadingIssuerAccount:boolean = false;

  weHaveIssued:boolean = false;

  issuerAccountChangedSubject: Subject<XrplAccountChanged> = new Subject<XrplAccountChanged>();

  ngOnInit(): void {
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
        console.log("valid issuer");
        this.issuerAccount = info.account;
        this.validIssuer = true;
        this.loadingIssuerAccount = false;
      } else {
        this.issuerAccount = null;
        this.validIssuer = false;
        this.loadingIssuerAccount = false;
      }

      this.issuerAccountChangedSubject.next({account: this.issuerAccount, mode: this.isTestMode});
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

  networkSwitched() {
    this.issuerAccountChangedSubject.next({account: this.issuerAccount, mode: this.isTestMode});
  }

  onIssuedCurrencyFound(iou:any) {
    this.currencyCode = iou.currency;
    this.checkChangesCurrencyCode();
  }

  checkChangesCurrencyCode() {
    this.validCurrencyCode = this.currencyCode && this.currencyCode != "XRP";
    this.numberOfTokens = null;
    this.validNumberOfTokens = false;
    this.notEnoughLimit = false;

    this.loadTrustLines();
  }

  checkChangesNumberOfTokens() {
    this.validNumberOfTokens = this.numberOfTokens && !(/[^.0-9]|\d*\.\d{16,}/.test(this.numberOfTokens.toString())) && this.numberOfTokens > 0;

    this.notEnoughLimit = this.validNumberOfTokens && this.numberOfTokens > this.getMaxIssuerTokens();
  }

  checkChangesDestination() {
    this.validAddress = this.destinationInput && this.destinationInput.trim().length > 0 && this.isValidXRPAddress(this.destinationInput.trim());

    this.noTrustLineFound = false;
    this.recipientAccountNotFound = false;

    this.loadTrustLines();
  }

  issueIOU() {
    let genericBackendRequest:GenericBackendPostRequest = {
      options: {
        issuing: true
      },
      payload: {
        txjson: {
          TransactionType: "Payment",
          Destination: this.destinationInput.trim(),
          Amount: {
            currency: this.currencyCode.trim(),
            issuer: this.issuerAccount.trim(),
            value: this.numberOfTokens.toString().trim()
          }
        },
        custom_meta: {
          instruction: "- Issuing " + this.numberOfTokens + " " + this.currencyCode + " to: " + this.destinationInput.trim() + "\n\n- Please sign with the ISSUER account!"
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

  loadTrustLines() {
    if(!this.loadingRecipientToIssuerTL && this.validCurrencyCode && this.validAddress && this.validIssuer) {
      this.loadingRecipientToIssuerTL = true;
      this.googleAnalytics.analyticsEventEmitter('load_trust_lines', 'issue_more_iou', 'more_iou_component');

      let websocketTL:WebSocketSubject<any> = webSocket(this.isTestMode ? 'wss://testnet.xrpl-labs.com' : 'wss://xrpl.ws');

      websocketTL.asObservable().subscribe(async message => {
        console.log("websocket message: " + JSON.stringify(message));
          if(message.status && message.status === 'success' && message.type && message.type === 'response' && message.result && message.result.lines) {
              let trustLines:TrustLine[] = message.result.lines;

              console.log("trustLines: " + JSON.stringify(trustLines));

              if(trustLines && trustLines.length > 0) {
                for(let i = 0; i < trustLines.length; i++) {
                  if(trustLines[i].currency === this.currencyCode) {
                    this.recipientToIssuerTrustLine = trustLines[i];
                    break;
                  }
                }
              }

              if(!this.recipientToIssuerTrustLine)
                this.noTrustLineFound = true;

              this.loadingRecipientToIssuerTL = false;
              console.log("recipientToIssuerTrustLine: " + JSON.stringify(this.recipientToIssuerTrustLine));
          } else if(message.status && message.status === 'error' && message.error === 'actNotFound') {
            this.recipientAccountNotFound = true;
            this.loadingRecipientToIssuerTL = false;

            websocketTL.unsubscribe();
            websocketTL.complete();
            websocketTL = null;  
          } else {
            this.recipientToIssuerTrustLine = null;
            this.recipientAccountNotFound = false;
            this.loadingRecipientToIssuerTL = false;

            websocketTL.unsubscribe();
            websocketTL.complete();
            websocketTL = null;
          }
      });

      let account_lines_request:any = {
        command: "account_lines",
        account: this.destinationInput.trim(),
        peer: this.issuerAccount.trim(),
        ledger_index: "validated",
      }

      websocketTL.next(account_lines_request);
    }
  }

  getMaxIssuerTokens(): number {
    if(this.recipientToIssuerTrustLine && (Number(this.recipientToIssuerTrustLine.limit) - Number(this.recipientToIssuerTrustLine.balance)) > 0)
      return Number(this.recipientToIssuerTrustLine.limit) - Number(this.recipientToIssuerTrustLine.balance);
    else
      return 0;
  }

  clearIssuerAccount() {
    this.issuerAccount = null;
    this.loadingIssuerAccount = false;
    this.validIssuer = false;
  }

  reset() {
    this.isTestMode = false;
    this.checkBoxFiveXrp = this.checkBoxNetwork = this.checkBoxSufficientFunds = this.checkBoxTwoAccounts = this.checkBoxNoLiability = false;
    this.currencyCode = null;
    this.numberOfTokens = null;
    this.validCurrencyCode = false;
    this.validNumberOfTokens = false;
    this.issuerAccount = null;
    this.validIssuer = false;
    this.destinationInput = null;
    this.weHaveIssued = false;
  }
}
