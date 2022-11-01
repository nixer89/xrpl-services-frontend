import { Component, OnInit, ViewChild } from '@angular/core';
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

  @ViewChild('inpdomain') inpcustomnode;
  customNodeInput: string = "";
  
  xrplAccount:string = null;
  xrplAccount_Info:any = null;

  lasTrxLink:string;

  accountInfoChanged: Subject<AccountInfoChanged> = new Subject<AccountInfoChanged>();
  transactionSuccessfull: Subject<any> = new Subject<any>();

  loadingData:boolean = false;
  cannotConnectToNode:boolean = false;

  dismissInfo:boolean = false;

  accountReserve:number = 10000000;
  ownerReserve:number = 2000000;

  xummNodeUrl:string = null;
  validCustomNodeUrl:boolean = false;
  nodesAreSame:boolean = false;

  availableNetworks:any[] = [
    {value:"wss://hooks-testnet-v2.xrpl-labs.com", viewValue: "Hooks v2 Testnet"},
    {value:"wss://s.devnet.rippletest.net:51233", viewValue: "Devnet"},
    {value:"wss://xls20-sandbox.rippletest.net:51233", viewValue: "XLS20 Devnet"},
    {value: "custom", viewValue: "Custom"}
  ];

  selectedNode:string = "wss://hooks-testnet-v2.xrpl-labs.com";
  selectedNodeUrl: string = "wss://hooks-testnet-v2.xrpl-labs.com";

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
        //check if transaction was successful and redirect user to stats page right away:
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

      if(this.localStorage.keys().includes("nodeUrl") && this.localStorage.get("nodeUrl") != null)
        this.selectedNodeUrl = this.localStorage.get("nodeUrl");

      if(this.availableNetworks.includes(this.selectedNodeUrl))
        this.selectedNode = this.selectedNodeUrl;
      else
        this.selectedNode = "custom";

      if(this.localStorage.keys().includes("xummNodeUrl") && this.localStorage.get("xummNodeUrl") != null)
        this.xummNodeUrl = this.localStorage.get("xummNodeUrl");

      if(this.selectedNodeUrl && this.xummNodeUrl) {
        this.nodesAreSame = await this.areSameNodes(this.selectedNodeUrl, this.xummNodeUrl);
      }

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
            this.snackBar.open("Transaction successful! You have enabled the auto release feature for your escrow!", null, {panelClass: 'snackbar-success', duration: 10000, horizontalPosition: 'center', verticalPosition: 'top'});
            
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
          this.snackBar.open("Login successful. Loading account data...", null, {panelClass: 'snackbar-success', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
          await this.handleTransactionInfo(signInCheck);
        } else {
          this.snackBar.open("Login not successful. Cannot load account data. Please try again!", null, {panelClass: 'snackbar-failed', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
        }    
      } else {
        let transactionResult:TransactionValidation = await this.xummApi.validateTransaction(payloadId);

        this.snackBar.dismiss();
        if(transactionResult && transactionResult.success) {
          this.snackBar.open("Your transaction was successful on " + (transactionResult.testnet ? 'testnet.' : 'mainnet.'), null, {panelClass: 'snackbar-success', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
        } else {
          this.snackBar.open("Your transaction was not successful. Please try again.", null, {panelClass: 'snackbar-failed', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'})
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

  async networkChanged() {
    if(this.selectedNode != 'custom') {
      this.selectedNodeUrl = this.selectedNode;

      if(this.selectedNodeUrl != null) {
        this.loadingData = true;
        await this.loadFeeReserves()
        await this.loadAccountData(false);
        this.loadingData = false;
      }

    } else if(this.customNodeInput != null && this.customNodeInput.length > 0)
      this.selectedNodeUrl = this.customNodeInput.trim();
    else
      this.selectedNodeUrl = null;
  }

  checkUrlChange() {
    this.validCustomNodeUrl = this.customNodeInput && ( this.customNodeInput.trim().startsWith("ws://") || this.customNodeInput.trim().startsWith("wss://"));
    this.networkChanged();
  }

  async connectCustomNetwork() {
    if(this.selectedNode == 'custom' && this.validCustomNodeUrl) {
        this.loadingData = true;
        await this.loadFeeReserves()
        await this.loadAccountData(false);
        this.loadingData = false;
    }
  }

  async loadFeeReserves() {
    try {
      let fee_request:any = {
        command: "ledger_entry",
        index: "4BC50C9B0D8515D3EAAE1E74B29A95804346C491EE1A95BF25E4AAB854A6A651",
        ledger_index: "validated"
      }

      let feeSetting:any = await this.xrplWebSocket.getWebsocketMessage("fee-settings", fee_request, this.selectedNode);
      this.accountReserve = feeSetting?.result?.node["ReserveBase"];
      this.ownerReserve = feeSetting?.result?.node["ReserveIncrement"];

      //console.log("resolved accountReserve: " + this.accountReserve);
      //console.log("resolved ownerReserve: " + this.ownerReserve);

      this.emitAccountInfoChanged();
    } catch(err) {
      this.loadingData = false;
      throw "Can not connect to node!";
    }
  }

  async loadAccountData(isInit?: boolean) {
    try {
      if(this.xrplAccount) {
        this.googleAnalytics.analyticsEventEmitter('loading_account_data', 'account_data', 'tools_component');

        this.localStorage.set("xrplAccount", this.xrplAccount);
        this.localStorage.set("nodeUrl", this.selectedNode);
        this.localStorage.set("xummNodeUrl", this.xummNodeUrl);

        this.cannotConnectToNode = false;
        this.loadingData = true;

        let account_info_request:any = {
          command: "account_info",
          account: this.xrplAccount,
          "strict": true,
        }

        let message:any = await this.xrplWebSocket.getWebsocketMessage("tools", account_info_request, this.selectedNode);
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

        console.log(this.xrplAccount_Info);

        this.cannotConnectToNode = message && message.error && message.message === 'No node connection possible';

        if(isInit && this.snackBar)
          this.snackBar.dismiss();

        this.loadingData = false;

      } else {
        this.emitAccountInfoChanged();
      }
    } catch(err) {
      this.loadingData = false;
      throw "Can not connect to node!";
    }
  }

  openSignInDialog(): void {
    const dialogRef = this.matDialog.open(XummSignDialogComponent, {
      width: 'auto',
      height: 'auto;',
      data: {xrplAccount: null}
    });

    dialogRef.afterClosed().subscribe(async (info:TransactionValidation) => {
      //console.log('The dialog was closed');
      //console.log(info);
      if(info && info.redirect) {
        //nothing to do
      } else if(info && info.account) {
        this.loadingData = true;
        this.xrplAccount = info.account;

        this.xummNodeUrl = !info.xummNodeUrl.startsWith("ws") ? "wss://"+info.xummNodeUrl : info.xummNodeUrl;
        this.nodesAreSame = await this.areSameNodes(this.selectedNodeUrl, this.xummNodeUrl);
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
      this.xummNodeUrl = trxInfo.xummNodeUrl;
    }

    if(trxInfo) {
      this.googleAnalytics.analyticsEventEmitter('handle_transaction_success', 'handle_transaction', 'tools_component');

      if(trxInfo.testnet != null)

      
      if(trxInfo.txid) {
        
        let shortNodeUrl = this.selectedNodeUrl;
        shortNodeUrl = shortNodeUrl.replace('wss://','');
        shortNodeUrl = shortNodeUrl.replace('ws://','');

        this.lasTrxLink = "https://sidechain.xrpl.org/"+shortNodeUrl+"/transactions/"+trxInfo.txid;

        if(trxInfo.success)
          this.transactionSuccessfull.next();
      }
    } else {
      this.googleAnalytics.analyticsEventEmitter('handle_transaction_failed', 'handle_transaction', 'tools_component');
      this.lasTrxLink = null;
    }

    if(this.xrplAccount) {
      await this.loadAccountData(false);
    }
  }

  emitAccountInfoChanged() {
    //console.log("emit account info changed");
    this.accountInfoChanged.next({info: this.xrplAccount_Info, accountReserve: this.accountReserve, ownerReserve: this.ownerReserve, nodeUrl: this.selectedNode, xummNodeUrl: this.xummNodeUrl});
  }

  async onPayloadReceived(genericBackendRequest: GenericBackendPostRequest) {
    //console.log("received payload: " + JSON.stringify(payload));

    if(!this.nodesAreSame) {
      //not same nodes, we have to set some things here!
      genericBackendRequest.payload.txjson.Sequence = this.xrplAccount_Info.Sequence;
    }

    if(!genericBackendRequest.options)
      genericBackendRequest.options = {};
      
    genericBackendRequest.options.xrplAccount = this.xrplAccount ? this.xrplAccount : null
    genericBackendRequest.options.submit = this.xummNodeUrl === this.selectedNodeUrl,
    genericBackendRequest.options.submitUrl = this.selectedNodeUrl

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
      balance = balance - (this.accountReserve); //deduct acc reserve
      balance = balance - (this.xrplAccount_Info.OwnerCount * this.ownerReserve); //deduct owner count
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
    this.googleAnalytics.analyticsEventEmitter('logout_clicked', 'logout', 'tools_component');
    this.xrplAccount = this.xrplAccount_Info = this.lasTrxLink = null;
    this.xummNodeUrl = null;
    this.localStorage.remove("xrplAccount");
    this.localStorage.remove("xummNodeUrl");
    this.emitAccountInfoChanged();
    this.router.navigate(['/tools'])
  }

  gotIt() {
    this.dismissInfo = true;
    this.localStorage.set("dismissInfo", true);
  }

  async areSameNodes(nodeUrl1: string, nodeUrl2: string) {
    console.log("Checking:")
    console.log(nodeUrl1);
    console.log(nodeUrl2);

    if(nodeUrl1 === nodeUrl2)
      return true;

    if(!nodeUrl1 || !nodeUrl2)
      return false;

    if(!nodeUrl1.startsWith("ws") || !nodeUrl2.startsWith("ws"))
      return false;

    //get server info node 1

    let nodePubKey1:string;
    let nodePubKey2:string;

    try {
      let server_info_request = {
        command: "server_info"
      }

      let serverResponse1 = await this.xrplWebSocket.getWebsocketMessage("server-info-1", server_info_request, nodeUrl1)
      console.log("serverResponse1: " + JSON.stringify(serverResponse1));

      nodePubKey1 = serverResponse1?.result?.info?.pubkey_node;

    } catch(err) {
      console.log(JSON.stringify(err));
      return false;
    }

    try {
      let server_info_request_2 = {
        command: "server_info"
      }

      let serverResponse2 = await this.xrplWebSocket.getWebsocketMessage("server-info-1", server_info_request_2, nodeUrl2)
      console.log("serverResponse2: " + JSON.stringify(serverResponse2));

      nodePubKey2 = serverResponse2?.result?.info?.pubkey_node;
      
    } catch(err) {
      console.log(JSON.stringify(err));
      return false;
    }

    console.log("comparing nodes:")
    console.log(nodePubKey1);
    console.log(nodePubKey2);

    return nodePubKey1 && nodePubKey2 && nodePubKey1 === nodePubKey2;
  }

}
