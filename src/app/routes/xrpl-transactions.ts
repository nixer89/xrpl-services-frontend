import { Component, NgZone, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { XummSignDialogComponent } from '../components/xummSignRequestDialog';
import { GenericPayloadQRDialog } from '../components/genericPayloadQRDialog';
import { GenericDialogComponent } from '../components/genericDialog';
import { Subject } from 'rxjs'
import { Router, ActivatedRoute } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { XummService } from '../services/xumm.service'
import { GenericBackendPostRequest, TransactionValidation, AccountInfoChanged, AccountObjectsChanged } from '../utils/types';
import { XummTypes } from 'xumm-sdk';
import { LocalStorageService } from 'angular-2-local-storage';
import { OverlayContainer } from '@angular/cdk/overlay';
import { XRPLWebsocket } from '../services/xrplWebSocket';
import { DeviceDetectorService } from 'ngx-device-detector';

@Component({
  selector: 'xrpl-transactions',
  templateUrl: './xrpl-transactions.html',
})
export class XrplTransactionsComponent implements OnInit {
  
  xrplAccount:string = null;
  xrplAccount_Info:any = null;
  xrplAccount_Objects:any[] = null;

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

  accountReserve:number = 10000000;
  ownerReserve:number = 2000000;

  constructor(
    private matDialog: MatDialog,
    private router: Router,
    private route: ActivatedRoute,
    private xummApi: XummService,
    private snackBar: MatSnackBar,
    private localStorage: LocalStorageService,
    private overlayContainer: OverlayContainer,
    private xrplWebsocket: XRPLWebsocket,
    private deviceDetector: DeviceDetectorService) { }

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
        payloadId = this.router.getCurrentNavigation().extras.state.payloadId
        //this.router.getCurrentNavigation().extras.state = null;
      }

      let signinToValidate = params.signinToValidate;

      if(payloadId) {
        //check if transaction was successful and redirect user to stats page right away:
        this.snackBar.open("Loading ...", null, {panelClass: 'snackbar-success', horizontalPosition: 'center', verticalPosition: 'top'});
        //console.log(JSON.stringify(payloadInfo));
        if(signinToValidate) {
            let signInCheck:TransactionValidation = await this.xummApi.checkSignIn(payloadId);

            if(signInCheck.success) {
              this.snackBar.dismiss();
              this.snackBar.open("Login successful. Loading account data...", null, {panelClass: 'snackbar-success', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
              await this.handleTransactionInfo(signInCheck);
            } else {
              this.snackBar.dismiss();
              this.snackBar.open("Login not successful. Cannot load account data. Please try again!", null, {panelClass: 'snackbar-failed', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
            }    
        } else {

          let transactionResult:TransactionValidation = await this.xummApi.validateTransaction(payloadId);

          transactionResult.payloadId = payloadId;

          await this.handleTransactionInfo(transactionResult);

          this.snackBar.dismiss();
          if(transactionResult && transactionResult.success) {
            this.snackBar.open("Your transaction was successful on " + (transactionResult.testnet ? 'test net.' : 'main net.'), null, {panelClass: 'snackbar-success', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
          } else {
            this.snackBar.open("Your transaction was not successful. Please try again.", null, {panelClass: 'snackbar-failed', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'})
          }
        }
      }

      if(params.issuer && params.currency && params.limit) {
        if(params && ((params.testmode && params.testmode.toLowerCase() === 'true') || (params.testnet && params.testnet.toLowerCase() === 'true') || (params.test && params.test.toLowerCase() === 'true'))) {
          if(!this.isTestMode) {
            this.isTestMode = true;
            this.networkChanged();
          }
        } else {
          if(this.isTestMode) {
            this.isTestMode = false;
            this.networkChanged();
          }
        }
      }

      //console.log("check logged in account xrpl");
      //console.log(this.localStorage.get("xrplAccount"));
      //console.log(this.localStorage.get("testMode"));

      if(!this.xrplAccount && this.localStorage.get("xrplAccount")) {
        this.xrplAccount = this.localStorage.get("xrplAccount");
        
        if(this.localStorage.keys().includes("testMode"))
          this.isTestMode = this.localStorage.get("testMode");
          
        this.loadAccountData(true);
      }
    });

    this.loadFeeReserves();

    //this.xrplAccount="rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B"; //bitstamp
    //this.xrplAccount="rNixerUVPwrhxGDt4UooDu6FJ7zuofvjCF";
    
    //this.xrplAccount="rpPVUDK8xSYejBHA1431nKDaaM8wnKt3Rc";
    
    //this.xrplAccount="r4LxkCUXYTCUgwquN3BnsUxFacoVLjGFyF";
    //this.isTestMode = true;
    //await this.loadAccountData(false);
  }

  networkChanged() {
    this.loadFeeReserves()
    this.loadAccountData(false);
  }

  async loadFeeReserves() {
    let fee_request:any = {
      command: "ledger_entry",
      index: "4BC50C9B0D8515D3EAAE1E74B29A95804346C491EE1A95BF25E4AAB854A6A651",
      ledger_index: "validated"
    }

    let feeSettingResult:any = await this.xrplWebsocket.getWebsocketMessage("fee-settings", fee_request, this.isTestMode);

    let feeSettingObject = feeSettingResult?.result?.node;

    if('ReserveBase' in feeSettingObject) {
      this.accountReserve = feeSettingObject.ReserveBase;
      this.ownerReserve = feeSettingObject.ReserveIncrement;
    } else {
      this.accountReserve = Number(feeSettingObject.ReserveBaseDrops);
      this.ownerReserve = Number(feeSettingObject.ReserveIncrementDrops);
    }

    //console.log("resolved accountReserve: " + this.accountReserve);
    //console.log("resolved ownerReserve: " + this.ownerReserve);

    this.emitAccountInfoChanged();
  }

  async loadAccountData(isInit?: boolean) {
    
      if(this.xrplAccount) {
        this.cannotConnectToNode = false;
        this.loadingData = true;

        this.localStorage.set("xrplAccount", this.xrplAccount);
        this.localStorage.set("testMode", this.isTestMode);

        let account_info_request:any = {
          command: "account_info",
          account: this.xrplAccount,
          "strict": true,
        }

        let message_acc_info:any = await this.xrplWebsocket.getWebsocketMessage("xrpl-transactions", account_info_request, this.isTestMode)
        //console.log("xrpl-transactions account info: " + JSON.stringify(message_acc_info));

        if(message_acc_info && message_acc_info.status && message_acc_info.type && message_acc_info.type === 'response') {
          if(message_acc_info.status === 'success' && message_acc_info.result && message_acc_info.result.account_data) {
            this.xrplAccount_Info = message_acc_info.result.account_data;
            if(this.xrplAccount_Info.urlgravatar)
              this.xrplAccount_Info.urlgravatar = this.xrplAccount_Info.urlgravatar.replace('http','https');
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

          this.xrplAccount_Objects = null;

          let account_objects_request:any = {
            command: "account_objects",
            account: this.xrplAccount,
            ledger_index: "validated",
            limit: 200
          }
    
          let accountObjects:any = await this.xrplWebsocket.getWebsocketMessage("account-objects", account_objects_request, this.isTestMode);

          //load more escrows
          if(accountObjects?.result?.account_objects) {

              this.xrplAccount_Objects = accountObjects.result.account_objects;
      
              let marker = accountObjects.result.marker;
      
              //console.log("marker: " + marker);
              //console.log("LEDGER_INDEX : " + accountLines.result.ledger_index);
    
      
              while(marker) {
                  //console.log("marker: " + marker);
                  account_objects_request.marker = marker;
                  account_objects_request.ledger_index = accountObjects.result.ledger_index;
    
                  //await this.xrplWebSocket.getWebsocketMessage("token-trasher", server_info, this.isTestMode);
      
                  accountObjects = await this.xrplWebsocket.getWebsocketMessage("account-objects", account_objects_request, this.isTestMode);

                  //console.log(JSON.stringify(accountObjects));
      
                  marker = accountObjects?.result?.marker;
      
                  if(accountObjects?.result?.account_objects) {
                      this.xrplAccount_Objects = this.xrplAccount_Objects.concat(accountObjects.result.account_objects)
                      account_objects_request.marker = marker;
                  } else {
                      marker = null;
                  }
              }
          }

          this.emitAccountObjectsChanged();

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
    if(trxInfo && trxInfo.account && (!trxInfo.originalPayload || (trxInfo.originalPayload && trxInfo.originalPayload.custom_meta && trxInfo.originalPayload.custom_meta.blob && !trxInfo.originalPayload.custom_meta.blob.noSignIn))) {
      this.loadingData = true;
      this.xrplAccount = trxInfo.account;
    }

    if(trxInfo) {
      if(trxInfo.success && trxInfo.testnet != null)
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

        if(trxInfo.success) {
          this.transactionSuccessfull.next();

          this.handleEscrowCreate(trxInfo);
        }

        //christmas over, do not generate image anmore!
        //if(trxInfo.account != null && this.localStorage) {
        //    this.createRandomImage(trxInfo.account);
        //}
      }
    } else {
      this.lastTrxLinkBithomp = null;
      this.lastTrxLinkXrplOrg = null;
      this.lastTrxLinkXrpScan = null;
    }

    if(this.xrplAccount) {
      await this.loadAccountData(false);
    }
  }

  createRandomImage(account:string) {
    try {
      let giftSendTime:number = this.localStorage.get("gift_time");

      if(!giftSendTime || (giftSendTime < (Date.now() - 86400000))) { //check non existent or older than 24 h
        //make christmas gift!
        let elements:HTMLCollectionOf<HTMLDivElement> = document.getElementsByTagName("div");
        let randomNumber = this.randomIntFromInterval(0, elements.length-1);
        let randomElement = elements.item(randomNumber)

        let img = document.createElement('img');
        img.src = "../../assets/christmas.png";

        if(this.deviceDetector.isMobile()) {
          img.height = 20;
          img.width = 20;
          img.setAttribute("style", "cursor: pointer; padding: 5px;");
        } else {
          img.height = 30;
          img.width = 30;
          img.setAttribute("style", "cursor: pointer; padding: 10px;");
        }
        
        img.onclick = (event => {
          this.xummApi.makeChristmasPaymentRequest(account);
          this.snackBar.open("Merry Christmas! If you are lucky, you will receive a small gift within the next 24 hours!", null, {panelClass: 'snackbar-success', duration: 8000, horizontalPosition: 'center', verticalPosition: 'top'});
          this.localStorage.set("gift_time", Date.now());
          //delete image
          img.remove();
        });
        randomElement.appendChild(img);
      }
    } catch(err) {
      //ignore everything!
    }
  }

  async handleEscrowCreate(trxInfo: TransactionValidation) {
    if(trxInfo.originalPayload) {
      let payload:XummTypes.XummGetPayloadResponse = trxInfo.originalPayload;
      if(payload && payload.payload && payload.payload.request_json) {
        let trx:XummTypes.XummJsonTransaction = payload.payload.request_json;
        if(trx.TransactionType === "EscrowCreate" && trx.FinishAfter && !trx.Condition && (!trx.CancelAfter || (Number(trx.CancelAfter) - Number(trx.FinishAfter)) > 90*60)) {
          //ask user to add escrow to auto execution
          const dialogRef = this.matDialog.open(GenericDialogComponent, {
            width: 'auto',
            height: 'auto;',
            data: {
              line1: "Do you want to add your new Escrow to the automatic 'Escrow Releaser' service?",
              line2: "That means you do not need to take care of releasing your Escrow once it's finished. We will do it for you!",
              btnLeft: "Yes",
              btnRight: "No"
            }
          });
      
          dialogRef.afterClosed().subscribe((result:any) => {
            //console.log('The generic dialog was closed: ' + JSON.stringify(info));
      
            if(result) {
              this.router.navigate(['/tools'], {queryParams:{"escrowReleaser":"open"}});
            }
          });
        }
      }
    }
  }

  emitAccountInfoChanged() {
    //console.log("emit account info changed");
    this.accountInfoChanged.next({info: this.xrplAccount_Info, mode: this.isTestMode, accountReserve: this.accountReserve, ownerReserve: this.ownerReserve});
  }

  emitAccountObjectsChanged() {
    //console.log("emit account objects changed");
    this.accountObjectsChanged.next({objects: this.xrplAccount_Objects, mode: this.isTestMode});
  }

  async onPayloadReceived(xummPayload:XummTypes.XummPostPayloadBodyJson) {
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
    this.xrplAccount = this.xrplAccount_Info = this.xrplAccount_Objects = this.lastTrxLinkBithomp = this.lastTrxLinkXrp1ntel = this.lastTrxLinkXrpScan = this.lastTrxLinkXrplOrg = this.lastTrxLinkXrplorer = null;
    this.localStorage.remove("xrplAccount");
    this.localStorage.remove("testMode");
    this.emitAccountInfoChanged();
    this.emitAccountObjectsChanged();
    this.router.navigate(['/'])
  }

  gotIt() {
    this.dismissInfo = true;
    this.localStorage.set("dismissInfo", true);
  }

  private randomIntFromInterval(min, max) { // min and max included 
    return Math.floor(Math.random() * (max - min + 1) + min)
  }
}
