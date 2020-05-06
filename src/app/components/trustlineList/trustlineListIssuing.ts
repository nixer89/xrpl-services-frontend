import { Component, OnInit, Input, Output, EventEmitter, OnDestroy } from "@angular/core";
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { Observable, Subscription } from 'rxjs';
import { GoogleAnalyticsService } from '../../services/google-analytics.service';
import { XrplAccountChanged } from 'src/app/utils/types';

interface TrustLine {
    account:string,
    balance: string,
    currency: string,
    limit: string,
    limit_peer: string,
    no_ripple: boolean
}

@Component({
    selector: "trustlineListIssuing",
    templateUrl: "trustlineListIssuing.html",
    styleUrls: ['./trustlineListIssuing.css']
})
export class TrustLineListIssuing implements OnInit, OnDestroy {

    @Input()
    issuerAccountChanged: Observable<XrplAccountChanged>;

    @Input()
    recipientAccountChanged: Observable<XrplAccountChanged>

    @Output()
    trustLineSelected: EventEmitter<TrustLine> = new EventEmitter();
    
    websocket: WebSocketSubject<any>;
    trustLines:TrustLine[] = [];
    displayedColumns: string[] = ['currency', 'account','balance', 'limit', 'info'];
    loading:boolean = false;
    testMode:boolean = false;
    originalTestModeValue:boolean = false;

    issuerAccount:string = null;
    recipientAccount:string = null;

    recipientAccountNotFound:boolean = false;

    private recipientAccountChangedSubscription: Subscription;
    private issuerAccountChangedSubscription: Subscription;

    constructor(private googleAnalytics: GoogleAnalyticsService) {}

    ngOnInit() {
        this.recipientAccountChangedSubscription = this.recipientAccountChanged.subscribe(recipientAccountInfo => {
            //console.log("trustline account changed received: " + xrplAccount);
            //console.log("test mode: " + this.testMode);
            this.recipientAccount = recipientAccountInfo.account;
            this.testMode = recipientAccountInfo.mode;
            
            if(this.recipientAccount && this.issuerAccount)
                this.loadTrustLineList(this.recipientAccount);
            else
                this.trustLines = [];
        });

        this.issuerAccountChangedSubscription = this.issuerAccountChanged.subscribe(isserAccountInfo => {
            //console.log("trustline account changed received: " + xrplAccount);
            //console.log("test mode: " + this.testMode);
            this.issuerAccount = isserAccountInfo.account;
            this.testMode = isserAccountInfo.mode;
            
            if(this.recipientAccount && this.issuerAccount)
                this.loadTrustLineList(this.recipientAccount);
            else
                this.trustLines = [];
        });
    }

    ngOnDestroy() {
        if(this.issuerAccountChangedSubscription)
          this.issuerAccountChangedSubscription.unsubscribe();

        if(this.recipientAccountChangedSubscription)
          this.recipientAccountChangedSubscription.unsubscribe();

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
            console.log("trustline message: " + JSON.stringify(message));
            if(message.status && message.status === 'success' && message.type && message.type === 'response' && message.result && message.result.lines) {
                this.trustLines = message.result.lines;

                if(this.trustLines && this.trustLines.length > 0)
                    this.trustLines = this.trustLines.sort((lineA, lineB) => lineA.currency.localeCompare(lineB.currency));
            
                //if data 0 (no available trustlines) -> show message "no trustlines available"
                if(this.trustLines && this.trustLines.length == 0)
                    this.trustLines = null;
                    
                this.loading = false;
            } else if(message.status && message.status === 'error' && message.error === 'actNotFound') {
                this.trustLines = null;
                this.recipientAccountNotFound = true;
                this.loading = false;
            } else {                
              this.trustLines = null;
              this.loading = false;
            }
        });
    }

    loadTrustLineList(xrplAccount: string) {
        this.googleAnalytics.analyticsEventEmitter('load_trustline_list_issuing', 'trustline_list', 'trustline_list_component');

        if(this.websocket && this.originalTestModeValue != this.testMode) {
            this.websocket.unsubscribe();
            this.websocket.complete();
            this.websocket = null;
        }

        if(!this.websocket || this.websocket.closed)
            this.setupWebsocket();

        if(xrplAccount) {
            this.loading = true;

            this.recipientAccountNotFound = false;

            let account_lines_request:any = {
              command: "account_lines",
              account: xrplAccount,
              ledger_index: "validated",
              peer: this.issuerAccount
            }
      
            this.websocket.next(account_lines_request);
        }
    }

    selectTrustLine(trustLine: TrustLine) {
        this.trustLineSelected.next(trustLine);
    }

    stringToFloat(number: string): number {
        return parseFloat(number);
    }
}