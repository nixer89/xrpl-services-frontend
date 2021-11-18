import { Component, OnInit, Input, Output, EventEmitter, OnDestroy } from "@angular/core";
import { Observable, Subscription } from 'rxjs';
import { GoogleAnalyticsService } from '../../services/google-analytics.service';
import { XrplAccountChanged, Token } from 'src/app/utils/types';
import * as normalizer from 'src/app/utils/normalizers';
import { AppService } from "src/app/services/app.service";

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

    constructor(private app: AppService, private googleAnalytics: GoogleAnalyticsService) {}

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

                let xrpscanResponse:any = await this.app.get("https://api.xrpscan.com/api/v1/account/"+xrplAccount+"/obligations?origin=https://xumm.community")

                if(xrpscanResponse && xrpscanResponse.length > 0) {
                    for(let i = 0; i < xrpscanResponse.length; i++) {
                        this.tokenList.push({currency: xrpscanResponse[i].currency, amount: xrpscanResponse[i].value});
                    }

                    if(this.tokenList.length > 1)
                        this.tokenList = this.tokenList.sort((tokenA, tokenB) => this.getCurrencyCode(tokenA.currency).localeCompare(this.getCurrencyCode(tokenB.currency)));

                    //if data 0 (no available tokens) -> show message "no tokens available"
                    if(this.tokenList && this.tokenList.length == 0)
                        this.tokenList = null;

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