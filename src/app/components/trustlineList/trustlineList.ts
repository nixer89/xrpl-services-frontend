import { Component, OnInit, Input, Output, EventEmitter, OnDestroy, ViewChild } from "@angular/core";
import { Observable, Subscription } from 'rxjs';
import { GoogleAnalyticsService } from '../../services/google-analytics.service';
import * as util from '../../utils/flagutils';
import * as normalizer from 'src/app/utils/normalizers';
import { AccountInfoChanged, AccountObjectsChanged, RippleState, SimpleTrustLine } from 'src/app/utils/types';
import { MatPaginator } from "@angular/material/paginator";
import { MatTableDataSource } from "@angular/material/table";

//RippleState Flags
const lsfLowReserve = 0x10000;
const lsfHighReserve = 0x20000;

const lsfLowFreeze = 0x400000;
const lsfHighFreeze = 0x800000;

const lsfLowNoRipple = 0x100000;
const lsfHighNoRipple = 0x200000;

@Component({
    selector: "trustlineList",
    templateUrl: "trustlineList.html",
    styleUrls: ['./trustlineList.css']
})
export class TrustLineList implements OnInit, OnDestroy {

    @Input()
    xrplAccountInfoChanged: Observable<AccountInfoChanged>;

    @Input()
    accountObjectsChanged: Observable<AccountObjectsChanged>;

    @Output()
    trustLineEdit: EventEmitter<SimpleTrustLine> = new EventEmitter();

    @Output()
    trustLineDelete: EventEmitter<SimpleTrustLine> = new EventEmitter();

    @Output()
    disableRippling: EventEmitter<SimpleTrustLine> = new EventEmitter();

    @ViewChild(MatPaginator, {static: true}) paginator: MatPaginator;

    existingAccountLines:RippleState[] = [];
    
    trustLines:SimpleTrustLine[] = [];
    displayedColumns: string[] = ['currency', 'account','balance', 'limit', 'limit_peer', 'no_ripple', 'actions'];
    loading:boolean = false;
    testMode:boolean = false;
    originalTestModeValue:boolean = false;
    trustlineClicked:boolean = false;

    account_Info:any = null;

    datasource:MatTableDataSource<SimpleTrustLine> = null;

    private trustLineAccountChangedSubscription: Subscription;
    private accountObjectsChangedSubscription: Subscription;

    constructor(private googleAnalytics: GoogleAnalyticsService) {}

    ngOnInit() {
        this.trustLineAccountChangedSubscription = this.xrplAccountInfoChanged.subscribe(account => {
            //console.log("trustline account changed received: " + xrplAccount);
            //console.log("test mode: " + this.testMode);
            this.account_Info = account.info;
            this.testMode = account.mode;
        });

        this.accountObjectsChangedSubscription = this.accountObjectsChanged.subscribe(trustlineObjects => {

            this.loading = true;
            if(trustlineObjects && trustlineObjects.objects) {

                this.testMode = trustlineObjects.mode;

                this.convertToSimpleTrustline(trustlineObjects.objects);            
            
                //if data 0 (no available trustlines) -> show message "no trustlines available"
                if(this.trustLines && this.trustLines.length == 0)
                    this.trustLines = null;
                    
                this.datasource = new MatTableDataSource(this.trustLines);

                if(this.trustLines && this.trustLines.length > 0)
                    this.datasource.paginator = this.paginator

                //console.log("account trust lines: " + JSON.stringify(this.trustLines));
                this.loading = false;
            } else {
                this.trustLines = [];
                this.datasource = new MatTableDataSource(this.trustLines);
            }

            this.loading = false;
        });
    }

    ngOnDestroy() {
        if(this.trustLineAccountChangedSubscription)
          this.trustLineAccountChangedSubscription.unsubscribe();

        if(this.accountObjectsChangedSubscription)
          this.accountObjectsChangedSubscription.unsubscribe();
    }

