import { Component, OnInit, Input, Output, EventEmitter, OnDestroy } from "@angular/core";
import { Observable, Subscription } from 'rxjs';
import { GoogleAnalyticsService } from '../../services/google-analytics.service';
import * as util from '../../utils/flagutils';
import { AccountInfoChanged, TrustLine } from 'src/app/utils/types';
import { XRPLWebsocket } from '../../services/xrplWebSocket';

@Component({
    selector: "trustlineList",
    templateUrl: "trustlineList.html",
    styleUrls: ['./trustlineList.css']
})
export class TrustLineList implements OnInit, OnDestroy {

    @Input()
    xrplAccountInfoChanged: Observable<AccountInfoChanged>;

    @Output()
    trustLineEdit: EventEmitter<TrustLine> = new EventEmitter();

    @Output()
    trustLineDelete: EventEmitter<TrustLine> = new EventEmitter();

    @Output()
    disableRippling: EventEmitter<TrustLine> = new EventEmitter();
    
    trustLines:TrustLine[] = [];
    displayedColumns: string[] = ['currency', 'account','balance', 'limit', 'limit_peer', 'no_ripple', 'actions'];
    loading:boolean = false;
    testMode:boolean = false;
    originalTestModeValue:boolean = false;
    trustlineClicked:boolean = false;

    account_Info:any = null;

    private trustLineAccountChangedSubscription: Subscription;

    constructor(private xrplWebSocket: XRPLWebsocket, private googleAnalytics: GoogleAnalyticsService) {}

    ngOnInit() {
        this.trustLineAccountChangedSubscription = this.xrplAccountInfoChanged.subscribe(account => {
            //console.log("trustline account changed received: " + xrplAccount);
            //console.log("test mode: " + this.testMode);
            this.account_Info = account.info;
            this.testMode = account.mode;
            
            if(this.account_Info && this.account_Info.Account) {
                this.loadTrustLineList(this.account_Info.Account);
            } else
                this.trustLines = [];
        });
    }

    ngOnDestroy() {
        if(this.trustLineAccountChangedSubscription)
          this.trustLineAccountChangedSubscription.unsubscribe();
    }

    async loadTrustLineList(xrplAccount: string) {
        this.googleAnalytics.analyticsEventEmitter('load_trustline_list', 'trustline_list', 'trustline_list_component');

        //console.log("load trustlines");

        if(xrplAccount) {
            this.loading = true;

            let account_lines_request:any = {
              command: "account_lines",
              account: xrplAccount,
              ledger_index: "validated",
            }

            let message:any = await this.xrplWebSocket.getWebsocketMessage("trustlineList", account_lines_request, this.testMode);

            if(message.status && message.status === 'success' && message.type && message.type === 'response' && message.result && message.result.lines) {
                this.trustLines = message.result.lines;

                if(this.trustLines && this.trustLines.length > 0)
                    this.trustLines = this.trustLines.sort((lineA, lineB) => lineA.currency.localeCompare(lineB.currency));
            
                //if data 0 (no available trustlines) -> show message "no trustlines available"
                if(this.trustLines && this.trustLines.length == 0)
                    this.trustLines = null;
                    
                this.loading = false;
            } else {                
              this.trustLines = null;
              this.loading = false;
            }
        }
    }

    editTrustline(trustLine: TrustLine) {
        this.googleAnalytics.analyticsEventEmitter('trustline_edit', 'trustline_list', 'trustline_list_component');
        //console.log("trustline selected: " + JSON.stringify(trustline));
        this.trustLineEdit.emit(trustLine);
    }

    deleteTrustLine(trustLine: TrustLine) {
        if(trustLine.balance === "0") {
            this.googleAnalytics.analyticsEventEmitter('trustline_delete', 'trustline_list', 'trustline_list_component');
            //console.log("trustline selected: " + JSON.stringify(trustline));
            this.trustLineDelete.emit(trustLine);
        }
    }

    accountHasDefaultRipple(): boolean {
        return this.account_Info && util.isDefaultRippleEnabled(this.account_Info.Flags);
    }

    setNoRippleFlag(trustLine: TrustLine) {
        this.googleAnalytics.analyticsEventEmitter('setNoRippleFlag', 'trustline_list', 'trustline_list_component');
        //console.log("trustline selected: " + JSON.stringify(trustline));
        this.disableRippling.emit(trustLine);
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