import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { XummSignDialogComponent } from '../components/xummSignRequestDialog';
import { GenericPayloadQRDialog } from '../components/genericPayloadQRDialog';
import { Subject } from 'rxjs'
import { ActivatedRoute } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { XummService } from '../services/xumm.service'
import { GenericBackendPostRequest, TransactionValidation, AccountInfoChanged, AccountObjectsChanged } from '../utils/types';
import { XummPostPayloadBodyJson } from 'xumm-api';
import { GoogleAnalyticsService } from '../services/google-analytics.service';
import { LocalStorageService } from 'angular-2-local-storage';
import { OverlayContainer } from '@angular/cdk/overlay';
import { XRPLWebsocket } from '../services/xrplWebSocket';

@Component({
  selector: 'xrpl-transactions',
  templateUrl: './xrpl-transactions.html',
})
export class XrplTransactionsComponent implements OnInit {
  
  xrplAccount:string = null;
  xrplAccount_Info:any = null;
  xrplAccount_Objects: any = null;

  lastTrxLinkBithomp:string;
  lastTrxLinkXrplOrg:string;
  lastTrxLinkXrpScan:string;
  lastTrxLinkXrp1ntel:string;
  lastTrxLinkXrplorer:string;

  accountInfoChanged: Subject<AccountInfoChanged> = new Subject<AccountInfoChanged>();
  accountObjectsChanged: Subject<AccountObjectsChanged> = new Subject<AccountObjectsChanged>();
  transactionSuccessfull: Subject<any> = new Subject<any>();

  isTestMode:boolean = false;

  loadingData:boolean = false;
  cannotConnectToNode:boolean = false;

  dismissInfo:boolean = false;

  constructor(
    private matDialog: MatDialog,
    private route: ActivatedRoute,
    private xummApi: XummService,
    private snackBar: MatSnackBar,
    private googleAnalytics: GoogleAnalyticsService,
    private localStorage: LocalStorageService,
    private overlayContainer: OverlayContainer,
    private xrplWebsocket: XRPLWebsocket) { }

