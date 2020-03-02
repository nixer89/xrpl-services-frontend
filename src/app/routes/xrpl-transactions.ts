import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { XummSignDialogComponent } from '../components/xummSignRequestDialog';
import { GenericPayloadQRDialog } from '../components/genericPayloadQRDialog';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { Subject } from 'rxjs'
import { ActivatedRoute } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { XummService } from '../services/xumm.service'
import { GenericBackendPostRequest, TransactionValidation } from '../utils/types';
import { XummPostPayloadBodyJson, XummGetPayloadResponse } from 'xumm-api';
import { GoogleAnalyticsService } from '../services/google-analytics.service';

@Component({
  selector: 'app-xrpl-transactions',
  templateUrl: './xrpl-transactions.html',
})
export class XrplTransactionsComponent implements OnInit {
  
  xrplAccount:string;
  xrplAccount_Info:any;
  xrplAccount_Objects: any;

  lastTrxLink:string;

  accountInfoChanged: Subject<void> = new Subject<void>();
  accountObjectsChanged: Subject<void> = new Subject<void>();
  transactionSuccessfull: Subject<void> = new Subject<void>();
  websocket: WebSocketSubject<any>;

  isTestMode:boolean = false;

  constructor(
    private matDialog: MatDialog,
    private route: ActivatedRoute,
    private xummApi: XummService,
    private snackBar: MatSnackBar,
    private googleAnalytics: GoogleAnalyticsService) { }

