import { Component, OnInit, Input, Output, EventEmitter, OnDestroy, ViewChild, AfterViewInit } from "@angular/core";
import { Observable, Subscription } from 'rxjs';
import { GoogleAnalyticsService } from '../../services/google-analytics.service';
import { AccountObjectsChanged, XrplAccountChanged } from 'src/app/utils/types';
import { XRPLWebsocket } from '../../services/xrplWebSocket';
import * as normalizer from '../../utils/normalizers';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from "@angular/material/table";

@Component({
    selector: "escrowList",
    templateUrl: "escrowList.html",
    styleUrls: ['./escrowList.css']
})
export class EscrowList implements OnInit, OnDestroy {

    @Input()
    escrowAccountChanged: Observable<XrplAccountChanged>;

    @Input()
    escrowsChanged: Observable<AccountObjectsChanged>;

    @Input()
    isFinish: boolean;

    @Input()
    isCancel: boolean;

    @Output()
    escrowSequenceFound: EventEmitter<any> = new EventEmitter();

    @ViewChild(MatPaginator, {static: true}) paginator: MatPaginator;
    
    escrowData:any[] = [];
    displayedColumns: string[] = ['destination', 'amount', 'finishafter', 'cancelafter', 'condition'];
    loading:boolean = false;
    nodeUrl:string;
    escrowClicked:boolean = false;

    uniqueIdentifier:string = Math.random() +"";

    private escrowAccountChangedSubscription: Subscription;
    private escrowsChangedSubscription: Subscription;

    datasource:MatTableDataSource<any> = null;

    constructor(private xrplWebSocket: XRPLWebsocket, private googleAnalytics: GoogleAnalyticsService) {}

    ngOnInit() {

        this.uniqueIdentifier = Math.random() +"";
        this.escrowAccountChangedSubscription = this.escrowAccountChanged.subscribe(async accountData => {            
            //console.log("escrow account changed received: " + xrplAccount);
            //console.log("test mode: " + this.testMode);
            if(accountData) {
                this.nodeUrl = accountData.nodeUrl;
            }

            if(accountData && accountData.account) {
                this.loading = true;
            }
        });

        this.escrowsChangedSubscription = this.escrowsChanged.subscribe(escrowObjects => {
            //console.log("escrow account changed received: " + xrplAccount);
            //console.log("test mode: " + this.testMode);

            this.loading = true;

            if(escrowObjects && escrowObjects.objects) {
                //console.log("length: " + escrowObjects.objects.length + " | " + this.isCancel + " | " + this.isFinish);
                this.nodeUrl = escrowObjects.nodeUrl;

                //no escrows delivered. set empty list
                if(!escrowObjects.objects)
                    escrowObjects.objects = [];
                
                let unfilteredList:any[] = escrowObjects.objects;
                let filteredList:any[] = [];

                //console.time("filter: " + escrowObjects.objects.length + " | " + this.isCancel + " | " + this.isFinish)
                if(this.isCancel) {
                    filteredList = unfilteredList.filter(escrow => escrow.CancelAfter && (new Date(normalizer.rippleEpocheTimeToUTC(escrow.CancelAfter)).getTime() < Date.now()));
                } else if(this.isFinish) {
                    filteredList = unfilteredList.filter(escrow => ((!escrow.FinishAfter && escrow.Condition) || (escrow.FinishAfter && new Date(normalizer.rippleEpocheTimeToUTC(escrow.FinishAfter)).getTime() < Date.now())) && (!escrow.CancelAfter || new Date(normalizer.rippleEpocheTimeToUTC(escrow.CancelAfter)).getTime() > Date.now()));
                } else {
                    filteredList = unfilteredList;
                }
                //console.timeEnd("filter: " + escrowObjects.objects.length + " | " + this.isCancel + " | " + this.isFinish)

                if(this.escrowData) {
                    this.escrowData = this.escrowData.concat(filteredList);
                } else {
                    this.escrowData = filteredList;
                }
                    
                //if data 0 (no available escrows) -> show message "no escrows available"
                if(this.escrowData.length == 0)
                    this.escrowData = null;
                else {
                    //console.time("sort: " + escrowObjects.objects.length + " | " + this.isCancel + " | " + this.isFinish)
                    this.escrowData = this.escrowData.sort((escrow1, escrow2) => {
                        if(escrow1.FinishAfter && escrow2.FinishAfter)
                            return escrow1.FinishAfter - escrow2.FinishAfter;
                        else if(escrow1.CancelAfter - escrow2.CancelAfter)
                            return escrow1.CancelAfter - escrow2.CancelAfter;
                        else return 1;
                    });
                    //console.timeEnd("sort: " + escrowObjects.objects.length + " | " + this.isCancel + " | " + this.isFinish)
                }
                
            }
            else {
                this.escrowData = [];
            }

            this.datasource = new MatTableDataSource(this.escrowData);

            if(this.escrowData && this.escrowData.length > 0)
                this.datasource.paginator = this.paginator

            this.loading = false;
        });
    }

    ngOnDestroy() {
        if(this.escrowAccountChangedSubscription)
          this.escrowAccountChangedSubscription.unsubscribe();

        if(this.escrowsChangedSubscription)
          this.escrowsChangedSubscription.unsubscribe();
    }

    getTimeFromRippleTime(rippleCodedFinishAfter: number): string {
        if(rippleCodedFinishAfter) {
            let finishAfter:Date = new Date(normalizer.rippleEpocheTimeToUTC(rippleCodedFinishAfter));
            return finishAfter.toLocaleString();
        } else
            return "-";
    }

    getAmountInXRP(amount: string): Number {
        return Number.parseInt(amount) / 1000000;
    }

    async escrowSelected(escrow: any) {
        if(this.isCancel || this.isFinish) {
            //console.log("escrow selected: " + JSON.stringify(escrow));

            let txInfo:any = {
                command: "tx",
                transaction: escrow.PreviousTxnID,
            }

            let message:any = await this.xrplWebSocket.getWebsocketMessage("escrowList"+this.uniqueIdentifier, txInfo, this.nodeUrl);

            this.handleWebsocketMessage(message);
            this.googleAnalytics.analyticsEventEmitter('escrow_list_selected', 'escrow_list', 'escrow_list_component');
        }
    }

    handleWebsocketMessage(message) {
        if(message && message.status && message.status === 'success' && message.type && message.type === 'response') {
            if(message.result && message.result.TransactionType === 'EscrowCreate') {
                //console.log("Sequence: " + message.result.Sequence);
                this.escrowSequenceFound.emit({owner: message.result.Account, sequence: message.result.Sequence, condition: message.result.Condition});
                this.escrowClicked = true;
                this.loading = false;
            }
              //console.log("xrplAccountData");
        } else {                
            this.escrowData = null;
            this.loading = false;
        }
    }
}