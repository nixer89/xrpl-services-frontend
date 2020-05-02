import { Component, OnInit, Input, Output, EventEmitter, OnDestroy } from "@angular/core";
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { Observable, Subscription } from 'rxjs';
import { GoogleAnalyticsService } from '../../services/google-analytics.service';
import * as util from '../../utils/flagutils';
import { AccountInfoChanged } from 'src/app/utils/types';

interface TrustLine {
    account:string,
    balance: string,
    currency: string,
    limit: string,
    limit_peer: string,
    no_ripple: boolean
}

@Component({
    selector: "trustlineList",
    templateUrl: "trustlineList.html",
    styleUrls: ['./trustlineList.css']
})
export class TrustLineList implements OnInit, OnDestroy {

    @Input()
    xrplAccountInfoChanged: Observable<AccountInfoChanged>;

    @Output()
    trustLineEdit: EventEmitter<any> = new EventEmitter();

    @Output()
    trustLineDelete: EventEmitter<any> = new EventEmitter();

    @Output()
    disableRippling: EventEmitter<any> = new EventEmitter();
    
    websocket: WebSocketSubject<any>;
    trustLines:TrustLine[] = [];
    displayedColumns: string[] = ['currency', 'account','balance', 'limit', 'limit_peer', 'no_ripple', 'actions'];
    loading:boolean = false;
    testMode:boolean = false;
    originalTestModeValue:boolean = false;
    trustlineClicked:boolean = false;

    account_Info:any = null;

    private trustLineAccountChangedSubscription: Subscription;

    constructor(private googleAnalytics: GoogleAnalyticsService) {}

    ngOnInit() {
        this.trustLineAccountChangedSubscription = this.xrplAccountInfoChanged.subscribe(account_Info => {
            //console.log("trustline account changed received: " + xrplAccount);
            //console.log("test mode: " + this.testMode);
            this.account_Info = account_Info.info;
            this.testMode = account_Info.mode;
            
            if(this.account_Info && this.account_Info.Account)
                this.loadTrustLineList(this.account_Info.Account);
            else
                this.trustLines = [];
        });
    }

    ngOnDestroy() {
        if(this.trustLineAccountChangedSubscription)
          this.trustLineAccountChangedSubscription.unsubscribe();

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
            if(message.status && message.status === 'success' && message.type && message.type === 'response' && message.result && message.result.lines) {
                this.trustLines = message.result.lines;

                if(this.trustLines && this.trustLines.length > 0)
                    this.trustLines = this.trustLines.sort((lineA, lineB) => lineA.currency.localeCompare(lineB.currency));
            
                //if data 0 (no available trustlines) -> show message "no trustlines available"
                if(this.trustLines && this.trustLines.length == 0)
                    this.trustLines = null;
                    
                console.log(JSON.stringify(this.trustLines));
                delete this.trustLines[0].no_ripple;
                this.loading = false;
                console.log("trustLines: " + JSON.stringify(this.trustLines));
            } else {                
              this.trustLines = null;
              this.loading = false;
            }
        });
    }

    loadTrustLineList(xrplAccount: string) {
        this.googleAnalytics.analyticsEventEmitter('load_trustline_list', 'trustline_list', 'trustline_list_component');

        if(this.websocket && this.originalTestModeValue != this.testMode) {
            this.websocket.unsubscribe();
            this.websocket.complete();
            this.websocket = null;
        }

        if(!this.websocket || this.websocket.closed)
            this.setupWebsocket();

        if(xrplAccount) {
            this.loading = true;

            let account_lines_request:any = {
              command: "account_lines",
              account: xrplAccount,
              ledger_index: "validated",
            }
      
            this.websocket.next(account_lines_request);
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
}