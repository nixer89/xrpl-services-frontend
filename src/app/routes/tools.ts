import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { XummSignDialogComponent } from '../components/xummSignRequestDialog';
import { GenericPayloadQRDialog } from '../components/genericPayloadQRDialog';
import { Subject } from 'rxjs'
import { Router, ActivatedRoute } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { XummService } from '../services/xumm.service'
import { GenericBackendPostRequest, TransactionValidation, AccountInfoChanged } from '../utils/types';
import { GoogleAnalyticsService } from '../services/google-analytics.service';
import { LocalStorageService } from 'angular-2-local-storage';
import { OverlayContainer } from '@angular/cdk/overlay';
import { XRPLWebsocket } from '../services/xrplWebSocket';
import { XummTypes } from 'xumm-sdk';
import { isValidXRPAddress } from '../utils/utils';

@Component({
  selector: 'tools',
  templateUrl: './tools.html',
})
export class Tools implements OnInit {
  
  xrplAccount:string = null;
  xrplAccount_Info:any = null;

  lastTrxLinkBithomp:string;
  lastTrxLinkXrplOrg:string;
  lastTrxLinkXrpScan:string;
  lastTrxLinkXrp1ntel:string;
  lastTrxLinkXrplorer:string;

  accountInfoChanged: Subject<AccountInfoChanged> = new Subject<AccountInfoChanged>();
  transactionSuccessfull: Subject<any> = new Subject<any>();

  isTestMode:boolean = false;

  loadingData:boolean = false;
  cannotConnectToNode:boolean = false;

  dismissInfo:boolean = false;

  accountReserve:number = 10000000;
  ownerReserve:number = 2000000;

  constructor(
    private matDialog: MatDialog,
    private router: Router,
    private route: ActivatedRoute,
    private xummApi: XummService,
    private snackBar: MatSnackBar,
    private googleAnalytics: GoogleAnalyticsService,
    private localStorage: LocalStorageService,
    private overlayContainer: OverlayContainer,
    private xrplWebSocket: XRPLWebsocket) { }

  async ngOnInit() {
    //console.log("on init");
    if(this.localStorage && !this.localStorage.get("darkMode")) {
      this.overlayContainer.getContainerElement().classList.remove('dark-theme');
      this.overlayContainer.getContainerElement().classList.add('light-theme');
    } else {
        this.overlayContainer.getContainerElement().classList.remove('light-theme');
        this.overlayContainer.getContainerElement().classList.add('dark-theme');
    }

    this.dismissInfo = this.localStorage && this.localStorage.get("dismissInfo");

    this.route.queryParams.subscribe(async params => {
      
      //remove payload from url and navigate again
      if(params && params.payloadId) {
        let state = {
          payloadId: params.payloadId
        }

        let newParams = {};

        for (var param in params) {
          if (params.hasOwnProperty(param) && param != "payloadId") {
            newParams[param] = params[param];
          }
        }


        return this.router.navigate(
          ['/'], 
          { relativeTo: this.route, queryParams: newParams, state: state }
        );
      }

      let payloadId = null;

      if(this.router.getCurrentNavigation() && this.router.getCurrentNavigation().extras && this.router.getCurrentNavigation().extras.state && this.router.getCurrentNavigation().extras.state.payloadId) {
        payloadId = this.router.getCurrentNavigation().extras.state.payloadId;
        //this.router.getCurrentNavigation().extras.state = null;
      }
      
      let signinToValidate = params.signinToValidate;
      if(payloadId) {
        this.googleAnalytics.analyticsEventEmitter('opened_with_payload_id', 'opened_with_payload', 'tools_component');
        //check if transaction was successfull and redirect user to stats page right away:
        this.snackBar.open("Loading ...", null, {panelClass: 'snackbar-success', horizontalPosition: 'center', verticalPosition: 'top'});
        //console.log(JSON.stringify(payloadInfo));

        await this.handlePayloadInfo(payloadId, signinToValidate);
      }
    });

    this.loadFeeReserves();

    //console.log("check logged in account tools");
    //console.log(this.localStorage.get("xrplAccount"));
    //console.log(this.localStorage.get("testMode"));

    if(!this.xrplAccount && this.localStorage.get("xrplAccount")) {
      this.xrplAccount = this.localStorage.get("xrplAccount");

      if(this.localStorage.keys().includes("testMode") && this.localStorage.get("testMode") != null)
        this.isTestMode = this.localStorage.get("testMode");

      await this.loadAccountData(true);
    }

    //this.xrplAccount="r3K1TgPvTPkWZR2Lhawpvv9YR7yYuqSXBp";
    //this.isTestMode = true;
    //this.xrplAccount="rwCNdWiEAzbMwMvJr6Kn6tzABy9zHNeSTL";
    //this.xrplAccount="rU2mEJSLqBRkYLVTv55rFTgQajkLTnT6mA";
    //await this.loadAccountData(false);
  }

