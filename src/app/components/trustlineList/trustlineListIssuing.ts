import { Component, OnInit, Input, Output, EventEmitter, OnDestroy } from "@angular/core";
import { Observable, Subscription } from 'rxjs';
import { GoogleAnalyticsService } from '../../services/google-analytics.service';
import { XrplAccountChanged } from 'src/app/utils/types';
import { XRPLWebsocket } from '../../services/xrplWebSocket';

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

    constructor(private xrplWebSocket: XRPLWebsocket, private googleAnalytics: GoogleAnalyticsService) {}

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
    }

    async loadTrustLineList(xrplAccount: string) {
        this.googleAnalytics.analyticsEventEmitter('load_trustline_list_issuing', 'trustline_list_issuing', 'trustline_list_issuing_component');

        if(xrplAccount) {
            this.loading = true;

            this.recipientAccountNotFound = false;

            let account_lines_request:any = {
              command: "account_lines",
              account: xrplAccount,
              ledger_index: "validated",
              peer: this.issuerAccount
            }

            let message:any = await this.xrplWebSocket.getWebsocketMessage(account_lines_request, this.testMode);
      
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
        }
    }

    selectTrustLine(trustLine: TrustLine) {
        this.trustLineSelected.next(trustLine);
    }

    stringToFloat(number: string): number {
        return parseFloat(number);
    }

    getCurrencyCode(currency: string): string {
        if(currency) {
            if(currency.length == 40)
                //hex to ascii
                return Buffer.from(currency, 'hex').toString('ascii').trim();
            else
                return currency;
        } else
            return ""
    }
}