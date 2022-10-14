import { Component, OnInit, Input, Output, EventEmitter, OnDestroy } from "@angular/core";
import { Observable, Subscription } from 'rxjs';
import { GoogleAnalyticsService } from '../../services/google-analytics.service';
import { XrplAccountChanged, Token } from 'src/app/utils/types';
import * as normalizer from 'src/app/utils/normalizers';
import { AppService } from "src/app/services/app.service";
import { XRPLWebsocket } from "src/app/services/xrplWebSocket";

@Component({
    selector: "tokenList",
    templateUrl: "tokenList.html",
    styleUrls: ['./tokenList.css']
})
export class TokenList implements OnInit, OnDestroy {

    @Input()
    issuerAccountChanged: Observable<XrplAccountChanged>;

    @Output()
    issuerCurrencySelected: EventEmitter<Token> = new EventEmitter();
    
    tokenList:Token[] = [];
    displayedColumns: string[] = ['currency', 'amount'];
    loading:boolean = false;
    nodeUrl:string;
    originalIsserAccount:string;
    originalTestModeValue:boolean = false;
    tokenClicked:boolean = false;

    private tokenAccountChangedSubscription: Subscription;

    constructor(private xrplWebSocket: XRPLWebsocket, private app: AppService, private googleAnalytics: GoogleAnalyticsService) {}

    ngOnInit() {
        this.tokenAccountChangedSubscription = this.issuerAccountChanged.subscribe(accountData => {
            //console.log("token account changed received: " + JSON.stringify(accountData));
            
            if(accountData.account) {
                this.originalIsserAccount = accountData.account;
                this.nodeUrl = accountData.nodeUrl;
                
                this.loadTokenList(this.originalIsserAccount);
            }   
            else {
                this.originalIsserAccount = null;
                this.tokenList = [];
            }
        });
    }

    ngOnDestroy() {
        if(this.tokenAccountChangedSubscription)
          this.tokenAccountChangedSubscription.unsubscribe();
    }

    async loadTokenList(xrplAccount: string) {
        //console.log("loading Token list for: " + xrplAccount);

        if(xrplAccount) {
            this.loading = true;

            try {

                this.tokenList = [];
                
                
                let gateway_balances_request:any = {
                    command: "gateway_balances",
                    account: xrplAccount,
                    ledger_index: "validated",
                    }
            
                    let message:any = await this.xrplWebSocket.getWebsocketMessage("tokenList", gateway_balances_request, this.nodeUrl);

                    if(message && message.status && message.status === 'success' && message.type && message.type === 'response' && message.result && message.result.obligations) {
                    this.tokenList = [];
                    let obligations:any = message.result.obligations;
                    
                    if(obligations) {
                        for (var currency in obligations) {
                            if (obligations.hasOwnProperty(currency)) {
                                this.tokenList.push({currency: currency, amount: obligations[currency]});
                            }
                        }

                        this.tokenList = this.tokenList.sort((tokenA, tokenB) => this.getCurrencyCode(tokenA.currency).localeCompare(this.getCurrencyCode(tokenB.currency)));
                    }
                                
                    //if data 0 (no available tokens) -> show message "no tokens available"
                    if(this.tokenList && this.tokenList.length == 0)
                        this.tokenList = null;
                
                    //console.log(JSON.stringify(this.tokenList));
                    this.googleAnalytics.analyticsEventEmitter('load_token_list', 'token_list', 'token_list_component');
                } else {                
                    this.tokenList = null;
                }
            } catch(err) {
                console.log(err);
            }

            this.loading = false; 
        }
    }

    tokenSelected(token: Token) {
        this.googleAnalytics.analyticsEventEmitter('token_list_selected', 'token_list', 'token_list_component');
        //console.log("token selected: " + JSON.stringify(token));
        this.issuerCurrencySelected.emit(token)
    }

    stringToFloat(number: string): number {
        return parseFloat(number);
    }

    getCurrencyCode(currency: string): string {
        return normalizer.normalizeCurrencyCodeXummImpl(currency);
    }
}