  async handlePayloadInfo(payloadId:string, signinToValidate:any) {
    try {
      let payloadInfo:XummTypes.XummGetPayloadResponse = await this.xummApi.getPayloadInfo(payloadId);

      if(payloadInfo && payloadInfo.custom_meta && payloadInfo.custom_meta.blob) {
        let escrow:any = payloadInfo.custom_meta.blob;
        //console.log("Escrow :" + JSON.stringify(escrow));
        //console.log("Payload: " + JSON.stringify(payloadInfo));
        if(signinToValidate) {
          //handle disable auto release escrow
          let signInCheck = await this.xummApi.validateEscrowSignInToDelete(payloadId);

          //console.log("SignInCheck: " + JSON.stringify(signInCheck));
          if(signInCheck && signInCheck.success && signInCheck.account && isValidXRPAddress(signInCheck.account) && signInCheck.account == escrow.account) {
            //console.log(JSON.stringify(disableResponse));

            this.snackBar.dismiss();
            if(signInCheck.success) {
                this.snackBar.open("Ownership verified and auto release disabled!", null, {panelClass: 'snackbar-success', duration: 7500, horizontalPosition: 'center', verticalPosition: 'top'});
                this.googleAnalytics.analyticsEventEmitter('escrow_auto_release_disabled', 'escrow_executer', 'escrow_executer_component');
            } else {
                this.snackBar.open("Ownership verified but error disabling auto release!", null, {panelClass: 'snackbar-success', duration: 7500, horizontalPosition: 'center', verticalPosition: 'top'});
            }
          } else {
            this.snackBar.open("Could not verify ownership. You are not allowed to disable the auto release for this escrow!", null, {panelClass: 'snackbar-failed', duration: 7500, horizontalPosition: 'center', verticalPosition: 'top'});
          }

          await this.handleTransactionInfo(signInCheck);
        
        } else {
          //handle enable auto release escrow
          let trxInfo = await this.xummApi.validateEscrowPayment(payloadId);

          //console.log("txInfo: " + JSON.stringify(trxInfo));
          this.snackBar.dismiss();

          if(trxInfo && trxInfo.success && trxInfo.account && trxInfo.account == escrow.account && trxInfo.testnet == escrow.testnet) {
            //handle success
            this.snackBar.open("Transaction successfull! You have enabled the auto release feature for your escrow!", null, {panelClass: 'snackbar-success', duration: 10000, horizontalPosition: 'center', verticalPosition: 'top'});
            
            this.googleAnalytics.analyticsEventEmitter('pay_for_escrow_release', 'escrow_executer', 'escrow_executer_component');
          } else if( trxInfo && trxInfo.testnet && trxInfo.testnet != escrow.testnet) {
            this.snackBar.open("You have submitted a transaction on the " + (trxInfo.testnet ? "Testnet" : "Mainnet") + " for an escrow on the " + (escrow.testnet ? "Testnet": "Mainnet") + "! Can not activate Auto Release!", null, {panelClass: 'snackbar-failed', duration: 10000, horizontalPosition: 'center', verticalPosition: 'top'});
          } else if(trxInfo && trxInfo.account && trxInfo.account != escrow.account) {
                this.snackBar.open("Your account from the payment does not match the Escrow owner account. Can not enable Auto Releasing!", null, {panelClass: 'snackbar-failed', duration: 10000, horizontalPosition: 'center', verticalPosition: 'top'});
          } else {
              if(trxInfo) {
                this.snackBar.open(trxInfo && trxInfo.message ? trxInfo.message : "An error occured handling your payment", null, {panelClass: 'snackbar-failed', duration: 10000, horizontalPosition: 'center', verticalPosition: 'top'});
              } else {
                  //user closed, nothing to do
              }
          }

          await this.handleTransactionInfo(trxInfo);
        }
      } else if(signinToValidate) {
        let signInCheck:TransactionValidation = await this.xummApi.checkSignIn(payloadId);

        this.snackBar.dismiss();
        if(signInCheck.success) {
          this.snackBar.open("Login successfull. Loading account data...", null, {panelClass: 'snackbar-success', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
          await this.handleTransactionInfo(signInCheck);
        } else {
          this.snackBar.open("Login not successfull. Cannot load account data. Please try again!", null, {panelClass: 'snackbar-failed', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
        }    
      } else {
        let transactionResult:TransactionValidation = await this.xummApi.validateTransaction(payloadId);

        this.snackBar.dismiss();
        if(transactionResult && transactionResult.success) {
          this.snackBar.open("Your transaction was successfull on " + (transactionResult.testnet ? 'testnet.' : 'mainnet.'), null, {panelClass: 'snackbar-success', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
        } else {
          this.snackBar.open("Your transaction was not successfull. Please try again.", null, {panelClass: 'snackbar-failed', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'})
        }

        await this.handleTransactionInfo(transactionResult);
        
      }
    }catch(err) {
      console.log("ERR: " + JSON.stringify(err));
      if(err && err.message) {
        this.snackBar.open(err.message, null, {panelClass: 'snackbar-failed', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
      } else {
        this.snackBar.open("Backend could not be contacted. Please try again later!", null, {panelClass: 'snackbar-failed', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
      }
    }
  }

  networkChanged() {
    this.loadFeeReserves();
    this.loadAccountData(false);
  }

  async loadFeeReserves() {
    let fee_request:any = {
      command: "ledger_entry",
      index: "4BC50C9B0D8515D3EAAE1E74B29A95804346C491EE1A95BF25E4AAB854A6A651",
      ledger_index: "validated"
    }

    let feeSetting:any = await this.xrplWebSocket.getWebsocketMessage("fee-settings", fee_request, this.isTestMode);
    this.accountReserve = feeSetting?.result?.node["ReserveBase"];
    this.ownerReserve = feeSetting?.result?.node["ReserveIncrement"];

    //console.log("resolved accountReserve: " + this.accountReserve);
    //console.log("resolved ownerReserve: " + this.ownerReserve);

    this.emitAccountInfoChanged();
  }

  async loadAccountData(isInit?: boolean) {
    if(this.xrplAccount) {
      this.googleAnalytics.analyticsEventEmitter('loading_account_data', 'account_data', 'tools_component');

      this.localStorage.set("xrplAccount", this.xrplAccount);
      this.localStorage.set("testMode", this.isTestMode);

      this.cannotConnectToNode = false;
      this.loadingData = true;

      let account_info_request:any = {
        command: "account_info",
        account: this.xrplAccount,
        "strict": true,
      }

      let message:any = await this.xrplWebSocket.getWebsocketMessage("tools", account_info_request, this.isTestMode);
      //console.log("tools account info: " + JSON.stringify(message));

      if(message.status && message.type && message.type === 'response') {
        if(message.status === 'success') {
          if(message.result && message.result.account_data) {
            this.xrplAccount_Info = message.result.account_data;
            //console.log("xrplAccount_Info: " + JSON.stringify(this.xrplAccount_Info));
            this.emitAccountInfoChanged();
          }
        } else {
          if(message.request.command === 'account_info') {
            this.xrplAccount_Info = message;
            this.emitAccountInfoChanged();
          }
        }

      } else {
        this.xrplAccount_Info = null;
        this.emitAccountInfoChanged();
      }

      this.cannotConnectToNode = message && message.error && message.message === 'No node connection possible';

      if(isInit && this.snackBar)
        this.snackBar.dismiss();

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

    if(trxInfo) {
      this.googleAnalytics.analyticsEventEmitter('handle_transaction_success', 'handle_transaction', 'tools_component');

      if(trxInfo.testnet != null)
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

        if(trxInfo.success)
          this.transactionSuccessfull.next();
      }
    } else {
      this.googleAnalytics.analyticsEventEmitter('handle_transaction_failed', 'handle_transaction', 'tools_component');
      this.lastTrxLinkBithomp = null;
      this.lastTrxLinkXrplOrg = null;
      this.lastTrxLinkXrpScan = null;
      this.lastTrxLinkXrplorer = null;
    }

    if(this.xrplAccount) {
      await this.loadAccountData(false);
    }
  }

  emitAccountInfoChanged() {
    //console.log("emit account info changed");
    this.accountInfoChanged.next({info: this.xrplAccount_Info, accountReserve: this.accountReserve, ownerReserve: this.ownerReserve, mode: this.isTestMode});
  }

  async onPayloadReceived(genericBackendRequest: GenericBackendPostRequest) {
    //console.log("received payload: " + JSON.stringify(payload));

    if(!genericBackendRequest.options)
      genericBackendRequest.options = {};
      
    genericBackendRequest.options.xrplAccount = this.xrplAccount ? this.xrplAccount : null

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
      balance = balance - this.accountReserve; //deduct acc reserve
      balance = balance - (this.xrplAccount_Info.OwnerCount * this.ownerReserve); //deduct owner count
      return balance/1000000;
    } else {
      return 0;
    }
  }

  logoutAccount() {
    this.googleAnalytics.analyticsEventEmitter('logout_clicked', 'logout', 'tools_component');
    this.xrplAccount = this.xrplAccount_Info = this.lastTrxLinkBithomp = this.lastTrxLinkXrp1ntel = this.lastTrxLinkXrpScan = this.lastTrxLinkXrplOrg = this.lastTrxLinkXrplorer = null;
    this.localStorage.remove("xrplAccount");
    this.localStorage.remove("testMode");
    this.emitAccountInfoChanged();
    this.router.navigate(['/tools'])
  }

  gotIt() {
    this.dismissInfo = true;
    this.localStorage.set("dismissInfo", true);
  }

}
