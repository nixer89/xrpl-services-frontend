import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { XummSignDialogComponent } from '../components/xummSignRequestDialog';
import { GenericPayloadQRDialog } from '../components/genericPayloadQRDialog';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { Subject } from 'rxjs'
import { XummService } from '../services/xumm.service';

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

  constructor(
    private signDialog: MatDialog,
    private xumm: XummService) { }

  async ngOnInit() {
    this.xrplAccount="rwCNdWiEAzbMwMvJr6Kn6tzABy9zHNeSTL";
    await this.loadAccountData();
  }

  async loadAccountData() {
    if(this.xrplAccount) {
      this.websocket = webSocket('wss://testnet.xrpl-labs.com');

      this.websocket.asObservable().subscribe(async message => {
        console.log("websocket message: " + JSON.stringify(message));
        if(message.status && message.status === 'success' && message.type && message.type === 'response') {
          if(message.result && message.result.account_data)
            this.xrplAccountData = message.result.account_data;
            console.log("xrplAccountData");
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

    dialogRef.afterClosed().subscribe((xrplAccount:string) => {
      console.log('The dialog was closed');
      console.log(xrplAccount);
      this.xrplAccount = xrplAccount;

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

    dialogRef.afterClosed().subscribe((transactionInfo:any) => {
      console.log('The generic dialog was closed');
      if(transactionInfo) {
        this.xrplAccount = transactionInfo.xrplAccount;
        this.lastTrxLink = transactionInfo.txLink;
      } else {
        this.xrplAccount = null;
        this.lastTrxLink = null;
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
    this.openGenericDialog(payload);
  }
}