  async ngOnInit() {
    if(this.localStorage && !this.localStorage.get("darkMode")) {
      this.overlayContainer.getContainerElement().classList.remove('dark-theme');
      this.overlayContainer.getContainerElement().classList.add('light-theme');
    } else {
        this.overlayContainer.getContainerElement().classList.remove('light-theme');
        this.overlayContainer.getContainerElement().classList.add('dark-theme');
    }

    this.dismissInfo = this.localStorage && this.localStorage.get("dismissInfo");

    this.route.queryParams.subscribe(async params => {
      let payloadId = params.payloadId;
      let signinToValidate = params.signinToValidate;
      if(payloadId) {
        this.googleAnalytics.analyticsEventEmitter('opened_with_payload_id', 'opened_with_payload', 'xrpl_transactions_component');
        //check if transaction was successfull and redirect user to stats page right away:
        this.snackBar.open("Loading ...", null, {panelClass: 'snackbar-success', horizontalPosition: 'center', verticalPosition: 'top'});
        //console.log(JSON.stringify(payloadInfo));
        if(signinToValidate) {
            let signInCheck:TransactionValidation = await this.xummApi.checkSignIn(payloadId);

            if(signInCheck.success) {
              this.snackBar.dismiss();
              this.snackBar.open("Login successfull. Loading account data...", null, {panelClass: 'snackbar-success', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
              await this.handleTransactionInfo(signInCheck);
            } else {
              this.snackBar.dismiss();
              this.snackBar.open("Login not successfull. Cannot load account data. Please try again!", null, {panelClass: 'snackbar-failed', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
            }    
        } else {
          let transactionResult:TransactionValidation = await this.xummApi.validateTransaction(payloadId);

          await this.handleTransactionInfo(transactionResult);

          this.snackBar.dismiss();
          if(transactionResult && transactionResult.success) {
            this.snackBar.open("Your transaction was successfull on " + (transactionResult.testnet ? 'test net.' : 'live net.'), null, {panelClass: 'snackbar-success', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
          } else {
            this.snackBar.open("Your transaction was not successfull. Please try again.", null, {panelClass: 'snackbar-failed', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'})
          }
        }
      }

      //console.log("check logged in account xrpl");
      //console.log(this.localStorage.get("xrplAccount"));
      //console.log(this.localStorage.get("testMode"));

      if(!this.xrplAccount && this.localStorage.get("xrplAccount")) {
        this.xrplAccount = this.localStorage.get("xrplAccount");
        this.isTestMode = this.localStorage.get("testMode");
        this.loadAccountData(true);
      }
    });

    //this.xrplAccount="rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B"; //bitstamp
    //this.xrplAccount="rNixerUVPwrhxGDt4UooDu6FJ7zuofvjCF";
    //this.isTestMode = true;
    //this.xrplAccount="rpPVUDK8xSYejBHA1431nKDaaM8wnKt3Rc";
    
    //this.xrplAccount="rU2mEJSLqBRkYLVTv55rFTgQajkLTnT6mA";
    //await this.loadAccountData(false);
  }

  changeNetwork() {
    this.loadAccountData(false);
  }

  async loadAccountData(isInit?: boolean) {
    if(this.xrplAccount) {
      this.googleAnalytics.analyticsEventEmitter('loading_account_data', 'account_data', 'xrpl_transactions_component');
      this.cannotConnectToNode = false;
      this.loadingData = true;

      this.localStorage.set("xrplAccount", this.xrplAccount);
      this.localStorage.set("testMode", this.isTestMode);

      let account_info_request:any = {
        command: "account_info",
        account: this.xrplAccount,
        "strict": true,
      }

      let message_acc_info:any = await this.xrplWebsocket.getWebsocketMessage("xrpl-transactions", account_info_request, this.isTestMode);
      //console.log("xrpl-transactions account info: " + JSON.stringify(message_acc_info));

      if(message_acc_info && message_acc_info.status && message_acc_info.type && message_acc_info.type === 'response') {
        if(message_acc_info.status === 'success' && message_acc_info.result && message_acc_info.result.account_data) {
          this.xrplAccount_Info = message_acc_info.result.account_data;
          //console.log("xrplAccount_Info: " + JSON.stringify(this.xrplAccount_Info));
          this.emitAccountInfoChanged();
        } else {
          this.xrplAccount_Info = message_acc_info;
          this.emitAccountInfoChanged();
        }
      } else {
        this.xrplAccount_Info = null;
        this.emitAccountInfoChanged();
      }

      this.cannotConnectToNode = message_acc_info && message_acc_info.error && message_acc_info.message === 'No node connection possible';

      if(!this.cannotConnectToNode) {

        let account_objects_request:any = {
          command: "account_objects",
          account: this.xrplAccount,
          type: "signer_list",
        }

        let message_acc_objects:any = await this.xrplWebsocket.getWebsocketMessage("xrpl-transactions", account_objects_request, this.isTestMode);
        //console.log("xrpl-transactions account objects:: " + JSON.stringify(message_acc_objects));

        if(message_acc_objects && message_acc_objects.status && message_acc_objects.type && message_acc_objects.type === 'response') {
          if(message_acc_objects.status === 'success' && message_acc_objects.result && message_acc_objects.result.account_objects) {
            this.xrplAccount_Objects = message_acc_objects.result.account_objects;
            //console.log("xrplAccount_Objects: " + JSON.stringify(this.xrplAccount_Objects));
            this.emitAccountObjectsChanged();
          } else {
            this.xrplAccount_Objects = message_acc_objects;
            this.emitAccountObjectsChanged();
          }
        } else {
          this.xrplAccount_Objects = null;
          this.emitAccountObjectsChanged();
        }

        if(isInit && this.snackBar)
          this.snackBar.dismiss();

      }

      this.loadingData = false;
    } else {
      this.emitAccountInfoChanged();
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
        this.loadingData = true;
        this.xrplAccount = info.account;
      }

      if(this.xrplAccount) {
        this.loadAccountData(false);
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

  async handleTransactionInfo(trxInfo:TransactionValidation) {
    if(trxInfo && trxInfo.account) {
      this.loadingData = true;
      this.xrplAccount = trxInfo.account;
    }

    if(trxInfo && trxInfo.success) {
      this.googleAnalytics.analyticsEventEmitter('handle_transaction_success', 'handle_transaction', 'xrpl_transactions_component');
      this.isTestMode = trxInfo.testnet;

      if(trxInfo.txid) {
        if(trxInfo.testnet) {
          this.lastTrxLinkBithomp = "https://test.bithomp.com/explorer/"+trxInfo.txid;
          this.lastTrxLinkXrplOrg = "https://testnet.xrpl.org/transactions/"+trxInfo.txid;
        } else {
          this.lastTrxLinkBithomp = "https://bithomp.com/explorer/"+trxInfo.txid;
          this.lastTrxLinkXrplOrg = "https://livenet.xrpl.org/transactions/"+trxInfo.txid;
          this.lastTrxLinkXrpScan = "https://xrpscan.com/tx/"+trxInfo.txid;
          this.lastTrxLinkXrp1ntel = "https://xrp1ntel.com/tx/"+trxInfo.txid;
          this.lastTrxLinkXrplorer = "https://xrplorer.com/transaction/"+trxInfo.txid;
        }

        this.transactionSuccessfull.next();
      }
    } else {
      this.googleAnalytics.analyticsEventEmitter('handle_transaction_failed', 'handle_transaction', 'xrpl_transactions_component');
      this.lastTrxLinkBithomp = null;
      this.lastTrxLinkXrplOrg = null;
      this.lastTrxLinkXrpScan = null;
    }

    if(this.xrplAccount) {
      await this.loadAccountData(false);
    }
  }

  emitAccountInfoChanged() {
    //console.log("emit account info changed");
    this.accountInfoChanged.next({info: this.xrplAccount_Info, mode: this.isTestMode});
  }

  emitAccountObjectsChanged() {
    //console.log("emit account objects changed");
    this.accountObjectsChanged.next({object: this.xrplAccount_Objects, mode: this.isTestMode});
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

  getAvailableBalance(): number {
    if(this.xrplAccount_Info && this.xrplAccount_Info.Balance) {
      let balance:number = Number(this.xrplAccount_Info.Balance);
      balance = balance - (20*1000000); //deduct acc reserve
      balance = balance - (this.xrplAccount_Info.OwnerCount * 5 * 1000000); //deduct owner count
      balance = balance/1000000;

      if(balance >= 0.000001)
        return balance;
      else
        return 0;
        
    } else {
      return 0;
    }
  }

  logoutAccount() {
    this.googleAnalytics.analyticsEventEmitter('logout_clicked', 'logout', 'xrpl_transactions_component');
    this.xrplAccount = this.xrplAccount_Info = this.xrplAccount_Objects = this.lastTrxLinkBithomp = this.lastTrxLinkXrp1ntel = this.lastTrxLinkXrpScan = this.lastTrxLinkXrplOrg = this.lastTrxLinkXrplorer = null;
    this.localStorage.remove("xrplAccount");
    this.localStorage.remove("testMode");
    this.emitAccountInfoChanged();
    this.emitAccountObjectsChanged();
  }

  gotIt() {
    this.dismissInfo = true;
    this.localStorage.set("dismissInfo", true);
  }
}
