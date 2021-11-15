import { Component, OnInit, Input, Output, EventEmitter, OnDestroy } from "@angular/core";
import { Observable, Subscription } from 'rxjs';
import { GoogleAnalyticsService } from '../../services/google-analytics.service';
import { XrplAccountChanged } from 'src/app/utils/types';
import { XRPLWebsocket } from '../../services/xrplWebSocket';
import * as normalizer from '../../utils/normalizers';

@Component({
    selector: "escrowList",
    templateUrl: "escrowList.html",
    styleUrls: ['./escrowList.css']
})
export class EscrowList implements OnInit, OnDestroy {

    @Input()
    escrowAccountChanged: Observable<XrplAccountChanged>;

    @Input()
    isFinish: boolean;

    @Input()
    isCancel: boolean;

    @Output()
    escrowSequenceFound: EventEmitter<any> = new EventEmitter();
    
    escrowData:any[] = [];
    displayedColumns: string[] = ['destination', 'amount', 'finishafter', 'cancelafter', 'condition'];
    loading:boolean = false;
    testMode:boolean = false;
    escrowClicked:boolean = false;

    private escrowAccountChangedSubscription: Subscription;

    constructor(private xrplWebSocket: XRPLWebsocket, private googleAnalytics: GoogleAnalyticsService) {}

    ngOnInit() {
        this.escrowAccountChangedSubscription = this.escrowAccountChanged.subscribe(accountData => {
            //console.log("escrow account changed received: " + xrplAccount);
            //console.log("test mode: " + this.testMode);
            if(accountData) {
                this.testMode = accountData.mode;
                this.loadEscrowList(accountData.account);
            }
            else
                this.escrowData = [];
        });
    }

    ngOnDestroy() {
        if(this.escrowAccountChangedSubscription)
          this.escrowAccountChangedSubscription.unsubscribe();
    }

    async loadEscrowList(xrplAccount: string) {
        if(xrplAccount) {
            this.loading = true;

            let account_objects_request:any = {
              command: "account_objects",
              account: xrplAccount,
              type: "escrow",
              ledger_index: "validated",
            }
      
            let message:any = await this.xrplWebSocket.getWebsocketMessage(account_objects_request, this.testMode);
            this.handleWebsocketMessage(message);
            this.googleAnalytics.analyticsEventEmitter('load_escrow_list', 'escrow_list', 'escrow_list_component');
        } else {
            this.escrowData = [];
        }
    }

    getTimeFromRippleTime(rippleCodedFinishAfter: number): string {
        if(rippleCodedFinishAfter) {
            let finishAfter:Date = new Date(normalizer.rippleEpocheTimeToUTC(rippleCodedFinishAfter));
            return finishAfter.toLocaleString();
        } else
            return "-";
    }

    getAmountInXRP(amount: string): Number {
        return Number.parseInt(amount) / 1000000;
    }

    async escrowSelected(escrow: any) {
        if(this.isCancel || this.isFinish) {
            //console.log("escrow selected: " + JSON.stringify(escrow));

            let txInfo:any = {
                command: "tx",
                transaction: escrow.PreviousTxnID,
            }

            let message:any = await this.xrplWebSocket.getWebsocketMessage(txInfo, this.testMode);

            this.handleWebsocketMessage(message);
            this.googleAnalytics.analyticsEventEmitter('escrow_list_selected', 'escrow_list', 'escrow_list_component');
        }
    }

    handleWebsocketMessage(message) {
        if(message && message.status && message.status === 'success' && message.type && message.type === 'response') {
            if(message.result && message.result.account_objects) {
                let unfilteredList:any[] = message.result.account_objects;
                if(this.isCancel)
                    this.escrowData = unfilteredList.filter(escrow => escrow.CancelAfter && (new Date(normalizer.rippleEpocheTimeToUTC(escrow.CancelAfter)).getTime() < Date.now()));
                else if(this.isFinish)
                    this.escrowData = unfilteredList.filter(escrow => ((!escrow.FinishAfter && escrow.Condition) || (escrow.FinishAfter && new Date(normalizer.rippleEpocheTimeToUTC(escrow.FinishAfter)).getTime() < Date.now())) && (!escrow.CancelAfter || new Date(normalizer.rippleEpocheTimeToUTC(escrow.CancelAfter)).getTime() > Date.now()));
                else
                    this.escrowData = unfilteredList;
                    
                //if data 0 (no available escrows) -> show message "no escrows available"
                if(this.escrowData.length == 0)
                    this.escrowData = null;
                else {
                    this.escrowData = this.escrowData.sort((escrow1, escrow2) => {
                        if(escrow1.FinishAfter && escrow2.FinishAfter)
                            return escrow1.FinishAfter - escrow2.FinishAfter;
                        else if(escrow1.CancelAfter - escrow2.CancelAfter)
                            return escrow1.CancelAfter - escrow2.CancelAfter;
                        else return 1;
                    });
                }

            
                  
              this.loading = false;
            }
            else if(message.result && message.result.TransactionType === 'EscrowCreate') {
                //console.log("Sequence: " + message.result.Sequence);
                this.escrowSequenceFound.emit({owner: message.result.Account, sequence: message.result.Sequence, condition: message.result.Condition});
                this.escrowClicked = true;
                this.loading = false;
            }
              //console.log("xrplAccountData");
        } else {                
            this.escrowData = null;
            this.loading = false;
        }
    }
}