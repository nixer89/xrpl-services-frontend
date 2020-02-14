import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { XummSignDialogComponent } from '../components/xummSignRequestDialog';
import { GenericPayloadQRDialog } from '../components/genericPayloadQRDialog';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { Subject } from 'rxjs'
import { ActivatedRoute } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { XummService } from '../services/xumm.service'

@Component({
  selector: 'app-xrpl-transactions',
  templateUrl: './xrpl-transactions.html',
})
export class XrplTransactionsComponent implements OnInit {
  
  xrplAccount:string;
  xrplAccountData:any;

  lastTrxLink:string;

  accountInfoChanged: Subject<void> = new Subject<void>();
  websocket: WebSocketSubject<any>;

  isTestMode:boolean = true;

  constructor(
    private signDialog: MatDialog,
    private route: ActivatedRoute,
    private xummApi: XummService,
    private snackBar: MatSnackBar) { }

  async ngOnInit() {
    //this.xrplAccount="rwCNdWiEAzbMwMvJr6Kn6tzABy9zHNeSTL";
    //await this.loadAccountData();

    this.route.queryParams.subscribe(async params => {
      let payloadId = params.payloadId;
      if(payloadId) {
        //check if transaction was successfull and redirect user to stats page right away:
        let payloadInfo = await this.xummApi.getPayloadInfo(payloadId);
        console.log(JSON.stringify(payloadInfo));
        if(payloadInfo && payloadInfo.response && payloadInfo.response.account) {
            this.snackBar.open("Login successfull. Loading account data...", null, {panelClass: 'snackbar-success', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
            this.xrplAccount = payloadInfo.response.account;
            this.loadAccountData();
        } else {
            this.snackBar.open("Login not successfull. Cannot load account data. Please try again!", null, {panelClass: 'snackbar-failed', duration: 5000, horizontalPosition: 'center', verticalPosition: 'top'});
        }
      }
    });
  }

  async loadAccountData() {
    if(this.xrplAccount) {
      this.websocket = webSocket(this.isTestMode ? 'wss://testnet.xrpl-labs.com' : 'wss://s1.ripple.com');

      this.websocket.asObservable().subscribe(async message => {
        console.log("websocket message: " + JSON.stringify(message));
        if(message.status && message.status === 'success' && message.type && message.type === 'response') {
          if(message.result && message.result.account_data)
            this.xrplAccountData = message.result.account_data;
            //console.log("xrplAccountData");
            this.emitAccountInfoChanged();
        } else {
          this.xrplAccountData = null;
          this.emitAccountInfoChanged();
        }
      });

      let account_info_request:any = {
        command: "account_info",
        account: this.xrplAccount,
        "strict": true,
      }

      this.websocket.next(account_info_request);
    }
  }

  openSignInDialog(): void {
    const dialogRef = this.signDialog.open(XummSignDialogComponent, {
      width: 'auto',
      height: 'auto;',
      data: {xrplAccount: null}
    });

    dialogRef.afterClosed().subscribe((info:any) => {
      console.log('The dialog was closed');
      console.log(info);
      if(info && info.redirect) {
        //nothing to do
      } else {
        this.xrplAccount = info;
      }

      if(this.xrplAccount) {
        this.loadAccountData();
      }
    });
  }

  openGenericDialog(payload: any):void {
    const dialogRef = this.signDialog.open(GenericPayloadQRDialog, {
      width: 'auto',
      height: 'auto;',
      data: payload
    });

    dialogRef.afterClosed().subscribe((info:any) => {
      console.log('The generic dialog was closed: ' + JSON.stringify(info));

      if(info && info.redirect) {
        //nothing to do
      } else {
        if(info && info.success) {
          this.xrplAccount = info.xrplAccount;
  
          this.isTestMode = info.testnet;
  
          if(info.txid) {
            if(info.testnet)
              this.lastTrxLink = "https://test.bithomp.com/explorer/"+info.txid;
            else
              this.lastTrxLink = "https://bithomp.com/explorer/"+info.txid;
          }
        } else {
          this.xrplAccount = null;
          this.lastTrxLink = null;
        }
      }

      if(this.xrplAccount) {
        this.loadAccountData();
      }
    });
  }

  emitAccountInfoChanged() {
    console.log("emit account info changed");
    this.accountInfoChanged.next(this.xrplAccountData);
  }

  async onPayloadReceived(payload:any) {
    console.log("received payload: " + JSON.stringify(payload));
    if(this.xrplAccount)
      payload.xrplAccount = this.xrplAccount;

    this.openGenericDialog(payload);
  }

  getAccountBalance(): number {
    if(this.xrplAccountData && this.xrplAccountData.Balance) {
      let balance:number = Number(this.xrplAccountData.Balance);
      return balance/1000000;
    } else {
      return 0;
    }
  }

  logoutAccount() {
    this.xrplAccount = null;
    this.xrplAccountData = null;
    this.lastTrxLink = null;
    this.emitAccountInfoChanged();
  }

}
