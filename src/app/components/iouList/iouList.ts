import { Component, OnInit, Input, Output, EventEmitter, OnDestroy } from "@angular/core";
import { Observable, Subscription } from 'rxjs';
import { GoogleAnalyticsService } from '../../services/google-analytics.service';
import { XrplAccountChanged, IOU } from 'src/app/utils/types';
import { XRPLWebsocket } from '../../services/xrplWebSocket';
import * as normalizer from 'src/app/utils/normalizers';

@Component({
    selector: "iouList",
    templateUrl: "iouList.html",
    styleUrls: ['./iouList.css']
})
export class IouList implements OnInit, OnDestroy {

    @Input()
    issuerAccountChanged: Observable<XrplAccountChanged>;

    @Output()
    issuerCurrencySelected: EventEmitter<IOU> = new EventEmitter();
    
    iouList:IOU[] = [];
    displayedColumns: string[] = ['currency', 'amount'];
    loading:boolean = false;
    testMode:boolean = false;
    originalIsserAccount:string;
    originalTestModeValue:boolean = false;
    iouClicked:boolean = false;

    private iouAccountChangedSubscription: Subscription;

    constructor(private xrplWebSocket: XRPLWebsocket, private googleAnalytics: GoogleAnalyticsService) {}

    ngOnInit() {
        this.iouAccountChangedSubscription = this.issuerAccountChanged.subscribe(accountData => {
            //console.log("iou account changed received: " + JSON.stringify(accountData));
            
            if(accountData.account) {
                this.originalIsserAccount = accountData.account;
                this.testMode = accountData.mode;
                
                this.loadIOUList(this.originalIsserAccount);
            }   
            else
                this.iouList = [];
        });
    }

    ngOnDestroy() {
        if(this.iouAccountChangedSubscription)
          this.iouAccountChangedSubscription.unsubscribe();
    }

    async loadIOUList(xrplAccount: string) {
        //console.log("loading IOU list for: " + xrplAccount);
        this.googleAnalytics.analyticsEventEmitter('load_iou_list', 'iou_list', 'iou_list_component');

        if(xrplAccount) {
            this.loading = true;

            let gateway_balances_request:any = {
              command: "gateway_balances",
              account: xrplAccount,
              ledger_index: "validated",
            }
      
            let message:any = await this.xrplWebSocket.getWebsocketMessage("iouList", gateway_balances_request, this.testMode);

            if(message && message.status && message.status === 'success' && message.type && message.type === 'response' && message.result && message.result.obligations) {
                this.iouList = [];
                let obligations:any = message.result.obligations;
                
                if(obligations) {
                    for (var currency in obligations) {
                        if (obligations.hasOwnProperty(currency)) {
                            this.iouList.push({currency: currency, amount: obligations[currency]});
                        }
                    }

                    this.iouList = this.iouList.sort((iouA, iouB) => this.getCurrencyCode(iouA.currency).localeCompare(this.getCurrencyCode(iouB.currency)));
                }
            
                //if data 0 (no available ious) -> show message "no ious available"
                if(this.iouList && this.iouList.length == 0)
                    this.iouList = null;
                    
                //console.log(JSON.stringify(this.iouList));
                this.loading = false;
            } else {                
              this.iouList = null;
              this.loading = false;
            }
        }
    }

    iouSelected(iou: IOU) {
        this.googleAnalytics.analyticsEventEmitter('iou_list_selected', 'iou_list', 'iou_list_component');
        //console.log("iou selected: " + JSON.stringify(iou));
        this.issuerCurrencySelected.emit(iou)
    }

    stringToFloat(number: string): number {
        return parseFloat(number);
    }

    getCurrencyCode(currency: string): string {
        return normalizer.currencyCodeHexToAsciiTrimmed(currency);
    }
}