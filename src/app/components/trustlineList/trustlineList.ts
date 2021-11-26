import { Component, OnInit, Input, Output, EventEmitter, OnDestroy, ViewChild } from "@angular/core";
import { Observable, Subscription } from 'rxjs';
import { GoogleAnalyticsService } from '../../services/google-analytics.service';
import * as util from '../../utils/flagutils';
import * as normalizer from 'src/app/utils/normalizers';
import { AccountInfoChanged, TrustLine } from 'src/app/utils/types';
import { XRPLWebsocket } from '../../services/xrplWebSocket';
import { MatTableDataSource } from "@angular/material/table";

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

    @Output()
    enableRippling: EventEmitter<TrustLine> = new EventEmitter();

    datasource:MatTableDataSource<TrustLine> = null;

    trustLines:TrustLine[] = [];
    displayedColumns: string[] = ['currency', 'account','balance', 'limit', 'limit_peer', 'no_ripple', 'actions'];
    loading:boolean = false;
    testMode:boolean = false;
    originalTestModeValue:boolean = false;
    originalAccount:string = null;
    trustlineClicked:boolean = false;

    account_Info:any = null;
    defaultRippleSet = null;

    private trustLineAccountChangedSubscription: Subscription;

    constructor(private xrplWebSocket: XRPLWebsocket, private googleAnalytics: GoogleAnalyticsService) {}

    ngOnInit() {
        this.trustLineAccountChangedSubscription = this.xrplAccountInfoChanged.subscribe(async account => {
            console.log("trustline account changed received: " + account);
            console.log("test mode: " + this.testMode);
            this.account_Info = account.info;
            this.defaultRippleSet = util.isDefaultRippleEnabled(this.account_Info.Flags);
            console.log("defaultRippleSet: " + this.defaultRippleSet);
            this.testMode = account.mode;
            
            if(this.account_Info && this.account_Info.Account) {
                this.originalAccount = this.account_Info.Account;
                await this.loadTrustLineList(this.account_Info.Account);
                this.loading = false;
            }

            console.log("finished all")
        });
    }

    ngOnDestroy() {
        if(this.trustLineAccountChangedSubscription)
          this.trustLineAccountChangedSubscription.unsubscribe();
    }

    async loadTrustLineList(xrplAccount: string): Promise<void> {
        this.googleAnalytics.analyticsEventEmitter('load_trustline_list', 'trustline_list', 'trustline_list_component');

        //console.log("load trustlines");

        if(xrplAccount) {
            this.loading = true;

            let marker:any = null;
            let ledger_hash:string = null;

            let account_lines_request:any = {
              command: "account_lines",
              account: xrplAccount,
              ledger_index: "validated",
              limit: 1000
            }

            let message:any = await this.xrplWebSocket.getWebsocketMessage("trustlineList", account_lines_request, this.testMode);

            if(message.status && message.status === 'success' && message.type && message.type === 'response' && message.result && message.result.lines) {
                this.trustLines = message.result.lines;
                marker = message.result.marker;
                ledger_hash = message.result.ledger_hash;

                if(this.trustLines && this.trustLines.length > 0) {
                    this.trustLines = this.trustLines.filter(trustline => trustline.limit === "0" && trustline.limit_peer === "0" &&
                        (
                            (this.defaultRippleSet && trustline.no_ripple) ||
                            (!this.defaultRippleSet && !trustline.no_ripple)
                        ));
                    this.trustLines = this.trustLines.sort((lineA, lineB) => lineA.currency.localeCompare(lineB.currency));
                }
            
                //if data 0 (no available trustlines) -> show message "no trustlines available"
                if(this.trustLines && this.trustLines.length == 0)
                    this.trustLines = [];
                else if(this.trustLines && this.trustLines.length > 5) {
                    marker = null;
                }

                
                while(marker != null) {
                    console.log("trustline length: " + this.trustLines.length);
                    let account_lines_request:any = {
                        command: "account_lines",
                        account: xrplAccount,
                        ledger_hash: ledger_hash,
                        marker: marker,
                        limit: 1000
                    }

                    let message2:any = await this.xrplWebSocket.getWebsocketMessage("trustlineList", account_lines_request, this.testMode);

                    console.log("new marker: " + message2.result.marker);

                    if(message2.status && message2.status === 'success' && message2.type && message2.type === 'response' && message2.result && message2.result.lines) {
                        this.trustLines = this.trustLines.concat(message2.result.lines);
                        marker = message2.result.marker;

                        console.log("sorting")
                        if(this.trustLines && this.trustLines.length > 0) {
                            this.trustLines = this.trustLines.filter(trustline => trustline.limit === "0" &&
                                (
                                    trustline.limit_peer === "0" ||
                                    (this.defaultRippleSet && trustline.no_ripple) ||
                                    (!this.defaultRippleSet && !trustline.no_ripple)
                                ));

                            this.trustLines = this.trustLines.sort((lineA, lineB) => lineA.currency.localeCompare(lineB.currency));
                        }

                        if(typeof marker != 'string' || this.trustLines.length > 5) {
                            console.log("TRUSLTINES BIGGER 100")
                            marker = null;
                            break;
                        }
                    }
                }
                

                this.trustLines = this.trustLines.slice(0, 5);
                
                console.log("sorting")
                if(this.trustLines && this.trustLines.length > 0) {
                    this.trustLines = this.trustLines.sort((lineA, lineB) => lineA.currency.localeCompare(lineB.currency));

                    this.trustLines = this.trustLines.filter(trustline =>  trustline.limit === "0");
                }

                
                console.log("sorting finished")

                this.datasource = new MatTableDataSource(this.trustLines);
                this.loading = false;
                console.log("datasource set")
                console.log("account trust lines: " + JSON.stringify(this.trustLines.length));
                
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
        if(!trustLine.no_ripple) {
            this.googleAnalytics.analyticsEventEmitter('setNoRippleFlag', 'trustline_list', 'trustline_list_component');
            //console.log("trustline selected: " + JSON.stringify(trustline));
            this.disableRippling.emit(trustLine);
        } else {
            this.googleAnalytics.analyticsEventEmitter('setNoRippleFlag', 'trustline_list', 'trustline_list_component');
            //console.log("trustline selected: " + JSON.stringify(trustline));
            this.enableRippling.emit(trustLine);
        }
    }

    stringToFloat(number: string): number {
        return parseFloat(number);
    }

    getCurrencyCode(currency: string): string {
        return normalizer.normalizeCurrencyCodeXummImpl(currency);
    }
}