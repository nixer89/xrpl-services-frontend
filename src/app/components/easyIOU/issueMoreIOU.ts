import { Component, OnInit, ViewChild } from '@angular/core';
import { Encode } from 'xrpl-tagged-address-codec';
import { MatDialog } from '@angular/material/dialog';
import { XummSignDialogComponent } from '../xummSignRequestDialog';
import { GenericPayloadQRDialog } from '../genericPayloadQRDialog';
import { XummService } from '../../services/xumm.service'
import { Subject } from 'rxjs';
import { TransactionValidation, GenericBackendPostRequest, XrplAccountChanged } from '../../utils/types';
import * as normalizer from '../../utils/normalizers';
import { GoogleAnalyticsService } from '../../services/google-analytics.service';
import { ActivatedRoute } from '@angular/router';
import { MatSnackBar, MatExpansionPanel } from '@angular/material';

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
    private googleAnalytics: GoogleAnalyticsService,
    private route: ActivatedRoute,
    private xummApi: XummService,
    private snackBar: MatSnackBar) {
  }

  @ViewChild('inpdestination', {static: false}) recipientAccount;
  recipientAccountInput: string;

  @ViewChild('mep', {static: true}) mep: MatExpansionPanel;

  isTestMode:boolean = false;

  issuerAccount: string;
  //private issuerAccount: string;
  validIssuer:boolean = false;
  validAddress:boolean = false;

  currencyCode:string;
  numberOfTokens:string;
  validCurrencyCode:boolean = false;
  validNumberOfTokens:boolean = false;
  notEnoughLimit:boolean = false;

  recipientToIssuerTrustLine:TrustLine;
  loadingRecipientToIssuerTL:boolean = false;
  recipientSameAsIssuer:boolean = false;

  transactionSuccessfull: Subject<void> = new Subject<void>();
  loadingIssuerAccount:boolean = false;

  issuerAccountChangedSubject: Subject<XrplAccountChanged> = new Subject<XrplAccountChanged>();
  recipientAccountChangedSubject: Subject<XrplAccountChanged> = new Subject<XrplAccountChanged>();

  ngOnInit(): void {
    this.route.queryParams.subscribe(async params => {
      let payloadId = params.payloadId;
      let signinToValidate = params.signinToValidate;
      if(payloadId) {
        this.googleAnalytics.analyticsEventEmitter('opened_with_payload_id', 'opened_with_payload', 'issue_more_iou_component');
        this.mep.expanded = true;
        //check if transaction was successfull and redirect user to stats page right away:
        this.snackBar.open("Loading ...", null, {panelClass: 'snackbar-success', horizontalPosition: 'center', verticalPosition: 'top'});
        //console.log(JSON.stringify(payloadInfo));
        if(signinToValidate) {
            this.loadingIssuerAccount = true;
            let signInCheck:TransactionValidation = await this.xummApi.checkSignIn(payloadId);

            this.handleSignInInfo(signInCheck);
        } else {
          let transactionResult:TransactionValidation = await this.xummApi.validateTransaction(payloadId);
          this.handleTransactionInfo(transactionResult);
        }
      }
    });

    this.issuerAccount = "r3K1TgPvTPkWZR2Lhawpvv9YR7yYuqSXBp";
    this.isTestMode = true;
    this.validIssuer = true;
    this.recipientAccountInput = "rDn65vS7Hw2g4WHMTHdgbQ3HTyaqQ7ADmJ"
    this.issuerAccountChangedSubject.next({account: this.issuerAccount, mode: this.isTestMode});
  }

  getIssuer(): string {
    return this.issuerAccount;
  }

  signInWithIssuer() {
    this.loadingIssuerAccount = true;

    const dialogRef = this.matDialog.open(XummSignDialogComponent, {
      width: 'auto',
      height: 'auto;',
      data: {xrplAccount: null}
    });

    dialogRef.afterClosed().subscribe(async (info:TransactionValidation) => {
      //console.log('The signin dialog was closed: ' + JSON.stringify(info));
      this.handleSignInInfo(info)
    });
  }

  handleSignInInfo(info: TransactionValidation) {
    if(info && info.success && info.account && this.isValidXRPAddress(info.account)) {
      //("valid issuer");
      this.snackBar.dismiss();
      this.snackBar.open("Login successfull. Loading account data...", null, {panelClass: 'snackbar-success', duration: 3000, horizontalPosition: 'center', verticalPosition: 'top'});
      this.issuerAccount = info.account;
      this.validIssuer = true;
      this.loadingIssuerAccount = false;
    } else {
      this.issuerAccount = null;
      this.validIssuer = false;
      this.loadingIssuerAccount = false;
      this.snackBar.open("Login not successfull. Please try again", null, {panelClass: 'snackbar-failed', duration: 3000, horizontalPosition: 'center', verticalPosition: 'top'});
    }

    this.issuerAccountChangedSubject.next({account: this.issuerAccount, mode: this.isTestMode});
  }

  handleTransactionInfo(info: TransactionValidation) {
    this.snackBar.dismiss();
    if(info && info.success) {
      this.snackBar.open("Your transaction was successfull on " + (info.testnet ? 'test net.' : 'live net.'), null, {panelClass: 'snackbar-success', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
      this.reset();
    } else {
      this.snackBar.open("Your transaction was not successfull. Please try again.", null, {panelClass: 'snackbar-failed', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'})
    }

    this.reset();
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

  onTrustLineSelected(trustLine:TrustLine) {
    this.recipientToIssuerTrustLine = trustLine;
    this.currencyCode = this.recipientToIssuerTrustLine.currency;
    this.checkChangesCurrencyCode();
  }

  checkChangesCurrencyCode() {
    this.validCurrencyCode = this.currencyCode && this.currencyCode != "XRP";

    if(!this.currencyCode || this.currencyCode.trim().length==0)
      this.recipientToIssuerTrustLine = null;
      
    this.numberOfTokens = null;
    this.validNumberOfTokens = false;
    this.notEnoughLimit = false;
  }

  checkChangesNumberOfTokens() {
    this.validNumberOfTokens = this.numberOfTokens && !(/[^.0-9]|\d*\.\d{15,}/.test(this.numberOfTokens.toString())) && Number(this.numberOfTokens) > 0;

    this.notEnoughLimit = this.validNumberOfTokens && Number(this.numberOfTokens) > this.getMaxIssuerTokens();
  }

  checkChangesRecipientAccount() {
    this.validAddress = this.recipientAccountInput && this.recipientAccountInput.trim().length > 0 && this.isValidXRPAddress(this.recipientAccountInput.trim());
    this.recipientSameAsIssuer = this.issuerAccount && this.recipientAccountInput &&  this.issuerAccount.trim() === this.recipientAccountInput.trim();

    if(this.validAddress && !this.recipientSameAsIssuer)
      this.recipientAccountChangedSubject.next({account: this.recipientAccountInput.trim(), mode: this.isTestMode});
    else
      this.recipientAccountChangedSubject.next({account: null, mode: this.isTestMode});
  }

  issueIOU() {
    let genericBackendRequest:GenericBackendPostRequest = {
      options: {
        issuing: true,
        xrplAccount: this.getIssuer()
      },
      payload: {
        txjson: {
          TransactionType: "Payment",
          Destination: this.recipientAccountInput.trim(),
          Amount: {
            currency: this.currencyCode,
            issuer: this.issuerAccount.trim(),
            value: normalizer.iouTokenNormalizer(this.numberOfTokens)
          }
        },
        custom_meta: {
          instruction: "- Issuing " + this.numberOfTokens + " " + this.getCurrencyCodeAscii(this.currencyCode) + " to: " + this.recipientAccountInput.trim() + "\n\n- Please sign with the ISSUER account!"
        }
      }
    } 
    
    const dialogRef = this.matDialog.open(GenericPayloadQRDialog, {
      width: 'auto',
      height: 'auto;',
      data: genericBackendRequest
    });

    dialogRef.afterClosed().subscribe(async (info:TransactionValidation) => {
      //console.log('The generic dialog was closed: ' + JSON.stringify(info));

      this.handleTransactionInfo(info);
    });
  }

  getMaxIssuerTokens(): number {
    if(this.recipientToIssuerTrustLine && (Number(this.recipientToIssuerTrustLine.limit) - Number(this.recipientToIssuerTrustLine.balance)) > 0)
      return Number(this.recipientToIssuerTrustLine.limit) - Number(this.recipientToIssuerTrustLine.balance);
    else
      return 0;
  }

  getCurrencyCodeAscii(currency: string): string {
    return normalizer.currencyCodeHexToAsciiTrimmed(currency);
}

  clearIssuerAccount() {
    this.issuerAccount = null;
    this.loadingIssuerAccount = false;
    this.validIssuer = false;
  }

  clearCurrencyCode() {
    this.currencyCode = null;
    this.checkChangesCurrencyCode()
  }

  reset() {
    this.isTestMode = false;
    this.currencyCode = null;
    this.numberOfTokens = null;
    this.validCurrencyCode = false;
    this.validNumberOfTokens = false;
    this.issuerAccount = null;
    this.validIssuer = false;
    this.recipientAccountInput = null;
  }
}