  async ngOnInit() {
    //this.xrplAccount="rwCNdWiEAzbMwMvJr6Kn6tzABy9zHNeSTL";
    //this.isTestMode = true;
    //this.xrplAccount="rU2mEJSLqBRkYLVTv55rFTgQajkLTnT6mA";
    //await this.loadAccountData();

    this.route.queryParams.subscribe(async params => {
      let payloadId = params.payloadId;
      let signinToValidate = params.signinToValidate;
      if(payloadId) {
        this.googleAnalytics.analyticsEventEmitter('opened_with_payload_id', 'opened_with_payload_id', 'xrpl_transactions_component');
        //check if transaction was successfull and redirect user to stats page right away:
        this.snackBar.open("Loading ...", null, {panelClass: 'snackbar-success', horizontalPosition: 'center', verticalPosition: 'top'});
        let payloadInfo:XummGetPayloadResponse = await this.xummApi.getPayloadInfo(payloadId);
        this.snackBar.dismiss();
        //console.log(JSON.stringify(payloadInfo));
        if(payloadInfo && payloadInfo.response && payloadInfo.response.account && signinToValidate) {
            this.snackBar.open("Login successfull. Loading account data...", null, {panelClass: 'snackbar-success', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
            this.xrplAccount = payloadInfo.response.account;
            this.loadAccountData();
        } else if (signinToValidate) {
            this.snackBar.open("Login not successfull. Cannot load account data. Please try again!", null, {panelClass: 'snackbar-failed', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
        } else {
          let transactionResult:TransactionValidation = await this.xummApi.validateTransaction(payloadId);

          this.handleTransactionInfo(transactionResult);

          if(transactionResult && transactionResult.success) {
            this.snackBar.open("Your transaction was successfull on " + (transactionResult.testnet ? 'test net.' : 'live net.'), null, {panelClass: 'snackbar-success', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
          } else {
            this.snackBar.open("Your transaction was not successfull. Please try again.", null, {panelClass: 'snackbar-failed', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'})
          }
        }
      }
    });
  }

  async loadAccountData() {
    if(this.xrplAccount) {

      if(this.websocket) {
        this.websocket.unsubscribe();
        this.websocket.complete();
      }

      this.websocket = webSocket(this.isTestMode ? 'wss://testnet.xrpl-labs.com' : 'wss://s1.ripple.com');

      this.websocket.asObservable().subscribe(async message => {
        //console.log("websocket message: " + JSON.stringify(message));
        if(message.status && message.status === 'success' && message.type && message.type === 'response') {
          if(message.result && message.result.account_data) {
            this.xrplAccount_Info = message.result.account_data;
            console.log("xrplAccount_Info: " + JSON.stringify(this.xrplAccount_Info));
            this.emitAccountInfoChanged();
          }

          if(message.result && message.result.account_objects) {
            this.xrplAccount_Objects = message.result.account_objects;
            console.log("xrplAccount_Objects: " + JSON.stringify(this.xrplAccount_Objects));
            this.emitAccountObjectsChanged();
          }

        } else {
          this.xrplAccount_Info = null;
          this.xrplAccount_Objects = null;
          this.emitAccountInfoChanged();
          this.emitAccountObjectsChanged();
        }
      });

      let account_info_request:any = {
        command: "account_info",
        account: this.xrplAccount,
        "strict": true,
      }

      let account_objects_request:any = {
        command: "account_objects",
        account: this.xrplAccount,
        type: "signer_list",
      }

      this.websocket.next(account_info_request);
      this.websocket.next(account_objects_request);
    }
  }

  openSignInDialog(): void {
    const dialogRef = this.matDialog.open(XummSignDialogComponent, {
      width: 'auto',
      height: 'auto;',
      data: {xrplAccount: null}
    });

    dialogRef.afterClosed().subscribe((info:TransactionValidation) => {
      //console.log('The dialog was closed');
      //console.log(info);
      if(info && info.redirect) {
        //nothing to do
      } else if(info && info.account) {
        this.xrplAccount = info.account;
      }

      if(this.xrplAccount) {
        this.loadAccountData();
      }
    });
  }

  openGenericDialog(payload: GenericBackendPostRequest):void {
    const dialogRef = this.matDialog.open(GenericPayloadQRDialog, {
      width: 'auto',
      height: 'auto;',
      data: payload
    });

    dialogRef.afterClosed().subscribe((info:TransactionValidation) => {
      //console.log('The generic dialog was closed: ' + JSON.stringify(info));

      if(info && info.redirect) {
        //nothing to do
      } else {
        this.handleTransactionInfo(info);
      }
    });
  }

  handleTransactionInfo(trxInfo:TransactionValidation) {
    if(trxInfo && trxInfo.account)
      this.xrplAccount = trxInfo.account;

    if(trxInfo && trxInfo.success) {
      this.isTestMode = trxInfo.testnet;

      if(trxInfo.txid) {
        if(trxInfo.testnet)
          this.lastTrxLink = "https://test.bithomp.com/explorer/"+trxInfo.txid;
        else
          this.lastTrxLink = "https://bithomp.com/explorer/"+trxInfo.txid;
      }

      this.transactionSuccessfull.next();
    } else {
      this.lastTrxLink = null;
    }

    if(this.xrplAccount) {
      this.loadAccountData();
    }
  }

  emitAccountInfoChanged() {
    //console.log("emit account info changed");
    this.accountInfoChanged.next(this.xrplAccount_Info);
  }

  emitAccountObjectsChanged() {
    //console.log("emit account objects changed");
    this.accountObjectsChanged.next(this.xrplAccount_Objects);
  }

  async onPayloadReceived(xummPayload:XummPostPayloadBodyJson) {
    //console.log("received payload: " + JSON.stringify(payload));
    let genericBackendRequest:GenericBackendPostRequest = {
      options: {
        xrplAccount: this.xrplAccount ? this.xrplAccount : null
      },
      payload: xummPayload
    }

    this.openGenericDialog(genericBackendRequest);
  }

  getAccountBalance(): number {
    if(this.xrplAccount_Info && this.xrplAccount_Info.Balance) {
      let balance:number = Number(this.xrplAccount_Info.Balance);
      return balance/1000000;
    } else {
      return 0;
    }
  }

  logoutAccount() {
    this.googleAnalytics.analyticsEventEmitter('logout_clicked', 'logout', 'xrpl_transactions_component');
    this.xrplAccount = null;
    this.xrplAccount_Info = null;
    this.lastTrxLink = null;
    this.emitAccountInfoChanged();
    this.emitAccountObjectsChanged();
  }

}
