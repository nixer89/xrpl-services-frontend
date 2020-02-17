import { Component, OnInit, Inject } from "@angular/core";
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';

@Component({
    selector: "escrowListDialog",
    templateUrl: "escrowListDialog.html"
})
export class EscrowListDialog implements OnInit {

    websocket: WebSocketSubject<any>;
    escrowData:any[] = [];
    displayedColumns: string[] = ['destination', 'amount', 'finishafter'];
    loading:boolean = true;

    constructor(
        public dialogRef: MatDialogRef<EscrowListDialog>,
        @Inject(MAT_DIALOG_DATA) public data: any) {}

    ngOnInit() {
        this.loading = true;
        this.loadEscrowList();
    }

    loadEscrowList() {
        if(this.data.xrplAccount) {
            this.websocket = webSocket(this.data.testMode ? 'wss://testnet.xrpl-labs.com' : 'wss://s1.ripple.com');
      
            this.websocket.asObservable().subscribe(async message => {
              console.log("websocket message: " + JSON.stringify(message));
              if(message.status && message.status === 'success' && message.type && message.type === 'response') {
                if(message.result && message.result.account === this.data.xrplAccount && message.result.account_objects) {
                  this.escrowData = message.result.account_objects;
                  this.loading = false;
                }
                else if(message.result && message.result.TransactionType === 'EscrowCreate') {
                    console.log("Sequence: " + message.result.Sequence);
                    this.dialogRef.close({escrowSequence: message.result.Sequence})
                }
                  //console.log("xrplAccountData");
              } else {
                this.escrowData = null;
              }
            });
      
            let account_objects_request:any = {
              command: "account_objects",
              account: this.data.xrplAccount,
              type: "escrow",
              ledger_index: "validated",
            }
      
            this.websocket.next(account_objects_request);
        }
    }

    getFinishAfterTime(rippleCodedFinishAfter: number): string {
        if(rippleCodedFinishAfter) {
            let finishAfter:Date = new Date((rippleCodedFinishAfter+946684800)*1000);
            return finishAfter.toLocaleString();
        } else
            return "";
    }

    getAmountInXRP(amount: string): Number {
        return Number.parseInt(amount) / 1000000;
    }

    escrowSelected(escrow: any) {
        let txInfo:any = {
            command: "tx",
            transaction: escrow.PreviousTxnID,
        }

        this.websocket.next(txInfo);
    }
}