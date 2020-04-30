import { Component, OnInit, Input, Output, EventEmitter, OnDestroy } from "@angular/core";
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { Observable, Subscription } from 'rxjs';
import { GoogleAnalyticsService } from '../../services/google-analytics.service';

@Component({
    selector: "escrowList",
    templateUrl: "escrowList.html",
    styleUrls: ['./escrowList.css']
})
export class EscrowList implements OnInit, OnDestroy {

    @Input()
    escrowAccountChanged: Observable<string>;

    @Input()
    testMode: boolean;

    @Input()
    isCancel: boolean;

    @Output()
    escrowSequenceFound: EventEmitter<any> = new EventEmitter();
    
    websocket: WebSocketSubject<any>;
    escrowData:any[] = [];
    displayedColumns: string[] = ['destination', 'amount', 'finishafter', 'cancelafter', 'condition'];
    loading:boolean = false;
    originalTestModeValue:boolean;
    escrowClicked:boolean = false;

    private escrowAccountChangedSubscription: Subscription;

    constructor(private googleAnalytics: GoogleAnalyticsService) {}

    ngOnInit() {
        this.escrowAccountChangedSubscription = this.escrowAccountChanged.subscribe(xrplAccount => {
            //console.log("escrow account changed received: " + xrplAccount);
            //console.log("test mode: " + this.testMode);
            if(xrplAccount)
                this.loadEscrowList(xrplAccount);
            else
                this.escrowData = [];
        });
    }

    ngOnDestroy() {
        if(this.escrowAccountChangedSubscription)
          this.escrowAccountChangedSubscription.unsubscribe();

        if(this.websocket) {
            this.websocket.unsubscribe();
            this.websocket.complete();
        }
    }

    setupWebsocket() {
        this.originalTestModeValue = this.testMode;
        //console.log("connecting websocket");
        this.websocket = webSocket(this.testMode ? 'wss://testnet.xrpl-labs.com' : 'wss://xrpl.ws');

        this.websocket.asObservable().subscribe(async message => {
            //console.log("websocket message: " + JSON.stringify(message));
            if(message.status && message.status === 'success' && message.type && message.type === 'response') {
              if(message.result && message.result.account_objects) {
                  let unfilteredList:any[] = message.result.account_objects;
                  if(this.isCancel)
                      this.escrowData = unfilteredList.filter(escrow => escrow.CancelAfter && (new Date((escrow.CancelAfter+946684800)*1000).getTime() < Date.now()));
                  else
                    this.escrowData = unfilteredList.filter(escrow => ((!escrow.FinishAfter && escrow.Condition) || (escrow.FinishAfter && new Date((escrow.FinishAfter+946684800)*1000).getTime() < Date.now())) && (!escrow.CancelAfter || new Date((escrow.CancelAfter+946684800)*1000).getTime() > Date.now()));
                
                //if data 0 (no available escrows) -> show message "no escrows available"
                if(this.escrowData.length == 0)
                    this.escrowData = null;
                    
                this.loading = false;
              }
              else if(message.result && message.result.TransactionType === 'EscrowCreate') {
                  console.log("Sequence: " + message.result.Sequence);
                  this.escrowSequenceFound.emit({owner: message.result.Account, sequence: message.result.Sequence, condition: message.result.Condition});
                  this.escrowClicked = true;
                  this.loading = false;
              }
                //console.log("xrplAccountData");
            } else {                
              this.escrowData = null;
              this.loading = false;
            }
        });
    }

    loadEscrowList(xrplAccount: string) {
        this.googleAnalytics.analyticsEventEmitter('load_escrow_list', 'escrow_list', 'escrow_list_component');

        if(this.websocket && this.originalTestModeValue != this.testMode) {
            this.websocket.unsubscribe();
            this.websocket.complete();
            this.websocket = null;
        }

        if(!this.websocket || this.websocket.closed)
            this.setupWebsocket();

        if(xrplAccount) {
            this.loading = true;

            let account_objects_request:any = {
              command: "account_objects",
              account: xrplAccount,
              type: "escrow",
              ledger_index: "validated",
            }
      
            this.websocket.next(account_objects_request);
        }
    }

    getTimeFromRippleTime(rippleCodedFinishAfter: number): string {
        if(rippleCodedFinishAfter) {
            let finishAfter:Date = new Date((rippleCodedFinishAfter+946684800)*1000);
            return finishAfter.toLocaleString();
        } else
            return "-";
    }

    getAmountInXRP(amount: string): Number {
        return Number.parseInt(amount) / 1000000;
    }

    escrowSelected(escrow: any) {
        this.googleAnalytics.analyticsEventEmitter('escrow_list_selected', 'escrow_list', 'escrow_list_component');
        console.log("escrow selected: " + JSON.stringify(escrow));

        if(this.websocket && this.originalTestModeValue != this.testMode) {
            this.websocket.unsubscribe();
            this.websocket.complete();
            this.websocket = null;
        }

        if(!this.websocket || this.websocket.closed)
            this.setupWebsocket();

        let txInfo:any = {
            command: "tx",
            transaction: escrow.PreviousTxnID,
        }

        this.websocket.next(txInfo);
    }
}