    convertToSimpleTrustline(existingAccountLines:any[]) {
    
        let newSimpleTrustlines:SimpleTrustLine[] = []
    
        if(existingAccountLines) {
            for(let i = 0; i < existingAccountLines.length; i++) {
            if(existingAccountLines[i] && this.countsTowardsReserve(existingAccountLines[i])) {
                let balance = Number(existingAccountLines[i].Balance.value);

                let lowIsIssuer = existingAccountLines[i].HighLimit.issuer === this.account_Info.Account
        
                let issuer:string = lowIsIssuer ? existingAccountLines[i].LowLimit.issuer : existingAccountLines[i].HighLimit.issuer;
                let currency = existingAccountLines[i].Balance.currency;
                let currencyShow = normalizer.normalizeCurrencyCodeXummImpl(currency);
                let noRipple = this.hasNoRipple(existingAccountLines[i]);

                let limit:string = lowIsIssuer ? existingAccountLines[i].HighLimit.value : existingAccountLines[i].LowLimit.value

                let limitPeer:string = lowIsIssuer ? existingAccountLines[i].LowLimit.value : existingAccountLines[i].HighLimit.value
        
                if(balance < 0)
                    balance = balance * -1;
        
                let balanceShow = normalizer.normalizeBalance(balance);
                let isFrozen = this.isFrozen(existingAccountLines[i]);
        
                newSimpleTrustlines.push({account: issuer, currency: currency, currencyN: currencyShow, balance: balance, balanceN: balanceShow, isFrozen: isFrozen, limit: limit, limit_peer: limitPeer, no_ripple: noRipple});
            }
            }
        
            if(newSimpleTrustlines?.length > 0) {
                newSimpleTrustlines = newSimpleTrustlines.sort((a,b) => {
                    return a.currencyN.localeCompare(b.currencyN);
                });
            }
        }
    
        this.trustLines = newSimpleTrustlines;
    }

    countsTowardsReserve(line: RippleState): boolean {
        const reserveFlag = this.account_Info && line.HighLimit.issuer === this.account_Info.Account ? lsfHighReserve : lsfLowReserve;
        return line.Flags && (line.Flags & reserveFlag) == reserveFlag;
    }

    isFrozen(line: RippleState): boolean {
        const freezeFlag = line.HighLimit.issuer === this.account_Info.Account ? lsfLowFreeze : lsfHighFreeze;
        return line.Flags && (line.Flags & freezeFlag) == freezeFlag;
    }

    hasNoRipple(line: RippleState): boolean {
        const noRippleFlag = line.HighLimit.issuer === this.account_Info.Account ? lsfHighNoRipple : lsfLowNoRipple;
        return line.Flags && (line.Flags & noRippleFlag) == noRippleFlag;
    }

    editTrustline(trustLine: SimpleTrustLine) {
        this.googleAnalytics.analyticsEventEmitter('trustline_edit', 'trustline_list', 'trustline_list_component');
        //console.log("trustline selected: " + JSON.stringify(trustline));
        this.trustLineEdit.emit(trustLine);
    }

    deleteTrustLine(trustLine: SimpleTrustLine) {
        if(trustLine.balance === 0) {
            this.googleAnalytics.analyticsEventEmitter('trustline_delete', 'trustline_list', 'trustline_list_component');
            //console.log("trustline selected: " + JSON.stringify(trustline));
            this.trustLineDelete.emit(trustLine);
        }
    }

    accountHasDefaultRipple(): boolean {
        return this.account_Info && util.isDefaultRippleEnabled(this.account_Info.Flags);
    }

    setNoRippleFlag(trustLine: SimpleTrustLine) {
        if(!trustLine.no_ripple) {
            this.googleAnalytics.analyticsEventEmitter('setNoRippleFlag', 'trustline_list', 'trustline_list_component');
            //console.log("trustline selected: " + JSON.stringify(trustline));
            this.disableRippling.emit(trustLine);
        }
    }

    stringToFloat(number: string): number {
        return parseFloat(number);
    }
}