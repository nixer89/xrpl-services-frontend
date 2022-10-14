import { Component, OnInit, Input, Output, EventEmitter, OnDestroy } from "@angular/core";
import { Observable, Subscription } from 'rxjs';
import { GoogleAnalyticsService } from '../../services/google-analytics.service';
import { XrplAccountChanged, TrustLine } from 'src/app/utils/types';
import { XRPLWebsocket } from '../../services/xrplWebSocket';

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
    nodeUrl:string;
    originalTestModeValue:boolean = false;

    issuerAccount:string = null;
    recipientAccount:string = null;

    recipientAccountNotFound:boolean = false;

    private recipientAccountChangedSubscription: Subscription;
    private issuerAccountChangedSubscription: Subscription;

    constructor(private xrplWebSocket: XRPLWebsocket, private googleAnalytics: GoogleAnalyticsService) {}

    ngOnInit() {
        this.recipientAccountChangedSubscription = this.recipientAccountChanged.subscribe(recipientAccountInfo => {
            //console.log("recipientAccountChanged " + JSON.stringify(recipientAccountInfo));
            //console.log("test mode: " + recipientAccountInfo.mode);
            this.recipientAccount = recipientAccountInfo.account;
            this.nodeUrl = recipientAccountInfo.nodeUrl;
            
            if(this.recipientAccount && this.issuerAccount)
                this.loadTrustLineList(this.recipientAccount);
            else
                this.trustLines = [];
        });

        this.issuerAccountChangedSubscription = this.issuerAccountChanged.subscribe(isserAccountInfo => {
            //console.log("issuerAccountChanged: " + JSON.stringify(isserAccountInfo));
            //console.log("test mode: " + isserAccountInfo.mode);
            this.issuerAccount = isserAccountInfo.account;
            this.nodeUrl = isserAccountInfo.nodeUrl;
            
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

            let message:any = await this.xrplWebSocket.getWebsocketMessage("trustlineListIssuing", account_lines_request, this.nodeUrl);
      
            if(message.status && message.status === 'success' && message.type && message.type === 'response' && message.result && message.result.lines) {
                this.trustLines = message.result.lines;

                if(this.trustLines && this.trustLines.length > 0) {
                    this.trustLines = this.trustLines.sort((lineA, lineB) => lineA.currency.localeCompare(lineB.currency));
                    this.trustLines.forEach(trustline => {
                        trustline.balanceN = Number(trustline.balance);
                        trustline.limitN = Number(trustline.limit);
                    })
                }
            
                //if data 0 (no available trustlines) -> show message "no trustlines available"
                if(this.trustLines && this.trustLines.length == 0)
                    this.trustLines = null;
                    
                //console.log("Trust lines: " + JSON.stringify(this.trustLines));
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
            if(currency.length == 40) {
                while(currency.endsWith("00")) {
                    currency = currency.substring(0, currency.length-2);
                }
                //hex to ascii
                return Buffer.from(currency, 'hex').toString('ascii').trim();
            } else
                return currency;
        } else
            return ""
    }
}