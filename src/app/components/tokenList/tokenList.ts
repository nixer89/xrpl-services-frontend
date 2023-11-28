import { Component, OnInit, Input, Output, EventEmitter, OnDestroy } from "@angular/core";
import { Observable, Subscription } from 'rxjs';
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
    testMode:boolean = false;
    originalIsserAccount:string;
    originalTestModeValue:boolean = false;
    tokenClicked:boolean = false;

    private tokenAccountChangedSubscription: Subscription;

    constructor(private xrplWebSocket: XRPLWebsocket, private app: AppService) {}

    ngOnInit() {
        this.tokenAccountChangedSubscription = this.issuerAccountChanged.subscribe(accountData => {
            //console.log("token account changed received: " + JSON.stringify(accountData));
            
            if(accountData.account) {
                this.originalIsserAccount = accountData.account;
                this.testMode = accountData.mode;
                
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
                
                if(!this.testMode) {

                    let xrpscanResponse:any = await this.app.get("https://api.xahscan.com/api/v1/account/"+xrplAccount+"/obligations?origin=https://xahau.services")

                    if(xrpscanResponse && xrpscanResponse.length > 0) {
                        for(let i = 0; i < xrpscanResponse.length; i++) {
                            this.tokenList.push({currency: xrpscanResponse[i].currency, amount: xrpscanResponse[i].value});
                        }

                        if(this.tokenList.length > 1)
                            this.tokenList = this.tokenList.sort((tokenA, tokenB) => this.getCurrencyCode(tokenA.currency).localeCompare(this.getCurrencyCode(tokenB.currency)));

                        //if data 0 (no available tokens) -> show message "no tokens available"
                        if(this.tokenList && this.tokenList.length == 0)
                            this.tokenList = null;

                    } else {                
                        this.tokenList = null;
                    }
                } else {
                    let gateway_balances_request:any = {
                        command: "gateway_balances",
                        account: xrplAccount,
                        ledger_index: "validated",
                      }
                
                      let message:any = await this.xrplWebSocket.getWebsocketMessage("tokenList", gateway_balances_request, this.testMode);

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
                    } else {                
                      this.tokenList = null;
                    }
                }
            } catch(err) {
                console.log(err);
            }

            this.loading = false; 
        }
    }

    tokenSelected(token: Token) {
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